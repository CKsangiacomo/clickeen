import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
  resolveTranslatedValues,
  type ResolvedAccountAsset,
} from '@clickeen/ck-contracts';
import { getIcon } from '../lib/icons';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';

const BLOCKED_SWITCHER_COPY =
  'Translations not available while in editing mode. Preview translations in Translations panel.';

export function Workspace({
  baseLocale,
  previewMode,
  translationPreviewLocale,
  onTranslationPreviewLocaleChange,
  previewablePreviewLocales,
  translationValuesByLanguage,
}: {
  baseLocale: string;
  previewMode: 'editing' | 'translations';
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  previewablePreviewLocales: string[];
  translationValuesByLanguage: Record<string, Record<string, string>>;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { accountAssets, compiled, instanceData } = session;
  const { preview, setPreview } = chrome;
  const instanceId = chrome.meta?.instanceId ?? '';
  const device = preview.device;
  const theme = preview.theme;
  const host = preview.host;
  const hasWidget = Boolean(compiled);
  const stageCanvas = (instanceData as { stage?: { canvas?: { mode?: unknown; width?: unknown; height?: unknown } } }).stage?.canvas;
  const stageMode = stageCanvas?.mode === 'wrap' || stageCanvas?.mode === 'fixed' ? stageCanvas.mode : null;
  const [stageFixedWidth, stageFixedHeight] = [stageCanvas?.width, stageCanvas?.height].map((value) => typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState<string | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [switcherNotice, setSwitcherNotice] = useState<string | null>(null);
  const [resolvedAssets, setResolvedAssets] = useState<Map<string, ResolvedAccountAsset>>(() => new Map());
  const mediaAssets = useMemo(() => {
    try {
      return { ok: true as const, refs: collectConfigMediaAssetRefs(instanceData) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [instanceData]);
  const mediaAssetRefs = useMemo(() => mediaAssets.ok ? mediaAssets.refs : [], [mediaAssets]);
  const unresolvedMediaAssetRefs = useMemo(
    () => mediaAssetRefs.filter((assetRef) => !resolvedAssets.has(assetRef)),
    [mediaAssetRefs, resolvedAssets],
  );
  const previewInstanceData = useMemo(() => {
    if (!mediaAssetRefs.length) return instanceData;
    if (unresolvedMediaAssetRefs.length) return instanceData;
    const materialized = materializeConfigMedia(instanceData, resolvedAssets);
    return materialized && typeof materialized === 'object' && !Array.isArray(materialized)
      ? (materialized as Record<string, unknown>)
      : instanceData;
  }, [instanceData, mediaAssetRefs, resolvedAssets, unresolvedMediaAssetRefs]);
  const mediaPreviewStateReady = mediaAssets.ok && !unresolvedMediaAssetRefs.length;
  const effectivePreviewableLocales = useMemo(() => {
    const previewableLocales = Array.from(
      new Set(
        previewablePreviewLocales
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    );
    if (baseLocale && !previewableLocales.includes(baseLocale)) {
      return [baseLocale, ...previewableLocales];
    }
    return previewableLocales;
  }, [baseLocale, previewablePreviewLocales]);
  const fallbackPreviewLocale = baseLocale || effectivePreviewableLocales[0] || '';
  const effectivePreviewLocale =
    previewMode === 'translations'
      ? translationPreviewLocale || fallbackPreviewLocale
      : fallbackPreviewLocale;
  const selectedTranslationValues =
    previewMode === 'translations' && effectivePreviewLocale !== baseLocale
      ? translationValuesByLanguage[effectivePreviewLocale] ?? null
      : null;
  const translationPreviewUnavailable =
    previewMode === 'translations' && effectivePreviewLocale !== baseLocale && !selectedTranslationValues;
  const previewStateReady = mediaPreviewStateReady && !translationPreviewUnavailable;
  const resolvedPreviewInstanceData = useMemo(() => {
    if (!selectedTranslationValues) return previewInstanceData;
    return resolveTranslatedValues(previewInstanceData, selectedTranslationValues);
  }, [previewInstanceData, selectedTranslationValues]);

  const latestRef = useRef({
    compiled,
    instanceData: resolvedPreviewInstanceData,
    instanceId,
    baseLocale,
    previewMode,
    effectivePreviewLocale,
    previewablePreviewLocales: effectivePreviewableLocales,
    device,
    theme,
  });

  useEffect(() => {
    latestRef.current = {
      compiled,
      instanceData: resolvedPreviewInstanceData,
      instanceId,
      baseLocale,
      previewMode,
      effectivePreviewLocale,
      previewablePreviewLocales: effectivePreviewableLocales,
      device,
      theme,
    };
  }, [
    compiled,
    resolvedPreviewInstanceData,
    instanceId,
    baseLocale,
    previewMode,
    effectivePreviewLocale,
    effectivePreviewableLocales,
    device,
    theme,
  ]);

  useEffect(() => {
    if (!mediaAssets.ok) {
      setIframeLoadError('Failed to resolve preview media assets');
      return;
    }
    let cancelled = false;
    if (!mediaAssetRefs.length) {
      return () => {
        cancelled = true;
      };
    }

    const missingAssetRefs = unresolvedMediaAssetRefs;
    if (!missingAssetRefs.length) {
      return () => {
        cancelled = true;
      };
    }

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
        if (!cancelled) setIframeLoadError('Failed to resolve preview media assets');
      });

    return () => {
      cancelled = true;
    };
  }, [accountAssets, mediaAssets, mediaAssetRefs, resolvedAssets, unresolvedMediaAssetRefs]);

  useEffect(() => {
    if (previewStateReady) return;
    setIframeHasState(false);
  }, [previewStateReady]);

  useEffect(() => {
    if (!switcherNotice) return undefined;
    const timer = window.setTimeout(() => setSwitcherNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [switcherNotice]);

  const iframeSrc = useMemo(() => {
    if (!hasWidget || !compiled) return 'about:blank';
    return compiled.media.htmlUrl;
  }, [hasWidget, compiled]);

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

    const handleLoad = () => {
      setIframeLoaded(true);
      const snapshot = latestRef.current;
      const nextCompiled = snapshot.compiled;
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow || !nextCompiled) return;
      if (!previewStateReady) return;
      setIframeLoadError(null);
      iframeWindow.postMessage(
        {
          type: 'ck:state-update',
          widgetname: nextCompiled.widgetname,
          instanceId: snapshot.instanceId,
          baseLocale: snapshot.baseLocale,
          state: snapshot.instanceData,
          locale: snapshot.effectivePreviewLocale,
          previewMode: snapshot.previewMode,
          device: snapshot.device,
          theme: snapshot.theme,
        },
        '*',
      );
    };
    const handleError = () => {
      setIframeLoadError('Failed to load preview runtime');
      setIframeHasState(true);
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);
    setIframeLoaded(false);
    setIframeHasState(false);
    setIframeLoadError(null);
    iframe.src = iframeSrc;

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [iframeSrc, previewStateReady]);

  useEffect(() => {
    if (!hasWidget || !compiled) return;
    if (!previewStateReady) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    if (!iframeLoaded) return;

    const message = {
      type: 'ck:state-update',
      widgetname: compiled.widgetname,
      instanceId,
      baseLocale,
      state: resolvedPreviewInstanceData,
      locale: effectivePreviewLocale,
      previewMode,
      device,
      theme,
    };

    iframeWindow.postMessage(message, '*');
  }, [
    hasWidget,
    compiled,
    instanceId,
    resolvedPreviewInstanceData,
    effectivePreviewLocale,
    previewMode,
    baseLocale,
    device,
    theme,
    iframeLoaded,
    previewStateReady,
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
        setIframeLoadError(null);
        return;
      }
      if (data.type === 'ck:preview-locale-switch-blocked') {
        setSwitcherNotice(BLOCKED_SWITCHER_COPY);
        return;
      }
      if (data.type === 'ck:preview-locale-change-request') {
        const requestedLocale =
          typeof data.locale === 'string' ? data.locale.trim() : '';
        if (!requestedLocale) return;
        if (latestRef.current.previewMode !== 'translations') {
          setSwitcherNotice(BLOCKED_SWITCHER_COPY);
          return;
        }
        if (!latestRef.current.previewablePreviewLocales.includes(requestedLocale)) {
          return;
        }
        onTranslationPreviewLocaleChange(requestedLocale);
        return;
      }
      if (data.type !== 'ck:resize') return;
      const h = Number(data.height);
      if (!Number.isFinite(h) || h <= 0) return;
      const next = Math.min(6000, Math.max(120, Math.round(h)));
      setMeasuredHeight((prev) => {
        if (prev != null && Math.abs(prev - next) <= 1) return prev;
        return next;
      });
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTranslationPreviewLocaleChange]);

  useEffect(() => {
    // When switching instances/devices/modes, allow the iframe to re-measure.
    setMeasuredHeight(null);
  }, [device, theme, host]);

  const isDesktopCanvas = host === 'canvas' && device === 'desktop';
  const shouldResizeCanvas = isDesktopCanvas && (stageMode === 'wrap' || stageMode === 'fixed');
  const resolvedCanvasHeight =
    isDesktopCanvas &&
    stageMode === 'fixed' &&
    Number.isFinite(stageFixedHeight) &&
    stageFixedHeight > 0
      ? stageFixedHeight
      : measuredHeight;
  const canvasHeightPx =
    shouldResizeCanvas && resolvedCanvasHeight ? `${resolvedCanvasHeight}px` : null;
  const canvasWidthPx =
    shouldResizeCanvas &&
    stageMode === 'fixed' &&
    Number.isFinite(stageFixedWidth) &&
    stageFixedWidth > 0
      ? `${stageFixedWidth}px`
      : null;
  const shouldRenderCanvasCard = Boolean(shouldResizeCanvas && (canvasHeightPx || canvasWidthPx));

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
        title="Widget preview"
        className="workspace-iframe"
        sandbox="allow-scripts allow-same-origin"
        style={iframeBackdrop ? ({ background: iframeBackdrop } as any) : undefined}
      />
      {hasWidget && translationPreviewUnavailable ? (
        <div className="workspace-status-overlay" role="status" aria-live="polite">
          <span className="label-s">Generate translations to preview this language.</span>
        </div>
      ) : null}
      {hasWidget && !translationPreviewUnavailable && !iframeHasState ? (
        <div className="workspace-status-overlay" role="status" aria-live="polite">
          <span className="label-s">Loading preview...</span>
        </div>
      ) : null}
      {hasWidget && iframeLoadError ? (
        <div className="workspace-status-overlay workspace-status-overlay--error" role="alert">
          <span className="label-s">{iframeLoadError}</span>
        </div>
      ) : null}
      {hasWidget && switcherNotice ? (
        <div className="workspace-status-overlay" role="status" aria-live="polite">
          <span className="label-s">{switcherNotice}</span>
        </div>
      ) : null}

      <div className="workspace-overlay" aria-hidden={!hasWidget}>
        <div
          className="workspace-device-toggle diet-segmented diet-segmented-ic"
          role="radiogroup"
          aria-label="Device"
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
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ic"
              data-size="lg"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={device === 'desktop'}
            >
              <span
                className="diet-btn-ic__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('desktopcomputer') }}
              />
            </button>
            <span className="diet-segment__sr">Desktop</span>
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
            <span className="diet-segment__surface" />
            <button
              className="diet-btn-ic"
              data-size="lg"
              data-variant="neutral"
              tabIndex={-1}
              type="button"
              aria-pressed={device === 'mobile'}
            >
              <span
                className="diet-btn-ic__icon"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: getIcon('iphone') }}
              />
            </button>
            <span className="diet-segment__sr">Mobile</span>
          </label>
        </div>
      </div>
    </section>
  );
}
