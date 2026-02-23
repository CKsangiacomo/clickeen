import crypto from 'node:crypto';
import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, parseReasonKey, randomAssetBytes, readString, scenarioPassed } from '../utils.mjs';

async function runAssetFlow({ hostLabel, hostBaseUrl, bearer, accountId, workspaceId }) {
  const uploadHeaders = authHeaders(bearer, {
    'content-type': 'application/octet-stream',
    'x-filename': `runtime-parity-${hostLabel}-upload.bin`,
    'x-variant': 'original',
    'x-account-id': accountId,
    'x-workspace-id': workspaceId,
    'x-source': 'api',
  });
  const upload = await fetchEnvelope(`${hostBaseUrl}/api/assets/upload?_t=${Date.now()}`, {
    method: 'POST',
    headers: uploadHeaders,
    body: randomAssetBytes(`${hostLabel}-upload`),
  });

  const uploadedAssetId = readString(upload.json?.assetId);
  const resolvedAccountId = readString(upload.json?.accountId) || accountId;

  const replaceHeaders = authHeaders(bearer, {
    'content-type': 'application/octet-stream',
    'x-filename': `runtime-parity-${hostLabel}-replace.bin`,
    'x-variant': 'original',
    'x-account-id': resolvedAccountId,
    'x-workspace-id': workspaceId,
    'x-source': 'api',
    'idempotency-key': crypto.randomUUID(),
  });

  const replace = uploadedAssetId
    ? await fetchEnvelope(
        `${hostBaseUrl}/api/assets/${encodeURIComponent(resolvedAccountId)}/${encodeURIComponent(
          uploadedAssetId,
        )}/content?_t=${Date.now()}`,
        {
          method: 'PUT',
          headers: replaceHeaders,
          body: randomAssetBytes(`${hostLabel}-replace`),
        },
      )
    : null;

  const deleted = uploadedAssetId
    ? await fetchEnvelope(
        `${hostBaseUrl}/api/assets/${encodeURIComponent(resolvedAccountId)}/${encodeURIComponent(
          uploadedAssetId,
        )}?_t=${Date.now()}`,
        {
          method: 'DELETE',
          headers: authHeaders(bearer),
        },
      )
    : null;

  const secondDelete = uploadedAssetId
    ? await fetchEnvelope(
        `${hostBaseUrl}/api/assets/${encodeURIComponent(resolvedAccountId)}/${encodeURIComponent(
          uploadedAssetId,
        )}?_t=${Date.now() + 1}`,
        {
          method: 'DELETE',
          headers: authHeaders(bearer),
        },
      )
    : null;

  return {
    upload,
    replace,
    deleted,
    secondDelete,
    uploadedAssetId,
    resolvedAccountId,
    secondDeleteReason: parseReasonKey(secondDelete?.json),
  };
}

export async function runAssetLifecycleParityScenario({ profile, context }) {
  const checks = [];
  const accountId = readString(context.accountId);
  const workspaceId = readString(context.workspaceId);

  if (!accountId || !workspaceId) {
    checks.push(
      makeCheck('Bootstrap context includes accountId/workspaceId for asset lifecycle', false, {
        actual: { accountId, workspaceId },
      }),
    );
    return {
      scenario: 'asset-lifecycle-parity',
      passed: false,
      checks,
      fingerprint: { accountId, workspaceId },
    };
  }

  const [bobFlow, romaFlow] = await Promise.all([
    runAssetFlow({
      hostLabel: 'bob',
      hostBaseUrl: profile.bobBaseUrl,
      bearer: profile.supabaseBearer,
      accountId,
      workspaceId,
    }),
    runAssetFlow({
      hostLabel: 'roma',
      hostBaseUrl: profile.romaBaseUrl,
      bearer: profile.supabaseBearer,
      accountId,
      workspaceId,
    }),
  ]);

  checks.push(
    makeCheck('Bob asset upload returns 200', bobFlow.upload.status === 200, { actual: bobFlow.upload.status }),
    makeCheck('Roma asset upload returns 200', romaFlow.upload.status === 200, { actual: romaFlow.upload.status }),
    makeCheck('Bob upload response includes assetId', Boolean(bobFlow.uploadedAssetId), {
      actual: bobFlow.uploadedAssetId,
    }),
    makeCheck('Roma upload response includes assetId', Boolean(romaFlow.uploadedAssetId), {
      actual: romaFlow.uploadedAssetId,
    }),
    makeCheck('Bob asset replace returns 200', bobFlow.replace?.status === 200, { actual: bobFlow.replace?.status }),
    makeCheck('Roma asset replace returns 200', romaFlow.replace?.status === 200, { actual: romaFlow.replace?.status }),
    makeCheck('Bob asset delete returns 200', bobFlow.deleted?.status === 200, { actual: bobFlow.deleted?.status }),
    makeCheck('Roma asset delete returns 200', romaFlow.deleted?.status === 200, { actual: romaFlow.deleted?.status }),
    makeCheck('Bob second delete returns 404', bobFlow.secondDelete?.status === 404, { actual: bobFlow.secondDelete?.status }),
    makeCheck('Roma second delete returns 404', romaFlow.secondDelete?.status === 404, { actual: romaFlow.secondDelete?.status }),
    makeCheck(
      'Bob second delete reasonKey is coreui.errors.asset.notFound',
      bobFlow.secondDeleteReason === 'coreui.errors.asset.notFound',
      { actual: bobFlow.secondDeleteReason },
    ),
    makeCheck(
      'Roma second delete reasonKey is coreui.errors.asset.notFound',
      romaFlow.secondDeleteReason === 'coreui.errors.asset.notFound',
      { actual: romaFlow.secondDeleteReason },
    ),
    makeCheck(
      'Bob and Roma second delete reasonKey match',
      bobFlow.secondDeleteReason === romaFlow.secondDeleteReason,
      {
        actual: {
          bob: bobFlow.secondDeleteReason,
          roma: romaFlow.secondDeleteReason,
        },
      },
    ),
  );

  return {
    scenario: 'asset-lifecycle-parity',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      accountId,
      workspaceId,
      bobSecondDeleteReason: bobFlow.secondDeleteReason,
      romaSecondDeleteReason: romaFlow.secondDeleteReason,
    },
  };
}
