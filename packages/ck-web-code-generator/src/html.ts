export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case "'":
        return '&#39;';
      default:
        return '&quot;';
    }
  });
}

export function extractBody(html: string): string {
  const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) throw new Error('ck.web_code.document_body_missing');
  return match[1] ?? '';
}

export function withoutSupportElements(body: string): string {
  return body
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, '')
    .trim();
}

export function readWidgetRootStyle(body: string): string {
  const root = body.match(/<([a-z][\w:-]*)\b(?=[^>]*\bdata-role=["']root["'])[^>]*>/i)?.[0];
  if (!root) throw new Error('ck.web_code.widget_root_missing');
  const style = root.match(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const raw = String(style?.[1] ?? style?.[2] ?? '');
  const customProperties = raw
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .filter((declaration) => /^--[a-z0-9_-]+\s*:/i.test(declaration));
  return customProperties.length ? `${customProperties.join(';')};` : '';
}

export function normalizeDocumentSupportElements(
  html: string,
  supportFiles: { stylesheetHref: string; runtimeSrc: string },
): string {
  const withoutStylesheets = html.replace(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>\s*/gi,
    '',
  );
  const withoutRuntimeScripts = withoutStylesheets.replace(
    /<script\b(?=[^>]*\bsrc=["'][^"']+["'])[^>]*>\s*<\/script>\s*/gi,
    '',
  );
  if (!/<\/head>/i.test(withoutRuntimeScripts) || !/<\/body>/i.test(withoutRuntimeScripts)) {
    throw new Error('ck.web_code.document_invalid');
  }
  return withoutRuntimeScripts
    .replace(
      /<\/head>/i,
      `    <link rel="stylesheet" href="${supportFiles.stylesheetHref}" />\n  </head>`,
    )
    .replace(
      /<\/body>/i,
      `    <script src="${supportFiles.runtimeSrc}" defer></script>\n  </body>`,
    );
}

function attributeValue(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? String(match[1] ?? match[2] ?? '') : null;
}

export function validateFieldMarkers(html: string): void {
  const allowedTargets = new Set(['text', 'richtext', 'attribute:alt', 'attribute:title']);
  for (const match of html.matchAll(/<[a-z][^<>]*>/gi)) {
    const tag = match[0];
    const path = attributeValue(tag, 'data-ck-field-path');
    const target = attributeValue(tag, 'data-ck-field-target');
    if (path === null && target === null) continue;
    if (!path || !target || path.includes('[]') || path.includes('*') || !allowedTargets.has(target)) {
      throw new Error(`ck.web_code.field_marker_invalid:${path || 'missing'}`);
    }
  }
}
