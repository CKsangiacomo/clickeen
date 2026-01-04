import { useEffect, useRef, useState } from 'react';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function Workspace() {
  const session = useWidgetSession();
  const { compiled, instanceData, preview, setPreview, meta } = session;
  const device = preview.device;
  const theme = preview.theme;
  const host = preview.host;
  const hasWidget = Boolean(compiled);
  const seoGeoEnabled = Boolean((instanceData as any)?.seoGeo?.enabled);
  const stageMode = String((instanceData as any)?.stage?.canvas?.mode || 'viewport');
  const stageFixedWidth = Number((instanceData as any)?.stage?.canvas?.width || 0);
  const stageFixedHeight = Number((instanceData as any)?.stage?.canvas?.height || 0);
  const publicId = meta?.publicId ? String(meta.publicId) : '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeRevision, setIframeRevision] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const displayName =
    meta?.label || meta?.publicId || compiled?.displayName || compiled?.widgetname || 'No instance loaded';

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    setIframeReady(false);
    if (!hasWidget || !compiled) {
      iframe.src = 'about:blank';
      return;
    }

    const handleLoad = () => setIframeReady(true);
    iframe.addEventListener('load', handleLoad);
    const baseUrl =
      seoGeoEnabled && publicId
        ? `/bob/preview-shadow?publicId=${encodeURIComponent(publicId)}&theme=${encodeURIComponent(
            theme,
          )}&device=${encodeURIComponent(device)}`
        : compiled.assets.htmlUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    iframe.src = `${baseUrl}${sep}ck_preview_rev=${iframeRevision}`;

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [hasWidget, compiled, compiled?.assets.htmlUrl, iframeRevision, seoGeoEnabled, publicId, theme, device]);

  // Reload iframe when a new widget/instance is loaded (so HTML/CSS/JS changes are picked up immediately).
  useEffect(() => {
    if (!compiled) return;
    setIframeRevision((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled?.assets.htmlUrl, meta?.publicId]);

  useEffect(() => {
    if (!hasWidget || !compiled) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;
    if (!iframeReady) return;

    const message = {
      type: 'ck:state-update',
      widgetname: compiled.widgetname,
      state: instanceData,
      device,
      theme,
    };

    iframeWindow.postMessage(message, '*');
  }, [hasWidget, compiled, instanceData, device, theme, iframeReady]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) return;
      if (event.source !== iframeWindow) return;
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
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
  }, []);

  useEffect(() => {
    // When switching instances/devices/modes, allow the iframe to re-measure.
    setMeasuredHeight(null);
  }, [meta?.publicId, device, theme, host]);

  const isDesktopCanvas = host === 'canvas' && device === 'desktop';
  const shouldResizeCanvas = isDesktopCanvas && (stageMode === 'wrap' || stageMode === 'fixed');
  const resolvedCanvasHeight =
    isDesktopCanvas && stageMode === 'fixed' && Number.isFinite(stageFixedHeight) && stageFixedHeight > 0
      ? stageFixedHeight
      : measuredHeight;
  const canvasHeightPx = shouldResizeCanvas && resolvedCanvasHeight ? `${resolvedCanvasHeight}px` : null;
  const canvasWidthPx =
    shouldResizeCanvas && stageMode === 'fixed' && Number.isFinite(stageFixedWidth) && stageFixedWidth > 0
      ? `${stageFixedWidth}px`
      : null;
  const shouldRenderCanvasCard = Boolean(shouldResizeCanvas && (canvasHeightPx || canvasWidthPx));

  return (
    <section
      className="workspace"
      data-device={device}
      data-host={host}
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
      <iframe ref={iframeRef} title="Widget preview" className="workspace-iframe" sandbox="allow-scripts allow-same-origin" />

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
