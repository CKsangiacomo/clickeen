import { escapeHtml } from '@venice/lib/html';
import type { InstanceLike } from '@venice/lib/renderers/formsContact';

export function renderTestButtonPage({
  instance,
  theme,
  device,
  backlink,
  nonce,
}: {
  instance: InstanceLike;
  theme: 'light' | 'dark';
  device: 'desktop' | 'mobile';
  backlink: boolean;
  nonce: string;
}) {
  const cfg = instance.config || {};
  const text = typeof (cfg as any).text === 'string' ? (cfg as any).text : 'Change me';
  const color = ((cfg as any).color === 'red' ? 'red' : 'green') as 'green' | 'red';
  const radiusPxRaw = Number((cfg as any).radiusPx);
  const radiusPx = Number.isFinite(radiusPxRaw)
    ? Math.max(0, Math.min(32, Math.round(radiusPxRaw)))
    : 12; // sensible default
  const width = device === 'mobile' ? '360px' : '720px';
  const bgPage = theme === 'dark' ? '#0e0f13' : '#f6f7f9';
  const textPage = theme === 'dark' ? '#f5f6f8' : '#0b0b0f';
  const cardBg = theme === 'dark' ? '#14161b' : '#ffffff';
  const border = theme === 'dark' ? 'rgba(250,250,255,0.18)' : 'rgba(10,10,12,0.16)';
  const green = '#22c55e';
  const red = '#ef4444';

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}" data-device="${escapeHtml(device)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(text)}</title>
    <style nonce="${escapeHtml(nonce)}">
      :root { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; }
      body { margin:0; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; background:${bgPage}; color:${textPage}; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:${width}; max-width:100%; background:${cardBg}; border-radius:16px; box-shadow: 0 24px 60px rgba(12,16,24,0.16); padding:24px; border:1px solid ${border}; display:grid; gap:16px; }
      .pill {
        display:inline-flex; align-items:center; justify-content:center;
        min-height:48px; padding:0 20px; border:0; cursor:pointer;
        /* Tokenized button visuals driven by CSS variables with sensible defaults */
        border-radius: var(--btn-radius, 12px);
        color: var(--btn-fg, #fff);
        background: var(--btn-bg, ${color === 'red' ? red : green});
        font-size:16px; font-weight:600; letter-spacing:0.01em;
      }
      footer { margin-top:4px; display:flex; justify-content:flex-end; font-size:12px; }
      footer a { color:${theme === 'dark' ? '#38bdf8' : '#0ea5e9'}; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <article class="card" role="region" aria-label="Test Button">
        <button
          type="button"
          class="pill"
          data-widget-element="button"
          style="--btn-radius: ${radiusPx}px; --btn-bg: ${color === 'red' ? red : green}; --btn-fg: #fff;"
        >
          <span data-widget-element="label">${escapeHtml(text)}</span>
        </button>
        ${backlink ? `<footer><a href="https://clickeen.com/?ref=widget&id=${escapeHtml(instance.publicId)}" target="_blank" rel="noopener">Made with Clickeen</a></footer>` : ''}
      </article>
    </div>
  </body>
</html>`;
}
