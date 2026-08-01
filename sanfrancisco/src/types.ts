import type { AiGrantPolicy } from '@clickeen/ck-contracts/ai';

export type GrantSubject = { kind: 'user'; userId: string; accountId: string };

export type AIGrant = {
  iss: 'roma';
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
    instanceId?: string;
    surfaceId?: string;
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

export type ModelChatRequest = {
  grant: string;
  agentId: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  trace?: {
    requestId?: string;
    client?: 'product-copilot' | 'translation-agent' | 'ops';
    locale?: string;
  };
};

export type ModelChatResponse = {
  requestId: string;
  agentId: string;
  content: string;
  usage: Usage;
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
  | { code: 'BAD_REQUEST'; message: string; reasonKey?: string; issues?: Array<{ path: string; message: string }> }
  | { code: 'PROVIDER_ERROR'; message: string; provider: string; upstreamStatus?: number };

export type Env = {
  ENVIRONMENT?: string;
  ROMA_AI_GRANT_PUBLIC_KEY_PEM: string;
  PRAGUE_L10N_HMAC_SECRET: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  SF_R2: R2Bucket;
};
