/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Fast-Path Semantic Cache Layer
 * Provides sub-300ms validated plan delivery with high semantic precision
 */

import { Goal } from '../types/schema.js';
import samplesData from '../data/samples.json' with { type: 'json' };
import queriesData from '../data/queries.json' with { type: 'json' };

export interface CacheEntry {
  key: string;
  canonicalQuery: string;
  variations: string[];
  responseContext: Goal[];
  domain: string;
  hitCount: number;
  helpfulVotes?: number;
  unhelpfulVotes?: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface CacheStats {
  totalEntries: number;
  totalLookups: number;
  hits: number;
  misses: number;
  hitRatePercent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  estimatedSavingsUsd: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it', 'with', 'from',
  'by', 'my', 'phone', 'device', 'samsung', 'galaxy', 'please', 'help', 'also', 'very', 'too',
  'how', 'why', 'what', 'when', 'does', 'do', 'not', 'can', 'cannot', 'cant', 'getting', 'issue', 'problem'
]);

// Synonyms and concept normalizer for high-precision semantic clustering
const CONCEPT_MAPPINGS: Record<string, string> = {
  // Navigation / Swipes
  'swipe': 'swipe',
  'swiping': 'swipe',
  'swipes': 'swipe',
  'gesture': 'gesture',
  'gestures': 'gesture',
  'navigation': 'navigation',
  'navbar': 'navigation',

  // Battery / Power
  'battery': 'battery',
  'power': 'battery',
  'drain': 'drain',
  'drains': 'drain',
  'draining': 'drain',
  'dies': 'drain',
  'discharging': 'drain',

  // Display / Flicker
  'flicker': 'flicker',
  'flickers': 'flicker',
  'flickering': 'flicker',
  'dimming': 'flicker',
  'flashing': 'flicker',
  'brightness': 'brightness',

  // Performance / Lag
  'slow': 'lag',
  'sloow': 'lag',
  'sluggish': 'lag',
  'lagging': 'lag',
  'lag': 'lag',
  'hang': 'lag',
  'hanging': 'lag',
  'stutter': 'lag',
  'update': 'firmware_update',
  'upgrade': 'firmware_update',

  // Camera
  'camera': 'camera',
  'cam': 'camera',
  'blurry': 'blur',
  'blur': 'blur',
  'fuzzy': 'blur',
  'focus': 'focus',
  'photo': 'photo',
  'photos': 'photo',

  // Charging
  'charging': 'charge',
  'charge': 'charge',
  'charger': 'charge',
  'cable': 'cable',

  // Audio / Sound
  'sound': 'audio',
  'audio': 'audio',
  'speaker': 'audio',
  'volume': 'audio',
  'mute': 'audio',
  'crackle': 'audio',
  'crackling': 'audio',

  // Storage
  'storage': 'storage',
  'disk': 'storage',
  'space': 'storage',
  'trash': 'storage',

  // Touch
  'touch': 'touch',
  'unresponsive': 'unresponsive',
  'protector': 'screen_protector',
  'glass': 'screen_protector'
};

function normalizeTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(w => CONCEPT_MAPPINGS[w] || w);
}

function detectDomainFromTokens(tokens: string[]): string {
  const set = new Set(tokens);
  if (set.has('audio') || set.has('speaker') || set.has('volume')) return 'Audio';
  if (set.has('charge') || (set.has('battery') && !set.has('flicker'))) return 'Battery';
  if (set.has('flicker') || set.has('swipe') || set.has('gesture') || set.has('touch') || set.has('brightness')) return 'Display';
  if (set.has('camera') || set.has('blur') || set.has('focus') || set.has('photo')) return 'Camera';
  if (set.has('lag') || set.has('firmware_update') || set.has('ram') || set.has('memory')) return 'Performance';
  if (set.has('storage')) return 'Storage';
  if (set.has('wifi') || set.has('bluetooth')) return 'Network';
  return 'System';
}

function createDenseVector(tokens: string[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const t of tokens) {
    vec.set(t, (vec.get(t) || 0) + 1);
  }
  return vec;
}

