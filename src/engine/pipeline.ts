/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Samsung Electronics Smart Guided Troubleshooting Engine
 * Core Pipeline Implementation: Query Understanding -> Fast Cache -> Extraction -> Deeplink Mapping -> Validation
 */

import { GoogleGenAI } from '@google/genai';
import {
  Goal,
  TroubleshootRequest,
  TroubleshootResponse,
  PipelineExecutionTrace,
  ActionCategory,
  HumanEscalationNote,
  DeviceContext
} from '../types/schema.js';
import { semanticCache } from './cache.js';
import { matchDeeplink } from './matcher.js';
import { validateAndCleanGoal, scrubUrls } from './validator.js';
import { 
  understandQuery, 
  GEMINI_MODEL, 
  checkOfflinePromptInjection,
  isGeminiRateLimited,
  setGeminiRateLimited
} from './understand.js';
import queriesData from '../data/queries.json' with { type: 'json' };
import siisData from '../data/siis_responses.json' with { type: 'json' };

const siisResponses: Record<string, string> = siisData;

/**
 * Domain-specific One UI knowledge bases for grounded fallback
 */
const DOMAIN_KNOWLEDGE: Record<string, string> = {
  Audio: "Navigate to Settings. Tap Sounds and vibration. Tap Sound mode and ensure Sound is selected rather than Mute or Vibrate. Tap Volume and adjust Media and Ringtone sliders. Tap Sound quality and effects and toggle on Dolby Atmos. For Bluetooth speakers or earbuds, tap Separate app sound to configure audio routing. Clean speaker grilles with a soft dry brush.",
  Storage: "Navigate to Settings. Tap Battery and device care. Tap Storage. Review available internal storage and tap Trash to empty deleted items from Gallery and Messages. Tap Unused apps to uninstall heavy background apps. Tap Clean now to reclaim space.",
  Battery: "Navigate to Settings. Tap Battery and device care. Tap Battery. Turn on Power saving if battery is critically low. Tap Background usage limits and toggle on Put unused apps to sleep. Tap More battery settings and enable Fast charging. Clean USB-C port with a soft non-conductive pick.",
  Display: "Navigate to Settings. Tap Display. Tap Motion smoothness and choose Standard 60Hz or Adaptive 120Hz. Tap Navigation bar to configure preferred Swipe gestures or Buttons. Toggle on Touch sensitivity if using a screen protector.",
  Camera: "Open Camera app. Tap Camera Settings gear in upper corner. Turn on Scene optimizer for enhanced detail. Inspect lens surface and clean with microfiber cloth. Scroll to bottom and tap Reset settings to restore camera defaults.",
  Performance: "Navigate to Settings. Tap Battery and device care. Tap Memory. Tap Clean now to clear background processes. Tap RAM Plus to adjust virtual memory. Tap Software update and download latest One UI version. If lag persists, reboot device into Safe mode.",
  Network: "Navigate to Settings. Tap Connections. Tap Wi-Fi and verify network frequency. Tap Bluetooth to pair or unpair audio accessories. If disconnects persist, tap General management, tap Reset, and select Reset network settings.",
  Apps: "Navigate to Settings. Tap Apps. Select misbehaving application. Tap Storage and tap Clear cache. Tap Permissions to verify required runtime access.",
  Safety: "Navigate to Settings. Tap Security and privacy. Tap Auto Blocker and toggle on protection against unauthorized installations and USB malware. Tap App security and run Device protection scan.",
  System: "Navigate to Settings. Tap Software update to verify One UI firmware. Tap General management, tap Reset, and restart the device to reload system caches cleanly."
};

/**
 * Generate 8-10 diverse paraphrase variations across linguistic registers
 */
function generateParaphrases(canonicalQuery: string, domain: string): string[] {
  const clean = canonicalQuery.trim();
  return [
    `Experiencing persistent ${clean.toLowerCase()} across One UI operations.`,
    `My Samsung Galaxy phone has an issue: ${clean}.`,
    `${clean.toLowerCase().replace(/[^a-z0-9 ]/g, '')}`,
    `Why is my phone doing this? ${clean} is causing trouble!`,
    `How do I troubleshoot ${clean} in device settings?`,
    `Reported symptom where ${clean.toLowerCase()} occurs on Galaxy device.`,
    `Please help resolve ${clean} on One UI.`,
    `Samsung customer service inquiry regarding ${clean}.`,
    `${clean.toLowerCase()} error and settings configuration.`,
    `Device care diagnostic request for ${domain} symptom ${clean.toLowerCase()}.`
  ];
}

