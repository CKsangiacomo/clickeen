import {
  applyAiRuntimeMatrixCellUpdate,
  applyEntitlementsMatrixCellUpdate,
  assertAiRuntimeMatrix,
  assertEntitlementsMatrix,
} from '@clickeen/ck-policy';
import { resolveDevstudioOrigin } from './env.js';
import { cloneResponseWithCookies, json, methodNotAllowed } from './http.js';
import { resolveDevstudioSession } from './session.js';

const DEFAULT_REPOSITORY = 'CKsangiacomo/clickeen';
const DEFAULT_BRANCH = 'main';

const POLICY_FILES = {
  entitlements: {
    path: 'packages/ck-policy/entitlements.matrix.json',
    missingReasonKey: 'coreui.errors.entitlements.notFound',
    updateFailedReasonKey: 'coreui.errors.entitlements.updateFailed',
    assertMatrix: assertEntitlementsMatrix,
    applyUpdate: applyEntitlementsMatrixCellUpdate,
    commitMessage(payload, before, after) {
      const entitlementKey = stringValue(payload?.entitlementKey);
      const tier = stringValue(payload?.tier);
      const previous = before?.entitlements?.[entitlementKey]?.values?.[tier];
      const next = after?.entitlements?.[entitlementKey]?.values?.[tier];
      return `policy(devstudio): ${entitlementKey} ${tier} ${formatPolicyValue(previous)} -> ${formatPolicyValue(next)}`;
    },
  },
  aiRuntime: {
    path: 'packages/ck-policy/ai-runtime.matrix.json',
    missingReasonKey: 'coreui.errors.aiRuntime.notFound',
    updateFailedReasonKey: 'coreui.errors.aiRuntime.updateFailed',
    assertMatrix: assertAiRuntimeMatrix,
    applyUpdate(input, payload) {
      return applyAiRuntimeMatrixCellUpdate(input, {
        agentId: stringValue(payload?.agentId),
        tier: stringValue(payload?.tier),
        field: stringValue(payload?.field),
        value: payload?.value,
        provider: typeof payload?.provider === 'string' ? payload.provider.trim() : undefined,
        model: typeof payload?.model === 'string' ? payload.model.trim() : undefined,
      });
    },
    commitMessage(payload) {
      const agentId = stringValue(payload?.agentId);
      const tier = stringValue(payload?.tier);
      const field = stringValue(payload?.field);
      const model = stringValue(payload?.model);
      const suffix = model ? ` ${model}` : '';
      return `policy(devstudio): ${agentId} ${tier} ${field}${suffix}`;
    },
  },
};

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatPolicyValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function resolveRepository(env) {
  const repository = stringValue(env.DEVSTUDIO_GITHUB_REPOSITORY) || DEFAULT_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('DEVSTUDIO_GITHUB_REPOSITORY invalid');
  }
  return repository;
}

function resolveBranch(env) {
  const branch = stringValue(env.DEVSTUDIO_GITHUB_BRANCH) || DEFAULT_BRANCH;
  if (!branch || branch.length > 128) throw new Error('DEVSTUDIO_GITHUB_BRANCH invalid');
  return branch;
}

function resolveGithubToken(env) {
  const token = stringValue(env.DEVSTUDIO_GITHUB_TOKEN) || stringValue(env.GITHUB_TOKEN);
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

function githubContentsUrl(env, path) {
  const repository = resolveRepository(env);
  return `https://api.github.com/repos/${repository}/contents/${path}`;
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

async function readGithubJsonFile(env, file) {
  const url = new URL(githubContentsUrl(env, file.path));
  url.searchParams.set('ref', resolveBranch(env));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: githubHeaders(env),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 404) {
    return {
      ok: false,
      response: json({ error: { kind: 'NOT_FOUND', reasonKey: file.missingReasonKey } }, 404),
    };
  }
  if (!response.ok || !payload) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'UPSTREAM_UNAVAILABLE',
            reasonKey: 'devstudio.errors.github.readFailed',
            status: response.status,
          },
        },
        502,
      ),
    };
  }

  try {
    const raw = decodeBase64Utf8(payload.content);
    const matrix = file.assertMatrix(JSON.parse(raw));
    return {
      ok: true,
      matrix,
      raw,
      sha: stringValue(payload.sha),
      path: file.path,
    };
  } catch (error) {
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: 'devstudio.errors.policy.invalidPersistedMatrix',
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        422,
      ),
    };
  }
}

async function commitGithubJsonFile(env, file, args) {
  const response = await fetch(githubContentsUrl(env, file.path), {
    method: 'PUT',
    headers: githubHeaders(env),
    cache: 'no-store',
    body: JSON.stringify({
      branch: resolveBranch(env),
      message: args.message,
      content: encodeBase64Utf8(`${JSON.stringify(args.matrix, null, 2)}\n`),
      sha: args.sha,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 409) {
    const latest = await readGithubJsonFile(env, file);
    return {
      ok: false,
      response: json(
        {
          error: {
            kind: 'CONFLICT',
            reasonKey: 'devstudio.errors.github.shaConflict',
            latestSha: latest.ok ? latest.sha : null,
          },
        },
        409,
      ),
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
  if (!origin) {
    return json(
      { error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.required' } },
      403,
    );
  }
  try {
    if (new URL(origin).origin === resolveDevstudioOrigin(env)) return null;
  } catch {
    return json({ error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.invalid' } }, 403);
  }
  return json({ error: { kind: 'AUTH', reasonKey: 'devstudio.errors.origin.forbidden' } }, 403);
}

async function withPolicySession(context, handler) {
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
          reasonKey: 'devstudio.errors.policy.config_missing',
          detail: error instanceof Error ? error.message : String(error),
        },
      },
      503,
    );
  }
}

export async function handlePolicyMatrixRequest(context, kind) {
  if (context.request.method.toUpperCase() !== 'GET') return methodNotAllowed();
  const file = POLICY_FILES[kind];
  if (!file) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, 404);

  return withPolicySession(context, async () => {
    const current = await readGithubJsonFile(context.env, file);
    if (!current.ok) return current.response;
    return json({ ok: true, path: current.path, sha: current.sha, matrix: current.matrix });
  });
}

export async function handlePolicyCellRequest(context, kind) {
  if (context.request.method.toUpperCase() !== 'POST') return methodNotAllowed();
  const file = POLICY_FILES[kind];
  if (!file) return json({ error: { kind: 'NOT_FOUND', reasonKey: 'coreui.errors.route.notFound' } }, 404);

  return withPolicySession(context, async () => {
    const payload = await readJsonBody(context.request);
    if (!payload) {
      return json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' } },
        422,
      );
    }

    const current = await readGithubJsonFile(context.env, file);
    if (!current.ok) return current.response;

    let nextMatrix;
    try {
      nextMatrix = file.applyUpdate(current.matrix, payload);
    } catch (error) {
      return json(
        {
          error: {
            kind: 'VALIDATION',
            reasonKey: file.updateFailedReasonKey,
            detail: error instanceof Error ? error.message : String(error),
          },
        },
        422,
      );
    }

    const committed = await commitGithubJsonFile(context.env, file, {
      matrix: nextMatrix,
      sha: current.sha,
      message: file.commitMessage(payload, current.matrix, nextMatrix),
    });
    if (!committed.ok) return committed.response;

    return json({
      ok: true,
      path: file.path,
      sha: committed.contentSha,
      commitSha: committed.commitSha,
      matrix: nextMatrix,
    });
  });
}
