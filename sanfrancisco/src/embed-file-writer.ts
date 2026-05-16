import {
  resolveLanguageOverlayCode,
  resolveLocaleForLanguageOverlayCode,
} from '@clickeen/ck-contracts/overlay-codebooks';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  parseOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import { resolveOverlay } from '@clickeen/ck-contracts';
import { isRecord } from './http';
import type { WidgetGenerationJob } from './widget-generation-jobs';

type EmbedBuildShape = {
  rendering: 'html' | 'iframe';
  seoMode: 'off' | 'lite' | 'full';
  locales: string[];
  clientSide: 'static' | 'minimal-js' | 'interactive';
};

type InstanceGenerationLane = {
  status: 'not_generated' | 'queued' | 'building' | 'ready' | 'stale' | 'failed' | 'unavailable';
  sourceVersion: number;
  requestedAt?: string;
  updatedAt: string;
  error?: string;
  files?: string[];
  startedAt?: string;
  finishedAt?: string;
  blockingReason?: string;
};

type AccountInstanceDocument = {
  v: 1;
  id: string;
  accountId: string;
  accountPublicId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  config: Record<string, unknown>;
  baseLocale: string;
  targetLocales: string[];
  embedBuildShape: EmbedBuildShape;
  sourceVersion: number;
  generation: {
    translations: InstanceGenerationLane;
    embed: InstanceGenerationLane;
  };
  publishStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type EmbedFileWriterStorage = {
  readText: (key: string) => Promise<string | null>;
  writeText: (key: string, value: string, options?: { contentType?: string }) => Promise<void>;
  exists: (key: string) => Promise<boolean>;
  listKeys: (prefix: string) => Promise<string[]>;
};

export type EmbedFileWriterResult =
  | { ok: true; stale: false; files: string[] }
  | { ok: true; stale: true; currentSourceVersion: number }
  | { ok: false; stale: false; reason: string };

const VALID_RENDERING = new Set(['html', 'iframe']);
const VALID_SEO_MODE = new Set(['off', 'lite', 'full']);
const VALID_CLIENT_SIDE = new Set(['static', 'minimal-js', 'interactive']);
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

function instanceRoot(accountPublicId: string, instanceId: string): string {
  return `accounts/${accountPublicId}/instances/${instanceId}`;
}

function instanceKey(accountPublicId: string, instanceId: string): string {
  return `${instanceRoot(accountPublicId, instanceId)}/instance.json`;
}

function normalizeLocale(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : null;
}

function normalizeShape(raw: unknown): EmbedBuildShape | null {
  if (!isRecord(raw)) return null;
  const rendering = typeof raw.rendering === 'string' ? raw.rendering : '';
  const seoMode = typeof raw.seoMode === 'string' ? raw.seoMode : '';
  const clientSide = typeof raw.clientSide === 'string' ? raw.clientSide : '';
  const locales = Array.isArray(raw.locales)
    ? raw.locales.map(normalizeLocale).filter((entry): entry is string => Boolean(entry))
    : [];
  if (!VALID_RENDERING.has(rendering) || !VALID_SEO_MODE.has(seoMode) || !VALID_CLIENT_SIDE.has(clientSide) || !locales.length) {
    return null;
  }
  return {
    rendering: rendering as EmbedBuildShape['rendering'],
    seoMode: seoMode as EmbedBuildShape['seoMode'],
    clientSide: clientSide as EmbedBuildShape['clientSide'],
    locales: Array.from(new Set(locales)),
  };
}

function normalizeInstance(raw: unknown): AccountInstanceDocument | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const accountId = typeof raw.accountId === 'string' ? raw.accountId.trim() : '';
  const accountPublicId = typeof raw.accountPublicId === 'string' ? raw.accountPublicId.trim() : '';
  const widgetCode = typeof raw.widgetCode === 'string' ? raw.widgetCode.trim() : '';
  const widgetType = typeof raw.widgetType === 'string' ? raw.widgetType.trim() : '';
  const baseLocale = normalizeLocale(raw.baseLocale);
  const embedBuildShape = normalizeShape(raw.embedBuildShape);
  const sourceVersion = typeof raw.sourceVersion === 'number' && Number.isInteger(raw.sourceVersion) && raw.sourceVersion >= 1
    ? raw.sourceVersion
    : null;
  if (
    !isCompactInstanceId(id) ||
    !isCompactAccountPublicId(accountId) ||
    accountPublicId !== accountId ||
    !widgetCode ||
    !widgetType ||
    !baseLocale ||
    !embedBuildShape ||
    sourceVersion === null ||
    !isRecord(raw.config) ||
    !isRecord(raw.generation) ||
    !isRecord(raw.generation.embed) ||
    !isRecord(raw.generation.translations)
  ) {
    return null;
  }
  return raw as AccountInstanceDocument;
}