/**
 * Grounded fallback extractor when Gemini is unreachable or for offline evaluation
 */
function extractFromKnowledge(
  query: string,
  knowledgeText: string,
  domain: string,
  deviceContext?: DeviceContext
): Goal {
  const sentences = knowledgeText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const cleanQuery = scrubUrls(query).cleaned;

  let title = 'Device settings';
  if (domain === 'Battery') title = 'Battery fast drain';
  else if (domain === 'Audio') title = 'Speaker sound issue';
  else if (domain === 'Storage') title = 'Device storage full';
  else if (domain === 'Display' && cleanQuery.toLowerCase().includes('swipe')) title = 'Swipe navigation settings';
  else if (domain === 'Display' && cleanQuery.toLowerCase().includes('touch')) title = 'Touch sensitivity issues';
  else if (domain === 'Display') title = 'Display flicker settings';
  else if (domain === 'Camera') title = 'Camera focus blur';
  else if (domain === 'Performance') title = 'Device performance lag';
  else if (domain === 'Network') title = 'Network connection issue';
  else if (domain === 'Safety') title = 'Device security protection';

  const autoSteps: string[] = [];
  const manualSteps: string[] = [];
  const criticalSteps: string[] = [];

  for (const sentence of sentences) {
    const sLower = sentence.toLowerCase();
    if (sLower.includes('restart') || sLower.includes('safe mode') || sLower.includes('reset network') || sLower.includes('factory reset')) {
      criticalSteps.push(sentence);
    } else if (sLower.includes('clean with') || sLower.includes('microfiber') || sLower.includes('cloth') || sLower.includes('debris') || sLower.includes('pick') || sLower.includes('lens')) {
      manualSteps.push(sentence);
    } else {
      autoSteps.push(sentence);
    }
  }

  const actions = [];

  if (autoSteps.length > 0) {
    const primarySteps = autoSteps.slice(0, 3);
    const secondarySteps = autoSteps.slice(3);

    actions.push({
      actionName: `Configure ${domain} Settings`,
      description: `It will adjust ${domain.toLowerCase()} settings and preferences`,
      category: 'auto' as ActionCategory,
      riskLevel: 'safe' as const,
      requiresConfirmation: false,
      stepGroups: [
        {
          steps: primarySteps,
          actionableDeeplink: null,
          validationDeeplink: null
        }
      ]
    });

    if (secondarySteps.length > 0) {
      actions.push({
        actionName: `Optimize Advanced ${domain} Preferences`,
        description: `It will optimize background ${domain.toLowerCase()} behavior`,
        category: 'auto' as ActionCategory,
        riskLevel: 'safe' as const,
        requiresConfirmation: false,
        stepGroups: [
          {
            steps: secondarySteps,
            actionableDeeplink: null,
            validationDeeplink: null
          }
        ]
      });
    }
  }

  if (manualSteps.length > 0) {
    actions.push({
      actionName: 'Perform Physical Hardware Cleaning',
      description: 'It will ensure clear hardware component contact',
      category: 'manual' as ActionCategory,
      riskLevel: 'safe' as const,
      requiresConfirmation: false,
      stepGroups: [
        {
          steps: manualSteps,
          actionableDeeplink: null,
          validationDeeplink: null
        }
      ]
    });
  }

  if (criticalSteps.length > 0) {
    const isDestructive = criticalSteps.some(s => s.toLowerCase().includes('factory') || s.toLowerCase().includes('wipe'));
    actions.push({
      actionName: isDestructive ? 'Execute Factory System Reset' : 'Reboot System Diagnostic Environment',
      description: 'It will reboot system caches and software',
      category: 'critical' as ActionCategory,
      riskLevel: isDestructive ? ('destructive' as const) : ('caution' as const),
      requiresConfirmation: true,
      stepGroups: [
        {
          steps: criticalSteps,
          actionableDeeplink: null,
          validationDeeplink: null
        }
      ]
    });
  }

  return {
    goal: `Follow these steps to perform this ${title} Troubleshooting`,
    title,
    score: 0.92,
    actions
  };
}

