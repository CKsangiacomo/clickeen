import { generateMetaPack } from './seo-geo';
import { errorDetail } from './errors';
import type {
  LocalePolicy,
  SyncLiveSurfaceJob,
  WriteConfigPackJob,
  WriteMetaPackJob,
  WriteTextPackJob,
} from './types';

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function splitPath(path: string): string[] {
  return String(path || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function setExistingStringAtPath(root: unknown, path: string, nextValue: string): void {
  const parts = splitPath(path);
  if (!parts.length) return;
  if (parts.some((seg) => PROHIBITED_SEGMENTS.has(seg))) return;

  let current: any = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    const last = i === parts.length - 1;

    if (isIndex(part)) {
      const idx = Number(part);
      if (!Array.isArray(current)) return;
      if (idx < 0 || idx >= current.length) return;
      if (last) {
        if (typeof current[idx] !== 'string') return;
        current[idx] = nextValue;
        return;
      }
      current = current[idx];
      continue;
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    if (!(part in current)) return;
    if (last) {
      if (typeof current[part] !== 'string') return;
      current[part] = nextValue;
      return;
    }
    current = current[part];
  }
}

export function stripTextFromConfig(config: Record<string, unknown>, textPaths: string[]): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const path of textPaths) {
    if (!path) continue;
    setExistingStringAtPath(cloned, path, '');
  }
  return cloned;
}

export function applyTextPackToConfig(
  config: Record<string, unknown>,
  textPack: Record<string, string>,
): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const [path, value] of Object.entries(textPack)) {
    if (!path) continue;
    if (typeof value !== 'string') continue;
    setExistingStringAtPath(cloned, path, value);
  }
  return cloned;
}

type L10nSetOp = { op: 'set'; path: string; value: unknown };
type MirrorOverlayRow = {
  layer?: unknown;
  layer_key?: unknown;
  base_fingerprint?: unknown;
  ops?: unknown;
};
type MirrorEnqueueResult = { ok: true } | { ok: false; error: string };
type MirrorEnqueueFailure = { locale: string; error: string };
type MirrorEnqueueKind = 'write-text-pack' | 'write-meta-pack' | 'write-config-pack' | 'sync-live-surface';

export function applyL10nOpsToTextPack(
  basePack: Record<string, string>,
  ops: L10nSetOp[] | null | undefined,
): Record<string, string> {
  const next: Record<string, string> = { ...basePack };
  if (!Array.isArray(ops) || ops.length === 0) return next;

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    const path = typeof op.path === 'string' ? op.path.trim() : '';
    if (!path) continue;
    if (!(path in next)) continue;
    if (typeof op.value !== 'string') continue;
    next[path] = op.value;
  }

  return next;
}

export function materializeTextPack(args: {
  basePack: Record<string, string>;
  localeOps?: L10nSetOp[] | null;
  userOps?: L10nSetOp[] | null;
}): Record<string, string> {
  const afterLocale = applyL10nOpsToTextPack(args.basePack, args.localeOps);
  return applyL10nOpsToTextPack(afterLocale, args.userOps);
}

export function collectLocaleOverlayOps(args: {
  rows: MirrorOverlayRow[];
  locales: string[];
  baseFingerprint: string;
}): {
  localeOpsByLocale: Map<string, L10nSetOp[]>;
  userOpsByLocale: Map<string, L10nSetOp[]>;
} {
  const localeOpsByLocale = new Map<string, L10nSetOp[]>();
  const userOpsByLocale = new Map<string, L10nSetOp[]>();
  const activeLocales = new Set(args.locales);

  args.rows.forEach((row) => {
    const layer = typeof row?.layer === 'string' ? row.layer.trim().toLowerCase() : '';
    const locale = typeof row?.layer_key === 'string' ? row.layer_key.trim() : '';
    if (!locale || !activeLocales.has(locale)) return;
    if (row.base_fingerprint !== args.baseFingerprint) return;
    if (!Array.isArray(row.ops)) return;
    if (layer === 'locale') {
      localeOpsByLocale.set(locale, row.ops as L10nSetOp[]);
    } else if (layer === 'user') {
      userOpsByLocale.set(locale, row.ops as L10nSetOp[]);
    }
  });

  return { localeOpsByLocale, userOpsByLocale };
}

export async function resolveLocaleOverlayOps(args: {
  loadRows: () => Promise<MirrorOverlayRow[]>;
  locales: string[];
  baseFingerprint: string;
  warnMessage: string;
  warnContext?: Record<string, unknown>;
}): Promise<{
  localeOpsByLocale: Map<string, L10nSetOp[]>;
  userOpsByLocale: Map<string, L10nSetOp[]>;
}> {
  if (args.locales.length === 0) {
    return {
      localeOpsByLocale: new Map<string, L10nSetOp[]>(),
      userOpsByLocale: new Map<string, L10nSetOp[]>(),
    };
  }

  try {
    return collectLocaleOverlayOps({
      rows: await args.loadRows(),
      locales: args.locales,
      baseFingerprint: args.baseFingerprint,
    });
  } catch (error) {
    const detail = errorDetail(error);
    if (args.warnContext) {
      console.warn(args.warnMessage, { ...args.warnContext, detail });
    } else {
      console.warn(args.warnMessage, detail);
    }
    return {
      localeOpsByLocale: new Map<string, L10nSetOp[]>(),
      userOpsByLocale: new Map<string, L10nSetOp[]>(),
    };
  }
}

