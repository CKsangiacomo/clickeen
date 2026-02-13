export type CKTypographyFontCategory = 'sans' | 'serif' | 'display' | 'script' | 'handwritten';
export type CKTypographyFamilyClass = 'sans' | 'serif';
export type CKTypographyUsage = 'body-safe' | 'heading-only';

type CKTypographyFontMeta = {
  spec: string;
  category: CKTypographyFontCategory;
  familyClass: CKTypographyFamilyClass;
  usage: CKTypographyUsage;
};

const CK_TYPOGRAPHY_CATEGORY_LABELS: Record<CKTypographyFontCategory, string> = {
  sans: 'Sans',
  serif: 'Serif',
  display: 'Display',
  script: 'Script',
  handwritten: 'Handwritten',
};

const CK_TYPOGRAPHY_CATEGORY_ORDER: readonly CKTypographyFontCategory[] = [
  'sans',
  'serif',
  'display',
  'script',
  'handwritten',
];

export const CK_TYPOGRAPHY_FONT_META = {
  Inter: {
    spec: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  },
  Manrope: {
    spec: 'Manrope:wght@200..800',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  },
  'Open Sans': {
    spec: 'Open+Sans:ital,wght@0,300..800;1,300..800',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  },
  Lato: {
    spec: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  },
  Roboto: {
    spec: 'Roboto:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  },
  Montserrat: {
    spec: 'Montserrat:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  Raleway: {
    spec: 'Raleway:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  'Libre Baskerville': {
    spec: 'Libre+Baskerville:ital,wght@0,400..700;1,400..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'body-safe',
  },
  Lora: {
    spec: 'Lora:ital,wght@0,400..700;1,400..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'body-safe',
  },
  'Cormorant Garamond': {
    spec: 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  },
  'Crimson Text': {
    spec: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  },
  Gabriela: {
    spec: 'Gabriela',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  },
  Michroma: {
    spec: 'Michroma',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  'Playfair Display': {
    spec: 'Playfair+Display:ital,wght@0,400..900;1,400..900',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  },
  Cookie: {
    spec: 'Cookie',
    category: 'script',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  'Homemade Apple': {
    spec: 'Homemade+Apple',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  'Permanent Marker': {
    spec: 'Permanent+Marker',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  },
  'Shadows Into Light': {
    spec: 'Shadows+Into+Light',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  },
} as const satisfies Record<string, CKTypographyFontMeta>;

export type CKTypographyFontFamily = keyof typeof CK_TYPOGRAPHY_FONT_META;

export const CK_GOOGLE_FONT_SPECS = Object.freeze(
  Object.fromEntries(
    Object.entries(CK_TYPOGRAPHY_FONT_META).map(([family, meta]) => [family, meta.spec]),
  ) as Record<CKTypographyFontFamily, string>,
);

export const CK_TYPOGRAPHY_FONTS = Object.keys(CK_TYPOGRAPHY_FONT_META) as CKTypographyFontFamily[];

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

export function getCkTypographyFontMeta(family: string): CKTypographyFontMeta | null {
  if (!isCkTypographyFamily(family)) return null;
  return CK_TYPOGRAPHY_FONT_META[family];
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

type CkTypographyFamilyOption = {
  label: string;
  value?: string;
  weights?: string;
  styles?: string;
  badge?: string;
  isGroupHeader?: boolean;
};

export function buildCkTypographyFamilyOptions(): CkTypographyFamilyOption[] {
  const options: CkTypographyFamilyOption[] = [];
  CK_TYPOGRAPHY_CATEGORY_ORDER.forEach((category) => {
    const families = CK_TYPOGRAPHY_FONTS.filter(
      (family) => CK_TYPOGRAPHY_FONT_META[family].category === category,
    );
    if (families.length === 0) return;

    options.push({
      isGroupHeader: true,
      label: CK_TYPOGRAPHY_CATEGORY_LABELS[category],
    });
    families.forEach((family) => {
      const meta = CK_TYPOGRAPHY_FONT_META[family];
      options.push({
        label: family,
        value: family,
        weights: getCkTypographyAllowedWeights(family).join(','),
        styles: getCkTypographyAllowedStyles(family).join(','),
        badge: meta.usage === 'body-safe' ? 'Body-safe' : 'Heading-only',
      });
    });
  });
  return options;
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
