/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hybrid Retriever & Deeplink Matcher
 * Maps UI steps and action names to verified masked catalog URIs using BM25 + Intent Scoring
 */

import { CatalogItem, Deeplink, ValidationDeepLink } from '../types/schema.js';
import catalogData from '../data/deeplinks.json' with { type: 'json' };

const catalog: CatalogItem[] = catalogData as CatalogItem[];

// Pre-tokenized catalog index for fast BM25
interface IndexedItem {
  item: CatalogItem;
  tokens: string[];
  docLength: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it', 'with', 'from', 'by', 'tap', 'open', 'go', 'navigate'
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

// Build inverted index and compute stats
const indexedDocs: IndexedItem[] = catalog.map(item => {
  const allText = [
    item.screenName,
    item.description,
    item.message,
    item.qna_description,
    item.domain,
    ...(item.keywords || [])
  ].join(' ');
  const tokens = tokenize(allText);
  return {
    item,
    tokens,
    docLength: tokens.length
  };
});

const totalDocs = indexedDocs.length;
const avgDocLength = indexedDocs.reduce((acc, doc) => acc + doc.docLength, 0) / Math.max(1, totalDocs);

// Compute Document Frequency (DF)
const termDocFrequency = new Map<string, number>();
for (const doc of indexedDocs) {
  const uniqueTerms = new Set(doc.tokens);
  for (const term of uniqueTerms) {
    termDocFrequency.set(term, (termDocFrequency.get(term) || 0) + 1);
  }
}

/**
 * Computes BM25 score for a query against an indexed catalog item
 */
function computeBM25(queryTokens: string[], doc: IndexedItem, k1 = 1.2, b = 0.75): number {
  let score = 0;
  // Term frequencies in doc
  const tfMap = new Map<string, number>();
  for (const t of doc.tokens) {
    tfMap.set(t, (tfMap.get(t) || 0) + 1);
  }

  for (const token of queryTokens) {
    const tf = tfMap.get(token) || 0;
    if (tf === 0) continue;

    const df = termDocFrequency.get(token) || 1;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (doc.docLength / avgDocLength));
    score += idf * (numerator / denominator);
  }

  return score;
}

export interface MatchResult {
  catalogItem: CatalogItem;
  score: number;
  deeplink: Deeplink;
  validationDeeplink: ValidationDeepLink | null;
}

/**
 * Maps an Action Name and Steps to the most specific Catalog Deeplink
 * Avoids parent-menu traps by boosting specific leaves and keywords
 */
export function matchDeeplink(
  actionName: string,
  steps: string[] = [],
  domainHint?: string
): MatchResult {
  const queryText = [actionName, ...steps, domainHint || ''].join(' ');
  const queryTokens = tokenize(queryText);

  let bestMatch: CatalogItem | null = null;
  let bestScore = -1;

  for (const doc of indexedDocs) {
    // Avoid dummy positive during normal matching unless no match
    if (doc.item.id === 'bixby_dummy_positive') continue;

    let score = computeBM25(queryTokens, doc);

    // Boost exact domain match
    if (domainHint && doc.item.domain.toLowerCase() === domainHint.toLowerCase()) {
      score += 0.8;
    }

    // Boost keyword exact phrase matches
    const lowerQuery = queryText.toLowerCase();
    for (const kw of doc.item.keywords || []) {
      if (lowerQuery.includes(kw.toLowerCase())) {
        score += 1.5;
      }
    }

    // Specific screen title match boost
    if (lowerQuery.includes(doc.item.screenName.toLowerCase())) {
      score += 2.0;
    }

    // Penalize generic parent menus when specific toggle terms are present
    const hasSpecificActionWord = ['switch', 'toggle', 'select', 'clean', 'standard', 'adaptive', 'protect', 'sleep'].some(w => lowerQuery.includes(w));
    if (hasSpecificActionWord && doc.item.control_type === 'menu' && !doc.item.toggle_validation) {
      score *= 0.9;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = doc.item;
    }
  }

  // Threshold: if score is too low, use reserved generic placeholder bixby://dummy_positive
  if (!bestMatch || bestScore < 0.5) {
    const fallbackItem = catalog.find(i => i.deeplink === 'bixby://dummy_positive') || catalog[0];
    return {
      catalogItem: fallbackItem,
      score: 0.5,
      deeplink: {
        deeplink: 'bixby://dummy_positive',
        description: `Open settings for ${actionName}`,
        message: `configure ${actionName.toLowerCase()}`
      },
      validationDeeplink: null
    };
  }

  const resultDeeplink: Deeplink = {
    deeplink: bestMatch.deeplink,
    description: bestMatch.description,
    message: bestMatch.message
  };

  let validation: ValidationDeepLink | null = null;
  if (bestMatch.toggle_validation) {
    validation = {
      deeplink: bestMatch.deeplink,
      key: bestMatch.toggle_validation.key,
      resultType: bestMatch.toggle_validation.resultType,
      condition: bestMatch.toggle_validation.condition,
      value: bestMatch.toggle_validation.value
    };
  }

  return {
    catalogItem: bestMatch,
    score: Math.min(1.0, Number((bestScore / 10).toFixed(2))),
    deeplink: resultDeeplink,
    validationDeeplink: validation
  };
}

export function getAllCatalogItems(): CatalogItem[] {
  return catalog;
}
