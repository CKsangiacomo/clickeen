import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectConfigMediaAssetRefs,
  materializeConfigMedia,
  resolveTranslatedValues,
  type ResolvedAccountAsset,
} from '@clickeen/ck-contracts';
import type { AccountFontLibrary, RuntimeTypographyData } from '@clickeen/widget-foundation';
import type { InstancePublicPackage } from '../lib/session/sessionTypes';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { dieterIconStyle } from './dieterIcon';

const BLOCKED_SWITCHER_COPY =
  'Translations not available while in editing mode. Preview translations in Translations panel.';

export function shouldBlockSavedTranslationPreview(args: {
  previewMode: 'editing' | 'translations';
  requestedLocale: string;
  baseLocale: string;
  loading: boolean;
  error: string | null;
}): boolean {
  return args.previewMode === 'translations' &&
    Boolean(args.requestedLocale) &&
    args.requestedLocale !== args.baseLocale &&
    (args.loading || Boolean(args.error));
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
}): { ok: true; data: RuntimeTypographyData } | { ok: false; error: string | null } {
  if (!args.fontLibrary) return { ok: false, error: 'Missing preview font library' };
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
    if (!resolved) return { ok: false, error: null };
    if (resolved.assetType !== 'font' || resolved.contentType !== record.contentType) {
      return { ok: false, error: 'Failed to resolve preview font assets' };
    }
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

function buildPreviewDocument(
  publicPackage: InstancePublicPackage,
  runtimeUrl: string,
): string {
  const document = new DOMParser().parseFromString(publicPackage.indexHtml, 'text/html');
  const stylesheet = document.querySelector('link[rel="stylesheet"]');
  const runtime = document.querySelector('script[src]');
  if (!stylesheet || !runtime) {
    throw new Error('coreui.errors.instance.publicPackageNotFound');
  }
  const style = document.createElement('style');
  style.textContent = publicPackage.stylesCss;
  stylesheet.replaceWith(style);
  runtime.setAttribute('src', runtimeUrl);
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
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
  savedTranslationsError: string | null;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const { accountAssets, compiled, fontLibrary, instanceData, publicPackage } = session;
  const { preview, setPreview } = chrome;
  const instanceId = chrome.meta?.instanceId ?? '';
  const device = preview.device;
  const host = preview.host;
  const hasWidget = Boolean(compiled && publicPackage);
  const stageCanvas = (instanceData as { stage?: { canvas?: { mode?: unknown; width?: unknown; height?: unknown } } }).stage?.canvas;
  const stageMode = stageCanvas?.mode === 'wrap' || stageCanvas?.mode === 'fixed' ? stageCanvas.mode : null;
  const [stageFixedWidth, stageFixedHeight] = [stageCanvas?.width, stageCanvas?.height].map((value) => typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState<string | null>(null);
  const [assetResolutionError, setAssetResolutionError] = useState<string | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
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
    const materialized = materializeConfigMedia(instanceData, resolvedAssets);
    return materialized && typeof materialized === 'object' && !Array.isArray(materialized)
      ? (materialized as Record<string, unknown>)
      : instanceData;
  }, [instanceData, mediaAssetRefs, resolvedAssets, unresolvedMediaAssetRefs]);
  const mediaPreviewStateReady = mediaAssets.ok && !unresolvedMediaAssetRefs.length;
  const previewTypography = useMemo(
    () => buildPreviewTypographyData({ fontLibrary, resolvedAssets }),
    [fontLibrary, resolvedAssets],
  );
  const previewTypographyData = previewTypography.ok ? previewTypography.data : null;
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
  const requestedTranslationPreviewLocale =
    translationPreviewLocale && effectivePreviewableLocales.includes(translationPreviewLocale)
      ? translationPreviewLocale
      : '';
  const effectivePreviewLocale =
    previewMode === 'translations'
      ? requestedTranslationPreviewLocale || fallbackPreviewLocale
      : fallbackPreviewLocale;
  const selectedTranslationValues =
    previewMode === 'translations' && effectivePreviewLocale !== baseLocale
      ? translationValuesByLanguage[effectivePreviewLocale] ?? null
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
  const previewDependencyError = !mediaAssets.ok
    ? 'Failed to resolve preview media assets'
    : assetResolutionError ?? (!previewTypography.ok ? previewTypography.error : null);
  const previewError = iframeLoadError ?? previewDependencyError;
  const resolvedPreviewInstanceData = useMemo(() => {
    if (!selectedTranslationValues) return previewInstanceData;
    return resolveTranslatedValues(previewInstanceData, selectedTranslationValues);
  }, [previewInstanceData, selectedTranslationValues]);

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
    if (!mediaAssets.ok) {
      setAssetResolutionError(null);
      return;
    }
    if (!accountAssetRefs.length) {
      setAssetResolutionError(null);
      return;
    }

    const missingAssetRefs = unresolvedAccountAssetRefs;
    if (!missingAssetRefs.length) {
      setAssetResolutionError(null);
      return;
    }

    let cancelled = false;
    setAssetResolutionError(null);
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
        if (!cancelled) setAssetResolutionError('Failed to resolve preview account assets');
      });

    return () => {
      cancelled = true;
    };
  }, [accountAssets, mediaAssets, accountAssetRefs, unresolvedAccountAssetRefs]);

  useEffect(() => {
    if (!switcherNotice) return undefined;
    const timer = window.setTimeout(() => setSwitcherNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [switcherNotice]);

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
    setIframeLoadError(null);
    if (!publicPackage) {
      iframe.srcdoc = '';
      return;
    }
    const runtimeUrl = URL.createObjectURL(
      new Blob([publicPackage.runtimeJs], { type: 'text/javascript' }),
    );
    let previewDocument: string;
    try {
      previewDocument = buildPreviewDocument(publicPackage, runtimeUrl);
    } catch (error) {
      URL.revokeObjectURL(runtimeUrl);
      setIframeLoadError(error instanceof Error ? error.message : String(error));
      return;
    }

    const handleLoad = () => {
      setIframeLoadError(null);
      setIframeLoaded(true);
    };
    const handleError = () => {
      setIframeLoadError('Failed to load preview runtime');
    };

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);
    iframe.srcdoc = previewDocument;

    return () => {
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
      URL.revokeObjectURL(runtimeUrl);
    };
  }, [publicPackage]);

  useEffect(() => {
    if (!hasWidget || !compiled) return;
    if (!previewMessageReady) return;
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
      ...(previewTypographyData ? { typographyData: previewTypographyData } : null),
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
        if (latestPreviewSelectionRef.current.previewMode !== 'translations') {
          setSwitcherNotice(BLOCKED_SWITCHER_COPY);
          return;
        }
        if (!latestPreviewSelectionRef.current.previewablePreviewLocales.includes(requestedLocale)) {
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
  const resolvedCanvasHeight = measuredHeight ?? (
    isDesktopCanvas &&
    stageMode === 'fixed' &&
    Number.isFinite(stageFixedHeight) &&
    stageFixedHeight > 0
      ? stageFixedHeight
      : null
  );
  const canvasHeightPx =
    shouldResizeCanvas && resolvedCanvasHeight ? `${resolvedCanvasHeight}px` : null;
  const canvasWidthPx =
    shouldResizeCanvas &&
    stageMode === 'fixed' &&
    (measuredWidth != null || (Number.isFinite(stageFixedWidth) && stageFixedWidth > 0))
      ? `${measuredWidth ?? stageFixedWidth}px`
      : null;
  const shouldRenderCanvasCard = Boolean(shouldResizeCanvas && (canvasHeightPx || canvasWidthPx));
  const previewStatus = !hasWidget
    ? null
    : savedTranslationPreviewBlocked
      ? {
          error: Boolean(savedTranslationsError),
          text: savedTranslationsError || 'Loading saved translation...',
        }
      : previewError
        ? { error: true, text: previewError }
        : !iframeHasState
          ? { error: false, text: 'Loading preview...' }
          : switcherNotice
            ? { error: false, text: switcherNotice }
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
        title="Widget preview"
        className="workspace-iframe"
        sandbox="allow-scripts allow-same-origin"
        style={!iframeHasState && iframeBackdrop ? ({ background: iframeBackdrop } as any) : undefined}
      />
      {previewStatus ? (
        <div
          className={`workspace-status-overlay${previewStatus.error ? ' workspace-status-overlay--error' : ''}`}
          role={previewStatus.error ? 'alert' : 'status'}
          aria-live={previewStatus.error ? undefined : 'polite'}
        >
          <span className="label-s">{previewStatus.text}</span>
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
            <span className="diet-segment__surface" aria-hidden="true" />
            <span className="diet-segment__content">
              <span
                className="diet-icon"
                data-icon="desktopcomputer"
                style={dieterIconStyle('desktopcomputer')}
                aria-hidden="true"
              />
              <span className="diet-segment__sr">Desktop</span>
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
              <span className="diet-segment__sr">Mobile</span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
