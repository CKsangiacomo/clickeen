function readString(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : '';
}

export function resolveBerlinBaseUrl(env) {
  const configured = readString(env, 'BERLIN_BASE_URL');
  if (!configured) throw new Error('BERLIN_BASE_URL missing');
  return new URL(configured).toString().replace(/\/+$/, '');
}

export function resolveRomaBaseUrl(env) {
  const configured = readString(env, 'ROMA_BASE_URL');
  if (!configured) throw new Error('ROMA_BASE_URL missing');
  const url = new URL(configured);
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) throw new Error('ROMA_BASE_URL invalid');
  return url.origin;
}

export function resolveDevstudioOrigin(env) {
  const configured = readString(env, 'DEVSTUDIO_CANONICAL_ORIGIN');
  if (!configured) throw new Error('DEVSTUDIO_CANONICAL_ORIGIN missing');
  return new URL(configured).origin;
}

export function isProductionStage(env) {
  const stage = readString(env, 'ENV_STAGE').toLowerCase();
  return stage === 'prod' || stage === 'production';
}
