export type GrantSubject =
  | { kind: 'anon'; sessionId: string }
  | { kind: 'user'; userId: string; workspaceId: string }
  | { kind: 'service'; serviceId: string };

export type AIGrant = {
  v: 1;
  iss: 'paris';
  sub: GrantSubject;
  exp: number; // epoch seconds
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number;
  };
  mode: 'editor' | 'ops';
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
    client?: 'minibob' | 'bob' | 'ops';
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
  | 'signup_started'
  | 'signup_completed'
  | 'upgrade_clicked'
  | 'upgrade_completed'
  | 'cta_clicked'
  | 'ux_keep'
  | 'ux_undo';

export type OutcomeAttachRequest = {
  requestId: string;
  sessionId: string;
  event: CopilotOutcomeEvent;
  occurredAtMs: number;
  timeToDecisionMs?: number;
  accountIdHash?: string;
  workspaceIdHash?: string;
};

export type Usage = {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd?: number;
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
  input: unknown;
  result: unknown;
  usage: Usage;
};

export type Env = {
  ENVIRONMENT?: string;
  AI_GRANT_HMAC_SECRET: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  PARIS_BASE_URL?: string;
  PARIS_DEV_JWT?: string;
  TOKYO_BASE_URL?: string;
  TOKYO_L10N_BASE_URL?: string;
  TOKYO_DEV_JWT?: string;
  OPENAI_API_KEY?: string;
  PITCH_SERVICE_KEY?: string;
  PITCH_MODEL?: string;
  SF_KV: KVNamespace;
  SF_EVENTS: Queue<InteractionEvent>;
  SF_D1: D1Database;
  SF_R2: R2Bucket;
  // Cloudflare Vectorize binding (typed loosely to avoid depending on Vectorize TS types).
  PITCH_DOCS?: any;
};
