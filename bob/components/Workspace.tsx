import { useEffect, useRef, useState } from 'react';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';

export function Workspace() {
  const session = useWidgetSession();
  const { compiled, instanceData, preview, setPreview, meta } = session;
  const device = preview.device;
  const theme = preview.theme;
  const hasWidget = Boolean(compiled);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeRevision, setIframeRevision] = useState(0);
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
    // Dev ergonomics: prevent stale Tokyo assets in the preview iframe (HTML/CSS/JS caching can make edits look like "nothing changed").
    const baseUrl = compiled.assets.htmlUrl;
    const sep = baseUrl.includes('?') ? '&' : '?';
    iframe.src = `${baseUrl}${sep}ck_preview_rev=${iframeRevision}`;

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [hasWidget, compiled, compiled?.assets.htmlUrl, iframeRevision]);

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

  return (
    <section className="workspace" data-device={device}>
      <div className="workspace-viewport">
        <iframe
          ref={iframeRef}
          title="Widget preview"
          className="workspace-iframe"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

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
