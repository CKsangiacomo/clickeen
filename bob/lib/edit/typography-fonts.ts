import {
  accountFontLibraryToFamilyOptions,
  accountFontLibraryToGoogleSpecs,
  createDefaultAccountFontLibrary,
  getAccountFontAllowedStyles,
  getAccountFontAllowedWeights,
  parseGoogleFontWeights,
  type AccountFontCategory,
  type AccountFontFamilyClass,
  type AccountFontLibrary,
  type AccountFontRecord,
  type AccountFontUsage,
  type AccountFontLibrarySource,
} from '@clickeen/widget-shell';

export type CKTypographyFontCategory = AccountFontCategory;
export type CKTypographyFamilyClass = AccountFontFamilyClass;
export type CKTypographyUsage = AccountFontUsage;
export type CKTypographyFontSource = AccountFontLibrarySource;
export type CKTypographyFontMeta = AccountFontRecord;

const DEFAULT_ACCOUNT_FONT_LIBRARY = createDefaultAccountFontLibrary();
const DEFAULT_ACCOUNT_FONT_RECORDS = DEFAULT_ACCOUNT_FONT_LIBRARY.fonts;

export type CKTypographyFontFamily = keyof typeof DEFAULT_ACCOUNT_FONT_RECORDS;
export const CK_GOOGLE_FONT_SPECS = accountFontLibraryToGoogleSpecs(DEFAULT_ACCOUNT_FONT_LIBRARY);
export const CK_TYPOGRAPHY_FONTS = Object.keys(DEFAULT_ACCOUNT_FONT_RECORDS) as CKTypographyFontFamily[];

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

export { parseGoogleFontWeights };

export function isCkTypographyFamily(value: string): value is CKTypographyFontFamily {
  return Object.prototype.hasOwnProperty.call(DEFAULT_ACCOUNT_FONT_RECORDS, value);
}

export function getCkTypographyFontMeta(family: string): CKTypographyFontMeta | null {
  return isCkTypographyFamily(family) ? DEFAULT_ACCOUNT_FONT_RECORDS[family] : null;
}

export function getCkTypographyAllowedWeights(
  family: string,
  fontLibrary: AccountFontLibrary = DEFAULT_ACCOUNT_FONT_LIBRARY,
): string[] {
  return getAccountFontAllowedWeights(fontLibrary, family);
}

export function getCkTypographyAllowedStyles(
  family: string,
  fontLibrary: AccountFontLibrary = DEFAULT_ACCOUNT_FONT_LIBRARY,
): string[] {
  return getAccountFontAllowedStyles(fontLibrary, family);
}

export function buildCkTypographyWeightOptions(weights: string[]) {
  return weights.map((weight) => ({
    label: WEIGHT_LABELS[weight] ? `${WEIGHT_LABELS[weight]} (${weight})` : weight,
    value: weight,
  }));
}

export function buildCkTypographyFamilyOptions(fontLibrary: AccountFontLibrary = DEFAULT_ACCOUNT_FONT_LIBRARY) {
  return accountFontLibraryToFamilyOptions(fontLibrary);
}

export const CK_TYPOGRAPHY_WEIGHT_OPTIONS = buildCkTypographyWeightOptions(
  (() => {
    const weights = new Set<string>();
    CK_TYPOGRAPHY_FONTS.forEach((family) => {
      getCkTypographyAllowedWeights(family).forEach((weight) => weights.add(weight));
    });
    return toSortedWeights(weights);
  })(),
);
