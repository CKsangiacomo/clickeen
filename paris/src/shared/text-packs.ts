import { errorDetail } from './errors';

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
