type Replacement = {
  start: number;
  end: number;
  value: string;
};

type OpenElement = {
  name: string;
  openEnd: number;
  path: string | null;
  target: string | null;
};

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const FIELD_TARGETS = new Set(['text', 'richtext', 'attribute:alt', 'attribute:title', 'attribute:content']);

function readAttribute(tag: string, name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? String(match[1] ?? match[2] ?? '') : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    return '&gt;';
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === "'") return '&#39;';
    return '&quot;';
  });
}

function replaceExistingAttribute(tag: string, name: string, value: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\s${escapedName}\\s*=\\s*)("[^"]*"|'[^']*')`, 'gi');
  const matches = Array.from(tag.matchAll(pattern));
  if (matches.length !== 1) throw new Error(`tokyo.locale_html.attribute_invalid:${name}`);
  return tag.replace(pattern, (_match, prefix: string, quoted: string) => {
    const quote = quoted.startsWith("'") ? "'" : '"';
    return `${prefix}${quote}${escapeAttribute(value)}${quote}`;
  });
}

function assertMarkerPair(path: string | null, target: string | null): void {
  if ((path === null) !== (target === null) || (target !== null && !FIELD_TARGETS.has(target))) {
    throw new Error('tokyo.locale_html.marker_invalid');
  }
}

function applyReplacements(html: string, replacements: Replacement[]): string {
  const ordered = [...replacements].sort((left, right) => left.start - right.start);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.start < ordered[index - 1]!.end) {
      throw new Error('tokyo.locale_html.marker_overlap');
    }
  }
  return ordered
    .sort((left, right) => right.start - left.start)
    .reduce(
      (result, replacement) =>
        `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`,
      html,
    );
}

function localizedFieldReplacements(
  html: string,
  resolveValue: (path: string) => string | undefined,
): Replacement[] {
  const replacements: Replacement[] = [];
  const stack: OpenElement[] = [];
  let markerCount = 0;
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi;

  for (const match of html.matchAll(tagPattern)) {
    const tag = match[0];
    const start = match.index;
    if (start == null || /^<!/i.test(tag)) continue;
    const closing = tag.match(/^<\s*\/\s*([a-z][\w:-]*)/i);
    if (closing) {
      const name = String(closing[1]).toLowerCase();
      const open = stack.pop();
      if (!open || open.name !== name) throw new Error('tokyo.locale_html.structure_invalid');
      if (open.path === null || open.target === null || open.target.startsWith('attribute:')) continue;
      const translated = resolveValue(open.path);
      if (typeof translated !== 'string') throw new Error(`tokyo.locale_html.value_missing:${open.path}`);
      replacements.push({
        start: open.openEnd,
        end: start,
        value: open.target === 'text' ? escapeHtml(translated) : translated,
      });
      continue;
    }

    const opening = tag.match(/^<\s*([a-z][\w:-]*)/i);
    if (!opening) continue;
    const name = String(opening[1]).toLowerCase();
    const path = readAttribute(tag, 'data-ck-field-path');
    const target = readAttribute(tag, 'data-ck-field-target');
    assertMarkerPair(path, target);
    if (path !== null && target !== null) {
      markerCount += 1;
      const translated = resolveValue(path);
      if (typeof translated !== 'string') throw new Error(`tokyo.locale_html.value_missing:${path}`);
      if (target.startsWith('attribute:')) {
        const attributeName = target.slice('attribute:'.length);
        replacements.push({
          start,
          end: start + tag.length,
          value: replaceExistingAttribute(tag, attributeName, translated),
        });
      }
    }

    const selfClosing = /\/\s*>$/.test(tag) || VOID_ELEMENTS.has(name);
    if (selfClosing) {
      if (target === 'text' || target === 'richtext') {
        throw new Error('tokyo.locale_html.marker_target_invalid');
      }
      continue;
    }
    stack.push({
      name,
      openEnd: start + tag.length,
      path,
      target,
    });
  }

  if (stack.length) throw new Error('tokyo.locale_html.structure_invalid');
  if (markerCount === 0) {
    throw new Error('tokyo.locale_html.markers_missing');
  }
  return replacements;
}

export function completeLocalizedInstanceHtml(args: {
  html: string;
  locale: string;
  values: Record<string, string>;
}): string {
  const htmlTags = Array.from(args.html.matchAll(/<html\b[^>]*>/gi));
  if (htmlTags.length !== 1 || htmlTags[0]!.index == null) {
    throw new Error('tokyo.locale_html.document_invalid');
  }
  const htmlTag = htmlTags[0]!;
  const replacements = localizedFieldReplacements(args.html, (path) => args.values[path]);
  replacements.push({
    start: htmlTag.index!,
    end: htmlTag.index! + htmlTag[0].length,
    value: replaceExistingAttribute(htmlTag[0], 'lang', args.locale),
  });
  return applyReplacements(args.html, replacements);
}
