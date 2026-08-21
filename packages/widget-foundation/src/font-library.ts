export type AccountFontLibrarySource = 'google' | 'tokyo' | 'account-asset';
export type AccountFontCategory = 'sans' | 'serif' | 'display' | 'script' | 'handwritten';
export type AccountFontFamilyClass = 'sans' | 'serif';
export type AccountFontUsage = 'body-safe' | 'heading-only';
export type AccountFontStyle = 'normal' | 'italic';

export type GoogleAccountFontRecord = {
  label: string;
  source: 'google';
  category: AccountFontCategory;
  familyClass: AccountFontFamilyClass;
  usage: AccountFontUsage;
  weights: string[];
  styles: AccountFontStyle[];
  spec: string;
  locked?: boolean;
};

export type AccountAssetFontRecord = {
  label: string;
  source: 'account-asset';
  category: AccountFontCategory;
  familyClass: AccountFontFamilyClass;
  usage: AccountFontUsage;
  weights: string[];
  styles: AccountFontStyle[];
  assetRef: string;
  contentType: string;
  locked?: boolean;
};

export type TokyoFontRecord = {
  label: string;
  source: 'tokyo';
  category: AccountFontCategory;
  familyClass: AccountFontFamilyClass;
  usage: AccountFontUsage;
  weights: string[];
  styles: AccountFontStyle[];
  filePath: string;
  locked?: boolean;
};

export type AccountFontRecord = GoogleAccountFontRecord | TokyoFontRecord | AccountAssetFontRecord;

export type AccountFontLibrary = {
  version: 1;
  fonts: Record<string, AccountFontRecord>;
};

export type RuntimeTypographyFontRecord =
  | {
      source: 'google';
      spec: string;
      familyClass: AccountFontFamilyClass;
      weights: string[];
      styles: AccountFontStyle[];
    }
  | {
      source: 'account-asset';
      url: string;
      contentType: string;
      familyClass: AccountFontFamilyClass;
      weights: string[];
      styles: AccountFontStyle[];
    }
  | {
      source: 'tokyo';
      url: string;
      familyClass: AccountFontFamilyClass;
      weights: string[];
      styles: AccountFontStyle[];
    };

export type RuntimeTypographyData = {
  curatedFonts: Record<string, RuntimeTypographyFontRecord>;
};

export type AccountFontFamilyOption = {
  label: string;
  value?: string;
  weights?: string;
  styles?: string;
  badge?: string;
  isGroupHeader?: boolean;
};

export type AccountFontFamilyOptionsCopy = {
  categories: Record<AccountFontCategory, string>;
  usage: Record<AccountFontUsage, string>;
};

export const ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY =
  'coreui.errors.typography.selection.invalid';

export type AccountTypographyFamilySelection = {
  family: string;
  weight: string;
  fontStyle: AccountFontStyle;
};

export const ACCOUNT_FONT_CATEGORY_ORDER: readonly AccountFontCategory[] = [
  'sans',
  'serif',
  'display',
  'script',
  'handwritten',
];

export const ACCOUNT_FONT_UPLOAD_MIME_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  woff2: ['font/woff2'],
  woff: ['font/woff', 'application/font-woff', 'application/x-font-woff'],
  ttf: ['font/ttf', 'application/x-font-ttf'],
  otf: ['font/otf', 'application/x-font-otf'],
};

const FONT_CATEGORIES = new Set<AccountFontCategory>(ACCOUNT_FONT_CATEGORY_ORDER);
const FAMILY_CLASSES = new Set<AccountFontFamilyClass>(['sans', 'serif']);
const USAGES = new Set<AccountFontUsage>(['body-safe', 'heading-only']);
const STYLES = new Set<AccountFontStyle>(['normal', 'italic']);

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readExactNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  return value;
}

function normalizeWeight(value: unknown): string | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !/^(100|200|300|400|500|600|700|800|900)$/.test(normalized)) return null;
  return normalized;
}

function normalizeStringList<T extends string>(
  value: unknown,
  normalize: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result: T[] = [];
  for (const item of value) {
    const normalized = normalize(item);
    if (!normalized) return null;
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function normalizeStyle(value: unknown): AccountFontStyle | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !STYLES.has(normalized as AccountFontStyle)) return null;
  return normalized as AccountFontStyle;
}

