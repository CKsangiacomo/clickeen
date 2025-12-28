export const CK_GOOGLE_FONT_SPECS = {
  Cookie: 'Cookie',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
  'Crimson Text': 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
  Gabriela: 'Gabriela',
  'Homemade Apple': 'Homemade+Apple',
  Inter: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900',
  Lato: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
  'Libre Baskerville': 'Libre+Baskerville:ital,wght@0,400..700;1,400..700',
  Lora: 'Lora:ital,wght@0,400..700;1,400..700',
  Manrope: 'Manrope:wght@200..800',
  Michroma: 'Michroma',
  Montserrat: 'Montserrat:ital,wght@0,100..900;1,100..900',
  'Open Sans': 'Open+Sans:ital,wght@0,300..800;1,300..800',
  'Permanent Marker': 'Permanent+Marker',
  'Playfair Display': 'Playfair+Display:ital,wght@0,400..900;1,400..900',
  Raleway: 'Raleway:ital,wght@0,100..900;1,100..900',
  Roboto: 'Roboto:ital,wght@0,100..900;1,100..900',
  'Shadows Into Light': 'Shadows+Into+Light',
} as const;

export type CKTypographyFontFamily = keyof typeof CK_GOOGLE_FONT_SPECS;

export const CK_TYPOGRAPHY_FONTS = Object.keys(CK_GOOGLE_FONT_SPECS) as CKTypographyFontFamily[];

const WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semi-bold',
  '700': 'Bold',
  '800': 'Extra bold',
  '900': 'Black',
};

function toSortedWeights(values: Iterable<string>): string[] {
  return Array.from(values).sort((a, b) => Number(a) - Number(b));
}

function expandWeightRange(minRaw: string, maxRaw: string): string[] {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const start = Math.ceil(lo / 100) * 100;
  const end = Math.floor(hi / 100) * 100;
  const result: string[] = [];
  for (let w = start; w <= end; w += 100) result.push(String(w));
  return result;
}

function specSupportsItalic(spec: string): boolean {
  return spec.includes('ital,') || spec.includes('ital@');
}

export function isCkTypographyFamily(value: string): value is CKTypographyFontFamily {
  return Object.prototype.hasOwnProperty.call(CK_GOOGLE_FONT_SPECS, value);
}

export function parseGoogleFontWeights(spec: string): string[] {
  const idx = spec.indexOf('wght@');
  if (idx === -1) return ['400'];
  const segment = spec.slice(idx + 'wght@'.length);
  const tokens = segment.split(';').map((t) => t.trim()).filter(Boolean);
  const weights = new Set<string>();
  for (const token of tokens) {
    const last = token.split(',').pop() || '';
    const rangeMatch = last.match(/(\d+)\.\.(\d+)/);
    if (rangeMatch) {
      expandWeightRange(rangeMatch[1], rangeMatch[2]).forEach((w) => weights.add(w));
      continue;
    }

    const match = last.match(/^\s*(\d+)\s*$/);
    if (match) weights.add(match[1]);
  }
  return weights.size ? toSortedWeights(weights) : ['400'];
}

export function getCkTypographyAllowedWeights(family: string): string[] {
  if (!isCkTypographyFamily(family)) return [];
  return parseGoogleFontWeights(CK_GOOGLE_FONT_SPECS[family]);
}

export function getCkTypographyAllowedStyles(family: string): string[] {
  if (!isCkTypographyFamily(family)) return [];
  const spec = CK_GOOGLE_FONT_SPECS[family];
  return specSupportsItalic(spec) ? ['normal', 'italic'] : ['normal'];
}

export function buildCkTypographyWeightOptions(weights: string[]) {
  return weights.map((w) => ({
    label: WEIGHT_LABELS[w] ? `${WEIGHT_LABELS[w]} (${w})` : w,
    value: w,
  }));
}

export const CK_TYPOGRAPHY_WEIGHT_OPTIONS = buildCkTypographyWeightOptions(
  (() => {
    const weights = new Set<string>();
    CK_TYPOGRAPHY_FONTS.forEach((family) => {
      getCkTypographyAllowedWeights(family).forEach((w) => weights.add(w));
    });
    return toSortedWeights(weights);
  })(),
);
