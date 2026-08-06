import type { ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { AccountFontLibrary, RuntimeTypographyData } from '@clickeen/widget-shell';

export function collectFontAssetRefs(fontLibrary: AccountFontLibrary | null): string[] {
  if (!fontLibrary) return [];
  const refs = new Set<string>();
  Object.values(fontLibrary.fonts).forEach((record) => {
    if (record.source === 'account-asset') refs.add(record.assetRef);
  });
  return Array.from(refs);
}

export function buildRuntimeTypographyData(args: {
  fontLibrary: AccountFontLibrary | null;
  resolvedAssets: Map<string, ResolvedAccountAsset>;
}): { ok: true; data: RuntimeTypographyData } | { ok: false; error: string | null } {
  if (!args.fontLibrary) return { ok: false, error: 'Missing font library' };
  const curatedFonts: RuntimeTypographyData['curatedFonts'] = {};
  for (const [family, record] of Object.entries(args.fontLibrary.fonts)) {
    if (record.source === 'google') {
      curatedFonts[family] = {
        source: 'google',
        spec: record.spec,
        familyClass: record.familyClass,
        weights: record.weights,
        styles: record.styles,
      };
      continue;
    }
    const resolved = args.resolvedAssets.get(record.assetRef);
    if (!resolved) return { ok: false, error: null };
    if (resolved.assetType !== 'font' || resolved.contentType !== record.contentType) {
      return { ok: false, error: 'Failed to resolve font assets' };
    }
    curatedFonts[family] = {
      source: 'account-asset',
      url: resolved.url,
      contentType: record.contentType,
      familyClass: record.familyClass,
      weights: record.weights,
      styles: record.styles,
    };
  }
  return { ok: true, data: { curatedFonts } };
}
