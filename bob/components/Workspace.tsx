import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectConfigMediaAssetRefs,
  resolveTranslatedValues,
  type ResolvedAccountAsset,
} from '@clickeen/ck-contracts';
import { generateInstance } from '@clickeen/ck-web-code-generator';
import type { InstancePublicPackage } from '../lib/session/sessionTypes';
import { useWidgetSession, useWidgetSessionChrome } from '../lib/session/useWidgetSession';
import { buildRuntimeTypographyData, collectFontAssetRefs } from '../lib/web-code-context';
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

function buildPreviewDocument(
  publicPackage: InstancePublicPackage,
  runtimeUrl: string,
  previewMode: 'editing' | 'translations',
  currentLocale: string,
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
  document.documentElement.setAttribute('data-ck-preview-mode', previewMode);
  document.documentElement.lang = currentLocale;
  const localeSelect = document.querySelector('.ck-locale-switcher__select');
  if (localeSelect instanceof HTMLSelectElement) {
    localeSelect.value = currentLocale;
    localeSelect.setAttribute('data-current-locale', currentLocale);
  }
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
  savedTranslationsReady,
}: {
  baseLocale: string;
  previewMode: 'editing' | 'translations';
  translationPreviewLocale: string;
  onTranslationPreviewLocaleChange: (locale: string) => void;
  previewablePreviewLocales: string[];
  translationValuesByLanguage: Record<string, Record<string, string>>;
  savedTranslationsLoading: boolean;
  savedTranslationsError: string | null;
  savedTranslationsReady: boolean;
}) {
  const session = useWidgetSession();
  const chrome = useWidgetSessionChrome();
  const {
    accountAssets,
    compiled,
    error: sessionError,
    fontLibrary,
    instanceData,
    setGeneratedPublicPackage,
  } = session;
  const { preview, setPreview } = chrome;
  const device = preview.device;
  const host = preview.host;
  const stageCanvas = (instanceData as { stage?: { canvas?: { mode?: unknown; width?: unknown; height?: unknown } } }).stage?.canvas;
  const stageMode = stageCanvas?.mode === 'wrap' || stageCanvas?.mode === 'fixed' ? stageCanvas.mode : null;
  const [stageFixedWidth, stageFixedHeight] = [stageCanvas?.width, stageCanvas?.height].map((value) => typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHasState, setIframeHasState] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState<string | null>(null);
  const [assetResolutionError, setAssetResolutionError] = useState<string | null>(null);
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
  const mediaPreviewStateReady = mediaAssets.ok && !unresolvedMediaAssetRefs.length;
  const previewTypography = useMemo(
    () => buildRuntimeTypographyData({ fontLibrary, resolvedAssets }),
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
  const previewDependencyError = !mediaAssets.ok
    ? 'Failed to resolve preview media assets'
    : assetResolutionError ??
      savedTranslationsError ??
      (!previewTypography.ok ? previewTypography.error : null);
  const resolvedPreviewInstanceData = useMemo(() => {
    if (!selectedTranslationValues) return instanceData;
    return resolveTranslatedValues(instanceData, selectedTranslationValues);
  }, [instanceData, selectedTranslationValues]);
  const resolvedAssetsByRef = useMemo(
    () => Object.fromEntries(resolvedAssets.entries()),
    [resolvedAssets],
  );
  const generationSettings = useMemo(() => {
    const behavior = instanceData.behavior && typeof instanceData.behavior === 'object' && !Array.isArray(instanceData.behavior)
      ? instanceData.behavior as Record<string, unknown>
      : {};
    return {
      seoGeoAeoEnabled: behavior.seoGeoAeoEnabled === true,
      includeClickeenAttribution: behavior.showBacklink !== false,
    };
  }, [instanceData]);
  const generateFiles = useMemo(() => {
    if (
      !compiled?.definition ||
      !savedTranslationsReady ||
      !previewTypographyData ||
      !mediaPreviewStateReady ||
      unresolvedFontAssetRefs.length
    ) return null;
    return (source: Record<string, unknown>) => generateInstance({
      definition: compiled.definition!,
      source,
      baseLocale,
      overlays: Object.fromEntries(
        Object.entries(translationValuesByLanguage)
          .filter(([locale]) => locale !== baseLocale)
          .map(([locale, values]) => [locale, { values }]),
      ),
      settings: generationSettings,
      context: {
        assetsByRef: resolvedAssetsByRef,
        typography: previewTypographyData,
      },
    });
  }, [
    compiled,
    baseLocale,
    generationSettings,
    mediaPreviewStateReady,
    previewTypographyData,
    resolvedAssetsByRef,
    savedTranslationsReady,
    translationValuesByLanguage,
    unresolvedFontAssetRefs.length,
  ]);
  const generatedBasePackage = useMemo(() => {
    if (!generateFiles) return null;
    try {
      return { ok: true as const, publicPackage: generateFiles(instanceData) };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : String(error) };
    }
  }, [generateFiles, instanceData]);

  useEffect(() => {
    if (session.publicPackage) return;
    setGeneratedPublicPackage(generatedBasePackage);
  }, [generatedBasePackage, session.publicPackage, setGeneratedPublicPackage]);

  const previewPublicPackage = useMemo(() => {
    if (!generateFiles) return null;
    if (previewMode === 'editing' && session.publicPackage) return session.publicPackage;
    if (savedTranslationPreviewBlocked) {
      return generatedBasePackage?.ok ? generatedBasePackage.publicPackage : null;
    }
    try {
      return generateFiles(resolvedPreviewInstanceData);
    } catch {
      return null;
    }
  }, [
    generateFiles,
    generatedBasePackage,
    previewMode,
    resolvedPreviewInstanceData,
    savedTranslationPreviewBlocked,
    session.publicPackage,
  ]);
  const hasWidget = Boolean(compiled && previewPublicPackage);
  const previewError =
    (sessionError?.source === 'generation' ? sessionError.message : null) ??
    iframeLoadError ??
    previewDependencyError;

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
    const raw = (instanceData as any)?.stage?.background;
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
    setIframeHasState(false);
    setIframeLoadError(null);
    if (!previewPublicPackage) {
      iframe.srcdoc = '';
      return;
    }
    const runtimeUrl = URL.createObjectURL(
      new Blob([previewPublicPackage.runtimeJs], { type: 'text/javascript' }),
    );
    let previewDocument: string;
    try {
      previewDocument = buildPreviewDocument(previewPublicPackage, runtimeUrl, previewMode, effectivePreviewLocale);
    } catch (error) {
      URL.revokeObjectURL(runtimeUrl);
      setIframeLoadError(error instanceof Error ? error.message : String(error));
      return;
    }

    const handleLoad = () => {
      setIframeLoadError(null);
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
  }, [effectivePreviewLocale, previewMode, previewPublicPackage]);

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
  }, [device, host]);

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
        style={iframeBackdrop ? ({ background: iframeBackdrop } as any) : undefined}
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
                data-icon="desktopcomputer"
                style={dieterIconStyle('desktopcomputer')}
                aria-hidden="true"
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
                data-icon="iphone"
                style={dieterIconStyle('iphone')}
                aria-hidden="true"
              />
            </button>
            <span className="diet-segment__sr">Mobile</span>
          </label>
        </div>
      </div>
    </section>
  );
}