export function buildLocaleTextPack(args: {
  locale: string;
  baseLocale: string;
  basePack: Record<string, string>;
  localeOps?: L10nSetOp[] | null;
  userOps?: L10nSetOp[] | null;
}): Record<string, string> {
  if (args.locale === args.baseLocale) return { ...args.basePack };
  return materializeTextPack({
    basePack: args.basePack,
    localeOps: args.localeOps,
    userOps: args.userOps,
  });
}

export function buildLocaleTextPacks(args: {
  locales: string[];
  baseLocale: string;
  basePack: Record<string, string>;
  localeOpsByLocale?: ReadonlyMap<string, L10nSetOp[]>;
  userOpsByLocale?: ReadonlyMap<string, L10nSetOp[]>;
}): Array<{ locale: string; textPack: Record<string, string> }> {
  return args.locales.map((locale) => ({
    locale,
    textPack: buildLocaleTextPack({
      locale,
      baseLocale: args.baseLocale,
      basePack: args.basePack,
      localeOps: args.localeOpsByLocale?.get(locale) ?? null,
      userOps: args.userOpsByLocale?.get(locale) ?? null,
    }),
  }));
}

export async function enqueueLocaleTextPacks(args: {
  publicId: string;
  localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }>;
  enqueue: (job: WriteTextPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<MirrorEnqueueFailure[]> {
  const failures: MirrorEnqueueFailure[] = [];
  for (const { locale, textPack } of args.localeTextPacks) {
    const result = await args.enqueue({
      v: 1,
      kind: 'write-text-pack',
      publicId: args.publicId,
      locale,
      textPack,
    });
    if (!result.ok) failures.push({ locale, error: result.error });
  }
  return failures;
}

export async function enqueueLocaleMetaPacks(args: {
  publicId: string;
  widgetType: string;
  configPack: Record<string, unknown>;
  localeTextPacks: Array<{ locale: string; textPack: Record<string, string> }>;
  enqueue: (job: WriteMetaPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<MirrorEnqueueFailure[]> {
  const failures: MirrorEnqueueFailure[] = [];
  for (const { locale, textPack } of args.localeTextPacks) {
    const metaState = applyTextPackToConfig(args.configPack, textPack);
    const metaPack = generateMetaPack({ widgetType: args.widgetType, state: metaState, locale });
    const result = await args.enqueue({
      v: 1,
      kind: 'write-meta-pack',
      publicId: args.publicId,
      locale,
      metaPack,
    });
    if (!result.ok) failures.push({ locale, error: result.error });
  }
  return failures;
}

export async function enqueueConfigPack(args: {
  publicId: string;
  widgetType: string;
  configFp: string;
  configPack: Record<string, unknown>;
  enqueue: (job: WriteConfigPackJob) => Promise<MirrorEnqueueResult>;
}): Promise<string | null> {
  const result = await args.enqueue({
    v: 1,
    kind: 'write-config-pack',
    publicId: args.publicId,
    widgetType: args.widgetType,
    configFp: args.configFp,
    configPack: args.configPack,
  });
  return result.ok ? null : result.error;
}

export async function enqueueLiveSurfaceSync(args: {
  publicId: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
  enqueue: (job: SyncLiveSurfaceJob) => Promise<MirrorEnqueueResult>;
}): Promise<string | null> {
  const result = await args.enqueue({
    v: 1,
    kind: 'sync-live-surface',
    publicId: args.publicId,
    live: true,
    widgetType: args.widgetType,
    configFp: args.configFp,
    localePolicy: args.localePolicy,
    seoGeo: args.seoGeo,
  });
  return result.ok ? null : result.error;
}

export function logMirrorEnqueueFailures(args: {
  kind: Extract<MirrorEnqueueKind, 'write-text-pack' | 'write-meta-pack'>;
  failures: MirrorEnqueueFailure[];
  context?: string;
}): void {
  if (args.failures.length === 0) return;
  const suffix = args.context ? ` (${args.context})` : '';
  for (const failure of args.failures) {
    console.error(`[ParisWorker] tokyo ${args.kind} enqueue failed${suffix}`, failure.error);
  }
}

export function logMirrorEnqueueError(args: {
  kind: Extract<MirrorEnqueueKind, 'write-config-pack' | 'sync-live-surface'>;
  error: string | null;
  context?: string;
}): void {
  if (!args.error) return;
  const suffix = args.context ? ` (${args.context})` : '';
  console.error(`[ParisWorker] tokyo ${args.kind} enqueue failed${suffix}`, args.error);
}
