import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, parseReasonKey, readString, scenarioPassed } from '../utils.mjs';

function extractInstanceEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      publicId: '',
      ownerAccountId: '',
      workspaceId: '',
      workspaceAccountId: '',
    };
  }
  const workspace =
    payload.workspace && typeof payload.workspace === 'object' && !Array.isArray(payload.workspace)
      ? payload.workspace
      : null;
  return {
    publicId: readString(payload.publicId),
    ownerAccountId: readString(payload.ownerAccountId),
    workspaceId: readString(workspace?.id),
    workspaceAccountId: readString(workspace?.accountId),
  };
}

export async function runInstanceOpenParityScenario({ profile, context }) {
  const checks = [];
  const workspaceId = readString(context.workspaceId);
  const publicId = readString(context.probePublicId);

  if (!workspaceId || !publicId) {
    checks.push(
      makeCheck('Bootstrap context includes workspaceId and probePublicId', false, {
        actual: { workspaceId, publicId },
      }),
    );
    return {
      scenario: 'instance-open-parity',
      passed: false,
      checks,
      fingerprint: { workspaceId, publicId },
    };
  }

  const headers = authHeaders(profile.authBearer);
  const bob = await fetchEnvelope(
    `${profile.bobBaseUrl}/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instance/${encodeURIComponent(
      publicId,
    )}?subject=workspace&_t=${Date.now()}`,
    { headers },
  );

  checks.push(makeCheck('Bob workspace instance route responds 200', bob.status === 200, { actual: bob.status }));

  const bobEnvelope = extractInstanceEnvelope(bob.json);

  checks.push(makeCheck('Bob instance envelope includes publicId', Boolean(bobEnvelope.publicId), { actual: bobEnvelope.publicId }));

  const bobMissingWorkspace = await fetchEnvelope(
    `${profile.bobBaseUrl}/api/paris/instance/${encodeURIComponent(publicId)}?subject=workspace&_t=${Date.now()}`,
    { headers },
  );
  const bobMissingReason = parseReasonKey(bobMissingWorkspace.json);

  checks.push(
    makeCheck('Bob missing workspace context returns 422', bobMissingWorkspace.status === 422, {
      actual: bobMissingWorkspace.status,
    }),
    makeCheck('Bob missing workspace reasonKey is coreui.errors.workspaceId.invalid', bobMissingReason === 'coreui.errors.workspaceId.invalid', {
      actual: bobMissingReason,
    }),
  );

  if (profile.name === 'local') {
    return {
      scenario: 'instance-open-parity',
      passed: scenarioPassed(checks),
      checks,
      fingerprint: {
        publicId,
        workspaceId,
        ownerAccountId: bobEnvelope.ownerAccountId,
        workspaceAccountId: bobEnvelope.workspaceAccountId,
        missingWorkspaceReason: bobMissingReason,
      },
    };
  }

  const roma = await fetchEnvelope(
    `${profile.romaBaseUrl}/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(
      workspaceId,
    )}&_t=${Date.now()}`,
    { headers },
  );

  checks.push(makeCheck('Roma workspace instance route responds 200', roma.status === 200, { actual: roma.status }));

  const romaEnvelope = extractInstanceEnvelope(roma.json);

  checks.push(
    makeCheck('PublicId matches on Roma/Bob instance envelope', romaEnvelope.publicId === bobEnvelope.publicId, {
      actual: { roma: romaEnvelope.publicId, bob: bobEnvelope.publicId },
    }),
    makeCheck('ownerAccountId matches on Roma/Bob instance envelope', romaEnvelope.ownerAccountId === bobEnvelope.ownerAccountId, {
      actual: { roma: romaEnvelope.ownerAccountId, bob: bobEnvelope.ownerAccountId },
    }),
    makeCheck('workspace.id matches on Roma/Bob instance envelope', romaEnvelope.workspaceId === bobEnvelope.workspaceId, {
      actual: { roma: romaEnvelope.workspaceId, bob: bobEnvelope.workspaceId },
    }),
    makeCheck('workspace.accountId matches on Roma/Bob instance envelope', romaEnvelope.workspaceAccountId === bobEnvelope.workspaceAccountId, {
      actual: { roma: romaEnvelope.workspaceAccountId, bob: bobEnvelope.workspaceAccountId },
    }),
  );

  const romaMissingWorkspace = await fetchEnvelope(
    `${profile.romaBaseUrl}/api/paris/instance/${encodeURIComponent(publicId)}?subject=workspace&_t=${Date.now()}`,
    { headers },
  );
  const romaMissingReason = parseReasonKey(romaMissingWorkspace.json);

  checks.push(
    makeCheck('Roma missing workspace context returns 422', romaMissingWorkspace.status === 422, {
      actual: romaMissingWorkspace.status,
    }),
    makeCheck('Roma missing workspace reasonKey is coreui.errors.workspaceId.invalid', romaMissingReason === 'coreui.errors.workspaceId.invalid', {
      actual: romaMissingReason,
    }),
    makeCheck(
      'Roma and Bob missing workspace reasonKey match',
      romaMissingReason === bobMissingReason,
      {
        actual: { roma: romaMissingReason, bob: bobMissingReason },
      },
    ),
  );

  return {
    scenario: 'instance-open-parity',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      publicId,
      workspaceId,
      ownerAccountId: romaEnvelope.ownerAccountId,
      workspaceAccountId: romaEnvelope.workspaceAccountId,
      missingWorkspaceReason: romaMissingReason,
    },
  };
}
