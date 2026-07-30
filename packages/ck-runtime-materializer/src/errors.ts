import type { RuntimeMaterializerErrorReason, RuntimeMaterializerFailure } from './types';

const REASON_KEYS: Record<RuntimeMaterializerErrorReason, string> = {
  compiled_widget_invalid: 'coreui.errors.widget.compiled.invalid',
  widget_package_missing: 'coreui.errors.widget.packageMissing',
  widget_package_file_missing: 'coreui.errors.widget.packageMissing',
  widget_package_root_invalid: 'coreui.errors.widget.packageRootInvalid',
  artifact_coordinate_invalid: 'coreui.errors.instance.invalidPayload',
  typography_data_invalid: 'coreui.errors.typography.fontLibrary.invalid',
  source_state_invalid: 'coreui.errors.instance.content.invalid',
};

export function materializerFailure(
  reason: RuntimeMaterializerErrorReason,
  detail?: string,
  paths?: string[],
): RuntimeMaterializerFailure {
  const key = REASON_KEYS[reason];
  const reasonKey = reason === 'widget_package_file_missing' && detail ? `${key}:${detail}` : key;
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
