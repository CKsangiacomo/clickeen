import { useEffect, useMemo, useRef } from 'react';
import { getIcon } from '../lib/icons';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { renderWidgetHtml } from '../lib/preview/renderWidgetHtml';

export function Workspace() {
  const session = useWidgetSession();
  const { compiled, instanceData, preview, setPreview, meta, widgetJSON } = session;
  const device = preview.device;
  const theme = preview.theme;
  const hasWidget = Boolean(compiled && widgetJSON);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const displayName =
    meta?.label || meta?.publicId || compiled?.displayName || compiled?.widgetname || 'No instance loaded';

  const previewDocument = useMemo(() => {
    if (!hasWidget) {
      return `<!doctype html><html><head><meta charset="utf-8" /></head><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:'Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="opacity:0.55;font-size:14px;">Load an instance to see the preview.</div>
      </body></html>`;
    }
    try {
      return renderWidgetHtml({
        widgetname: compiled!.widgetname,
        widgetJSON: widgetJSON as Record<string, unknown>,
        instanceData,
        publicId: meta?.publicId ?? 'preview-instance',
        device,
        theme,
        backlink: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const escaped = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return `<!doctype html><html><head><meta charset="utf-8" /></head><body style="margin:0;background:#fef2f2;color:#7f1d1d;font-family:'Inter Tight',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div style="padding:32px;max-width:420px;text-align:center;">
          <strong>Preview renderer error</strong>
          <div style="margin-top:12px;font-size:14px;">${escaped}</div>
        </div>
      </body></html>`;
    }
  }, [hasWidget, compiled, widgetJSON, instanceData, meta?.publicId, device, theme]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewDocument;
    }
  }, [previewDocument]);

  return (
    <section className="workspace">
      <header className="wsheader">
        <div className="wsheader-left">
          <span className="body-m label-muted">
            {displayName}
          </span>
        </div>

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

        <div className="wsheader-right">
          <div
            className="diet-segmented-ic"
            role="radiogroup"
            aria-label="Theme"
            data-size="md"
          >
            <label className="diet-segment">
              <input
                className="diet-segment__input"
                type="radio"
                name="workspace-theme"
                value="light"
                checked={theme === 'light'}
                onChange={() => setPreview({ theme: 'light' })}
              />
              <span className="diet-segment__surface" />
              <button
                className="diet-btn-ic"
                data-size="md"
                data-variant="neutral"
                tabIndex={-1}
                type="button"
                aria-pressed={theme === 'light'}
              >
                <span
                  className="diet-btn-ic__icon"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: getIcon('sun.max') }}
                />
              </button>
              <span className="diet-segment__sr">Light</span>
            </label>
            <label className="diet-segment">
              <input
                className="diet-segment__input"
                type="radio"
                name="workspace-theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={() => setPreview({ theme: 'dark' })}
              />
              <span className="diet-segment__surface" />
              <button
                className="diet-btn-ic"
                data-size="md"
                data-variant="neutral"
                tabIndex={-1}
                type="button"
                aria-pressed={theme === 'dark'}
              >
                <span
                  className="diet-btn-ic__icon"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: getIcon('moon.fill') }}
                />
              </button>
              <span className="diet-segment__sr">Dark</span>
            </label>
          </div>
        </div>
      </header>

      <div className="wscontent">
        <iframe
          ref={iframeRef}
          title="Widget preview"
          className="workspace-iframe"
          style={{
            width: device === 'mobile' ? '360px' : '640px',
            height: device === 'mobile' ? '640px' : '480px',
          }}
          sandbox="allow-scripts"
        />
      </div>
    </section>
  );
}
