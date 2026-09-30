/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Appendix A: Data Contract Reference (schema.py port for TypeScript)
 * Samsung Electronics Smart Guided Troubleshooting Engine
 */

export type Condition = 'greater' | 'equal' | 'less';

export type ResultTypes = 'boolean' | 'integer' | 'str' | 'float';

export type ActionCategory = 'auto' | 'manual' | 'critical';

export interface BaseDeeplink {
  deeplink: string;
}

export interface Deeplink extends BaseDeeplink {
  description: string;
  message?: string;
  classes?: Record<string, string> | null;
  originalType?: string | null;
}

export interface ValidationDeepLink extends BaseDeeplink {
  key: string;
  resultType?: ResultTypes | null;
  condition?: Condition | null;
  value?: string | null;
}

export interface StepGroup {
  steps: string[];
  validationDeeplink?: ValidationDeepLink | null;
  actionableDeeplink?: Deeplink | null;
}

export type RiskLevel = 'safe' | 'caution' | 'destructive';

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface HumanEscalationNote {
  needed: boolean;
  reason?: string;
  summary?: string;
  recommendedDepartment?: string;
  suggestedAction?: string;
}

export interface DeviceContext {
  model: string;
  oneUiVersion: string;
  androidVersion: string;
}

export interface Action {
  actionName: string;
  description: string;
  stepGroups: StepGroup[];
  category?: ActionCategory;
  riskLevel?: RiskLevel;
  requiresConfirmation?: boolean;
}

export interface Goal {
  goal: string;
  title: string;
  actions: Action[];
  score: number;
}

export interface ContextDeeplinkResponse {
  contexts: Goal[];
  fallback?: string;
  clarificationNeeded?: boolean;
  clarifyingQuestions?: ClarifyingQuestion[];
  escalation?: HumanEscalationNote;
  qrPayloadUrl?: string;
}

export interface TroubleshootMeta {
  latency_ms: number;
  cache_hit: boolean;
  similarity_score?: number;
  model: string;
  cost_usd: number;
  tokens_used?: number;
  trace_id?: string;
  detected_language?: string;
  device_context?: DeviceContext;
  prompt_injection_blocked?: boolean;
}

export interface TroubleshootRequest {
  query: string;
  siis_response?: string;
  image_base64?: string;
  language?: 'auto' | 'en' | 'hi' | 'kn' | 'ta' | 'hinglish';
  device_context?: Partial<DeviceContext>;
  clarification_answers?: Record<string, string>;
}

export interface TroubleshootResponse {
  query: string;
  query_variations: string[];
  response: ContextDeeplinkResponse;
  meta: TroubleshootMeta;
}

export interface CatalogItem {
  id: string;
  domain: 'Battery' | 'Display' | 'Camera' | 'Performance' | 'Network' | 'System' | 'Security';
  screenName: string;
  deeplink: string;
  description: string;
  message: string;
  qna_description: string;
  control_type: 'toggle' | 'slider' | 'radio' | 'button' | 'dialog' | 'menu';
  keywords: string[];
  destructive?: boolean;
  category: ActionCategory;
  toggle_validation?: {
    key: string;
    resultType: ResultTypes;
    condition: Condition;
    value: string;
  };
}

export interface PipelineExecutionTrace {
  query: string;
  normalizedQuery: string;
  detectedDomain: string;
  queryVariations: string[];
  cacheHit: boolean;
  cacheKey: string;
  stageTimings: {
    queryEnrichmentMs: number;
    cacheLookupMs: number;
    structureExtractionMs?: number;
    deeplinkMappingMs?: number;
    validationScrubbingMs?: number;
    totalMs: number;
  };
  matchedDeeplinks: Array<{
    actionName: string;
    screen: string;
    matchedUri: string;
    score: number;
    matchMethod: 'cache' | 'bm25' | 'dense_embedding' | 'fallback_dummy';
  }>;
  scrubbedUrlsCount: number;
  ruleViolationsFixed: string[];
}
