import { escapeHtml } from '@venice/lib/html';
import type { InstanceLike } from '@venice/lib/renderers/formsContact';

export function renderSocialProofPage({
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
  const title = typeof (cfg as any).title === 'string' ? (cfg as any).title : 'Trusted by great teams';
  const logos = Array.isArray((cfg as any).logos) ? (cfg as any).logos as Array<{ alt: string }> : [];
  const width = device === 'mobile' ? '360px' : '720px';
  const bgPage = theme === 'dark' ? '#0e0f13' : '#f6f7f9';
  const textPage = theme === 'dark' ? '#f5f6f8' : '#0b0b0f';
  const cardBg = theme === 'dark' ? '#14161b' : '#ffffff';
  const border = theme === 'dark' ? 'rgba(250,250,255,0.18)' : 'rgba(10,10,12,0.16)';
  const accent = '#0a84ff';

  const grid = logos.slice(0, 8).map((l) => `
    <div class="logo" aria-label="${escapeHtml(l.alt)}"></div>`).join('');

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
      .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; }
      @media (max-width: 640px) { .grid { grid-template-columns: repeat(2, 1fr); } }
      .logo { height:40px; background: ${theme === 'dark' ? 'rgba(250,250,255,0.08)' : 'rgba(10,10,12,0.06)'}; border-radius:8px; border:1px dashed ${border}; }
      footer { margin-top:12px; display:flex; justify-content:flex-end; font-size:12px; }
      footer a { color:${accent}; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <article class="card" role="region" aria-label="Social proof">
        <h1>${escapeHtml(title)}</h1>
        <div class="grid">${grid}</div>
        ${backlink ? `<footer><a href="https://clickeen.com/?ref=widget&id=${escapeHtml(instance.publicId)}" target="_blank" rel="noopener">Made with Clickeen</a></footer>` : ''}
      </article>
    </div>
  </body>
 </html>`;
}
