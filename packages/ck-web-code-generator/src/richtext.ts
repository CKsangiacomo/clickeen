const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's']);

function readAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\s${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match ? String(match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function safeLinkHref(value: string | null): string | null {
  if (!value) return null;
  const href = value.trim();
  if (
    /^https?:\/\/[^\s]+$/i.test(href) ||
    /^mailto:[^\s]+$/i.test(href) ||
    /^tel:[+0-9().\-\s]+$/i.test(href) ||
    /^\/(?!\/)[^\s]*$/.test(href) ||
    /^#[^\s]*$/.test(href)
  ) {
    return href;
  }
  return null;
}

function escapeAttribute(value: string): string {
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

export function sanitizeInlineRichText(value: string): string {
  const tokens = value.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+|</g) ?? [];
  return tokens
    .map((token) => {
      if (!token.startsWith('<') || token === '<') return token === '<' ? '&lt;' : token;
      if (/^<!--|^<!/i.test(token)) return '';
      const parsed = token.match(/^<\s*(\/?)\s*([a-z0-9]+)\b[^>]*>$/i);
      if (!parsed) return '';
      const closing = parsed[1] === '/';
      const tag = String(parsed[2]).toLowerCase();
      if (tag === 'br') return closing ? '' : '<br>';
      if (INLINE_TAGS.has(tag)) return closing ? `</${tag}>` : `<${tag}>`;
      if (tag !== 'a') return '';
      if (closing) return '</a>';
      const href = safeLinkHref(readAttribute(token, 'href'));
      const target = href && readAttribute(token, 'target') === '_blank' ? '_blank' : null;
      return `<a${href ? ` href="${escapeAttribute(href)}"` : ''}${target ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
    })
    .join('');
}
