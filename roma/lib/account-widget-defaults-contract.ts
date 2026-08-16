import {
  ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
  normalizeAccountFontLibrary,
  validateAccountTypographyFontSelections,
} from '@clickeen/widget-foundation';
import type { InstancePackageFailure } from './account-instance-public-package';
import type { AccountWidgetDefaultsDocument } from './account-widget-defaults-direct';

function typographyValidationFailure(paths: string[]): InstancePackageFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: ACCOUNT_TYPOGRAPHY_SELECTION_INVALID_REASON_KEY,
      paths,
    },
  };
}

export function validateAccountWidgetDefaultsTypography(
  widgetDefaults: AccountWidgetDefaultsDocument,
): { ok: true } | InstancePackageFailure {
  const fontLibrary = normalizeAccountFontLibrary(widgetDefaults.fontLibrary);
  if (!fontLibrary) {
    return typographyValidationFailure(['fontLibrary']);
  }
  const widgetTypes = Object.keys(widgetDefaults.widgets);
  const invalidTypographyPaths = validateAccountTypographyFontSelections({
    fontLibrary,
    typography: widgetDefaults.common.typography,
    required: true,
  }).map((path) => `common:${path}`);

  for (const widgetType of widgetTypes) {
    const widget = widgetDefaults.widgets[widgetType]!;
    invalidTypographyPaths.push(
      ...validateAccountTypographyFontSelections({
        fontLibrary,
        typography: widget.core.typography,
      }).map((path) => `${widgetType}:${path}`),
    );
  }

  if (invalidTypographyPaths.length) {
    return typographyValidationFailure(invalidTypographyPaths);
  }
  return { ok: true };
}
