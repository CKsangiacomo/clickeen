import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, normalizeHeader, readString, scenarioPassed, sleep, uniqueStrings } from '../utils.mjs';

function cacheIsNoStore(response) {
  const value = normalizeHeader(response.headers, 'cache-control').toLowerCase();
  return value.includes('no-store');
}

async function fetchEmbedHeaders({ profile, publicId }) {
  const headers = authHeaders(profile.authBearer);
  const [r, e] = await Promise.all([
    fetchEnvelope(`${profile.veniceBaseUrl}/r/${encodeURIComponent(publicId)}?_t=${Date.now()}`, { headers }),
    fetchEnvelope(`${profile.veniceBaseUrl}/e/${encodeURIComponent(publicId)}?_t=${Date.now()}`, { headers }),
  ]);

  return {
    r,
    e,
    rPointerUpdatedAt: normalizeHeader(r.response.headers, 'x-ck-render-pointer-updated-at'),
    ePointerUpdatedAt: normalizeHeader(e.response.headers, 'x-ck-render-pointer-updated-at'),
    rCacheControl: normalizeHeader(r.response.headers, 'cache-control'),
    eCacheControl: normalizeHeader(e.response.headers, 'cache-control'),
  };
}

async function fetchPublishStatus({ profile, accountId, publicId }) {
  const url =
    profile.name === 'local'
      ? `${profile.bobBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
          publicId,
        )}/publish/status?subject=account&_t=${Date.now()}`
      : `${profile.parisBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
          publicId,
        )}/publish/status?subject=account&_t=${Date.now()}`;

  return fetchEnvelope(url, {
    method: 'GET',
    headers: authHeaders(profile.authBearer),
  });
}

async function resolvePublishProbePublicId({ profile, context }) {
  const candidates = uniqueStrings([
    profile.probePublishPublicId,
    context.probePublicId,
    profile.probePublicId,
  ]);

  for (const candidate of candidates) {
    const sample = await fetchEmbedHeaders({ profile, publicId: candidate });
    if (sample.r.status === 200 && sample.e.status === 200) {
      return {
        publicId: candidate,
        sample,
      };
    }
  }

  return {
    publicId: '',
    sample: null,
  };
}

function pointerChanged(after, before) {
  if (!after) return false;
  if (!before) return true;
  return after !== before;
}

function readPublishOverall(payload) {
  return readString(payload?.pipeline?.overall).toLowerCase();
}

function isNonBlockedPublishOverall(overall) {
  return Boolean(overall) && overall !== 'awaiting_snapshot' && overall !== 'failed' && overall !== 'unpublished';
}

