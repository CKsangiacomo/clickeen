import { authHeaders, extractDefaults, fetchEnvelope } from '../http.mjs';
import { isUuid, makeCheck, readString, scenarioPassed } from '../utils.mjs';
import crypto from 'node:crypto';

function extractAccountInstancePublicIds(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const instances = Array.isArray(payload.instances) ? payload.instances : [];
  return instances
    .map((item) =>
      item && typeof item === 'object' && !Array.isArray(item) ? readString(item.publicId) : '',
    )
    .filter(Boolean);
}

function createProbePublicId(widgetType) {
  const normalized = readString(widgetType)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
  return `wgt_${stem}_u_${suffix}`;
}

function resolveAccountInstancesUrl(profile, accountId) {
  const normalizedAccountId = readString(accountId);
  const base =
    profile.name === 'local'
      ? `${profile.bobBaseUrl.replace(/\/+$/, '')}/api/paris`
      : profile.parisBaseUrl.replace(/\/+$/, '');
  const path = profile.name === 'local'
    ? `/accounts/${encodeURIComponent(normalizedAccountId)}/instances`
    : `/api/accounts/${encodeURIComponent(normalizedAccountId)}/instances`;
  return `${base}${path}?subject=account&_t=${Date.now()}`;
}

function resolveAccountInstancesCreateUrl(profile, accountId) {
  const normalizedAccountId = readString(accountId);
  const base =
    profile.name === 'local'
      ? `${profile.bobBaseUrl.replace(/\/+$/, '')}/api/paris`
      : profile.parisBaseUrl.replace(/\/+$/, '');
  const path = profile.name === 'local'
    ? `/accounts/${encodeURIComponent(normalizedAccountId)}/instances`
    : `/api/accounts/${encodeURIComponent(normalizedAccountId)}/instances`;
  return `${base}${path}?subject=account&_t=${Date.now()}`;
}

async function resolveProbePublicId({ profile, headers, accountId }) {
  const explicit = readString(profile.probePublicId);
  const debug = {
    explicit: explicit || null,
    list: { status: 0, count: 0 },
    create: { attempted: false, status: 0, reasonKey: null },
  };
  if (explicit) return { publicId: explicit, debug };

  const list = await fetchEnvelope(resolveAccountInstancesUrl(profile, accountId), { headers });
  debug.list.status = list.status;
  if (list.status === 200) {
    const publicIds = extractAccountInstancePublicIds(list.json);
    debug.list.count = publicIds.length;
    if (publicIds.length) return { publicId: publicIds[0] || '', debug };
  }

  if (profile.name !== 'local') return { publicId: '', debug };

  const widgetType = 'countdown';
  const publicId = createProbePublicId(widgetType);
  debug.create.attempted = true;
  const create = await fetchEnvelope(resolveAccountInstancesCreateUrl(profile, accountId), {
    method: 'POST',
    headers: authHeaders(profile.authBearer, { 'content-type': 'application/json' }),
    body: JSON.stringify({
      publicId,
      widgetType,
      status: 'unpublished',
      config: {},
    }),
    retries: 0,
  });
  debug.create.status = create.status;
  debug.create.reasonKey = readString(create.json?.error?.reasonKey) || readString(create.json?.error) || null;
  if (create.status !== 200) return { publicId: '', debug };
  const createdPublicId = readString(create.json?.publicId);
  return { publicId: createdPublicId || publicId, debug };
}

export async function runBootstrapParityScenario({ profile }) {
  const checks = [];
  const headers = authHeaders(profile.authBearer);

  if (profile.name === 'local') {
    const bob = await fetchEnvelope(`${profile.bobBaseUrl}/api/paris/roma/bootstrap?_t=${Date.now()}`, { headers });
    checks.push(makeCheck('Bob bootstrap responds 200', bob.status === 200, { actual: bob.status }));

    const bobDefaults = extractDefaults(bob.json);
    checks.push(
      makeCheck('Bob default accountId is UUID', isUuid(bobDefaults.accountId), { actual: bobDefaults.accountId }),
    );

    const resolvedAccountId = bobDefaults.accountId || '';
    const resolvedProbe = await resolveProbePublicId({ profile, headers, accountId: resolvedAccountId });
    const resolvedPublicId = readString(resolvedProbe.publicId);

    checks.push(makeCheck('Probe publicId resolved', Boolean(resolvedPublicId), { actual: resolvedProbe }));

    return {
      scenario: 'bootstrap-parity',
      passed: scenarioPassed(checks),
      checks,
      fingerprint: {
        accountId: resolvedAccountId,
        probePublicId: resolvedPublicId,
      },
      contextUpdate: {
        accountId: resolvedAccountId,
        probePublicId: resolvedPublicId,
      },
    };
  }

  const roma = await fetchEnvelope(`${profile.romaBaseUrl}/api/bootstrap?_t=${Date.now()}`, { headers });
  const bob = await fetchEnvelope(`${profile.bobBaseUrl}/api/paris/roma/bootstrap?_t=${Date.now()}`, { headers });

  checks.push(
    makeCheck('Roma bootstrap responds 200', roma.status === 200, { actual: roma.status }),
    makeCheck('Bob bootstrap responds 200', bob.status === 200, { actual: bob.status }),
  );

  const romaDefaults = extractDefaults(roma.json);
  const bobDefaults = extractDefaults(bob.json);

  checks.push(
    makeCheck('Roma default accountId is UUID', isUuid(romaDefaults.accountId), { actual: romaDefaults.accountId }),
    makeCheck('Bob default accountId is UUID', isUuid(bobDefaults.accountId), { actual: bobDefaults.accountId }),
    makeCheck('Roma/Bob accountId match', romaDefaults.accountId === bobDefaults.accountId, {
      actual: { roma: romaDefaults.accountId, bob: bobDefaults.accountId },
    }),
  );

  const resolvedAccountId = romaDefaults.accountId || bobDefaults.accountId || '';
  const resolvedProbe = await resolveProbePublicId({ profile, headers, accountId: resolvedAccountId });
  const resolvedPublicId = readString(resolvedProbe.publicId);

  if (profile.probeAccountId) {
    checks.push(
      makeCheck('Account matches configured probe accountId', resolvedAccountId === profile.probeAccountId, {
        actual: { expected: profile.probeAccountId, resolved: resolvedAccountId },
      }),
    );
  }
  checks.push(makeCheck('Probe publicId resolved', Boolean(resolvedPublicId), { actual: resolvedProbe }));

  return {
    scenario: 'bootstrap-parity',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      accountId: resolvedAccountId,
      probePublicId: resolvedPublicId,
    },
    contextUpdate: {
      accountId: resolvedAccountId,
      probePublicId: resolvedPublicId,
    },
  };
}
