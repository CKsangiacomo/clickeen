import type { TokyoMirrorQueueJob } from './domains/render';

export type Env = {
  ENV_STAGE?: string;
  TOKYO_DEV_JWT: string;
  TOKYO_PUBLIC_BASE_URL?: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  RENDER_SNAPSHOT_QUEUE?: Queue<TokyoMirrorQueueJob>;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BERLIN_BASE_URL?: string;
  BERLIN_JWKS_URL?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};
