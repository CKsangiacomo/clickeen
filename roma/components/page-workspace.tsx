'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { PagePlacementDraft } from './page-builder-model';

type WebFiles = { indexHtml: string; stylesCss: string; runtimeJs: string };

function bodyOnly(indexHtml: string): string {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(indexHtml);
  return (match?.[1] ?? indexHtml)
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '');
}

function draftDocument(placements: PagePlacementDraft[], selectedId: string, runtimeUrl: string): string {
  const sections = placements.map((placement) => `<section data-ck-page-editor-placement="${placement.placementId}"${placement.placementId === selectedId ? ' data-selected="true"' : ''}>
    <template shadowrootmode="open"><style>${placement.files.stylesCss}</style>${bodyOnly(placement.files.indexHtml)}</template>
  </section>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:16px;display:grid;gap:16px;background:#f4f4f4}
    [data-ck-page-editor-placement]{display:block;min-width:0;border:2px solid transparent;border-radius:12px}
    [data-ck-page-editor-placement][data-selected="true"]{border-color:#087dfd}
  </style></head><body>${sections}<script src="${runtimeUrl}"></script><script>
    document.querySelectorAll('[data-ck-page-editor-placement]').forEach(function(host){
      var root=host.shadowRoot&&host.shadowRoot.querySelector('[data-ck-widget][data-role="root"]');
      if(!root)return;var type=root.getAttribute('data-ck-widget')||'';
      var init=window.CK_WIDGET_INITIALIZERS&&window.CK_WIDGET_INITIALIZERS[type];
      if(typeof init==='function')init(root);
    });
  </script></body></html>`;
}

function savedDocument(files: WebFiles, runtimeUrl: string): string {
  return files.indexHtml
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/i, `<style>${files.stylesCss}</style>`)
    .replace(/<script\b[^>]*src=["'][^"']*runtime\.js["'][^>]*><\/script>/i, `<script src="${runtimeUrl}"></script>`);
}

export function PageWorkspace({
  placements,
  selectedPlacementId,
  savedFiles,
  showSaved,
  onSelect,
}: {
  placements: PagePlacementDraft[];
  selectedPlacementId: string;
  savedFiles: WebFiles | null;
  showSaved: boolean;
  onSelect: (placementId: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runtimeSource = showSaved && savedFiles ? savedFiles.runtimeJs : placements.map((placement) => placement.files.runtimeJs).join('\n\n');
  const coordinate = useMemo(() => JSON.stringify({ placements: placements.map((placement) => placement.placementId), selectedPlacementId, showSaved, saved: Boolean(savedFiles) }), [placements, savedFiles, selectedPlacementId, showSaved]);

  useEffect(() => {
    const runtimeUrl = URL.createObjectURL(new Blob([runtimeSource], { type: 'text/javascript' }));
    const iframe = iframeRef.current;
    if (iframe) iframe.srcdoc = showSaved && savedFiles ? savedDocument(savedFiles, runtimeUrl) : draftDocument(placements, selectedPlacementId, runtimeUrl);
    return () => URL.revokeObjectURL(runtimeUrl);
  }, [coordinate, placements, runtimeSource, savedFiles, selectedPlacementId, showSaved]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const listen = () => {
      const document = iframe?.contentDocument;
      if (!document) return;
      document.querySelectorAll<HTMLElement>('[data-ck-page-editor-placement]').forEach((element) => {
        element.onclick = () => onSelect(element.dataset.ckPageEditorPlacement ?? '');
      });
    };
    iframe?.addEventListener('load', listen);
    return () => iframe?.removeEventListener('load', listen);
  }, [coordinate, onSelect]);

  return (
    <section className="workspace roma-page-workspace" aria-label="Page preview">
      {placements.length || savedFiles ? <iframe ref={iframeRef} className="roma-page-workspace__frame" title="Page preview" /> : <div className="roma-page-workspace__empty"><p className="heading-4">This page has no widgets yet</p><p className="body-m">Add a widget from Content to start composing the page.</p></div>}
    </section>
  );
}