async function readJson(storage: EmbedFileWriterStorage, key: string): Promise<unknown> {
  const text = await storage.readText(key);
  if (text == null) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readCurrentInstance(
  storage: EmbedFileWriterStorage,
  accountPublicId: string,
  instanceId: string,
): Promise<AccountInstanceDocument | null> {
  return normalizeInstance(await readJson(storage, instanceKey(accountPublicId, instanceId)));
}

async function writeInstanceLane(args: {
  storage: EmbedFileWriterStorage;
  accountPublicId: string;
  instanceId: string;
  sourceVersion: number;
  patch: Partial<InstanceGenerationLane>;
}): Promise<{ ok: true; stale: false; instance: AccountInstanceDocument } | { ok: true; stale: true; currentSourceVersion: number }> {
  const instance = await readCurrentInstance(args.storage, args.accountPublicId, args.instanceId);
  if (!instance) throw new Error('embed.instance.invalid');
  if (instance.sourceVersion !== args.sourceVersion) {
    return { ok: true, stale: true, currentSourceVersion: instance.sourceVersion };
  }
  const now = new Date().toISOString();
  const next = {
    ...instance,
    generation: {
      ...instance.generation,
      embed: {
        ...instance.generation.embed,
        ...args.patch,
        sourceVersion: args.sourceVersion,
        updatedAt: now,
      },
    },
    updatedAt: now,
  };
  await args.storage.writeText(
    instanceKey(args.accountPublicId, args.instanceId),
    `${JSON.stringify(next, null, 2)}\n`,
    { contentType: 'application/json; charset=utf-8' },
  );
  return { ok: true, stale: false, instance: next };
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

function replaceWidgetScripts(body: string, scriptFile: string): { body: string; scriptSources: string[] } {
  const scriptSources: string[] = [];
  let inserted = false;
  const nextBody = body.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_full, _attrs, src) => {
    scriptSources.push(String(src));
    if (inserted) return '';
    inserted = true;
    return `<script src="./${scriptFile}" defer></script>`;
  });
  return {
    body: inserted ? nextBody : `${nextBody}\n<script src="./${scriptFile}" defer></script>`,
    scriptSources,
  };
}

