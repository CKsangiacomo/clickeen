import type { LocalizationOp } from "@clickeen/ck-contracts";
import { SEO_GEO_META_PACK_GENERATORS } from "../generated/widget-seo-geo-registry";
import { resolveWidgetCatalogEntry } from "./widget-catalog";

function splitPath(path: string): string[] {
  return String(path || "")
    .split(".")
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isIndex(segment: string): boolean {
  return /^\d+$/.test(segment);
}

function applyOpsToTextPack(
  basePack: Record<string, string>,
  ops: LocalizationOp[],
): Record<string, string> {
  const next = { ...basePack };
  for (const op of ops) {
    if (!(op.path in next)) continue;
    next[op.path] = op.value;
  }
  return next;
}

export function buildLocalizedTextPack(args: {
  baseLocale: string;
  locale: string;
  basePack: Record<string, string>;
  baseOps: LocalizationOp[];
}): Record<string, string> {
  if (args.locale === args.baseLocale) return { ...args.basePack };
  return applyOpsToTextPack(args.basePack, args.baseOps);
}

function setExistingStringAtPath(
  root: unknown,
  path: string,
  nextValue: string,
): void {
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
        if (typeof current[idx] !== "string") return;
        current[idx] = nextValue;
        return;
      }
      current = current[idx];
      continue;
    }

    if (!current || typeof current !== "object" || Array.isArray(current))
      return;
    if (!(part in current)) return;
    if (last) {
      if (typeof current[part] !== "string") return;
      current[part] = nextValue;
      return;
    }
    current = current[part];
  }
}

function applyTextPackToConfig(
  config: Record<string, unknown>,
  textPack: Record<string, string>,
): Record<string, unknown> {
  const cloned = structuredClone(config) as Record<string, unknown>;
  for (const [path, value] of Object.entries(textPack)) {
    if (!path || typeof value !== "string") continue;
    setExistingStringAtPath(cloned, path, value);
  }
  return cloned;
}

function generateMetaPack(args: {
  widgetType: string;
  state: Record<string, unknown>;
  locale: string;
}): { schemaJsonLd: string; excerptHtml: string } {
  const widgetType = args.widgetType.trim().toLowerCase();
  const locale = args.locale.trim() || "en";
  const catalogEntry = resolveWidgetCatalogEntry(widgetType);
  if (!catalogEntry?.capabilities.seoGeo)
    return { schemaJsonLd: "", excerptHtml: "" };

  const generator = SEO_GEO_META_PACK_GENERATORS[widgetType];
  return generator
    ? generator({ state: args.state, locale })
    : { schemaJsonLd: "", excerptHtml: "" };
}

export function buildLocaleMirrorPayload(args: {
  widgetType: string;
  baseConfig: Record<string, unknown>;
  baseLocale: string;
  locale: string;
  baseTextPack: Record<string, string>;
  baseOps: LocalizationOp[];
  seoGeoLive: boolean;
}): {
  textPack: Record<string, string>;
  metaPack: Record<string, unknown> | null;
} {
  const textPack = buildLocalizedTextPack({
    baseLocale: args.baseLocale,
    locale: args.locale,
    basePack: args.baseTextPack,
    baseOps: args.baseOps,
  });
  if (!args.seoGeoLive) {
    return { textPack, metaPack: null };
  }
  const localizedConfig = applyTextPackToConfig(args.baseConfig, textPack);
  return {
    textPack,
    metaPack: generateMetaPack({
      widgetType: args.widgetType,
      state: localizedConfig,
      locale: args.locale,
    }),
  };
}
