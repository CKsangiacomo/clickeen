'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildEmbedSnippets } from '../lib/embed-snippets';
import { useWidgetSessionChrome } from '../lib/session/useWidgetSession';

type EmbedModalProps = {
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

export function EmbedModal({ open, onClose }: EmbedModalProps) {
  const session = useWidgetSessionChrome();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountPublicId = session.meta?.accountPublicId ? String(session.meta.accountPublicId) : '';
  const instanceId = session.meta?.instanceId ? String(session.meta.instanceId) : '';
  const isPublished = session.meta?.publishStatus === 'published';

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

  const seoGeoEntitled = session.policy?.flags['embed.seoGeo.enabled'] === true;
  const seoGeoEnabled = seoGeoEntitled;

  const embed = useMemo(() => {
    return buildEmbedSnippets({
      accountPublicId,
      instanceId,
      published: isPublished,
    });
  }, [accountPublicId, instanceId, isPublished]);

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
        aria-label="Copy code to use this widget"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <div className="ck-publishModal__header">
          <div className="heading-3">Copy code to use this widget</div>
          <div className="label-s label-muted">Paste this code into your website where you want the widget to appear.</div>
        </div>

        {!instanceId ? <div className="settings-panel__error">Instance instanceId missing.</div> : null}
        {instanceId && !accountPublicId ? <div className="settings-panel__error">Account public ID missing.</div> : null}
        {instanceId && !isPublished ? (
          <div className="settings-panel__error">Publish this widget before copying embed code.</div>
        ) : null}
        {embed.canRender ? (
          <div className="ck-publishModal__content">
            <div>
              <div className="settings-panel__row">
                <div className="label-s">Recommended embed</div>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => void copySnippet('recommended embed', embed.iframeSnippet)}
                >
                  <span className="diet-btn-txt__label">Copy</span>
                </button>
              </div>
              <pre className="settings-panel__code">
                <code>{embed.iframeSnippet}</code>
              </pre>
            </div>

            <div>
              <div className="settings-panel__row">
                <div className="label-s">Script embed</div>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => void copySnippet('script embed', embed.scriptSnippet)}
                >
                  <span className="diet-btn-txt__label">Copy</span>
                </button>
              </div>
              <pre className="settings-panel__code">
                <code>{embed.scriptSnippet}</code>
              </pre>
            </div>

            <div>
              {seoGeoEnabled ? (
                <div className="label-s label-muted">
                  SEO/GEO embed generation is handled by the PRD 101 coding-agent build shape.
                </div>
              ) : (
                <div className="label-s label-muted">
                  SEO/GEO optimized embed is only available on entitled tiers.
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
