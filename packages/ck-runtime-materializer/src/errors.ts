import type { RuntimeMaterializerErrorReason, RuntimeMaterializerFailure } from './types';

const REASON_KEYS: Record<RuntimeMaterializerErrorReason, string> = {
  compiled_widget_invalid: 'coreui.errors.widget.compiled.invalid',
  widget_package_missing: 'coreui.errors.widget.packageMissing',
  widget_package_file_missing: 'coreui.errors.widget.packageMissing',
  widget_package_root_invalid: 'coreui.errors.widget.packageRootInvalid',
  locale_coordinate_invalid: 'coreui.errors.instance.invalidPayload',
  locale_overlay_missing: 'tokyo.translation.notFound',
  locale_overlay_unexpected_for_base: 'locale_overlay_unexpected_for_base',
  locale_overlay_locale_mismatch: 'locale_overlay_locale_mismatch',
  locale_overlay_key_missing: 'tokyo.translation.value_missing',
  locale_overlay_key_unexpected: 'tokyo.translation.value_unexpected',
  locale_overlay_value_invalid: 'coreui.errors.instance.invalidPayload',
  locale_overlay_scope_unsupported: 'locale_overlay_scope_unsupported',
  source_state_invalid: 'coreui.errors.instance.content.invalid',
};

export function materializerFailure(
  reason: RuntimeMaterializerErrorReason,
  detail?: string,
  paths?: string[],
): RuntimeMaterializerFailure {
  const key = REASON_KEYS[reason];
  const reasonKey =
    (reason === 'widget_package_file_missing' ||
      reason === 'locale_overlay_key_missing' ||
      reason === 'locale_overlay_key_unexpected') && detail
      ? `${key}:${detail}`
      : key;
  return {
    ok: false,
    error: {
      reason,
      reasonKey,
      ...(detail ? { detail } : {}),
      ...(paths?.length ? { paths } : {}),
    },
  };
}
