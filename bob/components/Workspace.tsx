import { useEffect, useRef, useState } from 'react';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { getAt } from '../lib/utils/paths';

export function Workspace() {
  const session = useWidgetSession();
  const { compiled, instanceData, preview, setPreview, meta } = session;
  const device = preview.device;
  const theme = preview.theme;
  const hasWidget = Boolean(compiled);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
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
    iframe.src = compiled.assets.htmlUrl;

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [hasWidget, compiled, compiled?.assets.htmlUrl]);

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

  const stageBg = getAt<string>(instanceData, 'stage.background') || undefined;

  return (
    <section className="workspace">
      <header className="wsheader">
        <div className="wsheader-left" />

        <div className="wsheader-center">
          <div
            className="diet-segmented-ic"
            role="radiogroup"
            aria-label="Device"
            data-size="md"
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
                data-size="md"
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
                data-size="md"
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

        <div className="wsheader-right" />
      </header>

      <div className="wscontent" style={stageBg ? { background: stageBg } : undefined}>
        <iframe
          ref={iframeRef}
          title="Widget preview"
          className="workspace-iframe"
          style={{
            width: device === 'mobile' ? '360px' : '640px',
            height: device === 'mobile' ? '640px' : '480px',
          }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </section>
  );
}