function extractStylesheetSources(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

async function readRequiredText(storage: EmbedFileWriterStorage, key: string): Promise<string> {
  const text = await storage.readText(key);
  if (text == null) throw new Error(`embed.source.missing:${key}`);
  return text;
}

async function buildStyles(storage: EmbedFileWriterStorage, widgetType: string, widgetHtml: string): Promise<string> {
  const chunks: string[] = [];
  for (const href of extractStylesheetSources(widgetHtml)) {
    if (href.startsWith('/dieter/')) {
      chunks.push(`@import "${href}";`);
      continue;
    }
    const key = resolveProductPath(widgetType, href);
    if (!key || !key.endsWith('.css')) continue;
    chunks.push(await readRequiredText(storage, key));
  }
  return `${chunks.join('\n\n')}\n`;
}

async function buildScript(args: {
  storage: EmbedFileWriterStorage;
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
    chunks.push(await readRequiredText(args.storage, key));
  }
  return `${chunks.join('\n\n')}\n`;
}

function buildHtml(args: {
  title: string;
  locale: string;
  body: string;
  styleFile: string;
}): string {
  return `<!doctype html>
<html lang="${args.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.title)}</title>
    <link rel="stylesheet" href="./${args.styleFile}" />
  </head>
  <body>
${args.body}
  </body>
</html>
`;
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

function assertVisitorSafe(files: Record<string, string>): void {
  for (const [name, text] of Object.entries(files)) {
    const hit = FORBIDDEN_VISITOR_PATTERNS.find((pattern) => pattern.test(text));
    if (hit) throw new Error(`embed.generated.forbidden:${name}:${hit}`);
  }
}

async function readSelectedOverlayValues(args: {
  storage: EmbedFileWriterStorage;
  accountPublicId: string;
  instance: AccountInstanceDocument;
  locale: string;
}): Promise<Record<string, string> | null> {
  const languageCode = resolveLanguageOverlayCode(args.locale);
  if (!languageCode) return null;
  const prefix = `${instanceRoot(args.accountPublicId, args.instance.id)}/overlays/`;
  const keys = await args.storage.listKeys(prefix);
  const matching = keys
    .map((key) => key.slice(prefix.length).replace(/\.json$/, ''))
    .filter((overlayId) => {
      const parsed = parseOverlayId(overlayId);
      return parsed.ok &&
        parsed.value.accountPublicId === args.accountPublicId &&
        parsed.value.widgetCode === args.instance.widgetCode &&
        parsed.value.instanceId === args.instance.id &&
        parsed.value.languageCode === languageCode;
    })
    .sort();
  const overlayId = matching[matching.length - 1];
  if (!overlayId) return null;
  const raw = await readJson(args.storage, `${prefix}${overlayId}.json`);
  if (!isRecord(raw) || !isRecord(raw.values)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw.values)) {
    if (typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function localeFileName(locale: string): string {
  return `${locale.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'locale'}.html`;
}

export async function runEmbedFileWriter(args: {
  storage: EmbedFileWriterStorage;
  job: WidgetGenerationJob;
}): Promise<EmbedFileWriterResult> {
  if (args.job.jobType !== 'widget.embed') return { ok: false, stale: false, reason: 'embed.job.invalid_type' };
  if (!isCompactAccountPublicId(args.job.accountPublicId) || !isCompactInstanceId(args.job.instanceId)) {
    return { ok: false, stale: false, reason: 'embed.job.invalid_coordinate' };
  }

  const building = await writeInstanceLane({
    storage: args.storage,
    accountPublicId: args.job.accountPublicId,
    instanceId: args.job.instanceId,
    sourceVersion: args.job.sourceVersion,
    patch: { status: 'building', startedAt: new Date().toISOString(), error: undefined, blockingReason: undefined },
  });
  if (building.stale) return building;

  const instance = building.instance;
  const fail = async (reason: string): Promise<EmbedFileWriterResult> => {
    await writeInstanceLane({
      storage: args.storage,
      accountPublicId: args.job.accountPublicId,
      instanceId: args.job.instanceId,
      sourceVersion: args.job.sourceVersion,
      patch: { status: 'failed', error: reason, blockingReason: reason },
    });
    return { ok: false, stale: false, reason };
  };

  try {
    if (instance.widgetType !== instance.widgetType.toLowerCase()) return await fail('embed.instance.widgetType_invalid');
    if (!instance.embedBuildShape.locales.includes(instance.baseLocale)) return await fail('embed.shape.base_locale_missing');
    if (instance.embedBuildShape.rendering !== 'html' && instance.embedBuildShape.rendering !== 'iframe') {
      return await fail('embed.shape.rendering_unsupported');
    }

    const widgetHtml = await readRequiredText(args.storage, `product/widgets/${instance.widgetType}/widget.html`);
    await readRequiredText(args.storage, `product/widgets/${instance.widgetType}/spec.json`);
    await readRequiredText(args.storage, `product/widgets/${instance.widgetType}/agent.md`);

    const styleFile = `styles.v${instance.sourceVersion}.css`;
    const scriptFile = `script.v${instance.sourceVersion}.js`;
    const bodyShell = addInstanceIdToRoot(extractBody(widgetHtml), instance.widgetType, instance.id);
    const { body, scriptSources } = replaceWidgetScripts(bodyShell, scriptFile);
    const localizedStates = new Map<string, Record<string, unknown>>();
    localizedStates.set(instance.baseLocale, instance.config);

    for (const locale of instance.embedBuildShape.locales) {
      if (locale === instance.baseLocale) continue;
      const values = await readSelectedOverlayValues({
        storage: args.storage,
        accountPublicId: args.job.accountPublicId,
        instance,
        locale,
      });
      if (!values) return await fail(`embed.overlay_blocked:${locale}`);
      const localized = resolveOverlay(instance.config, values);
      if (!isRecord(localized)) return await fail(`embed.overlay_invalid:${locale}`);
      localizedStates.set(locale, localized);
    }

    const styles = await buildStyles(args.storage, instance.widgetType, widgetHtml);
    const files: Record<string, string> = {
      [styleFile]: styles,
      'styles.css': styles,
    };

    for (const [locale, state] of localizedStates) {
      const localeScriptFile = locale === instance.baseLocale ? scriptFile : `script.v${instance.sourceVersion}.${localeFileName(locale).replace(/\.html$/, '')}.js`;
      const localeScript = await buildScript({
        storage: args.storage,
        widgetType: instance.widgetType,
        scriptSources,
        instanceId: instance.id,
        locale,
        state,
      });
      files[localeScriptFile] = localeScript;
      if (locale === instance.baseLocale) files['script.js'] = localeScript;
      const html = buildHtml({
        title: instance.displayName || `${instance.widgetType} widget`,
        locale,
        body: body.replace(`./${scriptFile}`, `./${localeScriptFile}`),
        styleFile,
      });
      const fileName = locale === instance.baseLocale ? 'index.html' : localeFileName(locale);
      files[fileName] = html;
    }

    assertVisitorSafe(files);

    const root = instanceRoot(args.job.accountPublicId, args.job.instanceId);
    const supportFiles = Object.keys(files).filter((name) => name !== 'index.html');
    for (const name of supportFiles) {
      await args.storage.writeText(`${root}/${name}`, files[name]!, {
        contentType: name.endsWith('.css')
          ? 'text/css; charset=utf-8'
          : name.endsWith('.js')
            ? 'text/javascript; charset=utf-8'
            : 'text/html; charset=utf-8',
      });
    }
    for (const name of supportFiles) {
      if (!(await args.storage.exists(`${root}/${name}`))) return await fail(`embed.support_missing:${name}`);
    }
    await args.storage.writeText(`${root}/index.html`, files['index.html']!, { contentType: 'text/html; charset=utf-8' });

    const generatedFiles = [...supportFiles, 'index.html'];
    const ready = await writeInstanceLane({
      storage: args.storage,
      accountPublicId: args.job.accountPublicId,
      instanceId: args.job.instanceId,
      sourceVersion: args.job.sourceVersion,
      patch: {
        status: 'ready',
        files: generatedFiles,
        finishedAt: new Date().toISOString(),
        error: undefined,
        blockingReason: undefined,
      },
    });
    if (ready.stale) return ready;
    return { ok: true, stale: false, files: generatedFiles };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'embed.build_failed');
  }
}
