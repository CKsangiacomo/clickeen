import { authHeaders, extractDefaults, fetchEnvelope } from '../http.mjs';
import { isUuid, makeCheck, readString, scenarioPassed } from '../utils.mjs';

function extractWidgetPublicIds(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const instances = Array.isArray(payload.instances) ? payload.instances : [];
  return instances
    .map((item) =>
      item && typeof item === 'object' && !Array.isArray(item) ? readString(item.publicId) : '',
    )
    .filter(Boolean);
}

function resolveRomaWidgetsUrl(profile, accountId) {
  const normalizedAccountId = readString(accountId);
  const base = profile.bobBaseUrl.replace(/\/+$/, '');
  return `${base}/api/roma/widgets?accountId=${encodeURIComponent(normalizedAccountId)}&_t=${Date.now()}`;
}

async function resolveProbePublicId({ profile, headers, accountId }) {
  const explicit = readString(profile.probePublicId);
  const debug = {
    explicit: explicit || null,
    widgets: { status: 0, count: 0 },
  };
  if (explicit) return { publicId: explicit, debug };

  const widgets = await fetchEnvelope(resolveRomaWidgetsUrl(profile, accountId), { headers });
  debug.widgets.status = widgets.status;
  if (widgets.status !== 200) return { publicId: '', debug };

  const publicIds = extractWidgetPublicIds(widgets.json);
  debug.widgets.count = publicIds.length;
  if (!publicIds.length) return { publicId: '', debug };
  return { publicId: publicIds[0] || '', debug };
}

export async function runBootstrapParityScenario({ profile }) {
  const checks = [];
  const headers = authHeaders(profile.authBearer);

  if (profile.name === 'local') {
    const bob = await fetchEnvelope(`${profile.bobBaseUrl.replace(/\/+$/, '')}/api/roma/bootstrap?_t=${Date.now()}`, { headers });
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
  const bob = await fetchEnvelope(`${profile.bobBaseUrl.replace(/\/+$/, '')}/api/roma/bootstrap?_t=${Date.now()}`, { headers });

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