export async function runPublishImmediacyScenario({ profile, context }) {
  const checks = [];
  const accountId = readString(context.accountId);
  const configuredPublishProbePublicId = readString(profile.probePublishPublicId);
  const publishProbeConfigured = Boolean(configuredPublishProbePublicId);
  const resolved = await resolvePublishProbePublicId({ profile, context });
  const publicId = readString(resolved.publicId);

  checks.push(
    makeCheck('Publish probe accountId is available in bootstrap context', Boolean(accountId), {
      actual: accountId || '<none>',
    }),
    makeCheck('Publish probe publicId configuration (enables publish-immediacy checks)', true, {
      actual: publishProbeConfigured
        ? configuredPublishProbePublicId
        : 'missing (set RUNTIME_PARITY_PUBLISH_PUBLIC_ID to enforce publish-immediacy checks)',
    }),
  );

  if (!accountId) {
    return {
      scenario: 'publish-immediacy',
      passed: false,
      checks,
      fingerprint: { accountId, publicId },
    };
  }

  if (!publicId || !resolved.sample) {
    if (!publishProbeConfigured) {
      checks.push(
        makeCheck('Publish-immediacy checks are skipped when no published probe publicId is configured', true, {
          actual: profile.name,
        }),
      );
      return {
        scenario: 'publish-immediacy',
        passed: scenarioPassed(checks),
        checks,
        fingerprint: { accountId, publicId },
      };
    }

    checks.push(
      makeCheck('Publish probe publicId resolves and is reachable via Venice /r + /e', false, {
        actual: publicId || '<none>',
      }),
    );
    return {
      scenario: 'publish-immediacy',
      passed: false,
      checks,
      fingerprint: { accountId, publicId },
    };
  }

  checks.push(
    makeCheck('Publish probe publicId resolves and is reachable via Venice /r + /e', true, {
      actual: publicId,
    }),
  );

  checks.push(
    makeCheck('Venice /r returns 200 before snapshot trigger', resolved.sample.r.status === 200, {
      actual: resolved.sample.r.status,
    }),
    makeCheck('Venice /e returns 200 before snapshot trigger', resolved.sample.e.status === 200, {
      actual: resolved.sample.e.status,
    }),
  );

  const instanceUrl =
    profile.name === 'local'
      ? `${profile.bobBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
          publicId,
        )}?subject=account&_t=${Date.now()}`
      : `${profile.parisBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
          publicId,
        )}?subject=account&_t=${Date.now()}`;

  const beforeUpdate = await fetchEnvelope(instanceUrl, {
    method: 'GET',
    headers: authHeaders(profile.authBearer),
  });

  const currentConfig =
    beforeUpdate.ok && beforeUpdate.json && typeof beforeUpdate.json === 'object' && !Array.isArray(beforeUpdate.json)
      ? beforeUpdate.json.config
      : null;

  const update = await fetchEnvelope(instanceUrl, {
    method: 'PUT',
    headers: authHeaders(profile.authBearer, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      config:
        currentConfig && typeof currentConfig === 'object' && !Array.isArray(currentConfig)
          ? { ...currentConfig, __runtimeParity: `publish-immediacy.${Date.now()}` }
          : { __runtimeParity: `publish-immediacy.${Date.now()}` },
    }),
    timeoutMs: Math.max(profile.publishLatencyBudgetMs + 12_000, 25_000),
    retries: 0,
  });

  checks.push(
    makeCheck(
      profile.name === 'local' ? 'Account instance update accepted (200)' : 'Paris account instance update accepted (200)',
      update.status === 200,
      { actual: update.status },
    ),
  );

  const baselineR = resolved.sample.rPointerUpdatedAt;
  const baselineE = resolved.sample.ePointerUpdatedAt;
  const startedAtMs = Date.now();
  const hardTimeoutMs = Math.max(profile.publishLatencyBudgetMs, 7_000) + 5_000;
  const deadlineMs = startedAtMs + hardTimeoutMs;

  let observed = null;
  let observedPublishStatus = null;
  let pointerShifted = false;
  while (Date.now() <= deadlineMs) {
    const [sample, publishStatus] = await Promise.all([
      fetchEmbedHeaders({ profile, publicId }),
      fetchPublishStatus({ profile, accountId, publicId }),
    ]);
    const rChanged = pointerChanged(sample.rPointerUpdatedAt, baselineR);
    const eChanged = pointerChanged(sample.ePointerUpdatedAt, baselineE);
    const overall = readPublishOverall(publishStatus.json);
    const publishSettled = publishStatus.status === 200 && isNonBlockedPublishOverall(overall);
    if (sample.r.status === 200 && sample.e.status === 200 && publishSettled) {
      observed = sample;
      observedPublishStatus = { status: publishStatus.status, overall };
      pointerShifted = rChanged && eChanged;
      break;
    }
    await sleep(250);
  }

  const observedAtMs = Date.now();
  const deltaMs = observed ? observedAtMs - startedAtMs : null;

  checks.push(
    makeCheck('Venice /r cache-control is no-store after snapshot trigger', Boolean(observed) && cacheIsNoStore(observed.r.response), {
      actual: observed?.rCacheControl || '',
    }),
    makeCheck('Venice /e cache-control is no-store after snapshot trigger', Boolean(observed) && cacheIsNoStore(observed.e.response), {
      actual: observed?.eCacheControl || '',
    }),
    makeCheck('Venice /r exposes pointer updated timestamp header', Boolean(observed?.rPointerUpdatedAt), {
      actual: observed?.rPointerUpdatedAt || '',
    }),
    makeCheck('Venice /e exposes pointer updated timestamp header', Boolean(observed?.ePointerUpdatedAt), {
      actual: observed?.ePointerUpdatedAt || '',
    }),
    makeCheck(
      'Paris publish pipeline reaches non-blocked overall state',
      Boolean(observedPublishStatus?.overall) && isNonBlockedPublishOverall(observedPublishStatus.overall),
      { actual: observedPublishStatus || null },
    ),
    makeCheck('Publish reaches observable Venice state on /r + /e', Boolean(observed), {
      actual: {
        baselineR,
        baselineE,
        observedR: observed?.rPointerUpdatedAt || '',
        observedE: observed?.ePointerUpdatedAt || '',
        pointerShifted,
      },
    }),
    makeCheck(
      `Publish-to-observable latency <= ${profile.publishLatencyBudgetMs}ms`,
      typeof deltaMs === 'number' && deltaMs <= profile.publishLatencyBudgetMs,
      { actual: deltaMs },
    ),
  );

  return {
    scenario: 'publish-immediacy',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      publicId,
      deltaMs,
      budgetMs: profile.publishLatencyBudgetMs,
      pointerShifted,
      publishOverall: observedPublishStatus?.overall || '',
      rPointerUpdatedAt: observed?.rPointerUpdatedAt || '',
      ePointerUpdatedAt: observed?.ePointerUpdatedAt || '',
    },
  };
}
