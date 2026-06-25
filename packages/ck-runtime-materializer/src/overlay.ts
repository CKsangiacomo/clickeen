import {
  extractSavedTextFieldsForEditableFields,
  resolveTranslatedValues,
} from '@clickeen/ck-contracts/translated-value-primitives';
import { materializerFailure } from './errors';
import type {
  RuntimeMaterializerCompiledWidget,
  RuntimeMaterializerFailure,
  RuntimeMaterializerLocaleOverlay,
} from './types';

export type ApplyLocaleOverlayToStateInput = {
  compiled: RuntimeMaterializerCompiledWidget;
  state: Record<string, unknown>;
  localeOverlay: RuntimeMaterializerLocaleOverlay;
};

export type ApplyLocaleOverlayToStateResult =
  | { ok: true; state: Record<string, unknown> }
  | RuntimeMaterializerFailure;

function fieldExtractionFailure(error: unknown): RuntimeMaterializerFailure {
  const detail = error instanceof Error ? error.message : String(error);
  if (
    detail.startsWith('widget_editable_fields_') ||
    detail.startsWith('saved_text_field_identity_missing') ||
    detail.startsWith('saved_text_field_identity_duplicate') ||
    detail.startsWith('saved_text_field_identity_path_invalid') ||
    detail.startsWith('saved_text_field_identity_scope_invalid')
  ) {
    return materializerFailure('compiled_widget_invalid', detail);
  }
  return materializerFailure('source_state_invalid', detail);
}

export function applyLocaleOverlayToState(input: ApplyLocaleOverlayToStateInput): ApplyLocaleOverlayToStateResult {
  if (input.localeOverlay.keyKind !== 'current_saved_content_concrete_path') {
    return materializerFailure('locale_overlay_scope_unsupported', input.localeOverlay.keyKind);
  }
  if (!input.compiled.editableFields || input.compiled.editableFields.widgetType !== input.compiled.widgetname) {
    return materializerFailure('compiled_widget_invalid');
  }

  let paths: string[];
  try {
    paths = extractSavedTextFieldsForEditableFields({
      contract: input.compiled.editableFields,
      config: input.state,
    }).map((field) => field.path);
  } catch (error) {
    return fieldExtractionFailure(error);
  }

  const required = new Set(paths);
  for (const path of paths) {
    if (!Object.prototype.hasOwnProperty.call(input.localeOverlay.values, path)) {
      return materializerFailure('locale_overlay_key_missing', path, [path]);
    }
    if (typeof input.localeOverlay.values[path] !== 'string') {
      return materializerFailure('locale_overlay_value_invalid', path, [path]);
    }
  }
  for (const [path, value] of Object.entries(input.localeOverlay.values)) {
    if (!required.has(path)) {
      return materializerFailure('locale_overlay_key_unexpected', path, [path]);
    }
    if (typeof value !== 'string') {
      return materializerFailure('locale_overlay_value_invalid', path, [path]);
    }
  }

  try {
    return {
      ok: true,
      state: resolveTranslatedValues(input.state, input.localeOverlay.values as Record<string, string>),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return materializerFailure('source_state_invalid', detail);
  }
}
