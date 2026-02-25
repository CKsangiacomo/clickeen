'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveVeniceBaseUrl } from '../lib/env/venice';
import { useWidgetSession } from '../lib/session/useWidgetSession';

type PublishEmbedModalProps = {
  open: boolean;
  onClose: () => void;
};

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.left = '-1000px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function PublishEmbedModal({ open, onClose }: PublishEmbedModalProps) {
  const session = useWidgetSession();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const publicId = session.meta?.publicId ? String(session.meta.publicId) : '';

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const seoGeoEnabled = Boolean((session.instanceData as any)?.seoGeo?.enabled === true);

  const embed = useMemo(() => {
    let veniceBase = '';
    try {
      veniceBase = resolveVeniceBaseUrl().replace(/\/+$/, '');
    } catch {
      veniceBase = '';
    }
    const loaderSrc = veniceBase ? `${veniceBase}/embed/latest/loader.js` : '';
    const canRender = Boolean(publicId && loaderSrc);

    const safeSnippet = canRender
      ? `<div data-clickeen-id="${publicId}"></div>
<script src="${loaderSrc}" async></script>`
      : '';

    const scriptlessSnippet = canRender
      ? `<iframe
  src="${veniceBase}/e/${encodeURIComponent(publicId)}?locale=en"
  title="Clickeen widget"
  loading="lazy"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-same-origin allow-forms"
  style="width:100%;border:0;min-height:420px;"
></iframe>`
      : '';

    const seoGeoSnippet = canRender
      ? `<div
  data-clickeen-id="${publicId}"
  data-ck-optimization="seo-geo"
  data-max-width="0"
  data-min-height="420"
  data-width="100%"
></div>
<script src="${loaderSrc}" async></script>`
      : '';

    const previewSeoGeoHref = publicId
      ? `/bob/preview-shadow?publicId=${encodeURIComponent(publicId)}&mode=seo-geo`
      : '/bob/preview-shadow?mode=seo-geo';

    return { veniceBase, loaderSrc, canRender, safeSnippet, scriptlessSnippet, seoGeoSnippet, previewSeoGeoHref };
  }, [publicId]);

  const copySnippet = useCallback(async (label: string, snippet: string) => {
    setCopyStatus(null);
    const ok = await copyToClipboard(snippet);
    setCopyStatus(ok ? `Copied: ${label}` : `Copy failed: ${label}`);
    window.setTimeout(() => setCopyStatus(null), 1800);
  }, []);

  if (!open) return null;

  return (
    <div className="ck-publishOverlay" role="presentation" onMouseDown={onClose}>
      <div
        className="ck-publishModal"
        role="dialog"
        aria-modal="true"
        aria-label="Publish"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="ck-publishModal__header">
          <div className="heading-3">Publish</div>
          <div className="label-s label-muted">Copy embed code for this instance.</div>
        </div>

        {!publicId ? <div className="settings-panel__error">Instance publicId missing.</div> : null}
        {publicId && !embed.veniceBase ? (
          <div className="settings-panel__error">Missing NEXT_PUBLIC_VENICE_URL (cannot build embed snippet).</div>
        ) : null}

        {embed.canRender ? (
          <div className="ck-publishModal__content">
            <div>
              <div className="settings-panel__row">
                <div className="label-s">Recommended embed (loader)</div>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => void copySnippet('recommended embed', embed.safeSnippet)}
                >
                  <span className="diet-btn-txt__label">Copy</span>
                </button>
              </div>
              <pre className="settings-panel__code">
                <code>{embed.safeSnippet}</code>
              </pre>
            </div>

            <div>
              <div className="settings-panel__row">
                <div className="label-s">Scriptless embed (iframe only)</div>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => void copySnippet('scriptless iframe embed', embed.scriptlessSnippet)}
                >
                  <span className="diet-btn-txt__label">Copy</span>
                </button>
              </div>
              <pre className="settings-panel__code">
                <code>{embed.scriptlessSnippet}</code>
              </pre>
            </div>

            <div>
              {seoGeoEnabled ? (
                <>
                  <div className="settings-panel__row">
                    <div className="label-s">SEO/GEO optimized embed (iframe++)</div>
                    <div className="settings-panel__actions-inline">
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="primary"
                        type="button"
                        onClick={() => void copySnippet('SEO/GEO embed', embed.seoGeoSnippet)}
                      >
                        <span className="diet-btn-txt__label">Copy</span>
                      </button>
                      <a
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="neutral"
                        href={embed.previewSeoGeoHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="diet-btn-txt__label">Preview</span>
                      </a>
                    </div>
                  </div>
                  <pre className="settings-panel__code">
                    <code>{embed.seoGeoSnippet}</code>
                  </pre>
                </>
              ) : (
                <div className="label-s label-muted">
                  Enable “SEO/GEO optimization” in Settings to unlock the SEO/GEO embed snippet.
                </div>
              )}
            </div>

            {copyStatus ? (
              <div className={copyStatus.startsWith('Copied') ? 'settings-panel__success' : 'settings-panel__error'}>
                {copyStatus}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ck-publishModal__actions">
          <button
            ref={closeButtonRef}
            className="diet-btn-txt"
            data-size="lg"
            data-variant="neutral"
            type="button"
            onClick={onClose}
          >
            <span className="diet-btn-txt__label">Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
