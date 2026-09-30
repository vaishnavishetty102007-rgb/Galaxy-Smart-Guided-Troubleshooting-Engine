/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Programmatic Schema & Rule Validator
 * Enforces Zero URL Leaks, Action Ordering Hierarchy, Exact Word Counts & Catalog Integrity
 */

import { Goal, Action, ActionCategory } from '../types/schema.js';
import catalogData from '../data/deeplinks.json' with { type: 'json' };

const VALID_CATALOG_URIS = new Set<string>([
  'bixby://dummy_positive',
  ...catalogData.map((item: { deeplink: string }) => item.deeplink)
]);

// URL patterns strictly prohibited
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|\[.*?\]\(https?:\/\/[^\s]+\)|[a-zA-Z0-9-]+\.(com|org|net|io|co|kr|samsung)[\/\w.-]*)/gi;

/**
 * Strips all prohibited web URLs, www links, markdown links from arbitrary text
 */
export function scrubUrls(text: string): { cleaned: string; leaksDetected: number } {
  if (!text) return { cleaned: '', leaksDetected: 0 };
  let leaks = 0;
  const matches = text.match(URL_REGEX);
  if (matches) {
    leaks = matches.length;
  }
  
  // Clean markdown links [text](http://...) -> text
  let cleaned = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Clean raw URLs
  cleaned = cleaned.replace(URL_REGEX, '');
  // Clean dangling artifacts
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  
  return { cleaned, leaksDetected: leaks };
}

/**
 * Normalizes action description to strictly 5 to 7 words starting with "It will"
 * Section 4.1: "Exactly 5 to 7 words, starting with 'It will', explaining the concrete benefit in plain language."
 */
export function enforceDescriptionSyntax(description: string, fallbackTopic = 'settings'): string {
  let cleaned = scrubUrls(description || '').cleaned.trim();
  
  // Remove trailing period for counting
  cleaned = cleaned.replace(/\.+$/, '');
  
  let words = cleaned.split(/\s+/).filter(Boolean);
  
  // Ensure starts with "It will"
  if (words.length < 2 || words[0].toLowerCase() !== 'it' || words[1].toLowerCase() !== 'will') {
    // If it started with "This will" or "Will" or other
    if (words[0]?.toLowerCase() === 'will') {
      words.unshift('It');
    } else if (words[0]?.toLowerCase() === 'this' && words[1]?.toLowerCase() === 'will') {
      words[0] = 'It';
    } else {
      words = ['It', 'will', ...words];
    }
  }

  // Capitalize "It"
  words[0] = 'It';
  words[1] = 'will';

  // If words < 5, pad with meaningful context words
  if (words.length < 5) {
    const pads = ['resolve', 'the', fallbackTopic, 'issue', 'cleanly'];
    let padIdx = 0;
    while (words.length < 6 && padIdx < pads.length) {
      if (!words.includes(pads[padIdx])) {
        words.push(pads[padIdx]);
      }
      padIdx++;
    }
  }

  // If words > 7, trim to 6 or 7 words
  if (words.length > 7) {
    words = words.slice(0, 7);
  }

  return words.join(' ');
}

/**
 * Normalizes title to 2 to 3 words, sentence case
 * Section 4.1: "2 to 3 words, sentence case, identifying the core issue"
 */
export function enforceTitleSyntax(title: string, fallback = 'Device settings'): string {
  let cleaned = scrubUrls(title || fallback).cleaned.trim();
  let words = cleaned.split(/\s+/).filter(Boolean);
  
  if (words.length < 2) {
    words.push('settings');
  } else if (words.length > 3) {
    words = words.slice(0, 3);
  }

  // Sentence case: Capitalize first word, lowercase others unless acronym
  return words.map((w, idx) => {
    if (idx === 0) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }
    // keep acronyms like RAM, UI, Wi-Fi uppercase if already
    if (w.length <= 3 && w === w.toUpperCase()) return w;
    return w.toLowerCase();
  }).join(' ');
}

/**
 * Normalizes goal to exact syntax:
 * "Follow these steps to perform this <Topic> Troubleshooting" (or Configuration)
 */
export function enforceGoalSyntax(goal: string, topic = 'Device'): string {
  let cleaned = scrubUrls(goal || '').cleaned.trim();
  const pattern = /^Follow these steps to perform this (.+?) (Troubleshooting|Configuration)$/i;
  const match = cleaned.match(pattern);
  if (match) {
    // Preserve topic with proper casing
    const capturedTopic = match[1].trim();
    const type = match[2].toLowerCase().includes('config') ? 'Configuration' : 'Troubleshooting';
    return `Follow these steps to perform this ${capturedTopic} ${type}`;
  }

  // If not adhering, synthesize exact syntax
  const cleanTopic = topic.replace(/Troubleshooting|Configuration/gi, '').trim() || 'Device';
  return `Follow these steps to perform this ${cleanTopic} Troubleshooting`;
}

/**
 * Action Ordering Hierarchy (Section 2 Phase 2 & Section 6.2):
 * Sequence: non-invasive settings first (auto) -> manual interventions (manual) -> critical/destructive last (critical)
 */
const CATEGORY_PRIORITY: Record<ActionCategory, number> = {
  auto: 1,
  manual: 2,
  critical: 3
};

