import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, readString, scenarioPassed } from '../utils.mjs';

function extractInstanceEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      publicId: '',
      ownerAccountId: '',
      accountId: '',
      widgetType: '',
    };
  }
  const account =
    payload.account && typeof payload.account === 'object' && !Array.isArray(payload.account)
      ? payload.account
      : null;
  return {
    publicId: readString(payload.publicId),
    ownerAccountId: readString(payload.ownerAccountId),
    accountId: readString(account?.id),
    widgetType: readString(payload.widgetType),
  };
}

export async function runInstanceOpenParityScenario({ profile, context }) {
  const checks = [];
  const accountId = readString(context.accountId);
  const publicId = readString(context.probePublicId);

  if (!accountId || !publicId) {
    checks.push(
      makeCheck('Bootstrap context includes accountId and probePublicId', false, {
        actual: { accountId, publicId },
      }),
    );
    return {
      scenario: 'instance-open-parity',
      passed: false,
      checks,
      fingerprint: { accountId, publicId },
    };
  }

  const headers = authHeaders(profile.authBearer);
  const bob = await fetchEnvelope(
    `${profile.bobBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
      publicId,
    )}?subject=account&_t=${Date.now()}`,
    { headers },
  );

  checks.push(makeCheck('Bob account instance route responds 200', bob.status === 200, { actual: bob.status }));

  const bobEnvelope = extractInstanceEnvelope(bob.json);

  checks.push(makeCheck('Bob instance envelope includes publicId', Boolean(bobEnvelope.publicId), { actual: bobEnvelope.publicId }));
  checks.push(
    makeCheck('Bob instance envelope includes ownerAccountId', Boolean(bobEnvelope.ownerAccountId), {
      actual: bobEnvelope.ownerAccountId,
    }),
    makeCheck('Bob instance envelope ownerAccountId matches bootstrap accountId', bobEnvelope.ownerAccountId === accountId, {
      actual: { expected: accountId, resolved: bobEnvelope.ownerAccountId },
    }),
  );

  if (profile.name === 'local') {
    return {
      scenario: 'instance-open-parity',
      passed: scenarioPassed(checks),
      checks,
      fingerprint: {
        publicId,
        accountId,
        ownerAccountId: bobEnvelope.ownerAccountId,
        widgetType: bobEnvelope.widgetType,
      },
    };
  }

  const roma = await fetchEnvelope(
    `${profile.romaBaseUrl.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
      publicId,
    )}?subject=account&_t=${Date.now()}`,
    { headers },
  );

  checks.push(makeCheck('Roma account instance route responds 200', roma.status === 200, { actual: roma.status }));

  const romaEnvelope = extractInstanceEnvelope(roma.json);

  checks.push(
    makeCheck('PublicId matches on Roma/Bob instance envelope', romaEnvelope.publicId === bobEnvelope.publicId, {
      actual: { roma: romaEnvelope.publicId, bob: bobEnvelope.publicId },
    }),
    makeCheck('ownerAccountId matches on Roma/Bob instance envelope', romaEnvelope.ownerAccountId === bobEnvelope.ownerAccountId, {
      actual: { roma: romaEnvelope.ownerAccountId, bob: bobEnvelope.ownerAccountId },
    }),
    makeCheck('account.id matches on Roma/Bob instance envelope', romaEnvelope.accountId === bobEnvelope.accountId, {
      actual: { roma: romaEnvelope.accountId, bob: bobEnvelope.accountId },
    }),
    makeCheck('widgetType matches on Roma/Bob instance envelope', romaEnvelope.widgetType === bobEnvelope.widgetType, {
      actual: { roma: romaEnvelope.widgetType, bob: bobEnvelope.widgetType },
    }),
  );

  return {
    scenario: 'instance-open-parity',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      publicId,
      accountId,
      ownerAccountId: romaEnvelope.ownerAccountId,
      widgetType: romaEnvelope.widgetType,
    },
  };
}
