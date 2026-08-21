import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
  resolveTranslatedValues,
  type ResolvedAccountAsset,
  type WidgetEditableFieldsContract,
} from '@clickeen/ck-contracts';
import {
  renderWidgetHtml,
  renderWidgetStyles,
  listWidgetFontStylesheets,
  type AccountFontLibrary,
  type RuntimeTypographyData,
  type WidgetSoftware,
} from '@clickeen/widget-foundation';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { mapTranslationOverlayValuesToCurrentPaths } from '../lib/translations-preview';
import { dieterIconStyle } from './dieterIcon';
import systemStatesCopy from '../l10n/system-states/en.json';
import workspaceCopy from '../l10n/workspace/en.json';

export function shouldBlockSavedTranslationPreview(args: {
  previewMode: 'editing' | 'translations';
  requestedLocale: string;
  baseLocale: string;
  loading: boolean;
  error: boolean;
}): boolean {
  return (
    args.previewMode === 'translations' &&
    Boolean(args.requestedLocale) &&
    args.requestedLocale !== args.baseLocale &&
    (args.loading || Boolean(args.error))
  );
}

function collectFontAssetRefs(fontLibrary: AccountFontLibrary | null): string[] {
  if (!fontLibrary) return [];
  const refs = new Set<string>();
  Object.values(fontLibrary.fonts).forEach((record) => {
    if (record.source === 'account-asset') refs.add(record.assetRef);
  });
  return Array.from(refs);
}

function buildPreviewTypographyData(args: {
  fontLibrary: AccountFontLibrary | null;
  resolvedAssets: Map<string, ResolvedAccountAsset>;
}): { ok: true; data: RuntimeTypographyData } | { ok: false } {
  if (!args.fontLibrary) return { ok: false };
  const curatedFonts: RuntimeTypographyData['curatedFonts'] = {};
  for (const [family, record] of Object.entries(args.fontLibrary.fonts)) {
    if (record.source === 'google') {
      curatedFonts[family] = {
        source: 'google',
        spec: record.spec,
        familyClass: record.familyClass,
        weights: record.weights,
        styles: record.styles,
      };
      continue;
    }
    if (record.source === 'tokyo') {
      curatedFonts[family] = {
        source: 'tokyo',
        url: record.filePath,
        familyClass: record.familyClass,
        weights: record.weights,
        styles: record.styles,
      };
      continue;
    }
    const resolved = args.resolvedAssets.get(record.assetRef);
    if (!resolved) return { ok: false };
    curatedFonts[family] = {
      source: 'account-asset',
      url: resolved.url,
      contentType: record.contentType,
      familyClass: record.familyClass,
      weights: record.weights,
      styles: record.styles,
    };
  }
  return { ok: true, data: { curatedFonts } };
}

const PREVIEW_BRIDGE_SOURCE = `
(function () {
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'ck:preview-render') return;

    document.documentElement.lang = data.locale;
    document.getElementById('ck-widget-styles').textContent = data.stylesCss;
    document.querySelectorAll('link[data-ck-preview-font]').forEach(function (link) {
      link.remove();
    });
    data.fontStylesheets.forEach(function (href) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.ckPreviewFont = '';
      document.head.appendChild(link);
    });
    document.body.innerHTML = data.bodyHtml;
    window.CK_LOCALE_POLICY = {
      baseLocale: data.baseLocale,
      languages: data.languages
    };
    var shell = document.querySelector('.ck-headerLayout[data-ck-widget]');
    window.CKWidgetRuntime.initialize(shell);
    window.parent.postMessage({
      type: 'ck:ready',
      widgetname: data.widgetname,
      instanceId: data.instanceId
    }, '*');
  });
})();`;

function inlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

