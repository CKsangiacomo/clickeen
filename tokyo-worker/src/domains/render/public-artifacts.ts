import { resolveOverlay } from '@clickeen/ck-contracts';
import type { Env } from '../../types';
import { normalizeLocale } from '../../asset-utils';
import { readAccountInstanceDocument } from './saved-config';
import { listTranslatedLocales, readTranslatedLocaleValues } from './translated-locales';

type R2TextObject = {
  text(): Promise<string>;
};

type MaterializedFile = {
  name: string;
  body: string;
  contentType: string;
};

export type MaterializeInstancePublicArtifactsResult =
  | {
      ok: true;
      accountId: string;
      instanceId: string;
      widgetType: string;
      baseLocale: string;
      locales: string[];
      publicFiles: string[];
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

const FORBIDDEN_VISITOR_PATTERNS = [
  /venice/i,
  /\/api\/account\//i,
  /\/__internal\//i,
  /fetch\([^)]*instance\.json/i,
  /fetch\([^)]*\/overlays\//i,
  /product\/widgets\//i,
  /src=["'][^"']*widget\.client\.js/i,
  /href=["'][^"']*widget\.css/i,
];

const GENERATED_PUBLIC_ARTIFACT_ALLOWLIST: ReadonlyArray<RegExp> = [
  /^index\.html$/,
  /^[a-z0-9][a-z0-9-]{0,19}\.html$/,
  /^styles\.css$/,
  /^script\.js$/,
  /^script\.[a-z0-9][a-z0-9-]{0,19}\.js$/,
  /^styles\.v[1-9][0-9]*\.css$/,
  /^script\.v[1-9][0-9]*(?:\.[a-z0-9][a-z0-9-]{0,19})?\.js$/,
];

export function isGeneratedPublicArtifactFile(file: string): boolean {
  if (!file || file.startsWith('.') || file.includes('/') || file.includes('\\')) return false;
  if (file.includes('%') || file.includes('..')) return false;
  return GENERATED_PUBLIC_ARTIFACT_ALLOWLIST.some((pattern) => pattern.test(file));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function instanceRoot(accountId: string, instanceId: string): string {
  return `accounts/${accountId}/instances/${instanceId}`;
}

function resolveProductPath(widgetType: string, src: string): string | null {
  const withoutQuery = src.split('?')[0] || '';
  if (!withoutQuery || withoutQuery.startsWith('/') || /^https?:\/\//i.test(withoutQuery)) return null;
  const base = `product/widgets/${widgetType}/`;
  const stack = base.split('/').filter(Boolean);
  for (const part of withoutQuery.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const normalized = stack.join('/');
  return normalized.startsWith('product/widgets/') ? normalized : null;
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] || '' : html;
}

function addInstanceIdToRoot(html: string, widgetType: string, instanceId: string): string {
  const marker = `data-ck-widget="${widgetType}"`;
  return html.includes(marker)
    ? html.replace(marker, `${marker} data-ck-instance-id="${instanceId}"`)
    : html;
}

function replaceWidgetScripts(body: string): { body: string; scriptSources: string[] } {
  const scriptSources: string[] = [];
  let inserted = false;
  const nextBody = body.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_full, _attrs, src) => {
    scriptSources.push(String(src));
    if (inserted) return '';
    inserted = true;
    return '<script src="./script.js" defer></script>';
  });
  return {
    body: inserted ? nextBody : `${nextBody}\n<script src="./script.js" defer></script>`,
    scriptSources,
  };
}

function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

async function readRequiredText(env: Env, key: string): Promise<string> {
  const obj = await env.TOKYO_R2.get(key) as R2TextObject | null;
  if (!obj) throw new Error(`artifact.source.missing:${key}`);
  return obj.text();
}

async function buildStyles(env: Env, widgetType: string, widgetHtml: string): Promise<string> {
  const chunks: string[] = [];
  for (const href of extractStylesheetSources(widgetHtml)) {
    if (href.startsWith('/dieter/')) {
      chunks.push(`@import "${href}";`);
      continue;
    }
    const key = resolveProductPath(widgetType, href);
    if (!key || !key.endsWith('.css')) continue;
    chunks.push(await readRequiredText(env, key));
  }
  return `${chunks.join('\n\n')}\n`;
}

async function buildScript(args: {
  env: Env;
  widgetType: string;
  scriptSources: string[];
  instanceId: string;
  locale: string;
  state: Record<string, unknown>;
}): Promise<string> {
  const payload = {
    instanceId: args.instanceId,
    locale: args.locale,
    state: args.state,
  };
  const chunks = [
    `window.CK_WIDGET = ${JSON.stringify(payload)};`,
    `window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {}, { ${JSON.stringify(args.instanceId)}: window.CK_WIDGET });`,
  ];
  for (const src of args.scriptSources) {
    const key = resolveProductPath(args.widgetType, src);
    if (!key || !key.endsWith('.js')) continue;
    chunks.push(await readRequiredText(args.env, key));
  }
  return `${chunks.join('\n\n')}\n`;
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function buildHtml(args: {
  title: string;
  locale: string;
  stylesheetFile: string;
  body: string;
  scriptFile: string;
}): string {
  return `<!doctype html>
<html lang="${args.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.title)}</title>
    <link rel="stylesheet" href="./${args.stylesheetFile}" />
  </head>
  <body>
${args.body.replace('./script.js', `./${args.scriptFile}`)}
  </body>
</html>
`;
}

function localeFileStem(locale: string): string {
  return locale.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'locale';
}

function publicArtifactVersion(): string {
  return String(Date.now());
}

function publicArtifactStylesheetFile(version: string): string {
  return `styles.v${version}.css`;
}

function publicArtifactBaseScriptFile(version: string): string {
  return `script.v${version}.js`;
}

export function publicArtifactLocaleHtmlFile(locale: string): string {
  return `${localeFileStem(locale)}.html`;
}

export function publicArtifactLocaleScriptFile(locale: string, version?: string): string {
  return version
    ? `script.v${version}.${localeFileStem(locale)}.js`
    : `script.${localeFileStem(locale)}.js`;
}

function assertVisitorSafe(files: MaterializedFile[]): void {
  for (const file of files) {
    const hit = FORBIDDEN_VISITOR_PATTERNS.find((pattern) => pattern.test(file.body));
    if (hit) throw new Error(`artifact.generated.forbidden:${file.name}:${hit}`);
  }
}

function textContentType(name: string): string {
  if (name.endsWith('.css')) return 'text/css; charset=utf-8';
  if (name.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

export async function materializeInstancePublicArtifacts(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<MaterializeInstancePublicArtifactsResult> {
  try {
    const instance = await readAccountInstanceDocument({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
    });
    if (!instance.ok) {
      return { ok: false, reasonKey: instance.reasonKey, detail: instance.reasonKey };
    }
    if (instance.value.embedBuildShape.rendering !== 'html' && instance.value.embedBuildShape.rendering !== 'iframe') {
      return {
        ok: false,
        reasonKey: 'artifact.shape.rendering_unsupported',
        detail: `Unsupported rendering mode ${instance.value.embedBuildShape.rendering}`,
      };
    }

    const widgetHtml = await readRequiredText(args.env, `product/widgets/${instance.value.widgetType}/widget.html`);
    const bodyShell = addInstanceIdToRoot(extractBody(widgetHtml), instance.value.widgetType, instance.value.id);
    const { body, scriptSources } = replaceWidgetScripts(bodyShell);
    const styles = await buildStyles(args.env, instance.value.widgetType, widgetHtml);
    const targetLocales = new Set(instance.value.targetLocales.map((locale) => normalizeLocale(locale)).filter((locale): locale is string => Boolean(locale)));
    const translatedLocales = await listTranslatedLocales({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
    });

    const localizedStates = new Map<string, Record<string, unknown>>();
    localizedStates.set(instance.value.baseLocale, instance.value.config);
    for (const summary of translatedLocales) {
      const locale = normalizeLocale(summary.locale);
      if (!locale || !targetLocales.has(locale)) continue;
      const translated = await readTranslatedLocaleValues({
        env: args.env,
        accountId: args.accountId,
        instanceId: args.instanceId,
        locale,
      });
      if (!translated) {
        return {
          ok: false,
          reasonKey: 'artifact.translation_missing',
          detail: `Translated locale values are missing for ${locale}`,
        };
      }
      const state = resolveOverlay(instance.value.config, translated.values);
      if (!isRecord(state)) {
        return {
          ok: false,
          reasonKey: 'artifact.translation_invalid',
          detail: `Translated locale values are invalid for ${locale}`,
        };
      }
      localizedStates.set(locale, state);
    }

    const version = publicArtifactVersion();
    const stylesheetFile = publicArtifactStylesheetFile(version);
    const files: MaterializedFile[] = [
      { name: stylesheetFile, body: styles, contentType: textContentType(stylesheetFile) },
      { name: 'styles.css', body: styles, contentType: textContentType('styles.css') },
    ];
    for (const [locale, state] of localizedStates) {
      const baseLocale = locale === instance.value.baseLocale;
      const scriptFile = baseLocale ? publicArtifactBaseScriptFile(version) : publicArtifactLocaleScriptFile(locale, version);
      const htmlFile = baseLocale ? 'index.html' : publicArtifactLocaleHtmlFile(locale);
      const script = await buildScript({
        env: args.env,
        widgetType: instance.value.widgetType,
        scriptSources,
        instanceId: instance.value.id,
        locale,
        state,
      });
      files.push({ name: scriptFile, body: script, contentType: textContentType(scriptFile) });
      files.push({
        name: baseLocale ? 'script.js' : publicArtifactLocaleScriptFile(locale),
        body: script,
        contentType: textContentType(scriptFile),
      });
      files.push({
        name: htmlFile,
        body: buildHtml({
          title: instance.value.displayName || `${instance.value.widgetType} widget`,
          locale,
          stylesheetFile,
          body,
          scriptFile,
        }),
        contentType: textContentType(htmlFile),
      });
    }

    assertVisitorSafe(files);

    const root = instanceRoot(args.accountId, args.instanceId);
    const supportFiles = files.filter((file) => file.name !== 'index.html' && !file.name.endsWith('.html'));
    for (const file of supportFiles) {
      await args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
        httpMetadata: { contentType: file.contentType },
      });
    }
    const localeEntryFiles = files.filter((file) => file.name !== 'index.html' && file.name.endsWith('.html'));
    for (const file of localeEntryFiles) {
      await args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
        httpMetadata: { contentType: file.contentType },
      });
    }
    const index = files.find((file) => file.name === 'index.html');
    if (!index) {
      return {
        ok: false,
        reasonKey: 'artifact.index_missing',
        detail: 'Generated index.html is missing.',
      };
    }
    await args.env.TOKYO_R2.put(`${root}/index.html`, index.body, {
      httpMetadata: { contentType: index.contentType },
    });

    return {
      ok: true,
      accountId: args.accountId,
      instanceId: args.instanceId,
      widgetType: instance.value.widgetType,
      baseLocale: instance.value.baseLocale,
      locales: [...localizedStates.keys()],
      publicFiles: files.map((file) => file.name),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.materialization_failed',
      detail,
    };
  }
}

export async function deleteInstancePublicArtifacts(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<{
  ok: true;
  accountId: string;
  instanceId: string;
  publicFiles: string[];
} | {
  ok: false;
  reasonKey: string;
  detail: string;
}> {
  try {
    const root = `${instanceRoot(args.accountId, args.instanceId)}/`;
    const deleted: string[] = [];
    let cursor: string | undefined;
    do {
      const listed = await args.env.TOKYO_R2.list({ prefix: root, cursor } as R2ListOptions);
      for (const object of listed.objects) {
        const name = object.key.slice(root.length);
        if (!isGeneratedPublicArtifactFile(name)) continue;
        await args.env.TOKYO_R2.delete(object.key);
        deleted.push(name);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
    return {
      ok: true,
      accountId: args.accountId,
      instanceId: args.instanceId,
      publicFiles: deleted,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: 'artifact.delete_failed',
      detail,
    };
  }
}