export function sortActionsByHierarchy(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const catA: ActionCategory = a.category || 'auto';
    const catB: ActionCategory = b.category || 'auto';
    return (CATEGORY_PRIORITY[catA] || 1) - (CATEGORY_PRIORITY[catB] || 1);
  });
}

/**
 * Validates and scrubs an entire Goal structure against all rules
 */
export function validateAndCleanGoal(goal: Goal): {
  cleanedGoal: Goal;
  violationsFixed: string[];
  totalLeaksScrubbed: number;
} {
  const violationsFixed: string[] = [];
  let totalLeaksScrubbed = 0;

  // 1. Scrub and format Title
  const cleanTitle = enforceTitleSyntax(goal.title);
  if (cleanTitle !== goal.title) {
    violationsFixed.push(`Normalized title '${goal.title}' -> '${cleanTitle}' (2-3 words, sentence case)`);
  }

  // 2. Scrub and format Goal
  const cleanGoal = enforceGoalSyntax(goal.goal, cleanTitle);
  if (cleanGoal !== goal.goal) {
    violationsFixed.push(`Enforced goal syntax format -> '${cleanGoal}'`);
  }

  // 3. Process Actions
  let processedActions: Action[] = (goal.actions || []).map((action) => {
    // Check Action Name
    const actionNameClean = scrubUrls(action.actionName || 'Settings Action');
    totalLeaksScrubbed += actionNameClean.leaksDetected;

    // Check Description: 5 to 7 words, starts with "It will"
    const validDescription = enforceDescriptionSyntax(action.description, cleanTitle);
    if (validDescription !== action.description) {
      violationsFixed.push(`Enforced description '${action.description}' -> '${validDescription}' (5-7 words, starts with 'It will')`);
    }

    // Category & Risk Level determination
    let category: ActionCategory = action.category || 'auto';
    let riskLevel: 'safe' | 'caution' | 'destructive' = 'safe';
    let requiresConfirmation = false;

    const actionLower = actionNameClean.cleaned.toLowerCase();
    if (
      actionLower.includes('restart') ||
      actionLower.includes('reboot') ||
      actionLower.includes('factory reset') ||
      actionLower.includes('wipe') ||
      actionLower.includes('safe mode')
    ) {
      category = 'critical';
      riskLevel = actionLower.includes('reset') || actionLower.includes('wipe') ? 'destructive' : 'caution';
      requiresConfirmation = true;
    } else if (
      actionLower.includes('clean') && (actionLower.includes('lens') || actionLower.includes('port') || actionLower.includes('cloth')) ||
      actionLower.includes('replace') ||
      actionLower.includes('hardware') ||
      actionLower.includes('service center')
    ) {
      category = 'manual';
      riskLevel = 'safe';
    } else if (actionLower.includes('reset network') || actionLower.includes('clear camera cache') || actionLower.includes('clear storage')) {
      riskLevel = 'caution';
      requiresConfirmation = true;
    }

    // StepGroups
    const stepGroups = (action.stepGroups || []).map((group) => {
      const scrubbedSteps: string[] = [];
      for (const step of group.steps || []) {
        const scrubbed = scrubUrls(step);
        totalLeaksScrubbed += scrubbed.leaksDetected;
        if (scrubbed.cleaned) {
          scrubbedSteps.push(scrubbed.cleaned);
        }
      }

      // Check Deeplink Catalog Integrity (Section 4.2: zero hallucination)
      let actionableDeeplink = group.actionableDeeplink;
      if (category === 'manual') {
        // Section 4.1: Manual cannot carry actionable deeplink
        if (actionableDeeplink) {
          violationsFixed.push(`Removed actionableDeeplink from manual physical action '${actionNameClean.cleaned}'`);
          actionableDeeplink = null;
        }
      } else if (actionableDeeplink?.deeplink) {
        if (!VALID_CATALOG_URIS.has(actionableDeeplink.deeplink)) {
          violationsFixed.push(`Unknown deeplink URI '${actionableDeeplink.deeplink}' replaced with 'bixby://dummy_positive'`);
          actionableDeeplink = {
            ...actionableDeeplink,
            deeplink: 'bixby://dummy_positive'
          };
        }
      }

      return {
        ...group,
        steps: scrubbedSteps.length > 0 ? scrubbedSteps : ['Open settings and verify configuration.'],
        actionableDeeplink: actionableDeeplink || null,
        validationDeeplink: group.validationDeeplink || null
      };
    });

    return {
      actionName: actionNameClean.cleaned,
      description: validDescription,
      category,
      riskLevel,
      requiresConfirmation,
      stepGroups
    };
  });

  // 4. Order actions by hierarchy (auto -> manual -> critical)
  const sortedActions = sortActionsByHierarchy(processedActions);
  if (JSON.stringify(sortedActions.map(a => a.category)) !== JSON.stringify(processedActions.map(a => a.category))) {
    violationsFixed.push('Reordered actions to ensure safe toggles precede critical operations');
  }

  // 5. Score clamp
  const score = Math.max(0.0, Math.min(1.0, goal.score ?? 0.92));

  return {
    cleanedGoal: {
      goal: cleanGoal,
      title: cleanTitle,
      score: Number(score.toFixed(2)),
      actions: sortedActions
    },
    violationsFixed,
    totalLeaksScrubbed
  };
}