function normalizeCategory(value: unknown): AccountFontCategory | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !FONT_CATEGORIES.has(normalized as AccountFontCategory)) return null;
  return normalized as AccountFontCategory;
}

function normalizeFamilyClass(value: unknown): AccountFontFamilyClass | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !FAMILY_CLASSES.has(normalized as AccountFontFamilyClass)) return null;
  return normalized as AccountFontFamilyClass;
}

function normalizeUsage(value: unknown): AccountFontUsage | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized || !USAGES.has(normalized as AccountFontUsage)) return null;
  return normalized as AccountFontUsage;
}

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
  for (let weight = start; weight <= end; weight += 100) result.push(String(weight));
  return result;
}

export function parseGoogleFontWeights(spec: string): string[] {
  const idx = spec.indexOf('wght@');
  if (idx === -1) return ['400'];
  const segment = spec.slice(idx + 'wght@'.length);
  const tokens = segment
    .split(';')
    .map((token) => token.trim())
    .filter(Boolean);
  const weights = new Set<string>();
  for (const token of tokens) {
    const last = token.split(',').pop() || '';
    const rangeMatch = last.match(/(\d+)\.\.(\d+)/);
    if (rangeMatch) {
      expandWeightRange(rangeMatch[1]!, rangeMatch[2]!).forEach((weight) => weights.add(weight));
      continue;
    }
    const match = last.match(/^\s*(\d+)\s*$/);
    if (match) weights.add(match[1]!);
  }
  return weights.size ? toSortedWeights(weights) : ['400'];
}

export function googleFontSpecSupportsItalic(spec: string): boolean {
  return spec.includes('ital,') || spec.includes('ital@');
}

function googleFont(args: {
  label: string;
  spec: string;
  category: AccountFontCategory;
  familyClass: AccountFontFamilyClass;
  usage: AccountFontUsage;
  locked?: boolean;
}): GoogleAccountFontRecord {
  return {
    label: args.label,
    source: 'google',
    category: args.category,
    familyClass: args.familyClass,
    usage: args.usage,
    weights: parseGoogleFontWeights(args.spec),
    styles: googleFontSpecSupportsItalic(args.spec) ? ['normal', 'italic'] : ['normal'],
    spec: args.spec,
    ...(args.locked ? { locked: true } : {}),
  };
}

function tokyoFont(args: {
  label: string;
  filePath: string;
  category: AccountFontCategory;
  familyClass: AccountFontFamilyClass;
  usage: AccountFontUsage;
}): TokyoFontRecord {
  return {
    label: args.label,
    source: 'tokyo',
    category: args.category,
    familyClass: args.familyClass,
    usage: args.usage,
    weights: ['400'],
    styles: ['normal'],
    filePath: args.filePath,
  };
}

