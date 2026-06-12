import {
  WIDGET_SHELL_RUNTIME_MODULE_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_END,
  WIDGET_SHELL_RUNTIME_PAYLOAD_START,
  WIDGET_SHELL_STYLE_CHUNK_END,
} from '@clickeen/widget-shell';

export type PagePackageSource = {
  schemaVersion: 1;
  pageId: string;
  accountPublicId: string;
  displayName: string;
  metadata: {
    title: string;
    description: string;
    robots: 'index,follow' | 'noindex,nofollow';
    canonicalUrl?: string;
  };
  localization: {
    defaultLocale: string;
    ipLocalizationEnabled: boolean;
    countryLocaleRules: Array<{ country: string; locale: string }>;
    languageSwitcherEnabled: boolean;
    missingLocaleBehavior: 'block_publish';
  };
  placements: Array<{ placementId: string; instanceId: string }>;
};

export type WidgetPackageForPage = {
  instanceId: string;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type ComposedPagePublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

type WidgetContribution = {
  instanceId: string;
  htmlRoot: string;
  locale: string;
  styleChunks: string[];
  runtimePayload: string;
  runtimeModules: string[];
};

type PagePackageBuildError = { kind: 'PAGE_PACKAGE_BUILD_ERROR'; reasonKey: string; detail: string };

const FORBIDDEN_SINGLETON_RUNTIME_RE = /\bwindow\.CK_WIDGET\b/;
const STYLE_MODULE_RE = new RegExp(
  `/\\*\\s*ck-style-module:[^*]*\\*/\\n([\\s\\S]*?)\\n${WIDGET_SHELL_STYLE_CHUNK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'g',
);
const RUNTIME_PAYLOAD_START = WIDGET_SHELL_RUNTIME_PAYLOAD_START;
const RUNTIME_PAYLOAD_END = WIDGET_SHELL_RUNTIME_PAYLOAD_END;
const RUNTIME_MODULE_RE = new RegExp(
  `/\\*\\s*ck-runtime-module:[^*]*\\*/\\n([\\s\\S]*?)\\n${WIDGET_SHELL_RUNTIME_MODULE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'g',
);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function readHtmlAttribute(openingTag: string, attrName: string): string {
  const escapedAttr = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = openingTag.match(new RegExp(`\\s${escapedAttr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return String(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

function readHtmlLang(html: string): string {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? '';
  return readHtmlAttribute(htmlTag, 'lang').toLowerCase();
}

function uniqueChunks(chunks: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  chunks.forEach((chunk) => {
    const normalized = chunk.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function extractMarkedChunks(args: {
  body: string;
  pattern: RegExp;
  reasonKey: string;
  instanceId: string;
}): string[] {
  args.pattern.lastIndex = 0;
  const chunks = [...args.body.matchAll(args.pattern)].map((match) => String(match[1] ?? '').trim()).filter(Boolean);
  if (!chunks.length) {
    pagePackageBuildError(args.reasonKey, args.instanceId);
  }
  return chunks;
}

function pagePackageBuildError(reasonKey: string, detail: string): never { throw { kind: 'PAGE_PACKAGE_BUILD_ERROR', reasonKey, detail } satisfies PagePackageBuildError; }

export function isPagePackageBuildError(value: unknown): value is PagePackageBuildError { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (value as PagePackageBuildError).kind === 'PAGE_PACKAGE_BUILD_ERROR'; }

function splitRuntimeContribution(args: {
  runtime: string;
  instanceId: string;
}): { payload: string; modules: string[] } {
  const startIndex = args.runtime.indexOf(RUNTIME_PAYLOAD_START);
  const endIndex = args.runtime.indexOf(RUNTIME_PAYLOAD_END);
  if (startIndex < 0 || endIndex < startIndex) {
    pagePackageBuildError('page.package.runtimePayloadMissing', args.instanceId);
  }
  const payload = args.runtime.slice(startIndex, endIndex + RUNTIME_PAYLOAD_END.length).trim();
  const modulesSource = `${args.runtime.slice(0, startIndex)}\n${args.runtime.slice(endIndex + RUNTIME_PAYLOAD_END.length)}`;
  return {
    payload,
    modules: extractMarkedChunks({
      body: modulesSource,
      pattern: RUNTIME_MODULE_RE,
      reasonKey: 'page.package.runtimeModulesMissing',
      instanceId: args.instanceId,
    }),
  };
}

function extractSingleWidgetRoot(args: {
  html: string;
  instanceId: string;
}): { ok: true; fragment: string } | { ok: false; reasonKey: string; detail: string } {
  const roots: Array<{ start: number; end: number; openingTag: string; insideRoot: boolean }> = [];
  const stack: Array<{ tagName: string; isRoot: boolean; start: number; openingTag: string }> = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^<>]*)?>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(args.html))) {
    const tag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosing = tag.startsWith('</');

    if (isClosing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const popped = stack.pop();
        if (!popped) break;
        if (popped.tagName !== tagName) continue;
        if (popped.isRoot) {
          roots.push({
            start: popped.start,
            end: match.index + tag.length,
            openingTag: popped.openingTag,
            insideRoot: stack.some((entry) => entry.isRoot),
          });
        }
        break;
      }
      continue;
    }

    const widgetType = readHtmlAttribute(tag, 'data-ck-widget');
    const isRoot = Boolean(widgetType) && readHtmlAttribute(tag, 'data-role') === 'root';
    if (!tag.endsWith('/>') && !voidTags.has(tagName)) {
      stack.push({ tagName, isRoot, start: match.index, openingTag: tag });
    }
  }

  const topLevelRoots = roots.filter((root) => !root.insideRoot);
  if (topLevelRoots.length !== 1) {
    return {
      ok: false,
      reasonKey: 'page.package.widgetRootInvalid',
      detail: `Expected exactly one top-level widget root for ${args.instanceId}; found ${topLevelRoots.length}.`,
    };
  }
  const root = topLevelRoots[0]!;
  const rootInstanceId = readHtmlAttribute(root.openingTag, 'data-ck-instance-id');
  if (rootInstanceId !== args.instanceId) {
    return {
      ok: false,
      reasonKey: 'page.package.widgetRootInstanceMismatch',
      detail: `Widget root instance id ${rootInstanceId || '(missing)'} does not match placement instance ${args.instanceId}.`,
    };
  }
  return { ok: true, fragment: args.html.slice(root.start, root.end) };
}

function pageLocale(packages: WidgetContribution[]): string {
  const locales = uniqueChunks(packages.map((pkg) => pkg.locale).filter(Boolean));
  if (locales.length > 1) {
    pagePackageBuildError('page.package.localeMismatch', locales.join(','));
  }
  return locales[0] ?? 'und';
}

function pageConfiguredLocales(source: PagePackageSource): string[] {
  return uniqueChunks([
    source.localization.defaultLocale,
    ...source.localization.countryLocaleRules.map((rule) => rule.locale),
  ].map((locale) => locale.trim().toLowerCase()));
}

function assertConfiguredLocalesAvailable(args: {
  source: PagePackageSource;
  availableLocale: string;
}): void {
  const availableLocale = args.availableLocale.trim().toLowerCase();
  const configuredLocales = pageConfiguredLocales(args.source);
  const unavailableLocales = configuredLocales.filter((locale) => locale !== availableLocale);
  if (unavailableLocales.length > 0) {
    pagePackageBuildError('page.package.localeUnavailable', unavailableLocales.join(','));
  }
}

function toContribution(pkg: WidgetPackageForPage): WidgetContribution {
  if (FORBIDDEN_SINGLETON_RUNTIME_RE.test(pkg.runtimeJs)) {
    pagePackageBuildError('page.package.singletonRuntime', pkg.instanceId);
  }
  const extracted = extractSingleWidgetRoot({
    html: pkg.indexHtml,
    instanceId: pkg.instanceId,
  });
  if (!extracted.ok) {
    pagePackageBuildError(extracted.reasonKey, extracted.detail);
  }
  const runtimeContribution = splitRuntimeContribution({
    runtime: pkg.runtimeJs,
    instanceId: pkg.instanceId,
  });
  return {
    instanceId: pkg.instanceId,
    htmlRoot: extracted.fragment,
    locale: readHtmlLang(pkg.indexHtml),
    styleChunks: extractMarkedChunks({
      body: pkg.stylesCss,
      pattern: STYLE_MODULE_RE,
      reasonKey: 'page.package.styleModulesMissing',
      instanceId: pkg.instanceId,
    }),
    runtimePayload: runtimeContribution.payload,
    runtimeModules: runtimeContribution.modules,
  };
}

function composePageIndex(args: {
  accountId: string;
  source: PagePackageSource;
  packages: WidgetContribution[];
  locale: string;
}): string {
  const title = escapeHtml(args.source.metadata.title);
  const description = escapeAttribute(args.source.metadata.description);
  const robots = escapeAttribute(args.source.metadata.robots);
  const canonicalUrl = escapeAttribute(args.source.metadata.canonicalUrl || `https://clk.live/${args.accountId}/pages/${args.source.pageId}`);
  const configuredLocales = pageConfiguredLocales(args.source);
  const switcher = args.source.localization.languageSwitcherEnabled && configuredLocales.length > 1
    ? `<nav class="ck-page-language-switcher" aria-label="Page language">
${configuredLocales.map((locale) => `    <a href="?locale=${escapeAttribute(locale)}" hreflang="${escapeAttribute(locale)}">${escapeHtml(locale.toUpperCase())}</a>`).join('\n')}
  </nav>
`
    : '';
  const body = args.packages
    .map((pkg) => `<section>${pkg.htmlRoot}</section>`)
    .join('\n');
  return `<!doctype html>
<html lang="${escapeAttribute(args.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="${robots}">
  <meta name="description" content="${description}">
  <title>${title}</title>
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  ${switcher}<main data-ck-page="${escapeAttribute(args.source.pageId)}" data-ck-composed-page="true">
${body}
  </main>
  <script src="./runtime.js" defer></script>
</body>
</html>`;
}

function composePageStyles(packages: WidgetContribution[]): string {
  const chunks = [
    `:where([data-ck-page]) {
  display: block;
}

:where([data-ck-page] > section) {
  display: block;
}

.ck-page-language-switcher {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem;
  font: 14px system-ui, sans-serif;
}

.ck-page-language-switcher a {
  color: inherit;
  text-decoration: underline;
}`,
  ];
  chunks.push(...uniqueChunks(packages.flatMap((pkg) => pkg.styleChunks)));
  return `${chunks.join('\n\n')}\n`;
}

function composePageRuntime(packages: WidgetContribution[]): string {
  const chunks = [
    `(function () {
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
})();`,
    ...uniqueChunks(packages.map((pkg) => pkg.runtimePayload)),
    ...uniqueChunks(packages.flatMap((pkg) => pkg.runtimeModules)),
  ];
  return `${chunks.join('\n\n')}\n`;
}

export function buildPagePublicPackage(args: {
  accountId: string;
  source: PagePackageSource;
  widgetPackages: WidgetPackageForPage[];
}): ComposedPagePublicPackage {
  const byInstanceId = new Map(args.widgetPackages.map((pkg) => [pkg.instanceId, pkg]));
  const contributions = args.source.placements.map((placement) => {
    const widgetPackage = byInstanceId.get(placement.instanceId);
    if (!widgetPackage) pagePackageBuildError('page.package.widgetPackageMissing', placement.instanceId);
    return toContribution(widgetPackage);
  });
  const runtimeJs = composePageRuntime(contributions);
  if (FORBIDDEN_SINGLETON_RUNTIME_RE.test(runtimeJs)) {
    pagePackageBuildError('page.package.singletonRuntime', 'Page runtime contains forbidden window.CK_WIDGET singleton state.');
  }
  const locale = pageLocale(contributions);
  assertConfiguredLocalesAvailable({
    source: args.source,
    availableLocale: locale,
  });
  return {
    v: 1,
    indexHtml: composePageIndex({
      accountId: args.accountId,
      source: args.source,
      packages: contributions,
      locale,
    }),
    stylesCss: composePageStyles(contributions),
    runtimeJs,
  };
}
