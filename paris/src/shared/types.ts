import type { Policy, PolicyProfile, LimitsSpec, AiGrantPolicy } from '@clickeen/ck-policy';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PARIS_DEV_JWT: string;
  TOKYO_BASE_URL?: string;
  TOKYO_WORKER_BASE_URL?: string;
  TOKYO_DEV_JWT?: string;
  AI_GRANT_HMAC_SECRET?: string;
  SANFRANCISCO_BASE_URL?: string;
  ENVIRONMENT?: string;
  ENV_STAGE?: string;
  MINIBOB_RATELIMIT_KV?: KVNamespace;
  MINIBOB_RATELIMIT_MODE?: 'off' | 'log' | 'enforce';
  USAGE_KV?: KVNamespace;
  USAGE_EVENT_HMAC_SECRET?: string;
  L10N_GENERATE_QUEUE?: Queue<L10nJob>;
  L10N_PUBLISH_QUEUE?: Queue<L10nPublishQueueJob>;
  RENDER_SNAPSHOT_QUEUE?: Queue<RenderSnapshotQueueJob>;
};

export type InstanceKind = 'curated' | 'user';

export type InstanceRow = {
  public_id: string;
  status: 'published' | 'unpublished';
  config: Record<string, unknown>;
  created_at: string;
  updated_at?: string | null;
  widget_id: string | null;
  workspace_id?: string | null;
  kind?: InstanceKind | null;
};

export type CuratedInstanceKind = 'baseline' | 'curated';

export type CuratedInstanceRow = {
  public_id: string;
  widget_type: string;
  kind?: CuratedInstanceKind | null;
  status: 'published' | 'unpublished';
  config: Record<string, unknown>;
  meta?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
};

export type WidgetRow = {
  id: string;
  type: string | null;
  name: string | null;
  catalog?: unknown;
};

export type WorkspaceRow = {
  id: string;
  tier: 'free' | 'tier1' | 'tier2' | 'tier3';
  name: string;
  slug: string;
  website_url: string | null;
  l10n_locales?: unknown;
};

export type WorkspaceBusinessProfileRow = {
  workspace_id: string;
  profile: Record<string, unknown>;
  sources?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UpdatePayload = {
  config?: Record<string, unknown>;
  status?: 'published' | 'unpublished';
  meta?: Record<string, unknown> | null;
};

export type CreateInstancePayload = {
  widgetType: string;
  publicId: string;
  workspaceId: string;
  config: Record<string, unknown>;
  status?: 'published' | 'unpublished';
  widgetName?: string;
  meta?: Record<string, unknown> | null;
};

export type CkErrorKind = 'DENY' | 'VALIDATION' | 'AUTH' | 'NOT_FOUND' | 'INTERNAL';

export type CkErrorResponse = {
  error: {
    kind: CkErrorKind;
    reasonKey: string;
    upsell?: 'UP';
    detail?: string;
    paths?: string[];
  };
};

export type GrantSubject =
  | { kind: 'anon'; sessionId: string }
  | { kind: 'user'; userId: string; workspaceId: string }
  | { kind: 'service'; serviceId: string };

export type AIGrant = {
  v: 1;
  iss: 'paris';
  jti?: string;
  sub: GrantSubject;
  exp: number;
  caps: string[];
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number;
  };
  mode: 'editor' | 'ops';
  ai?: AiGrantPolicy;
  trace?: {
    sessionId?: string;
    instancePublicId?: string;
    envStage?: string;
  };
};

export type L10nJob = {
  v: 2;
  agentId: string;
  grant: string;
  publicId: string;
  widgetType: string;
  locale: string;
  baseFingerprint: string;
  baseUpdatedAt: string | null;
  changedPaths?: string[];
  removedPaths?: string[];
  kind: InstanceKind;
  workspaceId: string | null;
  envStage: string;
};

export type LayerPublishJob = {
  v: 2;
  publicId: string;
  layer: string;
  layerKey: string;
  action?: 'upsert' | 'delete';
};

export type L10nPublishQueueJob = LayerPublishJob;

export type RenderSnapshotQueueJob = {
  v: 1;
  kind: 'render-snapshot';
  publicId: string;
  action?: 'upsert' | 'delete';
  locales?: string[];
};

export type InstanceOverlayRow = {
  public_id: string;
  layer: string;
  layer_key: string;
  ops: Array<{ op: 'set'; path: string; value: unknown }>;
  user_ops?: Array<{ op: 'set'; path: string; value: unknown }>;
  base_fingerprint: string | null;
  base_updated_at?: string | null;
  source: string;
  geo_targets?: string[] | null;
  workspace_id?: string | null;
  updated_at?: string | null;
};

export type L10nGenerateStatus = 'dirty' | 'queued' | 'running' | 'succeeded' | 'failed' | 'superseded';

export type L10nGenerateStateRow = {
  public_id: string;
  layer: string;
  layer_key: string;
  base_fingerprint: string;
  base_updated_at?: string | null;
  widget_type?: string | null;
  workspace_id?: string | null;
  status: L10nGenerateStatus;
  attempts: number;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  last_error?: string | null;
  changed_paths?: string[] | null;
  removed_paths?: string[] | null;
};

export type L10nBaseSnapshotRow = {
  public_id: string;
  base_fingerprint: string;
  snapshot: Record<string, string>;
  widget_type?: string | null;
  base_updated_at?: string | null;
  created_at?: string | null;
};

export type L10nGenerateReportPayload = {
  v: 1;
  publicId: string;
  layer: string;
  layerKey: string;
  baseFingerprint: string;
  status: L10nGenerateStatus;
  attempts?: number;
  widgetType?: string | null;
  workspaceId?: string | null;
  baseUpdatedAt?: string | null;
  error?: string | null;
  occurredAt?: string | null;
};

export type L10nAllowlistEntry = { path: string; type?: 'string' | 'richtext' };
export type L10nAllowlistFile = { v: 1; paths: L10nAllowlistEntry[] };

export type WebsiteCreativeEnsurePayload = {
  widgetType: string;
  page: string;
  slot: string;
  baselineConfig?: Record<string, unknown>;
  overwrite?: boolean;
};

export type PolicySnapshot = {
  policy: Policy;
  profile: PolicyProfile;
};

export type WidgetLimits = LimitsSpec | null;
