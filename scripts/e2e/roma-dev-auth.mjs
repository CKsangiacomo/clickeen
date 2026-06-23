import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ROMA_URL = 'https://roma.dev.clickeen.com';
const DEFAULT_BERLIN_URL = 'https://berlin-dev.clickeen.workers.dev';
const DEFAULT_AUTH_STATE = 'e2e/.auth/roma-dev.json';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const equals = trimmed.indexOf('=');
  if (equals === -1) return null;
  const key = trimmed.slice(0, equals).trim();
  let value = trimmed.slice(equals + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return key ? [key, value] : null;
}

async function loadLocalEnv() {
  let text = '';
  try {
    text = await fs.readFile('.env.local', 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (process.env[key] == null) process.env[key] = value;
  }
}

function requiredEnv(primary, fallback) {
  const value = process.env[primary] || (fallback ? process.env[fallback] : '');
  if (value) return value;
  const names = fallback ? `${primary} or ${fallback}` : primary;
  throw new Error(`Missing ${names} in environment or .env.local`);
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  const cookies = [];
  let start = 0;
  for (let index = 0; index < header.length; index += 1) {
    if (header[index] !== ',') continue;
    const rest = header.slice(index + 1);
    if (/^\s*[^=;,]+\s*=/.test(rest)) {
      cookies.push(header.slice(start, index).trim());
      start = index + 1;
    }
  }
  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}

function responseSetCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  return splitSetCookieHeader(response.headers.get('set-cookie'));
}

function parseSetCookie(setCookie, fallbackHostname) {
  const parts = setCookie.split(';').map((part) => part.trim()).filter(Boolean);
  const [nameValue, ...attrs] = parts;
  const equals = nameValue.indexOf('=');
  if (equals <= 0) return null;

  const cookie = {
    name: nameValue.slice(0, equals),
    value: nameValue.slice(equals + 1),
    domain: fallbackHostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  };

  for (const attr of attrs) {
    const [rawKey, ...rawValue] = attr.split('=');
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join('=').trim();
    if (key === 'domain' && value) cookie.domain = value.toLowerCase();
    if (key === 'path' && value) cookie.path = value;
    if (key === 'max-age') {
      const maxAge = Number(value);
      if (Number.isFinite(maxAge)) cookie.expires = Math.floor(Date.now() / 1000) + maxAge;
    }
    if (key === 'expires' && value && cookie.expires === -1) {
      const expires = Date.parse(value);
      if (Number.isFinite(expires)) cookie.expires = Math.floor(expires / 1000);
    }
    if (key === 'httponly') cookie.httpOnly = true;
    if (key === 'secure') cookie.secure = true;
    if (key === 'samesite') {
      const normalized = value.toLowerCase();
      if (normalized === 'strict') cookie.sameSite = 'Strict';
      if (normalized === 'lax') cookie.sameSite = 'Lax';
      if (normalized === 'none') cookie.sameSite = 'None';
    }
  }

  return cookie;
}

function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function main() {
  await loadLocalEnv();

  const romaBase = (process.env.E2E_ROMA_URL || process.env.E2E_BASE_URL || DEFAULT_ROMA_URL).replace(/\/+$/, '');
  const berlinBase = (process.env.E2E_BERLIN_URL || DEFAULT_BERLIN_URL).replace(/\/+$/, '');
  const authStatePath = process.env.E2E_AUTH_STATE || DEFAULT_AUTH_STATE;
  const email = requiredEnv('BERLIN_DEV_ADMIN_EMAIL', 'CK_ADMIN_EMAIL');
  const password = requiredEnv('BERLIN_DEV_ADMIN_PASSWORD', 'CK_ADMIN_PASSWORD');

  const finishRedirectUrl = new URL('/api/session/finish', romaBase).toString();
  const loginResponse = await fetch(`${berlinBase}/auth/login/dev-admin`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      next: '/home',
      finishRedirectUrl,
    }),
    redirect: 'manual',
  });
  const loginPayload = await readJson(loginResponse);
  if (!loginResponse.ok || !loginPayload?.ok || typeof loginPayload.finishUrl !== 'string') {
    throw new Error(`Berlin dev admin login failed with HTTP ${loginResponse.status}`);
  }

  const finishResponse = await fetch(loginPayload.finishUrl, {
    method: 'GET',
    redirect: 'manual',
  });
  if (finishResponse.status < 300 || finishResponse.status > 399) {
    throw new Error(`Roma session finish failed with HTTP ${finishResponse.status}`);
  }

  const romaHostname = new URL(romaBase).hostname;
  const cookies = responseSetCookies(finishResponse)
    .map((value) => parseSetCookie(value, romaHostname))
    .filter(Boolean);
  if (!cookies.length) {
    throw new Error('Roma session finish did not set cookies');
  }

  const meResponse = await fetch(new URL('/api/me', romaBase), {
    headers: {
      accept: 'application/json',
      cookie: cookieHeader(cookies),
    },
  });
  const mePayload = await readJson(meResponse);
  if (!meResponse.ok || mePayload?.error) {
    throw new Error(`Roma /api/me rejected generated auth state with HTTP ${meResponse.status}`);
  }

  const storageState = {
    cookies,
    origins: [],
  };
  await fs.mkdir(path.dirname(authStatePath), { recursive: true });
  await fs.writeFile(authStatePath, `${JSON.stringify(storageState, null, 2)}\n`);
  console.log(`Wrote authenticated Roma storage state to ${authStatePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
