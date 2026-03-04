import { authHeaders, extractDefaults, fetchEnvelope } from '../http.mjs';
import { isUuid, makeCheck, readString, scenarioPassed } from '../utils.mjs';

function extractWidgetInstances(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const domains =
    payload.domains && typeof payload.domains === 'object' && !Array.isArray(payload.domains) ? payload.domains : null;
  const widgets =
    domains?.widgets && typeof domains.widgets === 'object' && !Array.isArray(domains.widgets) ? domains.widgets : null;
  const instances = Array.isArray(widgets?.instances) ? widgets.instances : [];
  return instances
    .map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? { publicId: readString(item.publicId), source: readString(item.source), widgetType: readString(item.widgetType) }
        : { publicId: '', source: '', widgetType: '' },
    )
    .filter((item) => item.publicId);
}

function resolveProbePublicId(profile, romaPayload, bobPayload) {
  const explicit = readString(profile.probePublicId);
  if (explicit) return explicit;
  const instances = [...extractWidgetInstances(romaPayload), ...extractWidgetInstances(bobPayload)];
  const accountFirst = instances.find((item) => item.source === 'account');
  if (accountFirst?.publicId) return accountFirst.publicId;
  return instances[0]?.publicId || '';
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
    const resolvedPublicId = resolveProbePublicId(profile, null, bob.json);

    checks.push(makeCheck('Probe publicId resolved', Boolean(resolvedPublicId), { actual: resolvedPublicId }));

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
  const resolvedPublicId = resolveProbePublicId(profile, roma.json, bob.json);

  if (profile.probeAccountId) {
    checks.push(
      makeCheck('Account matches configured probe accountId', resolvedAccountId === profile.probeAccountId, {
        actual: { expected: profile.probeAccountId, resolved: resolvedAccountId },
      }),
    );
  }
  checks.push(makeCheck('Probe publicId resolved', Boolean(resolvedPublicId), { actual: resolvedPublicId }));

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