/**
 * LLM-powered extraction with Gemini
 */
async function extractWithGemini(
  query: string,
  knowledgeText: string | undefined,
  domain: string,
  deviceContext?: DeviceContext,
  imageSummary?: string
): Promise<Goal> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || isGeminiRateLimited()) {
    return extractFromKnowledge(query, knowledgeText || DOMAIN_KNOWLEDGE[domain] || DOMAIN_KNOWLEDGE.System, domain, deviceContext);
  }

  try {
    const ai = new GoogleGenAI();
    const deviceStr = deviceContext ? `${deviceContext.model} (${deviceContext.oneUiVersion})` : 'Samsung Galaxy One UI 6.1';

    const prompt = `You are the Samsung Electronics Smart Guided Troubleshooting Engine extractor.
Target Device: ${deviceStr}
Customer Complaint: "${query}"
Domain: ${domain}
${imageSummary ? `Screenshot Analysis: ${imageSummary}` : ''}
One UI Knowledge Reference: "${knowledgeText || DOMAIN_KNOWLEDGE[domain] || DOMAIN_KNOWLEDGE.System}"

Generate a structured troubleshooting plan following these strict specification rules:
1. Goal syntax: MUST be exactly "Follow these steps to perform this <Topic> Troubleshooting"
2. Title: EXACTLY 2 to 3 words, sentence case (e.g. "Battery fast drain", "Speaker sound issue", "Swipe navigation settings").
3. Each Action represents EXACTLY ONE physical screen or feature ("One Action = One Screen").
4. Description: EXACTLY 5 to 7 words, STARTING WITH "It will" (e.g. "It will adjust audio volume and profile").
5. Category: "auto" for settings screens, "manual" for physical actions (cleaning/replacing), "critical" for restart/safe mode/reset.
6. Order: Safe auto actions FIRST, manual steps SECOND, critical/destructive actions LAST.
7. ABSOLUTE PROHIBITION of web URLs (zero http, https, www, or markdown links).
8. Manual actions MUST NOT have actionable deeplinks.
9. Discrete UI steps: 2 to 4 imperative steps per action ("Navigate to...", "Tap on...", "Toggle...").

Return ONLY valid JSON matching this schema:
{
  "goal": "Follow these steps to perform this <Topic> Troubleshooting",
  "title": "<2-3 words>",
  "score": 0.95,
  "actions": [
    {
      "actionName": "<Screen Name in Title Case>",
      "description": "It will <3 to 5 more words>",
      "category": "auto" | "manual" | "critical",
      "riskLevel": "safe" | "caution" | "destructive",
      "requiresConfirmation": boolean,
      "stepGroups": [
        {
          "steps": ["<step 1>", "<step 2>"]
        }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text) as Goal;
    return parsed;
  } catch (err: unknown) {
    const errObj = err as { status?: string; message?: string };
    if (errObj?.status === 'RESOURCE_EXHAUSTED' || errObj?.message?.includes('429') || errObj?.message?.includes('Quota exceeded')) {
      setGeminiRateLimited(60);
      console.info('[Galaxy Engine] Gemini quota reached, using grounded One UI domain knowledge.');
    }
    return extractFromKnowledge(query, knowledgeText || DOMAIN_KNOWLEDGE[domain] || DOMAIN_KNOWLEDGE.System, domain, deviceContext);
  }
}

/**
 * Main Troubleshooting Pipeline
 */
export async function runTroubleshootPipeline(
  req: TroubleshootRequest,
  options: { forceCold?: boolean } = {}
): Promise<{
  response: TroubleshootResponse;
  trace: PipelineExecutionTrace;
}> {
  const pipelineStart = performance.now();
  const violationsFixed: string[] = [];
  let totalScrubbed = 0;

  // 1. Prompt Injection Protection Guardrail (Instant offline check)
  if (checkOfflinePromptInjection(req.query)) {
    const refusalGoal: Goal = {
      goal: 'Follow these steps to perform this Security Guardrail Troubleshooting',
      title: 'Security policy protection',
      score: 1.0,
      actions: [
        {
          actionName: 'Enforce Samsung System Security Policy',
          description: 'It will protect device firmware from manipulation',
          category: 'auto' as ActionCategory,
          riskLevel: 'safe',
          requiresConfirmation: false,
          stepGroups: [
            {
              steps: [
                'Refusal notice: Request was identified as a prompt-injection or system instruction override attempt.',
                'The Guided Troubleshooting Engine only executes approved Galaxy support remediation paths.',
                'Return to the main support menu and describe a valid hardware or One UI system symptom.'
              ],
              actionableDeeplink: {
                deeplink: 'bixby://masked/act/com.samsung.android.sm/auto_blocker',
                description: 'Open verified Galaxy system security settings',
                message: 'view device security and auto blocker'
              },
              validationDeeplink: null
            }
          ]
        }
      ]
    };

    const totalLatency = Math.max(1, Math.round(performance.now() - pipelineStart));

    return {
      response: {
        query: req.query,
        query_variations: ['Security guardrail override attempt prevented.'],
        response: {
          contexts: [refusalGoal]
        },
        meta: {
          latency_ms: totalLatency,
          cache_hit: false,
          model: 'rule-guardrail',
          cost_usd: 0.0,
          prompt_injection_blocked: true,
          trace_id: `trace_injection_${Date.now()}`
        }
      },
      trace: {
        query: req.query,
        normalizedQuery: 'prompt_injection_blocked',
        detectedDomain: 'Safety',
        queryVariations: [],
        cacheHit: false,
        cacheKey: 'sec_block',
        stageTimings: {
          queryEnrichmentMs: 1,
          cacheLookupMs: 1,
          totalMs: totalLatency
        },
        matchedDeeplinks: [],
        scrubbedUrlsCount: 0,
        ruleViolationsFixed: ['Blocked prompt injection payload']
      }
    };
  }

  // 2. Fast-Path Semantic Cache Check (sub-300ms SLA without LLM round-trip)
  if (!options.forceCold && !req.image_base64 && !req.clarification_answers) {
    const fastLookup = semanticCache.lookup(req.query);
    if (fastLookup.hit && fastLookup.entry) {
      const totalLatency = Math.max(1, Math.round(performance.now() - pipelineStart));
      const firstDeeplink = fastLookup.entry.responseContext[0]?.actions[0]?.stepGroups[0]?.actionableDeeplink?.deeplink || 'bixby://dummy_positive';
      const deviceCtx: DeviceContext = {
        model: req.device_context?.model || 'Samsung Galaxy S24 Ultra',
        oneUiVersion: req.device_context?.oneUiVersion || 'One UI 6.1',
        androidVersion: req.device_context?.androidVersion || 'Android 14'
      };

      return {
        response: {
          query: req.query,
          query_variations: fastLookup.entry.variations,
          response: {
            contexts: fastLookup.entry.responseContext,
            qrPayloadUrl: `intent://${firstDeeplink}#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end`
          },
          meta: {
            latency_ms: totalLatency,
            cache_hit: true,
            similarity_score: fastLookup.similarityScore || 0.98,
            model: GEMINI_MODEL,
            cost_usd: 0.0,
            detected_language: 'English',
            device_context: deviceCtx,
            trace_id: `trace_cache_${Date.now()}`
          }
        },
        trace: {
          query: req.query,
          normalizedQuery: fastLookup.entry.canonicalQuery,
          detectedDomain: fastLookup.entry.domain || 'System',
          queryVariations: fastLookup.entry.variations,
          cacheHit: true,
          cacheKey: fastLookup.entry.key,
          stageTimings: {
            queryEnrichmentMs: 0,
            cacheLookupMs: fastLookup.latencyMs,
            totalMs: totalLatency
          },
          matchedDeeplinks: [],
          scrubbedUrlsCount: 0,
          ruleViolationsFixed: []
        }
      };
    }
  }

  // 3. Multilingual Understanding & Triage
  const understandStart = performance.now();
  const understandRes = await understandQuery(req.query, req.image_base64);
  const understandMs = Math.max(1, Math.round(performance.now() - understandStart));

  // Double-check if understand detected prompt injection
  if (understandRes.is_prompt_injection) {
    const refusalGoal: Goal = {
      goal: 'Follow these steps to perform this Security Guardrail Troubleshooting',
      title: 'Security policy protection',
      score: 1.0,
      actions: [
        {
          actionName: 'Enforce Samsung System Security Policy',
          description: 'It will protect device firmware from manipulation',
          category: 'auto' as ActionCategory,
          riskLevel: 'safe',
          requiresConfirmation: false,
          stepGroups: [
            {
              steps: [
                'Refusal notice: Request was identified as a prompt-injection or system instruction override attempt.',
                'The Guided Troubleshooting Engine only executes approved Galaxy support remediation paths.',
                'Return to the main support menu and describe a valid hardware or One UI system symptom.'
              ],
              actionableDeeplink: {
                deeplink: 'bixby://masked/act/com.samsung.android.sm/auto_blocker',
                description: 'Open verified Galaxy system security settings',
                message: 'view device security and auto blocker'
              },
              validationDeeplink: null
            }
          ]
        }
      ]
    };

    const totalLatency = Math.max(1, Math.round(performance.now() - pipelineStart));

    return {
      response: {
        query: req.query,
        query_variations: ['Security guardrail override attempt prevented.'],
        response: {
          contexts: [refusalGoal]
        },
        meta: {
          latency_ms: totalLatency,
          cache_hit: false,
          model: 'rule-guardrail',
          cost_usd: 0.0,
          prompt_injection_blocked: true,
          trace_id: `trace_injection_${Date.now()}`
        }
      },
      trace: {
        query: req.query,
        normalizedQuery: 'prompt_injection_blocked',
        detectedDomain: 'Safety',
        queryVariations: [],
        cacheHit: false,
        cacheKey: 'sec_block',
        stageTimings: {
          queryEnrichmentMs: understandMs,
          cacheLookupMs: 1,
          totalMs: totalLatency
        },
        matchedDeeplinks: [],
        scrubbedUrlsCount: 0,
        ruleViolationsFixed: ['Blocked prompt injection payload']
      }
    };
  }

  // 3. Multi-turn Clarifying Questions Check
  const hasAnswers = req.clarification_answers && Object.keys(req.clarification_answers).length > 0;
  if (understandRes.is_vague && !hasAnswers && understandRes.clarifying_questions.length > 0) {
    const totalLatency = Math.max(1, Math.round(performance.now() - pipelineStart));
    return {
      response: {
        query: req.query,
        query_variations: ['Clarification required for ambiguous input.'],
        response: {
          contexts: [],
          clarificationNeeded: true,
          clarifyingQuestions: understandRes.clarifying_questions
        },
        meta: {
          latency_ms: totalLatency,
          cache_hit: false,
          model: 'rule-clarifier',
          cost_usd: 0.0,
          detected_language: understandRes.language_name,
          trace_id: `trace_clarify_${Date.now()}`
        }
      },
      trace: {
        query: req.query,
        normalizedQuery: understandRes.english_query,
        detectedDomain: understandRes.domain,
        queryVariations: [],
        cacheHit: false,
        cacheKey: 'clarify_needed',
        stageTimings: {
          queryEnrichmentMs: understandMs,
          cacheLookupMs: 1,
          totalMs: totalLatency
        },
        matchedDeeplinks: [],
        scrubbedUrlsCount: 0,
        ruleViolationsFixed: ['Generated multi-turn clarifying questions']
      }
    };
  }

  // Incorporate clarification answers if user provided them
  let workingQuery = understandRes.english_query;
  if (req.clarification_answers) {
    const answersText = Object.values(req.clarification_answers).join(' ');
    workingQuery = `${workingQuery}. User details: ${answersText}`;
  }

  const detectedDomain = understandRes.domain;
  const queryVariations = generateParaphrases(workingQuery, detectedDomain);

  const deviceCtx: DeviceContext = {
    model: req.device_context?.model || 'Samsung Galaxy S24 Ultra',
    oneUiVersion: req.device_context?.oneUiVersion || 'One UI 6.1',
    androidVersion: req.device_context?.androidVersion || 'Android 14'
  };

  // Stage 1: Fast-Path Semantic Cache Lookup
  const cacheStart = performance.now();
  const cacheResult = !options.forceCold
    ? semanticCache.lookup(workingQuery, detectedDomain)
    : { hit: false, latencyMs: 0, similarityScore: 0 };
  const cacheLookupMs = Math.max(1, Math.round(performance.now() - cacheStart));

  if (cacheResult.hit && cacheResult.entry) {
    const totalLatency = Math.max(1, Math.round(performance.now() - pipelineStart));
    const firstDeeplink = cacheResult.entry.responseContext[0]?.actions[0]?.stepGroups[0]?.actionableDeeplink?.deeplink || 'bixby://dummy_positive';

    const trace: PipelineExecutionTrace = {
      query: req.query,
      normalizedQuery: workingQuery,
      detectedDomain,
      queryVariations: cacheResult.entry.variations,
      cacheHit: true,
      cacheKey: cacheResult.entry.key,
      stageTimings: {
        queryEnrichmentMs: understandMs,
        cacheLookupMs,
        totalMs: totalLatency
      },
      matchedDeeplinks: [],
      scrubbedUrlsCount: 0,
      ruleViolationsFixed: []
    };

    return {
      response: {
        query: req.query,
        query_variations: cacheResult.entry.variations,
        response: {
          contexts: cacheResult.entry.responseContext,
          qrPayloadUrl: `intent://${firstDeeplink}#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end`
        },
        meta: {
          latency_ms: totalLatency,
          cache_hit: true,
          similarity_score: cacheResult.similarityScore || 0.96,
          model: GEMINI_MODEL,
          cost_usd: 0.0,
          detected_language: understandRes.language_name,
          device_context: deviceCtx,
          trace_id: `trace_cache_${Date.now()}`
        }
      },
      trace
    };
  }

  // Cache Miss -> Execute Full Cold Path
  let extractionMs = 0;
  let rawGoal: Goal;

  // Domain-aligned knowledge lookup
  let domainKnowledgeText = DOMAIN_KNOWLEDGE[detectedDomain];
  if (req.siis_response) {
    domainKnowledgeText = req.siis_response;
  } else {
    // Check specific SIIS response keys matching domain
    for (const [key, text] of Object.entries(siisResponses)) {
      const kLower = key.toLowerCase();
      if (
        (detectedDomain === 'Battery' && kLower.includes('battery')) ||
        (detectedDomain === 'Display' && (kLower.includes('display') || kLower.includes('touch'))) ||
        (detectedDomain === 'Camera' && kLower.includes('cam')) ||
        (detectedDomain === 'Performance' && kLower.includes('perf'))
      ) {
        domainKnowledgeText = text;
        break;
      }
    }
  }

  const extractStart = performance.now();
  let estimatedTokens = 450;
  try {
    if (process.env.GEMINI_API_KEY) {
      rawGoal = await extractWithGemini(
        workingQuery,
        domainKnowledgeText,
        detectedDomain,
        deviceCtx,
        understandRes.image_summary
      );
      estimatedTokens = Math.round((workingQuery.length + (domainKnowledgeText || '').length + JSON.stringify(rawGoal).length) / 4);
    } else {
      rawGoal = extractFromKnowledge(workingQuery, domainKnowledgeText || DOMAIN_KNOWLEDGE.System, detectedDomain, deviceCtx);
    }
  } catch (err) {
    console.error('Gemini extraction error, using grounded knowledge fallback:', err);
    rawGoal = extractFromKnowledge(workingQuery, domainKnowledgeText || DOMAIN_KNOWLEDGE.System, detectedDomain, deviceCtx);
  }
  extractionMs = Math.max(1, Math.round(performance.now() - extractStart));

  // Stage 2: Deeplink Mapping & Action Ordering
  const mapStart = performance.now();
  const matchedDeeplinksTrace: PipelineExecutionTrace['matchedDeeplinks'] = [];
  let totalMatchScore = 0;
  let matchedCount = 0;

  const mappedActions = rawGoal.actions.map(action => {
    const isManual = action.category === 'manual';

    const stepGroups = (action.stepGroups || []).map(group => {
      if (isManual) {
        return {
          ...group,
          actionableDeeplink: null,
          validationDeeplink: null
        };
      }

      // Match target screen against catalog
      const match = matchDeeplink(action.actionName, group.steps, detectedDomain);
      totalMatchScore += match.score;
      matchedCount++;

      matchedDeeplinksTrace.push({
        actionName: action.actionName,
        screen: match.catalogItem.screenName,
        matchedUri: match.deeplink.deeplink,
        score: match.score,
        matchMethod: match.catalogItem.id === 'bixby_dummy_positive' ? 'fallback_dummy' : 'bm25'
      });

      return {
        ...group,
        actionableDeeplink: match.deeplink,
        validationDeeplink: match.validationDeeplink
      };
    });

    return {
      ...action,
      stepGroups
    };
  });
  const deeplinkMappingMs = Math.max(1, Math.round(performance.now() - mapStart));

  // Stage 3: Programmatic Validation & Rule Enforcement
  const valStart = performance.now();
  const { cleanedGoal, violationsFixed: vFixed, totalLeaksScrubbed } = validateAndCleanGoal({
    ...rawGoal,
    actions: mappedActions
  });
  violationsFixed.push(...vFixed);
  totalScrubbed += totalLeaksScrubbed;
  const validationScrubbingMs = Math.max(1, Math.round(performance.now() - valStart));

  const totalTimeMs = Math.max(1, Math.round(performance.now() - pipelineStart));

  // Real confidence calculation: incorporates understanding confidence and catalog match scores
  const avgMatchQuality = matchedCount > 0 ? totalMatchScore / matchedCount : 0.7;
  const confidenceScore = Number((understandRes.confidence * 0.5 + avgMatchQuality * 0.5).toFixed(2));
  cleanedGoal.score = confidenceScore;

  // Escalation determination (< 0.65 indicates ambiguous symptom or weak catalog mapping)
  let escalation: HumanEscalationNote | undefined;
  if (confidenceScore < 0.65) {
    escalation = {
      needed: true,
      reason: `Low confidence diagnostic match (${Math.round(confidenceScore * 100)}%) for symptom: "${req.query}".`,
      summary: `Customer complaint regarding ${detectedDomain} ("${req.query}") on ${deviceCtx.model} (${deviceCtx.oneUiVersion}) required escalation. Suggested actions need verification.`,
      recommendedDepartment: 'Samsung Galaxy Tier-2 Technical Concierge',
      suggestedAction: 'Connect customer via Samsung Smart Tutor for remote diagnostic session.'
    };
  }

  // Safe-guard cache write: only store high-confidence plans to prevent cache poisoning
  if (confidenceScore >= 0.85 && !escalation) {
    semanticCache.store(workingQuery, queryVariations, [cleanedGoal], confidenceScore, detectedDomain);
  }

  const primaryDeeplink = cleanedGoal.actions[0]?.stepGroups[0]?.actionableDeeplink?.deeplink || 'bixby://dummy_positive';
  const estimatedCost = Number(((estimatedTokens * 0.0000003)).toFixed(6));

  const trace: PipelineExecutionTrace = {
    query: req.query,
    normalizedQuery: workingQuery,
    detectedDomain,
    queryVariations,
    cacheHit: false,
    cacheKey: semanticCache.generateSemanticKey(workingQuery),
    stageTimings: {
      queryEnrichmentMs: understandMs,
      cacheLookupMs,
      structureExtractionMs: extractionMs,
      deeplinkMappingMs,
      validationScrubbingMs,
      totalMs: totalTimeMs
    },
    matchedDeeplinks: matchedDeeplinksTrace,
    scrubbedUrlsCount: totalScrubbed,
    ruleViolationsFixed: violationsFixed
  };

  return {
    response: {
      query: req.query,
      query_variations: queryVariations,
      response: {
        contexts: [cleanedGoal],
        escalation,
        qrPayloadUrl: `intent://${primaryDeeplink}#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end`
      },
      meta: {
        latency_ms: totalTimeMs,
        cache_hit: false,
        similarity_score: Number(avgMatchQuality.toFixed(2)),
        model: GEMINI_MODEL,
        cost_usd: estimatedCost,
        tokens_used: estimatedTokens,
        detected_language: understandRes.language_name,
        device_context: deviceCtx,
        trace_id: `trace_cold_${Date.now()}`
      }
    },
    trace
  };
}
