const DEFAULT_DEVSTUDIO_ORIGIN = 'https://devstudio.clickeen.com';

function readString(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : '';
}

export function resolveBerlinBaseUrl(env) {
  const configured = readString(env, 'BERLIN_BASE_URL');
  if (!configured) throw new Error('BERLIN_BASE_URL missing');
  return new URL(configured).toString().replace(/\/+$/, '');
}

export function resolveDevstudioOrigin(env) {
  const configured = readString(env, 'DEVSTUDIO_CANONICAL_ORIGIN') || DEFAULT_DEVSTUDIO_ORIGIN;
  return new URL(configured).origin;
}

export function isProductionStage(env) {
  const stage = readString(env, 'ENV_STAGE').toLowerCase();
  return stage === 'prod' || stage === 'production';
}
