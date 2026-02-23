import { fetchEnvelope } from '../http.mjs';
import { makeCheck, normalizeHeader, parseReasonKey, readString, scenarioPassed } from '../utils.mjs';

function resolvePublicProbePublicId(profile, context) {
  const publishId = readString(profile.probePublishPublicId);
  if (publishId) return publishId;
  const contextProbe = readString(context.probePublicId);
  if (contextProbe) return contextProbe;
  return readString(profile.probePublicId);
}

function isNoStore(cacheControl) {
  return readString(cacheControl).toLowerCase().includes('no-store');
}

export async function runPublicAccessParityScenario({ profile, context }) {
  const checks = [];

  const romaBootstrap = await fetchEnvelope(`${profile.romaBaseUrl}/api/bootstrap?_t=${Date.now()}`);
  const bobBootstrap = await fetchEnvelope(`${profile.bobBaseUrl}/api/paris/roma/bootstrap?_t=${Date.now()}`);
  const romaBootstrapReason = parseReasonKey(romaBootstrap.json);
  const bobBootstrapReason = parseReasonKey(bobBootstrap.json);

  checks.push(
    makeCheck('Roma bootstrap without auth returns 401', romaBootstrap.status === 401, {
      actual: romaBootstrap.status,
    }),
    makeCheck('Bob bootstrap without auth returns 401', bobBootstrap.status === 401, {
      actual: bobBootstrap.status,
    }),
    makeCheck(
      'Roma bootstrap without auth reasonKey is coreui.errors.auth.required',
      romaBootstrapReason === 'coreui.errors.auth.required',
      {
        actual: romaBootstrapReason,
      },
    ),
    makeCheck(
      'Bob bootstrap without auth reasonKey is coreui.errors.auth.required',
      bobBootstrapReason === 'coreui.errors.auth.required',
      {
        actual: bobBootstrapReason,
      },
    ),
  );

  const publicId = resolvePublicProbePublicId(profile, context);
  const hasPublicId = Boolean(publicId);
  checks.push(
    makeCheck('Public probe publicId configuration (enables Venice /r + /e checks)', true, {
      actual: hasPublicId
        ? publicId
        : 'missing (set RUNTIME_PARITY_PUBLISH_PUBLIC_ID to enforce Venice public checks)',
    }),
  );

  let veniceRStatus = 0;
  let veniceEStatus = 0;
  let veniceRCacheControl = '';
  let veniceECacheControl = '';
  if (hasPublicId) {
    const veniceR = await fetchEnvelope(
      `${profile.veniceBaseUrl}/r/${encodeURIComponent(publicId)}?_t=${Date.now()}`,
    );
    const veniceE = await fetchEnvelope(
      `${profile.veniceBaseUrl}/e/${encodeURIComponent(publicId)}?_t=${Date.now()}`,
    );
    veniceRStatus = veniceR.status;
    veniceEStatus = veniceE.status;
    veniceRCacheControl = normalizeHeader(veniceR.response.headers, 'cache-control');
    veniceECacheControl = normalizeHeader(veniceE.response.headers, 'cache-control');

    checks.push(
      makeCheck('Venice /r public embed responds 200 without auth', veniceRStatus === 200, {
        actual: veniceRStatus,
      }),
      makeCheck('Venice /e public embed responds 200 without auth', veniceEStatus === 200, {
        actual: veniceEStatus,
      }),
      makeCheck('Venice /r cache-control includes no-store', isNoStore(veniceRCacheControl), {
        actual: veniceRCacheControl,
      }),
      makeCheck('Venice /e cache-control includes no-store', isNoStore(veniceECacheControl), {
        actual: veniceECacheControl,
      }),
    );
  } else {
    checks.push(
      makeCheck('Venice /r + /e public probe checks are skipped when no publicId is configured', true, {
        actual: profile.name,
      }),
    );
  }

  return {
    scenario: 'public-access-parity',
    passed: scenarioPassed(checks),
    checks,
    fingerprint: {
      bootstrap: {
        roma: { status: romaBootstrap.status, reasonKey: romaBootstrapReason },
        bob: { status: bobBootstrap.status, reasonKey: bobBootstrapReason },
      },
      publicId,
      venice: {
        r: { status: veniceRStatus, cacheControl: veniceRCacheControl || null },
        e: { status: veniceEStatus, cacheControl: veniceECacheControl || null },
      },
    },
  };
}
