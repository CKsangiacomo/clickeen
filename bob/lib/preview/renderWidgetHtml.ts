type Device = 'desktop' | 'mobile';
type Theme = 'light' | 'dark';

type RenderOptions = {
  widgetname: string;
  assets: {
    htmlUrl: string;
    cssUrl: string;
    jsUrl: string;
  };
  instanceData: Record<string, unknown>;
  publicId: string;
  device: Device;
  theme: Theme;
  backlink?: boolean;
};

function escapeHtml(value: unknown): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderWidgetHtml({
  widgetname,
  assets,
  instanceData,
  publicId,
  device,
  theme,
  backlink = true,
}: RenderOptions): string {
  const instanceJson = JSON.stringify(instanceData ?? {});
  const safeInstanceJson = instanceJson.replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en" data-device="${device}" data-theme="${theme}">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(widgetname)}</title>
  </head>
  <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <article style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;box-shadow:0 18px 40px rgba(15,23,42,0.18);padding:20px 24px;">
        <h1 style="margin:0 0 12px;font-size:18px;font-weight:600;">
          Preview – ${escapeHtml(widgetname)} (${escapeHtml(publicId)})
        </h1>
        <p style="margin:0 0 8px;font-size:13px;opacity:0.75;">
          Workspace is loading this widget from Denver.
        </p>
        <iframe
          src="${assets.htmlUrl}"
          title="Widget"
          style="width:100%;min-height:320px;border-radius:12px;border:0;box-shadow:0 14px 30px rgba(15,23,42,0.08);background:#f8fafc;"
        ></iframe>
        ${backlink ? `<p style="margin:16px 0 0;font-size:12px;opacity:0.6;">Preview only – embed will use Venice at runtime.</p>` : ''}
      </article>
    </div>
  </body>
</html>`;
}
