import { escapeHtml } from '@venice/lib/html';
import type { InstanceLike } from '@venice/lib/renderers/formsContact';

export function renderNewsletterPage({
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
  const title = typeof (cfg as any).title === 'string' ? (cfg as any).title : 'Subscribe to our newsletter';
  const placeholder = typeof (cfg as any).placeholder === 'string' ? (cfg as any).placeholder : 'you@example.com';
  const buttonText = typeof (cfg as any).buttonText === 'string' ? (cfg as any).buttonText : 'Subscribe';
  const layout = (cfg as any).layout === 'inline' ? 'inline' : 'stacked';
  const width = device === 'mobile' ? '360px' : '720px';
  const bgPage = theme === 'dark' ? '#0e0f13' : '#f6f7f9';
  const textPage = theme === 'dark' ? '#f5f6f8' : '#0b0b0f';
  const cardBg = theme === 'dark' ? '#14161b' : '#ffffff';
  const border = theme === 'dark' ? 'rgba(250,250,255,0.18)' : 'rgba(10,10,12,0.16)';
  const surface = theme === 'dark' ? '#1c1c1e' : '#f6f7f9';
  const accent = '#0a84ff';

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}" data-device="${escapeHtml(device)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style nonce="${escapeHtml(nonce)}">
      :root { color-scheme: ${theme === 'dark' ? 'dark' : 'light'}; }
      body { margin:0; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; background:${bgPage}; color:${textPage}; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:${width}; max-width:100%; background:${cardBg}; border-radius:16px; box-shadow: 0 24px 60px rgba(12,16,24,0.16); padding:24px; border:1px solid ${border}; }
      h1 { margin:0 0 12px; font-size:18px; }
      form { display:${layout === 'inline' ? 'grid; grid-template-columns: 1fr auto; gap: 8px' : 'grid; gap: 12px'}; }
      label { position:absolute; left:-9999px; top:auto; width:1px; height:1px; overflow:hidden; }
      input[type="email"] { width:100%; border:1px solid ${border}; background:${surface}; color:inherit; border-radius:8px; padding:10px 12px; font: inherit; }
      button { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:32px; padding:0 16px; border-radius:8px; border:0; background:${accent}; color:#fff; font-size:14px; cursor:pointer; }
      button:focus-visible { outline:none; box-shadow: 0 0 0 2px ${cardBg}, 0 0 0 4px ${accent}; }
      footer { margin-top:12px; display:flex; justify-content:flex-end; font-size:12px; }
      footer a { color:${accent}; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <article class="card" role="region" aria-label="Newsletter signup">
        <h1>${escapeHtml(title)}</h1>
        <form action="/s/${encodeURIComponent(instance.publicId)}" method="post" novalidate>
          <label for="ck-email">Email</label>
          <input type="email" id="ck-email" name="email" autocomplete="email" placeholder="${escapeHtml(placeholder)}" />
          <button type="submit">${escapeHtml(buttonText)}</button>
        </form>
        ${backlink ? `<footer><a href="https://clickeen.com/?ref=widget&id=${escapeHtml(instance.publicId)}" target="_blank" rel="noopener">Made with Clickeen</a></footer>` : ''}
      </article>
    </div>
  </body>
 </html>`;
}
