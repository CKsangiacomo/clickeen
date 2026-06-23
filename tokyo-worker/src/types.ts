export type Env = {
  ENV_STAGE?: string;
  TOKYO_PUBLIC_BASE_URL?: string;
  PUBLIC_SERVING_BASE_URL?: string;
  TOKYO_R2: R2Bucket;
  BERLIN_BASE_URL?: string;
  BERLIN_JWKS_URL?: string;
  AI_GRANT_HMAC_SECRET?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};
