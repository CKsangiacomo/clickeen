// services/embed/app/e/[publicId]/route.ts
export const runtime = 'edge';

type Params = { params: { publicId: string } };

function html({ publicId, theme, device }: { publicId: string; theme: 'light'|'dark'; device: 'desktop'|'mobile' }) {
  const density = device === 'mobile' ? 'compact' : 'cozy';
  const bg = theme === 'dark' ? '#0b0c0f' : '#ffffff';
  const fg = theme === 'dark' ? '#e7e9ea' : '#111827';
  const hint = `publicId=${publicId} · theme=${theme} · device=${device}`;

  // Phase-1 Wedge: honest SSR with minimal chrome.
  // Later: hydrate with real instance config from Paris.
  return (
`<!DOCTYPE html>
<html lang="en" data-theme="${theme}" data-device="${device}" data-density="${density}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>CKeen Embed · ${publicId}</title>
  <style>
    :root { --bg:${bg}; --fg:${fg}; }
    html,body { margin:0; padding:0; background:var(--bg); color:var(--fg); font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
    .wrap { display:flex; align-items:center; justify-content:center; min-height:100vh; padding:16px; }
    .panel { width: min(720px, 100%); border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); background: ${theme==='dark' ? '#111318' : '#fff'}; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .head { padding:12px 16px; border-bottom: 1px solid rgba(0,0,0,0.08); display:flex; align-items:center; justify-content:space-between; }
    .muted { opacity: 0.6 }
    .body { padding:16px; }
    .state { padding:12px; border-radius:8px; background:${theme==='dark' ? '#151922' : '#f7f8fa'}; }
    @media (max-width: 640px) { .panel { border-radius: 10px } }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="panel" role="region" aria-label="Clickeen Widget">
      <header class="head">
        <strong>CKeen · SSR</strong>
        <span class="muted">${hint}</span>
      </header>
      <section class="body">
        <div class="state">
          <!-- Phase-1 honest state: instance not configured yet -->
          <p><strong>Not configured yet.</strong> This is server-rendered HTML (no client loader).</p>
          <p class="muted">Once Paris Instance endpoints are live, this will render real content.</p>
        </div>
      </section>
    </article>
  </div>
</body>
</html>`
  );
}

export async function GET(req: Request, { params }: Params) {
  const url = new URL(req.url);
  const publicId = params.publicId ?? 'unknown';
  const theme = (url.searchParams.get('theme') === 'dark' ? 'dark' : 'light') as 'light'|'dark';
  const device = (url.searchParams.get('device') === 'mobile' ? 'mobile' : 'desktop') as 'desktop'|'mobile';

  // Cache: preview (ts present) = no-store; otherwise short public cache with SWR.
  const hasTs = url.searchParams.has('ts');
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': hasTs
      ? 'no-store'
      : 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
  });

  const body = html({ publicId, theme, device });
  return new Response(body, { status: 200, headers });
}