export const SYSTEM_GOOGLE_FONT_RECORDS = {
  Inter: googleFont({
    label: 'Inter',
    spec: 'Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
    locked: true,
  }),
  Manrope: googleFont({
    label: 'Manrope',
    spec: 'Manrope:wght@200..800',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  }),
  'Open Sans': googleFont({
    label: 'Open Sans',
    spec: 'Open+Sans:ital,wght@0,300..800;1,300..800',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  }),
  Lato: googleFont({
    label: 'Lato',
    spec: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  }),
  Roboto: googleFont({
    label: 'Roboto',
    spec: 'Roboto:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'body-safe',
  }),
  Montserrat: googleFont({
    label: 'Montserrat',
    spec: 'Montserrat:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  Raleway: googleFont({
    label: 'Raleway',
    spec: 'Raleway:ital,wght@0,100..900;1,100..900',
    category: 'sans',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  'Libre Baskerville': googleFont({
    label: 'Libre Baskerville',
    spec: 'Libre+Baskerville:ital,wght@0,400..700;1,400..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'body-safe',
  }),
  Lora: googleFont({
    label: 'Lora',
    spec: 'Lora:ital,wght@0,400..700;1,400..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'body-safe',
  }),
  'Cormorant Garamond': googleFont({
    label: 'Cormorant Garamond',
    spec: 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  'Crimson Text': googleFont({
    label: 'Crimson Text',
    spec: 'Crimson+Text:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Gabriela: googleFont({
    label: 'Gabriela',
    spec: 'Gabriela',
    category: 'serif',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Michroma: googleFont({
    label: 'Michroma',
    spec: 'Michroma',
    category: 'display',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  'Playfair Display': googleFont({
    label: 'Playfair Display',
    spec: 'Playfair+Display:ital,wght@0,400..900;1,400..900',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Cookie: googleFont({
    label: 'Cookie',
    spec: 'Cookie',
    category: 'script',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  'Homemade Apple': googleFont({
    label: 'Homemade Apple',
    spec: 'Homemade+Apple',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  'Permanent Marker': googleFont({
    label: 'Permanent Marker',
    spec: 'Permanent+Marker',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
  'Shadows Into Light': googleFont({
    label: 'Shadows Into Light',
    spec: 'Shadows+Into+Light',
    category: 'handwritten',
    familyClass: 'sans',
    usage: 'heading-only',
  }),
} as const satisfies Record<string, GoogleAccountFontRecord>;

export const SYSTEM_TOKYO_FONT_RECORDS = {
  Frari: tokyoFont({
    label: 'Frari',
    filePath: '/fonts/special/Frari.woff2',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Giudecca: tokyoFont({
    label: 'Giudecca',
    filePath: '/fonts/special/Giudecca.woff',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Marin: tokyoFont({
    label: 'Marin',
    filePath: '/fonts/special/Marin.woff',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Orio: tokyoFont({
    label: 'Orio',
    filePath: '/fonts/special/Orio.woff',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Pachuka: tokyoFont({
    label: 'Pachuka',
    filePath: '/fonts/special/Pachuka.woff2',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  'Pachuka Line': tokyoFont({
    label: 'Pachuka Line',
    filePath: '/fonts/special/Pachuka_line.woff2',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
  Rialto: tokyoFont({
    label: 'Rialto',
    filePath: '/fonts/special/Rialto.woff2',
    category: 'display',
    familyClass: 'serif',
    usage: 'heading-only',
  }),
} as const satisfies Record<string, TokyoFontRecord>;

function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isExactRawSystemTokyoFontRecord(
  family: string,
  value: Record<string, unknown>,
): value is TokyoFontRecord {
  const expected = (SYSTEM_TOKYO_FONT_RECORDS as Record<string, TokyoFontRecord>)[family];
  if (!expected) return false;
  const expectedKeys = Object.keys(expected).sort();
  if (!sameOrderedStrings(Object.keys(value).sort(), expectedKeys)) return false;
  return expectedKeys.every((key) => {
    const expectedValue = expected[key as keyof TokyoFontRecord];
    const actualValue = value[key];
    return Array.isArray(expectedValue)
      ? Array.isArray(actualValue) && sameOrderedStrings(actualValue, expectedValue)
      : actualValue === expectedValue;
  });
}

function isExactSystemTokyoFontRecord(family: string, record: AccountFontRecord): boolean {
  const expected = (SYSTEM_TOKYO_FONT_RECORDS as Record<string, TokyoFontRecord>)[family];
  if (!expected || record.source !== 'tokyo') return false;
  return (
    record.label === expected.label &&
    record.category === expected.category &&
    record.familyClass === expected.familyClass &&
    record.usage === expected.usage &&
    record.filePath === expected.filePath &&
    record.locked === expected.locked &&
    sameOrderedStrings(record.weights, expected.weights) &&
    sameOrderedStrings(record.styles, expected.styles)
  );
}

export function createDefaultAccountFontLibrary(): AccountFontLibrary {
  return {
    version: 1,
    fonts: cloneRecord({
      ...SYSTEM_GOOGLE_FONT_RECORDS,
      ...SYSTEM_TOKYO_FONT_RECORDS,
    }),
  };
}

function hasForbiddenGoogleFields(value: Record<string, unknown>): boolean {
  return value.assetRef != null || value.contentType != null || value.filePath != null || value.url != null;
}

function hasForbiddenAccountAssetFields(value: Record<string, unknown>): boolean {
  return value.spec != null || value.filePath != null || value.url != null;
}

function normalizeFontRecord(family: string, value: unknown): AccountFontRecord | null {
  if (!isRecord(value)) return null;
  const normalizedSource = normalizeNonEmptyString(value.source);
  if (normalizedSource === 'tokyo') {
    const expected = (SYSTEM_TOKYO_FONT_RECORDS as Record<string, TokyoFontRecord>)[family];
    return expected && isExactRawSystemTokyoFontRecord(family, value)
      ? cloneRecord(expected)
      : null;
  }
  const label = normalizeNonEmptyString(value.label);
  const source = normalizedSource;
  const category = normalizeCategory(value.category);
  const familyClass = normalizeFamilyClass(value.familyClass);
  const usage = normalizeUsage(value.usage);
  const weights = normalizeStringList(value.weights, normalizeWeight);
  const styles = normalizeStringList(value.styles, normalizeStyle);
  if (
    !label ||
    label !== family ||
    !source ||
    !category ||
    !familyClass ||
    !usage ||
    !weights ||
    !styles
  )
    return null;
  const locked = typeof value.locked === 'boolean' ? value.locked : undefined;
  const base = {
    label,
    category,
    familyClass,
    usage,
    weights: toSortedWeights(weights),
    styles,
    ...(typeof locked === 'boolean' ? { locked } : {}),
  };

  if (source === 'google') {
    const spec = normalizeNonEmptyString(value.spec);
    if (!spec || hasForbiddenGoogleFields(value)) return null;
    return {
      ...base,
      source,
      spec,
    };
  }

  if (source === 'account-asset') {
    const assetRef = normalizeNonEmptyString(value.assetRef);
    const contentType = normalizeNonEmptyString(value.contentType);
    if (
      !assetRef ||
      !contentType ||
      !isAcceptedAccountFontUpload(assetRef, contentType) ||
      hasForbiddenAccountAssetFields(value)
    )
      return null;
    return {
      ...base,
      source,
      assetRef,
      contentType,
    };
  }

  return null;
}

export function normalizeAccountFontLibrary(raw: unknown): AccountFontLibrary | null {
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.fonts)) return null;
  const fonts: Record<string, AccountFontRecord> = {};
  for (const [family, value] of Object.entries(raw.fonts)) {
    if (!family.trim()) return null;
    const record = normalizeFontRecord(family, value);
    if (!record) return null;
    fonts[family] = record;
  }
  const inter = fonts.Inter;
  if (!inter || inter.source !== 'google' || inter.locked !== true) return null;
  for (const family of Object.keys(SYSTEM_TOKYO_FONT_RECORDS)) {
    const record = fonts[family];
    if (!record || !isExactSystemTokyoFontRecord(family, record)) return null;
  }
  return {
    version: 1,
    fonts,
  };
}

export function isAccountFontFamily(fontLibrary: AccountFontLibrary, family: string): boolean {
  return Object.prototype.hasOwnProperty.call(fontLibrary.fonts, family);
}

export function getAccountFontRecord(
  fontLibrary: AccountFontLibrary,
  family: string,
): AccountFontRecord | null {
  return isAccountFontFamily(fontLibrary, family) ? fontLibrary.fonts[family]! : null;
}

export function getAccountFontAllowedWeights(
  fontLibrary: AccountFontLibrary,
  family: string,
): string[] {
  return getAccountFontRecord(fontLibrary, family)?.weights ?? [];
}

export function getAccountFontAllowedStyles(
  fontLibrary: AccountFontLibrary,
  family: string,
): AccountFontStyle[] {
  return getAccountFontRecord(fontLibrary, family)?.styles ?? [];
}

function resolveAllowedCompanion(args: {
  allowed: readonly string[];
  current: unknown;
  requested?: unknown;
  preferred: string;
}): string | null {
  if (args.requested !== undefined) {
    const requested = readExactNonEmptyString(args.requested);
    return requested && args.allowed.includes(requested) ? requested : null;
  }
  const current = readExactNonEmptyString(args.current);
  if (args.current !== undefined && !current) return null;
  if (current && args.allowed.includes(current)) return current;
  if (args.allowed.includes(args.preferred)) return args.preferred;
  return args.allowed[0] ?? null;
}

export function resolveAccountTypographyFamilySelection(args: {
  fontLibrary: AccountFontLibrary;
  requestedFamily: unknown;
  currentWeight: unknown;
  currentFontStyle: unknown;
  requestedWeight?: unknown;
  requestedFontStyle?: unknown;
}): AccountTypographyFamilySelection | null {
  const family = readExactNonEmptyString(args.requestedFamily);
  const record = family ? getAccountFontRecord(args.fontLibrary, family) : null;
  if (!family || !record) return null;
  const weight = resolveAllowedCompanion({
    allowed: record.weights,
    current: args.currentWeight,
    requested: args.requestedWeight,
    preferred: '400',
  });
  const fontStyle = resolveAllowedCompanion({
    allowed: record.styles,
    current: args.currentFontStyle,
    requested: args.requestedFontStyle,
    preferred: 'normal',
  });
  if (!weight || !fontStyle) return null;
  return {
    family,
    weight,
    fontStyle: fontStyle as AccountFontStyle,
  };
}

export function validateAccountTypographyFontSelections(args: {
  fontLibrary: AccountFontLibrary;
  typography: unknown;
  pathPrefix?: string;
  required?: boolean;
}): string[] {
  const pathPrefix = args.pathPrefix ?? 'typography';
  if (args.typography === undefined) return args.required ? [pathPrefix] : [];
  if (!isRecord(args.typography)) return [pathPrefix];
  if (!isRecord(args.typography.roles)) return [`${pathPrefix}.roles`];
  const invalidPaths: string[] = [];
  if (args.typography.globalFamily !== undefined) {
    const family = readExactNonEmptyString(args.typography.globalFamily);
    if (!family || !isAccountFontFamily(args.fontLibrary, family)) {
      invalidPaths.push(`${pathPrefix}.globalFamily`);
    }
  }
  for (const [roleKey, rawRole] of Object.entries(args.typography.roles)) {
    const rolePath = `${pathPrefix}.roles.${roleKey}`;
    if (!isRecord(rawRole)) {
      invalidPaths.push(rolePath);
      continue;
    }
    const family = readExactNonEmptyString(rawRole.family);
    const record = family ? getAccountFontRecord(args.fontLibrary, family) : null;
    if (!family || !record) {
      invalidPaths.push(`${rolePath}.family`);
      continue;
    }
    const weight = readExactNonEmptyString(rawRole.weight);
    if (!weight || !record.weights.includes(weight)) invalidPaths.push(`${rolePath}.weight`);
    const fontStyle = readExactNonEmptyString(rawRole.fontStyle);
    if (!fontStyle || !record.styles.includes(fontStyle as AccountFontStyle)) {
      invalidPaths.push(`${rolePath}.fontStyle`);
    }
  }
  return invalidPaths;
}

export function accountFontLibraryToFamilyOptions(
  fontLibrary: AccountFontLibrary,
  copy: AccountFontFamilyOptionsCopy,
): AccountFontFamilyOption[] {
  const options: AccountFontFamilyOption[] = [];
  ACCOUNT_FONT_CATEGORY_ORDER.forEach((category) => {
    const families = Object.keys(fontLibrary.fonts)
      .filter((family) => fontLibrary.fonts[family]?.category === category)
      .sort((left, right) => left.localeCompare(right));
    if (!families.length) return;
    options.push({ isGroupHeader: true, label: copy.categories[category] });
    families.forEach((family) => {
      const record = fontLibrary.fonts[family]!;
      options.push({
        label: record.label,
        value: family,
        weights: record.weights.join(','),
        styles: record.styles.join(','),
        badge: copy.usage[record.usage],
      });
    });
  });
  return options;
}

export function accountFontLibraryToGoogleSpecs(
  fontLibrary: AccountFontLibrary,
): Readonly<Record<string, string>> {
  const specs: Record<string, string> = {};
  Object.entries(fontLibrary.fonts).forEach(([family, record]) => {
    if (record.source === 'google') specs[family] = record.spec;
  });
  return Object.freeze(specs);
}

export function isAcceptedAccountFontUpload(filename: string, contentType: string): boolean {
  const ext = (filename.split('.').pop() || '').trim().toLowerCase();
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  if (!ext || !mime) return false;
  return ACCOUNT_FONT_UPLOAD_MIME_BY_EXTENSION[ext]?.includes(mime) === true;
}

export function accountFontContentTypeExtension(contentType: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  if (!mime) return null;
  for (const [ext, mimes] of Object.entries(ACCOUNT_FONT_UPLOAD_MIME_BY_EXTENSION)) {
    if (mimes.includes(mime)) return ext;
  }
  return null;
}
