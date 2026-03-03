const BERLIN_BASE_URL =
  process.env.CK_CLOUD_BERLIN_BASE_URL ||
  'https://berlin-dev.clickeen.workers.dev';

async function main() {
  const url = `${BERLIN_BASE_URL.replace(/\/+$/, '')}/auth/login/provider/start`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ provider: 'google' }),
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!res.ok) {
    const reasonKey = data?.error?.reasonKey || data?.error || null;
    const detail = data?.error?.detail || data?.detail || null;
    console.error(
      `[gate0] Berlin Google OAuth start failed (${res.status}) reasonKey=${reasonKey || 'unknown'}${detail ? ` detail=${detail}` : ''}`,
    );
    process.exit(1);
  }

  const oauthUrl = typeof data?.url === 'string' ? data.url.trim() : '';
  if (!oauthUrl) {
    console.error('[gate0] Berlin Google OAuth start returned 200 but no url');
    process.exit(1);
  }

  console.log('[gate0] Berlin Google OAuth start OK');
  console.log(`[gate0] url_prefix=${oauthUrl.slice(0, 80)}`);
}

main().catch((error) => {
  console.error(`[gate0] Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
