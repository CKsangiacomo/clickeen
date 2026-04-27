export type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ENV_STAGE?: string;
  BERLIN_ISSUER?: string;
  BERLIN_AUDIENCE?: string;
  BERLIN_REFRESH_SECRET?: string;
  BERLIN_ALLOWED_PROVIDERS?: string;
  BERLIN_LOGIN_CALLBACK_URL?: string;
  BERLIN_FINISH_REDIRECT_URL?: string;
  BERLIN_GOOGLE_CLIENT_ID?: string;
  BERLIN_GOOGLE_CLIENT_SECRET?: string;
  BERLIN_GOOGLE_CALLBACK_URL?: string;
  BERLIN_ACCESS_PRIVATE_KEY_PEM?: string;
  BERLIN_ACCESS_PUBLIC_KEY_PEM?: string;
  BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM?: string;
  BERLIN_ACCESS_PREVIOUS_KID?: string;
  CK_INTERNAL_SERVICE_JWT?: string;
  BERLIN_SESSION_KV?: KVNamespace;
  BERLIN_AUTH_TICKETS?: DurableObjectNamespace;
  RENDER_SNAPSHOT_QUEUE?: Queue<unknown>;
};

export type JwtHeader = {
  alg?: string;
  typ?: string;
  kid?: string;
};

export type AccessClaims = Record<string, unknown> & {
  sub?: string;
  sid?: string;
  ver?: number;
  iat?: number;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
};

export type RefreshPayloadV2 = {
  v: 2;
  sid: string;
  rti: string;
  ver: number;
  userId: string;
  exp: number;
};

export type RefreshPayload = RefreshPayloadV2;

export type AuthMode = 'direct_provider';

type BaseSessionState = {
  sid: string;
  currentRti: string;
  rtiRotatedAt: number;
  userId: string;
  ver: number;
  revoked: boolean;
  authMode: AuthMode;
  createdAt: number;
  updatedAt: number;
};

export type DirectProviderSessionState = BaseSessionState & {
  authMode: 'direct_provider';
};

export type SessionState = DirectProviderSessionState;

export type OAuthTransaction = {
  v: 1;
  flow: 'login' | 'link';
  provider: string;
  codeVerifier: string;
  createdAt: number;
  expiresAt: number;
  sid?: string;
  userId?: string;
  intent?: LoginIntent;
  next?: string;
  invitationId?: string;
};

export type LoginIntent = 'signin' | 'signup_prague';

export type OAuthFinishTransaction = {
  v: 1;
  provider: string;
  userId: string;
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  expiresAt: string;
  intent: LoginIntent;
  next: string;
  createdAt: number;
  finishExpiresAt: number;
};

export type SessionIssueArgs = {
  sid?: string;
  ver?: number;
  userId: string;
  authMode: 'direct_provider';
};

export type SessionIssueResult = {
  sid: string;
  ver: number;
  accessToken: string;
  refreshToken: string;
  accessTokenMaxAge: number;
  refreshTokenMaxAge: number;
  expiresAt: string;
};

export type RefreshResult = | { ok: true; payload: RefreshPayload } | { ok: false; reason: string };

export type SigningPublic = {
  kid: string;
  publicKey: CryptoKey;
  publicJwk: PublicJwk;
};

export type PublicJwk = JsonWebKey & {
  kid: string;
  alg: string;
  use: string;
};

export type SigningContext = {
  kid: string;
  privateKey: CryptoKey;
  current: SigningPublic;
  previous?: SigningPublic;
};

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ACCESS_TOKEN_SKEW_SECONDS = 30;
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const OAUTH_FINISH_TTL_SECONDS = 5 * 60;
export const REFRESH_RTI_GRACE_MS = 30_000;

export const REFRESH_TOKEN_PREFIX = 'ckr';
export const DEFAULT_AUDIENCE = 'clickeen.product';
export const DEFAULT_ISSUER = 'berlin.local';
export const SIGNING_CONTEXT_KEY = '__CK_BERLIN_SIGNING_CONTEXT_V2__';
export const REFRESH_KEY_CACHE = '__CK_BERLIN_REFRESH_KEY_V2__';

export const SESSION_KV_PREFIX = 'berlin:session:v1';
export const USER_INDEX_KV_PREFIX = 'berlin:user-sessions:v1';

export const CACHE_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
} as const;

export const REDIRECT_CACHE_HEADERS = {
  'cache-control': 'no-store',
  'cdn-cache-control': 'no-store',
  'cloudflare-cdn-cache-control': 'no-store',
} as const;
