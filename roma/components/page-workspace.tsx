'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PagePlacementDraft } from './page-builder-model';

type WebFiles = { indexHtml: string; stylesCss: string; runtimeJs: string };
type RuntimeWindow = Window & {
  CK_WIDGET_INITIALIZERS?: Record<string, (root: HTMLElement) => void>;
};

function instanceBody(indexHtml: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(indexHtml, 'text/html');
  parsed.body.querySelectorAll('link[rel="stylesheet"], script').forEach((element) => element.remove());
  const fragment = document.createDocumentFragment();
  Array.from(parsed.body.childNodes).forEach((node) => fragment.append(node.cloneNode(true)));
  return fragment;
}

function installShadow(host: HTMLElement, stylesCss: string, content: DocumentFragment): ShadowRoot {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = stylesCss;
  shadow.replaceChildren(style, content);
  return shadow;
}

function runRuntime(container: HTMLElement, runtimeJs: string): HTMLScriptElement {
  const script = document.createElement('script');
  script.dataset.ckPageEditorRuntime = 'true';
  script.textContent = runtimeJs;
  container.append(script);
  return script;
}

function initializeDraftPlacement(shadow: ShadowRoot): void {
  const widgetRoot = shadow.querySelector<HTMLElement>('[data-ck-widget][data-role="root"]');
  if (!widgetRoot) throw new Error('coreui.errors.page.preview.widgetRootMissing');
  const widgetType = widgetRoot.dataset.ckWidget ?? '';
  const initializer = (window as RuntimeWindow).CK_WIDGET_INITIALIZERS?.[widgetType];
  if (typeof initializer !== 'function') throw new Error('coreui.errors.page.preview.initializerMissing');
  initializer(widgetRoot);
}

function savedPlacementContent(sourceHost: HTMLElement): DocumentFragment {
  const content = document.createDocumentFragment();
  if (sourceHost.shadowRoot) {
    Array.from(sourceHost.shadowRoot.childNodes).forEach((node) => content.append(node.cloneNode(true)));
  } else {
    const template = sourceHost.querySelector<HTMLTemplateElement>('template[shadowrootmode="open"]');
    if (!template) throw new Error('coreui.errors.page.preview.shadowTemplateMissing');
    content.append(template.content.cloneNode(true));
  }
  content.querySelectorAll('link[rel="stylesheet"], script').forEach((element) => element.remove());
  return content;
}

function mountSavedPage(args: {
  container: HTMLElement;
  files: WebFiles;
  hosts: Map<string, HTMLElement>;
  onSelect: (placementId: string) => void;
}): () => void {
  const parsed = new DOMParser().parseFromString(args.files.indexHtml, 'text/html');
  const sourceHosts = Array.from(parsed.body.querySelectorAll<HTMLElement>('[data-ck-placement-id]'));
  if (!sourceHosts.length) throw new Error('coreui.errors.page.preview.placementsMissing');

  args.container.replaceChildren();
  sourceHosts.forEach((sourceHost) => {
    const placementId = sourceHost.dataset.ckPlacementId ?? '';
    if (!placementId || args.hosts.has(placementId)) throw new Error('coreui.errors.page.preview.placementInvalid');
    const host = document.createElement(sourceHost.tagName.toLowerCase());
    Array.from(sourceHost.attributes).forEach((attribute) => host.setAttribute(attribute.name, attribute.value));
    host.classList.add('roma-page-workspace__placement');
    host.dataset.ckPageEditorPlacement = placementId;
    host.addEventListener('click', () => args.onSelect(placementId));
    installShadow(host, args.files.stylesCss, savedPlacementContent(sourceHost));
    args.hosts.set(placementId, host);
    args.container.append(host);
  });
  runRuntime(args.container, args.files.runtimeJs);

  return () => {
    sourceHosts.forEach((sourceHost) => args.hosts.delete(sourceHost.dataset.ckPlacementId ?? ''));
    args.container.replaceChildren();
  };
}

export function PageWorkspace({
  placements,
  selectedPlacementId,
  savedFiles,
  showSaved,
  onSelect,
  onAdd,
}: {
  placements: PagePlacementDraft[];
  selectedPlacementId: string;
  savedFiles: WebFiles | null;
  showSaved: boolean;
  onSelect: (placementId: string) => void;
  onAdd: () => void;
}) {
  const savedContainerRef = useRef<HTMLDivElement>(null);
  const placementHostsRef = useRef(new Map<string, HTMLElement>());
  const [previewError, setPreviewError] = useState(false);
  const savedMode = Boolean(showSaved && savedFiles);
  const placementCoordinate = useMemo(
    () => placements.map((placement) => `${placement.placementId}:${placement.instanceId}`).join('|'),
    [placements],
  );
  const setDraftHost = useCallback((placementId: string, host: HTMLElement | null) => {
    if (host) placementHostsRef.current.set(placementId, host);
    else placementHostsRef.current.delete(placementId);
  }, []);

  useEffect(() => {
    setPreviewError(false);
    const container = savedContainerRef.current;
    if (!savedMode || !savedFiles || !container) return;
    try {
      return mountSavedPage({ container, files: savedFiles, hosts: placementHostsRef.current, onSelect });
    } catch {
      setPreviewError(true);
      container.replaceChildren();
    }
  }, [onSelect, savedFiles, savedMode]);

  useEffect(() => {
    if (savedMode || !placements.length) return;
    const scripts: HTMLScriptElement[] = [];
    const placementHosts = placementHostsRef.current;
    try {
      placements.forEach((placement) => {
        const host = placementHosts.get(placement.placementId);
        if (!host) throw new Error('coreui.errors.page.preview.placementMissing');
        const shadow = installShadow(host, placement.files.stylesCss, instanceBody(placement.files.indexHtml));
        scripts.push(runRuntime(host, placement.files.runtimeJs));
        initializeDraftPlacement(shadow);
      });
      setPreviewError(false);
    } catch {
      setPreviewError(true);
    }
    return () => {
      scripts.forEach((script) => script.remove());
      placements.forEach((placement) => placementHosts.get(placement.placementId)?.shadowRoot?.replaceChildren());
    };
  }, [placementCoordinate, placements, savedMode]);

  useEffect(() => {
    placementHostsRef.current.forEach((host, placementId) => {
      if (placementId === selectedPlacementId) host.setAttribute('aria-current', 'true');
      else host.removeAttribute('aria-current');
    });
    placementHostsRef.current.get(selectedPlacementId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [placementCoordinate, savedMode, selectedPlacementId]);

  return (
    <section className="workspace roma-page-workspace" aria-label="Page preview">
      {previewError ? <p className="body-m roma-page-workspace__error" role="alert">This Page preview could not be shown.</p> : null}
      {placements.length ? (
        <div className="roma-page-workspace__canvas" hidden={previewError}>
          {savedMode ? <div ref={savedContainerRef} className="roma-page-workspace__saved" /> : placements.map((placement) => (
            <section
              key={placement.placementId}
              ref={(host) => setDraftHost(placement.placementId, host)}
              className="roma-page-workspace__placement"
              data-ck-page-editor-placement={placement.placementId}
              onClick={() => onSelect(placement.placementId)}
            />
          ))}
        </div>
      ) : (
        <div className="roma-page-workspace__empty">
          <p className="heading-4">Add a widget to start your page</p>
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={onAdd}>
            <span className="diet-btn-txt__label body-m">Add widget</span>
          </button>
        </div>
      )}
    </section>
  );
}
