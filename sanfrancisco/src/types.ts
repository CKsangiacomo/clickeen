import type { AiGrantPolicy } from '@clickeen/ck-contracts/ai';

export type GrantSubject =
  | { kind: 'user'; userId: string; accountId: string }
  | { kind: 'service'; serviceId: string };

export type AIGrant = {
  v: 1;
  iss: 'roma' | 'sanfrancisco';
  jti?: string;
  sub: GrantSubject;
  exp: number; // epoch seconds
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs: number;
  };
  mode: 'editor' | 'ops';
  ai?: AiGrantPolicy;
  trace?: {
    sessionId?: string;
    instancePublicId?: string;
    envStage?: string;
  };
};

export type ExecuteRequest = {
  grant: string;
  agentId: string;
  input: unknown;
  trace?: {
    requestId?: string;
    client?: 'roma' | 'ops';
    locale?: string;
  };
};

export type ExecuteResponse = {
  requestId: string;
  agentId: string;
  result: unknown;
  usage: Usage;
};

export type CopilotOutcomeEvent =
  | 'cta_clicked'
  | 'edit_applied'
  | 'edit_rejected'
  | 'edit_undone'
  | 'clarification_needed'
  | 'invalid_output';

export type CopilotLearningMetadata = {
  intent?: string;
  touchedPaths?: string[];
  touchedControls?: Array<{
    path: string;
    label?: string;
    groupId?: string;
    groupLabel?: string;
  }>;
  touchedScopes?: string[];
  touchedGroups?: Array<{ key: string; label: string }>;
  opsCount?: number;
  uniquePathsTouched?: number;
  validationResult?: 'valid' | 'invalid' | 'not_applicable';
  invalidReason?: string;
};

export type OutcomeAttachRequest = {
  requestId: string;
  sessionId: string;
  event: CopilotOutcomeEvent;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
  metadata?: CopilotLearningMetadata;
};

export type Usage = {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export type AIError =
  | { code: 'GRANT_INVALID'; message: string }
  | { code: 'GRANT_EXPIRED'; message: string }
  | { code: 'CAPABILITY_DENIED'; message: string }
  | { code: 'BUDGET_EXCEEDED'; message: string }
  | { code: 'BAD_REQUEST'; message: string; issues?: Array<{ path: string; message: string }> }
  | { code: 'PROVIDER_ERROR'; message: string; provider: string };

export type InteractionEvent = {
  v: 1;
  requestId: string;
  agentId: string;
  occurredAtMs: number;
  subject: GrantSubject;
  trace?: AIGrant['trace'];
  ai?: {
    policyProfile?: AiGrantPolicy['policyProfile'];
    policyVersion?: string;
    learningCapture?: AiGrantPolicy['learningCapture'];
    taskClass?: string;
  };
  input: unknown;
  result: unknown;
  usage?: Usage;
};

export type Env = {
  ENVIRONMENT?: string;
  AI_GRANT_HMAC_SECRET: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SF_KV: KVNamespace;
  SF_EVENTS?: Queue<InteractionEvent>;
  INSTANCE_TRANSLATION_JOBS?: Queue<unknown>;
  TOKYO_PRODUCT_CONTROL?: Fetcher;
  SF_D1: D1Database;
  SF_R2: R2Bucket;
};
