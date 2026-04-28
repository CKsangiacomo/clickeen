import type { TokyoMirrorQueueJob } from './domains/render';
import type { LocalizationOp } from '@clickeen/ck-contracts';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';

export type AccountWidgetL10nItem = {
  path: string;
  type: 'string' | 'richtext';
  value: string;
};

export type AccountWidgetL10nGenerateResponse = {
  results?: unknown;
};

export type SanFranciscoL10nBinding = Fetcher & {
  generateAccountWidgetL10nOps(request: {
    widgetType: string;
    baseLocale: string;
    targetLocales: string[];
    items: AccountWidgetL10nItem[];
    existingOpsByLocale: Record<string, LocalizationOp[]>;
    changedPaths: string[] | null;
    removedPaths: string[];
    policyProfile: RomaAccountAuthzCapsulePayload['profile'];
  }): Promise<AccountWidgetL10nGenerateResponse>;
};

export type Env = {
  ENV_STAGE?: string;
  TOKYO_DEV_JWT: string;
  CK_INTERNAL_SERVICE_JWT?: string;
  TOKYO_PUBLIC_BASE_URL?: string;
  TOKYO_R2: R2Bucket;
  USAGE_KV?: KVNamespace;
  RENDER_SNAPSHOT_QUEUE?: Queue<TokyoMirrorQueueJob>;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  BERLIN_BASE_URL?: string;
  BERLIN_JWKS_URL?: string;
  SANFRANCISCO_L10N?: SanFranciscoL10nBinding;
  TOKYO_L10N_HTTP_BASE?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};
