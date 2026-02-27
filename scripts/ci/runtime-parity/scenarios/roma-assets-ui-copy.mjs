import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { authHeaders, fetchEnvelope } from '../http.mjs';
import { makeCheck, parseReasonKey, readString, scenarioPassed } from '../utils.mjs';

function readNotFoundCopyFromSource() {
  const sourcePath = path.join(process.cwd(), 'roma', 'components', 'assets-domain.tsx');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(/'coreui\.errors\.asset\.notFound'\s*:\s*'([^']+)'/);
  const copy = match?.[1] || '';
  return {
    sourcePath: path.relative(process.cwd(), sourcePath),
    copy,
  };
}

export async function runRomaAssetsUiCopyScenario({ profile, context }) {
  const checks = [];
  const accountId = readString(context.accountId);

  if (!accountId) {
    checks.push(
      makeCheck('Bootstrap context includes accountId for Roma assets UI check', false, {
        actual: accountId,
      }),
    );
    return {
      scenario: 'roma-assets-ui-copy',
      passed: false,
      checks,
      fingerprint: { accountId },
    };
  }

  const fakeAssetId = crypto.randomUUID();
  const response = await fetchEnvelope(
    `${profile.romaBaseUrl}/api/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(fakeAssetId)}?_t=${Date.now()}`,
    {
      method: 'DELETE',
      headers: authHeaders(profile.authBearer),
    },
  );
  const reasonKey = parseReasonKey(response.json);
  const sourceCopy = readNotFoundCopyFromSource();

  checks.push(
    makeCheck('Roma DELETE missing asset returns 404', response.status === 404, { actual: response.status }),
    makeCheck(
      'Roma DELETE missing asset reasonKey is coreui.errors.asset.notFound',
      reasonKey === 'coreui.errors.asset.notFound',
      { actual: reasonKey },
    ),
    makeCheck('Roma UI maps notFound reasonKey to user-facing copy', Boolean(sourceCopy.copy), {
      actual: { sourcePath: sourceCopy.sourcePath, copy: sourceCopy.copy },
    }),
    makeCheck('Roma UI copy is not raw reasonKey', sourceCopy.copy !== 'coreui.errors.asset.notFound', {
      actual: sourceCopy.copy,
    }),
  );

  return {
    scenario: 'roma-assets-ui-copy',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      notFoundReasonKey: reasonKey,
      mappedCopy: sourceCopy.copy,
    },
  };
}
