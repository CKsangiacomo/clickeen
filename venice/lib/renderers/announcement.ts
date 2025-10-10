import { escapeHtml } from '@venice/lib/html';
import type { InstanceLike } from '@venice/lib/renderers/formsContact';

export function renderAnnouncementPage({
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
  const title = typeof (cfg as any).title === 'string' ? (cfg as any).title : 'Announcement';
  const message = typeof (cfg as any).message === 'string' ? (cfg as any).message : 'We have something new for you!';
  const ctaLabel = typeof (cfg as any).ctaLabel === 'string' ? (cfg as any).ctaLabel : 'Learn more';
  const ctaHref = typeof (cfg as any).ctaHref === 'string' ? (cfg as any).ctaHref : '#';
  const width = device === 'mobile' ? '360px' : '720px';
  const bgPage = theme === 'dark' ? '#0e0f13' : '#f6f7f9';
  const textPage = theme === 'dark' ? '#f5f6f8' : '#0b0b0f';
  const cardBg = theme === 'dark' ? '#14161b' : '#ffffff';
  const border = theme === 'dark' ? 'rgba(250,250,255,0.18)' : 'rgba(10,10,12,0.16)';
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
      .card { width:${width}; max-width:100%; background:${cardBg}; border-radius:16px; box-shadow: 0 24px 60px rgba(12,16,24,0.16); padding:24px; border:1px solid ${border}; display:grid; gap:12px; }
      h1 { margin:0; font-size:18px; }
      p { margin:0; }
      a.btn { display:inline-flex; align-items:center; justify-content:center; padding:0 16px; min-height:32px; background:${accent}; color:#fff; border-radius:8px; text-decoration:none; }
      a.btn:focus-visible { outline:none; box-shadow: 0 0 0 2px ${cardBg}, 0 0 0 4px ${accent}; }
      footer { margin-top:4px; display:flex; justify-content:flex-end; font-size:12px; }
      footer a { color:${accent}; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <article class="card" role="region" aria-label="Announcement">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <div><a class="btn" href="${escapeHtml(ctaHref)}" target="_blank" rel="noopener">${escapeHtml(ctaLabel)}</a></div>
        ${backlink ? `<footer><a href="https://clickeen.com/?ref=widget&id=${escapeHtml(instance.publicId)}" target="_blank" rel="noopener">Made with Clickeen</a></footer>` : ''}
      </article>
    </div>
  </body>
 </html>`;
}