function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, valA] of vecA) {
    normA += valA * valA;
    if (vecB.has(term)) {
      dotProduct += valA * vecB.get(term)!;
    }
  }
  for (const [, valB] of vecB) {
    normB += valB * valB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class FastPathSemanticCache {
  private cache = new Map<string, CacheEntry>();
  private latencyHistory: number[] = [];
  private totalLookups = 0;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.preWarmCache();
  }

  /**
   * Pre-warms the cache with canonical sample plans and query variations
   */
  public preWarmCache() {
    this.cache.clear();

    // 1. Add reference samples
    for (const sample of samplesData) {
      const canonicalKey = this.generateSemanticKey(sample.query);
      const tokens = normalizeTokens(sample.query);
      const domain = detectDomainFromTokens(tokens);

      const entry: CacheEntry = {
        key: canonicalKey,
        canonicalQuery: sample.query,
        variations: sample.query_variations || [],
        responseContext: sample.response.contexts as Goal[],
        domain,
        hitCount: 0,
        createdAt: Date.now(),
        lastAccessedAt: Date.now()
      };
      this.cache.set(canonicalKey, entry);
    }

    // 2. Cross-reference queries.json to map variations
    for (const q of queriesData) {
      const canonicalKey = this.generateSemanticKey(q.canonical);
      const existing = this.cache.get(canonicalKey);
      if (existing) {
        const set = new Set([...existing.variations, ...q.query_variations]);
        existing.variations = Array.from(set);
        if (q.domain) existing.domain = q.domain;
      }
    }
  }

  /**
   * Generates a stable canonical semantic key
   */
  public generateSemanticKey(query: string): string {
    const tokens = normalizeTokens(query);
    const unique = Array.from(new Set(tokens)).sort();
    return unique.slice(0, 8).join('_');
  }

  /**
   * Fast-Path lookup: returns cached plan in <= 300 ms with cosine similarity score and domain safety check
   */
  public lookup(
    query: string,
    domainHint?: string
  ): { hit: boolean; entry?: CacheEntry; latencyMs: number; similarityScore: number } {
    const startTime = performance.now();
    this.totalLookups++;

    const incomingTokens = normalizeTokens(query);
    const queryDomain = domainHint || detectDomainFromTokens(incomingTokens);
    const directKey = this.generateSemanticKey(query);

    // 1. Exact canonical key match
    if (this.cache.has(directKey)) {
      const entry = this.cache.get(directKey)!;
      // Ensure positive feedback ratio
      if (!entry.unhelpfulVotes || entry.unhelpfulVotes <= (entry.helpfulVotes || 0) + 2) {
        entry.hitCount++;
        entry.lastAccessedAt = Date.now();
        const elapsed = Math.max(1, Math.round(performance.now() - startTime));
        this.hits++;
        this.latencyHistory.push(elapsed);
        return { hit: true, entry, latencyMs: elapsed, similarityScore: 0.99 };
      }
    }

    // 2. Semantic Embedding matching against cached variations
    const queryVec = createDenseVector(incomingTokens);
    let bestEntry: CacheEntry | null = null;
    let highestSim = 0;

    for (const entry of this.cache.values()) {
      // Avoid poisoned or heavily downvoted plans
      if (entry.unhelpfulVotes && entry.unhelpfulVotes > (entry.helpfulVotes || 0) + 2) {
        continue;
      }

      // Check variations
      for (const variation of [entry.canonicalQuery, ...entry.variations]) {
        const varTokens = normalizeTokens(variation);
        const varVec = createDenseVector(varTokens);
        const sim = cosineSimilarity(queryVec, varVec);
        if (sim > highestSim) {
          highestSim = sim;
          bestEntry = entry;
        }
      }
    }

    // Domain mismatch safeguard: e.g. Battery query should not match Display Flicker sample
    const isDomainAligned = !bestEntry || !queryDomain || queryDomain === 'System' || bestEntry.domain === queryDomain || bestEntry.domain === 'System';

    // Strict semantic threshold: >= 0.70 with domain alignment prevents cross-contamination
    if (bestEntry && highestSim >= 0.70 && isDomainAligned) {
      bestEntry.hitCount++;
      bestEntry.lastAccessedAt = Date.now();
      const elapsed = Math.max(1, Math.round(performance.now() - startTime));
      this.hits++;
      this.latencyHistory.push(elapsed);
      return { hit: true, entry: bestEntry, latencyMs: elapsed, similarityScore: Number(highestSim.toFixed(3)) };
    }

    // Miss
    const elapsed = Math.max(1, Math.round(performance.now() - startTime));
    this.misses++;
    this.latencyHistory.push(elapsed);
    return { hit: false, latencyMs: elapsed, similarityScore: Number(highestSim.toFixed(3)) };
  }

  public recordFeedback(key: string, helpful: boolean) {
    const entry = this.cache.get(key);
    if (entry) {
      if (helpful) {
        entry.helpfulVotes = (entry.helpfulVotes || 0) + 1;
      } else {
        entry.unhelpfulVotes = (entry.unhelpfulVotes || 0) + 1;
      }
    }
  }

  /**
   * Stores a validated plan into the semantic cache
   * Safe-guarded against caching low-confidence, injection, or degraded plans
   */
  public store(
    query: string,
    variations: string[],
    contexts: Goal[],
    confidence = 0.9,
    domain = 'System'
  ): CacheEntry | null {
    // Cache poisoning prevention
    if (confidence < 0.85 || !contexts || contexts.length === 0) {
      return null;
    }

    const key = this.generateSemanticKey(query);
    if (!key) return null;

    const entry: CacheEntry = {
      key,
      canonicalQuery: query,
      variations: variations || [],
      responseContext: contexts,
      domain,
      hitCount: 1,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };
    this.cache.set(key, entry);
    return entry;
  }

  public getStats(): CacheStats {
    const lats = [...this.latencyHistory].sort((a, b) => a - b);
    const p95Idx = Math.floor(lats.length * 0.95);
    const p95 = lats[p95Idx] || (lats.length > 0 ? lats[lats.length - 1] : 0);
    const avg = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
    const hitRate = this.totalLookups > 0 ? (this.hits / this.totalLookups) * 100 : 100;
    const estimatedSavingsUsd = Number((this.hits * 0.00015).toFixed(4));

    return {
      totalEntries: this.cache.size,
      totalLookups: this.totalLookups,
      hits: this.hits,
      misses: this.misses,
      hitRatePercent: Number(hitRate.toFixed(1)),
      avgLatencyMs: Number(avg.toFixed(1)),
      p95LatencyMs: p95,
      estimatedSavingsUsd
    };
  }

  public getAllEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  public clear() {
    this.cache.clear();
    this.latencyHistory = [];
    this.totalLookups = 0;
    this.hits = 0;
    this.misses = 0;
    this.preWarmCache();
  }
}

export const semanticCache = new FastPathSemanticCache();
