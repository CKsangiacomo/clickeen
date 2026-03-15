import type { TokyoMirrorQueueJob } from './domains/render';

export type Env = {
  TOKYO_DEV_JWT: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  RENDER_SNAPSHOT_QUEUE?: Queue<TokyoMirrorQueueJob>;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BERLIN_BASE_URL?: string;
  BERLIN_JWKS_URL?: string;
  BERLIN_ISSUER?: string;
  BERLIN_AUDIENCE?: string;
  TOKYO_L10N_HTTP_BASE?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  L10N_STATE_KV?: KVNamespace;
  L10N_GENERATE_QUEUE?: Queue;
  AI_GRANT_HMAC_SECRET?: string;
  SANFRANCISCO_BASE_URL?: string;
};
