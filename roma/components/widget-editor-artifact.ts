'use client';

import type { CompiledWidget } from '@clickeen/bob/types';
import { fetchSameOriginJson } from './same-origin-json';

export async function getWidgetEditorArtifact(widgetType: string): Promise<CompiledWidget> {
  return fetchSameOriginJson<CompiledWidget>(
    `/widget-editors/${encodeURIComponent(widgetType)}.json`,
  );
}
