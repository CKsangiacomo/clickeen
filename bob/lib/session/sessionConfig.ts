import type { CompiledWidget } from '../types';
import {
  accountFontLibraryToFamilyOptions,
  type AccountFontLibrary,
} from '@clickeen/widget-foundation';
import typographyCopy from '../../l10n/editor/typography/en.json';
export function bindSessionTypographyControls(
  compiled: CompiledWidget,
  fontLibrary: AccountFontLibrary,
): CompiledWidget {
  const options = accountFontLibraryToFamilyOptions(fontLibrary, {
    categories: typographyCopy.fontCategories,
    usage: typographyCopy.fontUsage,
  }).map((option) => ({
    label: option.label,
    value: option.value as string,
  }));
  const enumValues = options.map((option) => option.value);
  return {
    ...compiled,
    controls: compiled.controls.map((control) =>
      /^typography\.roles\.[^.]+\.family$/.test(control.path)
        ? {
            ...control,
            options,
            kind: 'enum' as const,
            enumValues,
          }
        : control,
    ),
  };
}
