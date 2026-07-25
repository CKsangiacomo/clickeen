'use client';

import { fetchSameOriginJson } from './same-origin-json';

function normalizeWidgetType(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isEditorArtifact(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export async function getWidgetEditorArtifact(widgetType: string): Promise<unknown> {
  const normalizedWidgetType = normalizeWidgetType(widgetType);
  if (!normalizedWidgetType) throw new Error('coreui.errors.widgetType.invalid');
  const artifact = await fetchSameOriginJson<unknown>(
    `/widget-editors/${encodeURIComponent(normalizedWidgetType)}.json`,
  );
  if (!isEditorArtifact(artifact)) throw new Error('coreui.errors.widget.compiled.invalid');
  return artifact;
}

export async function prefetchWidgetEditorArtifact(widgetType: string): Promise<void> {
  try {
    await getWidgetEditorArtifact(widgetType);
  } catch {
    // Opening the widget reports the authoritative error.
  }
}