function buildPreviewFrameDocument(software: WidgetSoftware): string {
  const scripts = software.scripts
    .map((asset) => `<script>${inlineScript(asset.source)}</script>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style id="ck-widget-styles"></style>
  </head>
  <body></body>
  <script>${inlineScript(PREVIEW_BRIDGE_SOURCE)}</script>
  ${scripts}
</html>`;
}

function renderPreviewBody(args: {
  software: WidgetSoftware;
  editableFields: WidgetEditableFieldsContract;
  state: Record<string, unknown>;
  instanceId: string;
  locale: string;
  previewMode: 'editing' | 'translations';
}): string {
  return renderWidgetHtml({
    software: args.software,
    state: args.state,
    editableFields: args.editableFields,
    context: {
      instanceId: args.instanceId,
      locale: args.locale,
      discoveryEnabled: false,
      previewMode: args.previewMode,
    },
  });
}

export function Workspace({
  baseLocale,
  previewMode,
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  previewablePreviewLocales,
  translationValuesByLanguage,
  savedTranslationsLoading,
  savedTranslationsError,
}: {
  baseLocale: string;
  previewMode: 'editing' | 'translations';
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  previewablePreviewLocales: string[];
  translationValuesByLanguage: Record<string, Record<string, string>>;
  savedTranslationsLoading: boolean;
  savedTranslationsError: boolean;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { accountAssets, compiled, fontLibrary, instanceData } = session;
  const { preview, setPreview } = chrome;
  const instanceId = chrome.meta?.instanceId ?? '';
  const device = preview.device;
  const host = preview.host;
  const hasWidget = Boolean(compiled);
  const stageCanvas = (
    instanceData as { stage?: { canvas?: { mode?: unknown; width?: unknown; height?: unknown } } }
  ).stage?.canvas;
  const stageMode =
    stageCanvas?.mode === 'wrap' || stageCanvas?.mode === 'fixed' ? stageCanvas.mode : null;
  const [stageFixedWidth, stageFixedHeight] = [stageCanvas?.width, stageCanvas?.height].map(
    (value) => (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN),
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState(false);
  const [assetResolutionError, setAssetResolutionError] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [resolvedAssets, setResolvedAssets] = useState<Map<string, ResolvedAccountAsset>>(
    () => new Map(),
  );
  const mediaAssetRefs = useMemo(
    () => collectConfigMediaAssetRefs(instanceData),
    [instanceData],
  );
  const fontAssetRefs = useMemo(() => collectFontAssetRefs(fontLibrary), [fontLibrary]);
  const accountAssetRefs = useMemo(
    () => Array.from(new Set([...mediaAssetRefs, ...fontAssetRefs])),
    [mediaAssetRefs, fontAssetRefs],
  );
  const unresolvedAccountAssetRefs = useMemo(
    () => accountAssetRefs.filter((assetRef) => !resolvedAssets.has(assetRef)),
    [accountAssetRefs, resolvedAssets],
  );
  const unresolvedMediaAssetRefs = useMemo(
    () => mediaAssetRefs.filter((assetRef) => !resolvedAssets.has(assetRef)),
    [mediaAssetRefs, resolvedAssets],
  );
  const unresolvedFontAssetRefs = useMemo(
    () => fontAssetRefs.filter((assetRef) => !resolvedAssets.has(assetRef)),
    [fontAssetRefs, resolvedAssets],
  );
  const previewInstanceData = useMemo(() => {
    if (!mediaAssetRefs.length) return instanceData;
    if (unresolvedMediaAssetRefs.length) return instanceData;
    return materializeConfigMedia(instanceData, resolvedAssets) as Record<string, unknown>;
  }, [instanceData, mediaAssetRefs, resolvedAssets, unresolvedMediaAssetRefs]);
  const mediaPreviewStateReady = !unresolvedMediaAssetRefs.length;
  const previewTypography = useMemo(
    () => buildPreviewTypographyData({ fontLibrary, resolvedAssets }),
    [fontLibrary, resolvedAssets],
  );
  const previewTypographyData = previewTypography.ok ? previewTypography.data : null;
  const effectivePreviewableLocales = previewablePreviewLocales;
  const effectivePreviewLocale =
    previewMode === 'translations'
      ? translationPreviewLocale
      : baseLocale;
  const selectedTranslationValues =
    previewMode === 'translations' && effectivePreviewLocale !== baseLocale
      ? (translationValuesByLanguage[effectivePreviewLocale] ?? null)
      : null;
  const savedTranslationPreviewBlocked = shouldBlockSavedTranslationPreview({
    previewMode,
    requestedLocale: effectivePreviewLocale,
    baseLocale,
    loading: savedTranslationsLoading,
    error: savedTranslationsError,
  });
  const previewMessageReady =
    mediaPreviewStateReady &&
    previewTypography.ok &&
    !unresolvedFontAssetRefs.length &&
    !savedTranslationPreviewBlocked;
  const previewUnavailable =
    Boolean(savedTranslationsError) ||
    iframeLoadError ||
    assetResolutionError ||
    !previewTypography.ok;
  const resolvedPreviewInstanceData = useMemo(() => {
    if (!selectedTranslationValues || !compiled) return previewInstanceData;
    return resolveTranslatedValues(
      previewInstanceData,
      mapTranslationOverlayValuesToCurrentPaths({
        contract: compiled.editableFields,
        config: previewInstanceData,
        values: selectedTranslationValues,
      }),
    );
  }, [compiled, previewInstanceData, selectedTranslationValues]);

  const latestPreviewSelectionRef = useRef({
    previewMode,
    previewablePreviewLocales: effectivePreviewableLocales,
  });

  useEffect(() => {
    latestPreviewSelectionRef.current = {
      previewMode,
      previewablePreviewLocales: effectivePreviewableLocales,
    };
  }, [previewMode, effectivePreviewableLocales]);

  useEffect(() => {
    if (!accountAssetRefs.length) {
      setAssetResolutionError(false);
      return;
    }

    const missingAssetRefs = unresolvedAccountAssetRefs;
    if (!missingAssetRefs.length) {
      setAssetResolutionError(false);
      return;
    }

    let cancelled = false;
    setAssetResolutionError(false);
    void accountAssets
      .resolveAssets(missingAssetRefs)
      .then(({ assetsByRef }) => {
        if (cancelled) return;
        setResolvedAssets((current) => {
          let changed = false;
          const next = new Map(current);
          assetsByRef.forEach((asset, assetRef) => {
            next.set(assetRef, asset);
            changed = true;
          });
          return changed ? next : current;
        });
      })
      .catch(() => {
        if (!cancelled) setAssetResolutionError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [accountAssets, accountAssetRefs, unresolvedAccountAssetRefs]);

  const iframeBackdrop = (() => {
    const raw = (previewInstanceData as any)?.stage?.background;
    if (typeof raw !== 'string') return undefined;
    const value = raw.trim();
    if (!value) return undefined;

    // If the background is an image fill with a fallback layer like:
    //   url("...") center / cover no-repeat, linear-gradient(<fallback>, <fallback>)
    // use the fallback for the iframe element background to avoid a grey flash before the iframe receives state.
    if (/\burl\(\s*/i.test(value)) {
      const fallbackMatch = value.match(/,\s*linear-gradient\(\s*([^,]+?)\s*,/i);
      if (fallbackMatch?.[1]) {
        const fallback = fallbackMatch[1].trim();
        return fallback === 'transparent' ? 'var(--color-system-white)' : fallback;
      }
      return 'var(--color-system-white)';
    }

    // Plain colors/gradients can be applied directly.
    if (
      /^(?:#|var\(|rgba?\(|hsla?\(|color-mix\(|-?(?:repeating-)?(?:linear|radial|conic)-gradient\()/i.test(
        value,
      )
    ) {
      return value === 'transparent' ? 'var(--color-system-white)' : value;
    }

    return undefined;
  })();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setIframeLoaded(false);
    setIframeHasState(false);
    setIframeLoadError(false);
    if (!compiled) {
      iframe.srcdoc = '';
      return;
    }

    const handleLoad = () => {
      setIframeLoadError(false);
      setIframeLoaded(true);
    };
    const handleError = () => {
      setIframeLoadError(true);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);
    iframe.srcdoc = buildPreviewFrameDocument(compiled.widgetSoftware);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [compiled, instanceId]);

  useEffect(() => {
    if (!hasWidget || !compiled) return;
    if (!previewMessageReady) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    if (!iframeLoaded) return;

    let bodyHtml: string;
    let stylesCss: string;
    let fontStylesheets: string[];
    try {
      bodyHtml = renderPreviewBody({
        software: compiled.widgetSoftware,
        editableFields: compiled.editableFields,
        state: resolvedPreviewInstanceData,
        instanceId,
        locale: effectivePreviewLocale,
        previewMode,
      });
      stylesCss = renderWidgetStyles({
        software: compiled.widgetSoftware,
        state: resolvedPreviewInstanceData,
        context: {
          locale: effectivePreviewLocale,
          typographyData: previewTypographyData!,
        },
      });
      fontStylesheets = listWidgetFontStylesheets({
        state: resolvedPreviewInstanceData,
        context: {
          locale: effectivePreviewLocale,
          typographyData: previewTypographyData!,
        },
      });
    } catch {
      setIframeLoadError(true);
      return;
    }

    const message = {
      type: 'ck:preview-render',
      widgetname: compiled.widgetname,
      instanceId,
      baseLocale,
      bodyHtml,
      stylesCss,
      fontStylesheets,
      locale: effectivePreviewLocale,
      languages: effectivePreviewableLocales,
    };

    iframeWindow.postMessage(message, '*');
  }, [
    hasWidget,
    compiled,
    instanceId,
    resolvedPreviewInstanceData,
    effectivePreviewLocale,
    effectivePreviewableLocales,
    previewMode,
    baseLocale,
    previewTypographyData,
    iframeLoaded,
    previewMessageReady,
  ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.source !== iframeWindow) return;
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ck:ready') {
        setIframeHasState(true);
        setIframeLoadError(false);
        return;
      }
      if (data.type === 'ck:preview-locale-switch-blocked') {
        return;
      }
      if (data.type === 'ck:preview-locale-change-request') {
        const requestedLocale = typeof data.locale === 'string' ? data.locale.trim() : '';
        if (!requestedLocale) return;
        if (latestPreviewSelectionRef.current.previewMode !== 'translations') {
          return;
        }
        if (
          !latestPreviewSelectionRef.current.previewablePreviewLocales.includes(requestedLocale)
        ) {
          return;
        }
        onTranslationPreviewLocaleChange(requestedLocale);
        return;
      }
      if (data.type !== 'ck:resize') return;
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) return;
      const w = Number(data.width);
      if (!Number.isFinite(w) || w <= 0) return;
      const next = Math.min(6000, Math.max(120, Math.round(h)));
      const nextWidth = Math.min(6000, Math.max(120, Math.round(w)));
      setMeasuredHeight((prev) => {
        if (prev != null && Math.abs(prev - next) <= 1) return prev;
        return next;
      });
      setMeasuredWidth((prev) => {
        if (prev != null && Math.abs(prev - nextWidth) <= 1) return prev;
        return nextWidth;
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTranslationPreviewLocaleChange]);

  useEffect(() => {
    // When switching instances/devices/modes, allow the iframe to re-measure.
    setMeasuredHeight(null);
    setMeasuredWidth(null);
  }, [device, host]);

  const isDesktopCanvas = host === 'canvas' && device === 'desktop';
  const shouldResizeCanvas = isDesktopCanvas && (stageMode === 'wrap' || stageMode === 'fixed');
  const resolvedCanvasHeight =
    measuredHeight ??
    (isDesktopCanvas &&
    stageMode === 'fixed' &&
    Number.isFinite(stageFixedHeight) &&
    stageFixedHeight > 0
      ? stageFixedHeight
      : null);
  const canvasHeightPx =
    shouldResizeCanvas && resolvedCanvasHeight ? `${resolvedCanvasHeight}px` : null;
  const canvasWidthPx =
    shouldResizeCanvas &&
    stageMode === 'fixed' &&
    (measuredWidth != null || (Number.isFinite(stageFixedWidth) && stageFixedWidth > 0))
      ? `${measuredWidth ?? stageFixedWidth}px`
      : null;
  const shouldRenderCanvasCard = Boolean(shouldResizeCanvas && (canvasHeightPx || canvasWidthPx));
  const previewStatus = !hasWidget || previewUnavailable
    ? null
    : savedTranslationPreviewBlocked
      ? { kind: 'loading' as const }
      : !iframeHasState
        ? { kind: 'loading' as const }
        : null;

  return (
    <section
      className="workspace"
      data-device={device}
      data-host={host}
      data-widget-ready={hasWidget && iframeHasState ? 'true' : undefined}
      data-canvas-resize={shouldRenderCanvasCard ? 'true' : undefined}
      style={
        shouldRenderCanvasCard
          ? ({
              ...(canvasHeightPx ? { ['--workspace-canvas-height' as any]: canvasHeightPx } : null),
              ...(canvasWidthPx ? { ['--workspace-canvas-width' as any]: canvasWidthPx } : null),
            } as any)
          : undefined
      }
    >
      <iframe
        ref={iframeRef}
        title={workspaceCopy.preview.accessibleLabel}
        className="workspace-iframe"
        sandbox="allow-scripts allow-same-origin"
        style={
          !iframeHasState && iframeBackdrop ? ({ background: iframeBackdrop } as any) : undefined
        }
      />
      {previewStatus?.kind === 'loading' ? (
        <div className="workspace-status-overlay">
          <div
            className="diet-loading-state"
            role="status"
            aria-label={systemStatesCopy.loading.accessibleLabel}
          >
            <span className="diet-spinner" data-size="medium" aria-hidden="true" />
          </div>
        </div>
      ) : null}

      <div className="workspace-overlay" aria-hidden={!hasWidget}>
        <div
          className="workspace-device-toggle diet-segmented diet-segmented-ic"
          role="radiogroup"
          aria-label={workspaceCopy.device.groupLabel}
          data-size="lg"
        >
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="workspace-device"
              value="desktop"
              checked={device === 'desktop'}
              onChange={() => setPreview({ device: 'desktop' })}
            />
            <span className="diet-segment__surface" aria-hidden="true" />
            <span className="diet-segment__content">
              <span
                className="diet-icon"
                data-icon="desktopcomputer"
                style={dieterIconStyle('desktopcomputer')}
                aria-hidden="true"
              />
              <span className="diet-segment__sr">{workspaceCopy.device.desktop}</span>
            </span>
          </label>
          <label className="diet-segment">
            <input
              className="diet-segment__input"
              type="radio"
              name="workspace-device"
              value="mobile"
              checked={device === 'mobile'}
              onChange={() => setPreview({ device: 'mobile' })}
            />
            <span className="diet-segment__surface" aria-hidden="true" />
            <span className="diet-segment__content">
              <span
                className="diet-icon"
                data-icon="iphone"
                style={dieterIconStyle('iphone')}
                aria-hidden="true"
              />
              <span className="diet-segment__sr">{workspaceCopy.device.mobile}</span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
