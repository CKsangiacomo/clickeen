import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, normalizeHeader, readString, scenarioPassed, sleep, uniqueStrings } from '../utils.mjs';

function cacheIsNoStore(response) {
  const value = normalizeHeader(response.headers, 'cache-control').toLowerCase();
  return value.includes('no-store');
}

async function fetchEmbedHeaders({ profile, publicId }) {
  const headers = authHeaders(profile.supabaseBearer);
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

async function fetchPublishStatus({ profile, workspaceId, publicId }) {
  return fetchEnvelope(
    `${profile.parisBaseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      publicId,
    )}/publish/status?subject=workspace&_t=${Date.now()}`,
    {
      method: 'GET',
      headers: authHeaders(profile.supabaseBearer),
    },
  );
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
  const workspaceId = readString(context.workspaceId);
  const resolved = await resolvePublishProbePublicId({ profile, context });
  const publicId = readString(resolved.publicId);

  checks.push(
    makeCheck('Publish probe workspaceId is available in bootstrap context', Boolean(workspaceId), {
      actual: workspaceId || '<none>',
    }),
    makeCheck('Publish probe publicId resolves and is reachable via Venice /r + /e', Boolean(publicId), {
      actual: publicId || '<none>',
    }),
  );

  if (!workspaceId || !publicId || !resolved.sample) {
    return {
      scenario: 'publish-immediacy',
      passed: false,
      checks,
      fingerprint: { workspaceId, publicId },
    };
  }

  checks.push(
    makeCheck('Venice /r returns 200 before snapshot trigger', resolved.sample.r.status === 200, {
      actual: resolved.sample.r.status,
    }),
    makeCheck('Venice /e returns 200 before snapshot trigger', resolved.sample.e.status === 200, {
      actual: resolved.sample.e.status,
    }),
  );

  const snapshot = await fetchEnvelope(
    `${profile.parisBaseUrl}/api/workspaces/${encodeURIComponent(workspaceId)}/instances/${encodeURIComponent(
      publicId,
    )}/render-snapshot?subject=workspace&_t=${Date.now()}`,
    {
      method: 'POST',
      headers: authHeaders(profile.supabaseBearer),
      timeoutMs: Math.max(profile.publishLatencyBudgetMs + 12_000, 25_000),
      retries: 0,
    },
  );

  checks.push(
    makeCheck('Paris render-snapshot orchestration command accepted (200/202)', snapshot.status === 200 || snapshot.status === 202, {
      actual: snapshot.status,
    }),
    makeCheck(
      'Paris render-snapshot response includes snapshotState (queued|ready|pending)',
      ['queued', 'ready', 'pending'].includes(readString(snapshot.json?.snapshotState)),
      { actual: readString(snapshot.json?.snapshotState) || '<none>' },
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
      fetchPublishStatus({ profile, workspaceId, publicId }),
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
