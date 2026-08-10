import { resolveDevstudioOrigin } from './env.js';
import { cloneResponseWithCookies, json, methodNotAllowed } from './http.js';
import { resolveDevstudioSession } from './session.js';
import {
  parseEditableDieterTokens,
  replaceDieterTokenValue,
  TOKEN_FILES,
} from './dieter-token-contracts.js';

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveRepository(env) {
  const repository = stringValue(env.DEVSTUDIO_GITHUB_REPOSITORY);
  if (!repository) throw new Error('DEVSTUDIO_GITHUB_REPOSITORY missing');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('DEVSTUDIO_GITHUB_REPOSITORY invalid');
  }
  return repository;
}

function resolveBranch(env) {
  const branch = stringValue(env.DEVSTUDIO_GITHUB_BRANCH);
  if (!branch) throw new Error('DEVSTUDIO_GITHUB_BRANCH missing');
  if (branch.length > 128) throw new Error('DEVSTUDIO_GITHUB_BRANCH invalid');
  return branch;
}

function resolveGithubToken(env) {
  const token = stringValue(env.DEVSTUDIO_GITHUB_TOKEN);
  if (!token) throw new Error('DEVSTUDIO_GITHUB_TOKEN missing');
  return token;
}

function githubHeaders(env) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${resolveGithubToken(env)}`,
    'content-type': 'application/json',
    'user-agent': 'clickeen-devstudio',
    'x-github-api-version': '2022-11-28',
  };
}

function githubContentsUrl(env, filePath) {
  return `https://api.github.com/repos/${resolveRepository(env)}/contents/${filePath}`;
}

function decodeBase64Utf8(input) {
  const binary = atob(String(input || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function encodeBase64Utf8(input) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

async function readGithubCssFile(env, file, dependencySources = []) {
  const url = new URL(githubContentsUrl(env, file.path));
  url.searchParams.set('ref', resolveBranch(env));
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: githubHeaders(env),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 404) {
    return { ok: false, response: json({ error: { kind: 'NOT_FOUND', reasonKey: 'devstudio.errors.dieterTokens.notFound' } }, 404) };
  }
  if (!response.ok || !payload) {
    return {
      ok: false,
      response: json({ error: { kind: 'UPSTREAM_UNAVAILABLE', reasonKey: 'devstudio.errors.github.readFailed', status: response.status } }, 502),
    };
  }
  const raw = decodeBase64Utf8(payload.content);
  return {
    ok: true,
    raw,
    sha: stringValue(payload.sha),
    path: file.path,
    tokens: parseEditableDieterTokens(raw, file, dependencySources),
  };
}

async function readTokenDependencySources(env, kind) {
  if (kind !== 'foundation') return { ok: true, sources: [] };
  const colors = await readGithubCssFile(env, TOKEN_FILES.colors);
  if (!colors.ok) return colors;
  return { ok: true, sources: [colors.raw] };
}

async function commitGithubCssFile(env, file, args) {
  const response = await fetch(githubContentsUrl(env, file.path), {
    method: 'PUT',
    headers: githubHeaders(env),
    cache: 'no-store',
    body: JSON.stringify({
      branch: resolveBranch(env),
      message: args.message,
      content: encodeBase64Utf8(args.raw),
      sha: args.sha,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 409) {
    const latest = await readGithubCssFile(env, file);
    return {
      ok: false,
      response: json({ error: { kind: 'CONFLICT', reasonKey: 'devstudio.errors.github.shaConflict', latestSha: latest.ok ? latest.sha : null } }, 409),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'devstudio.errors.github.writeFailed',
            status: response.status,
            detail: payload?.message || null,
          },
        },
        response.status >= 400 && response.status < 500 ? response.status : 502,
      ),
    };
  }
  return {
    ok: true,
    commitSha: stringValue(payload?.commit?.sha),
    contentSha: stringValue(payload?.content?.sha),
  };
}

async function readJsonBody(request) {
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload;
}

function unsafeOriginFailure(request, env) {
  if (request.method.toUpperCase() !== 'POST') return null;
  const origin = stringValue(request.headers.get('origin'));
  if (!origin) return json({ error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.required' } }, 403);
  try {
    if (new URL(origin).origin === resolveDevstudioOrigin(env)) return null;
  } catch {
    return json({ error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.invalid' } }, 403);
  }
  return json({ error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.forbidden' } }, 403);
}

async function withDieterTokenSession(context, handler) {
  const originFailure = unsafeOriginFailure(context.request, context.env);
  if (originFailure) return originFailure;

  const session = await resolveDevstudioSession(context.request, context.env).catch(() => ({
    ok: false,
    status: 503,
    reasonKey: 'devstudio.errors.auth.config_missing',
  }));
  if (!session.ok) {
    return json(
      {
        error: {
          kind: session.status === 403 ? 'DENY' : 'AUTH',
          reasonKey: session.reasonKey || 'coreui.errors.auth.required',
        },
      },
      session.status || 401,
    );
  }

  try {
    const response = await handler(session);
    return cloneResponseWithCookies(response, session.setCookies);
  } catch (error) {
    return json(
      {
        error: {
          kind: 'INTERNAL',
          reasonKey: 'devstudio.errors.dieterTokens.configMissing',
          detail: error instanceof Error ? error.message : String(error),
        },
      },
      503,
    );
  }
}

export async function handleDieterTokensRequest(context, kind) {
  if (context.request.method.toUpperCase() !== 'GET') return methodNotAllowed();
  const file = TOKEN_FILES[kind];
  if (!file) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, 404);

  return withDieterTokenSession(context, async () => {
    const dependencies = await readTokenDependencySources(context.env, kind);
    if (!dependencies.ok) return dependencies.response;
    const current = await readGithubCssFile(context.env, file, dependencies.sources);
    if (!current.ok) return current.response;
    return json({ ok: true, path: current.path, sha: current.sha, tokens: current.tokens });
  });
}

export async function handleDieterTokenValueRequest(context, kind) {
  if (context.request.method.toUpperCase() !== 'POST') return methodNotAllowed();
  const file = TOKEN_FILES[kind];
  if (!file) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, 404);

  return withDieterTokenSession(context, async () => {
    const payload = await readJsonBody(context.request);
    if (!payload) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } }, 422);
    }
    const token = stringValue(payload.token);
    const value = typeof payload.value === 'string' ? payload.value : '';
    if (!token || !value) {
      return json({ error: { kind: 'VALIDATION', reasonKey: 'devstudio.errors.dieterTokens.required' } }, 422);
    }

    const dependencies = await readTokenDependencySources(context.env, kind);
    if (!dependencies.ok) return dependencies.response;
    const current = await readGithubCssFile(context.env, file, dependencies.sources);
    if (!current.ok) return current.response;
    const replaced = replaceDieterTokenValue(
      current.raw,
      file,
      token,
      value,
      dependencies.sources,
    );
    if (!replaced.ok) {
      return json({ error: { kind: 'VALIDATION', reasonKey: replaced.reasonKey } }, 422);
    }

    const committed = await commitGithubCssFile(context.env, file, {
      raw: replaced.raw,
      sha: current.sha,
      message: `dieter(devstudio): ${token} ${value}`,
    });
    if (!committed.ok) return committed.response;

    const tokens = parseEditableDieterTokens(replaced.raw, file, dependencies.sources);
    return json({
      ok: true,
      path: file.path,
      sha: committed.contentSha,
      commitSha: committed.commitSha,
      tokens,
    });
  });
}
