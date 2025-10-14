"use client";

import { useState, useEffect, useRef } from 'react';
import styles from './bob.module.css';
import { getIcon } from '../../lib/icons';
import { getVeniceBase } from '../../lib/venice';
import { getDevJwt, parisGetInstance, parisUpdateInstance } from '../../lib/paris';

type Theme = 'light' | 'dark';

type Device = 'desktop' | 'mobile';

export default function Bob({ publicId: initialPublicIdProp }: { publicId?: string }) {
  const publicId = initialPublicIdProp || process.env.NEXT_PUBLIC_TEST_PUBLIC_ID;

  if (!publicId) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui', color: '#ef4444' }}>
        <h1>Error: No widget specified</h1>
        <p>Bob requires a publicId parameter. Example: /bob?publicId=wgt_abc123</p>
      </div>
    );
  }

  const [theme, setTheme] = useState<Theme>('light');
  const [device, setDevice] = useState<Device>('desktop');
  const [widgetName, setWidgetName] = useState('Untitled widget');
  const [instanceStatus, setInstanceStatus] = useState<'draft' | 'published' | 'inactive' | 'unknown'>('unknown');
  const [widgetTypeState, setWidgetTypeState] = useState<string | undefined>(undefined);
  const [btnText, setBtnText] = useState<string>('Change me');
  const [btnColor, setBtnColor] = useState<'green' | 'red'>('green');
  const [radiusPx, setRadiusPx] = useState<number>(12);
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string>('pencil');
  // Preview A/B iframes for smooth cross-fade
  const [activeFrame, setActiveFrame] = useState<0 | 1>(0);
  const iframeARef = useRef<HTMLIFrameElement | null>(null);
  const iframeBRef = useRef<HTMLIFrameElement | null>(null);
  // Server snapshot and saving state (explicit Save model)
  const [savedSnapshot, setSavedSnapshot] = useState<{ text: string; color: 'green' | 'red'; radiusPx: number }>({ text: 'Change me', color: 'green', radiusPx: 12 });
  const [lastServerConfig, setLastServerConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [previewTs, setPreviewTs] = useState<number>(0);
  const isDirty = (btnText !== savedSnapshot.text) || (btnColor !== savedSnapshot.color) || (radiusPx !== savedSnapshot.radiusPx);
  const buildPreviewSrc = () => `/api/preview/e/${encodeURIComponent(publicId)}?preview=1&theme=${theme}&device=${device}&ts=${previewTs}`;
  const getActiveWindow = () => (activeFrame === 0 ? iframeARef.current?.contentWindow : iframeBRef.current?.contentWindow);
  const postPreviewPatch = (fields: Record<string, unknown>) => {
    try {
      const win = getActiveWindow();
      if (!win) return;
      win.postMessage({ type: 'patch', widget: 'testbutton', fields }, '*');
    } catch {}
  };
  const requestPreviewSwap = () => {
    const hiddenRef = activeFrame === 0 ? iframeBRef : iframeARef;
    const nextSrc = buildPreviewSrc();
    const handler = () => {
      setActiveFrame((prev) => (prev === 0 ? 1 : 0));
      hiddenRef.current?.removeEventListener('load', handler as any);
    };
    if (hiddenRef.current) {
      try { hiddenRef.current.removeEventListener('load', handler as any); } catch {}
      hiddenRef.current.addEventListener('load', handler as any);
      hiddenRef.current.src = nextSrc;
    }
  };
  // topdrawer main rename state (size XL)
  const [isEditingNameTop, setIsEditingNameTop] = useState(false);
  const [editNameTop, setEditNameTop] = useState(widgetName);
  const renameTopRef = useRef<HTMLDivElement | null>(null);
  // Tool drawer assist mode (manual vs AI copilot)
  const [assistMode, setAssistMode] = useState<'manual' | 'copilot'>('manual');

  useEffect(() => { if (!isEditingNameTop) setEditNameTop(widgetName); }, [widgetName, isEditingNameTop]);
  useEffect(() => {
    if (!isEditingNameTop) return;
    const input = renameTopRef.current?.querySelector<HTMLInputElement>('.diet-textrename__input');
    if (input) {
      input.focus({ preventScroll: true });
      try {
        const value = input.value;
        input.setSelectionRange(value.length, value.length);
      } catch {}
    }
  }, [isEditingNameTop]);

  const beginRenameTop = () => {
    setEditNameTop(widgetName);
    setIsEditingNameTop(true);
  };

  // Dismiss edit state(s) on outside click
  useEffect(() => {
    if (!isEditingNameTop) return;
    function onDocPointerDown(e: Event) {
      const target = e.target as Node | null;
      const boxTop = renameTopRef.current;
      const insideTop = boxTop && target ? boxTop.contains(target) : false;
      if (!insideTop) {
        setEditNameTop(widgetName);
        setIsEditingNameTop(false);
        renameTopRef.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [isEditingNameTop, widgetName]);

  // Set preview timestamp on client mount to avoid hydration mismatch
  useEffect(() => {
    setPreviewTs(Date.now());
  }, []);

  // Load instance on mount / when publicId changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { res, body } = await parisGetInstance(publicId);
        console.log('[Bob] GET response:', res.status, body);
        if (!alive) return;
        if (res.status === 404) {
          console.log('[Bob] Widget not found (404)');
          // No fallback mutation here to avoid loops; keep current publicId
          return;
        }
        if (!res.ok) {
          console.log('[Bob] GET failed:', res.status);
          return;
        }
        const inst = body as any;
        console.log('[Bob] Setting widgetTypeState to:', inst?.widgetType);
        setInstanceStatus((inst?.status as any) || 'unknown');
        setWidgetTypeState(inst?.widgetType as string | undefined);
        const cfg = (inst?.config ?? {}) as Record<string, unknown>;
        if (typeof (inst as any)?.updatedAt === 'string') {
          setLastUpdatedAt(String((inst as any).updatedAt));
        }
        // Derive a friendly name for the top bar
        let derived = '';
        if (inst?.widgetType === 'engagement.announcement') {
          derived = String((cfg?.title as string) || (cfg?.message as string) || '').trim();
        } else {
          derived = String((cfg?.title as string) || '').trim();
        }
        setWidgetName(derived.length > 0 ? derived : 'Untitled widget');
        if (inst?.widgetType === 'testbutton') {
          const t = String((cfg as any).text ?? 'Change me');
          const c = ((cfg as any).color === 'red' ? 'red' : 'green') as 'green' | 'red';
          const rRaw = Number((cfg as any).radiusPx);
          const r = Number.isFinite(rRaw) ? Math.max(0, Math.min(32, Math.round(rRaw))) : 12;
          setBtnText(t);
          setBtnColor(c);
          setRadiusPx(r);
          setSavedSnapshot({ text: t, color: c, radiusPx: r });
          setLastServerConfig(cfg);
        }
      } catch (_) {
        // swallow dev fetch errors; UI still usable
      }
    })();
    return () => { alive = false; };
  }, [publicId]);
  return (
    <div className={styles.root}>
      <section id="topdrawer" className={styles.topdrawer} aria-label="topdrawer">
        <div className={styles.topbar}>
          <div className={styles.topdmain}>
            <div style={{ display: 'inline-grid', alignItems: 'center', blockSize: 'var(--control-size-xl)' }}>
              <div
                ref={renameTopRef}
                className="diet-textrename"
                data-size="xl"
                data-state={isEditingNameTop ? 'editing' : 'view'}
                style={{ paddingInline: 'var(--space-1)', blockSize: '100%' }}
              >
                <div
                  className="diet-textrename__view"
                  role="button"
                  aria-label="Rename widget"
                  tabIndex={0}
                  onClick={beginRenameTop}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      beginRenameTop();
                    }
                  }}
                >
                  <span className="diet-textrename__label heading-3">{widgetName || 'Untitled widget'}</span>
                </div>
                <div className="diet-textrename__edit">
                  <input
                    className="diet-textrename__input heading-3"
                    type="text"
                    value={editNameTop}
                    onChange={(e) => setEditNameTop(e.target.value)}
                    onBlur={(event) => {
                      const next = event.relatedTarget as Node | null;
                      if (next && renameTopRef.current?.contains(next)) {
                        return;
                      }
                      setEditNameTop(widgetName);
                      setIsEditingNameTop(false);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const trimmed = (editNameTop || '').trim();
                        const finalName = trimmed.length > 0 ? trimmed : 'Untitled widget';
                        setIsEditingNameTop(false);
                        renameTopRef.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
                        // Canonical save flow: GET then PUT (merge config)
                        try {
                          
                          const { res, body } = await parisGetInstance(publicId);
                          if (res.status === 404) {
                            // Future: prompt create-from-template; for now, keep local state only.
                            setWidgetName(finalName);
                            return;
                          }
                          if (!res.ok) {
                            // Non-blocking: reflect locally and log
                            setWidgetName(finalName);
                            console.warn('[bob] GET instance failed:', res.status, body);
                            return;
                          }
                          const current = (body as any)?.config ?? {};
                          const wtype = (body as any)?.widgetType as string | undefined;
                          const nextConfig = { ...current } as Record<string, unknown>;
                          // For announcement, "title" is not part of schema; use message for visible change
                          if (wtype === 'engagement.announcement') {
                            nextConfig.message = finalName;
                          } else {
                            nextConfig.title = finalName;
                          }
                          const put = await parisUpdateInstance(publicId, { config: nextConfig });
                          if (!put.res.ok) {
                            console.warn('[bob] PUT instance failed:', put.res.status, put.body);
                            setWidgetName(finalName);
                          } else {
                            const updated: any = put.body || {};
                            setInstanceStatus((updated?.status as any) || instanceStatus);
                            setWidgetTypeState((updated?.widgetType as string | undefined) ?? widgetTypeState);
                            const cfg = (updated?.config ?? {}) as Record<string, unknown>;
                            let derived = '';
                            if ((updated?.widgetType as string) === 'engagement.announcement') {
                              derived = String((cfg?.title as string) || (cfg?.message as string) || '').trim();
                            } else {
                              derived = String((cfg?.title as string) || '').trim();
                            }
                            setWidgetName(derived.length > 0 ? derived : finalName);
                          }
                        } catch (err) {
                          // Likely CORS in dev if Paris lacks CORS headers; keep local state.
                          setWidgetName(finalName);
                          console.warn('[bob] rename save error', err);
                        }
                      } else if (e.key === 'Escape') {
                        setEditNameTop(widgetName);
                        setIsEditingNameTop(false);
                        renameTopRef.current?.querySelector<HTMLInputElement>('.diet-textrename__input')?.blur();
                      }
                    }}
                    placeholder="Untitled widget"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.topdright}>
            {(widgetTypeState === 'testbutton' || widgetTypeState === 'lab.testbutton') && isDirty && (
              <button
                className="diet-btn"
                data-size="xl"
                data-variant="neutral"
                type="button"
                aria-disabled={saving}
                onClick={async () => {
                  if (saving) return;
                  setSaving(true);
                  try {
                    const merged = { ...lastServerConfig, text: btnText, color: btnColor, radiusPx } as Record<string, unknown>;
                    const put = await parisUpdateInstance(publicId, { config: merged });
                    if (put.res.ok) {
                      setSavedSnapshot({ text: btnText, color: btnColor, radiusPx });
                      setLastServerConfig(merged);
                      const newUpdatedAt = (put.body as any)?.updatedAt ? String((put.body as any).updatedAt) : null;
                      if (!lastUpdatedAt || (newUpdatedAt && newUpdatedAt !== lastUpdatedAt)) {
                        setLastUpdatedAt(newUpdatedAt);
                        requestPreviewSwap();
                      }
                    } else {
                      console.warn('[bob] save failed', put.res.status, put.body);
                    }
                  } catch (err) {
                    console.warn('[bob] save error', err);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <span className="diet-btn__label">{saving ? 'Saving…' : 'Save'}</span>
              </button>
            )}
            <button
              className="diet-btn"
              data-size="xl"
              data-variant="primary"
              type="button"
              onClick={async () => {
                try {
                  
                  const put = await parisUpdateInstance(publicId, { status: 'published' });
                  if (!put.res.ok) {
                    if ((put.body as any)?.error === 'PLAN_LIMIT') {
                      alert('Plan limit reached: cannot publish more widgets on free plan.');
                    } else {
                      console.warn('[bob] publish failed', put.res.status, put.body);
                    }
                  } else {
                    const updated: any = put.body || {};
                    setInstanceStatus((updated?.status as any) || 'published');
                    setWidgetTypeState((updated?.widgetType as string | undefined) ?? widgetTypeState);
                    const cfg = (updated?.config ?? {}) as Record<string, unknown>;
                    let derived = '';
                    if ((updated?.widgetType as string) === 'engagement.announcement') {
                      derived = String((cfg?.title as string) || (cfg?.message as string) || '').trim();
                    } else {
                      derived = String((cfg?.title as string) || '').trim();
                    }
                    if (derived.length > 0) setWidgetName(derived);
                  }
                } catch (err) {
                  console.warn('[bob] publish error', err);
                }
              }}
            >
              <span className="diet-btn__label">Publish</span>
            </button>
          </div>
        </div>
      </section>

      <div className={styles.grid}>
        {/* Left tool drawer */}
        <aside id="tooldrawer" className={styles.tooldrawer} aria-label="tooldrawer">
          <header className={styles.tdheader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', width: '100%' }}>
              <div className="diet-segmented" data-size="lg" role="group" aria-label="Assist mode" style={{ width: '100%' }}>
                <label className="diet-segment" data-type="icon-text" style={{ flex: 1 }}>
                  <input
                    className="diet-segment__input"
                    type="radio"
                    name="ck-assist"
                    value="manual"
                    checked={assistMode === 'manual'}
                    onChange={() => setAssistMode('manual')}
                  />
                  <span className="diet-segment__surface" />
                  <span className="diet-segment__icon" dangerouslySetInnerHTML={{ __html: getIcon('square.and.pencil') }} />
                  <span className="diet-segment__label" style={{ justifyContent: 'center' }}>Manual</span>
                </label>
                <label className="diet-segment" data-type="icon-text" style={{ flex: 1 }}>
                  <input
                    className="diet-segment__input"
                    type="radio"
                    name="ck-assist"
                    value="copilot"
                    checked={assistMode === 'copilot'}
                    onChange={() => setAssistMode('copilot')}
                  />
                  <span className="diet-segment__surface" />
                  <span className="diet-segment__icon" dangerouslySetInnerHTML={{ __html: getIcon('sparkles') }} />
                  <span className="diet-segment__label" style={{ justifyContent: 'center' }}>AI Copilot</span>
                </label>
              </div>
            </div>
          </header>
          <div className={styles.tdcontent}>
            <div className={styles.tdmenu}>
              {['pencil', 'scribble', 'folder', 'paperplane', 'tray', 'trash'].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className="diet-btn"
                  data-size="lg"
                  data-variant={activeMenu === icon ? 'primary' : 'neutral'}
                  onClick={() => setActiveMenu(icon)}
                  aria-label={icon}
                  dangerouslySetInnerHTML={{ __html: getIcon(icon) }}
                />
              ))}
            </div>
            <div className={styles.tdmenucontent}>
              {activeMenu === 'pencil' && (widgetTypeState === 'testbutton' || widgetTypeState === 'lab.testbutton') ? (
                <>
                  <div className="heading-3" style={{
                    width: '100%',
                    minHeight: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    paddingInline: 'var(--space-2)',
                    lineHeight: '28px',
                    marginBottom: 'var(--space-2)'
                  }}>
                    Content
                  </div>
                  <div className="stack" style={{ display: 'grid', gap: '12px', padding: 'var(--space-2)' }}>
                  <div className="diet-input" data-size="lg">
                    <label className="diet-input__label label" htmlFor="btn-text">Button text</label>
                    <input
                      id="btn-text"
                      className="diet-input__field"
                      type="text"
                      value={btnText}
                      placeholder="Hint text"
                      onChange={(e) => {
                        const next = e.target.value;
                        setBtnText(next);
                        postPreviewPatch({ text: next });
                      }}
                    />
                  </div>
                  <div className="diet-dropdown" data-state={isColorDropdownOpen ? 'open' : 'closed'} data-demo="dropdown" style={{ width: '100%' }}>
                    <button
                      type="button"
                      className="diet-btn diet-btn--block diet-btn--split"
                      data-size="lg"
                      data-variant="primary"
                      data-dropdown-trigger
                      aria-haspopup="menu"
                      aria-expanded={isColorDropdownOpen}
                      onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)}
                    >
                      <span className="diet-btn__label">{btnColor === 'green' ? 'Button Color Green' : 'Button Color Red'}</span>
                      <span className="diet-btn__icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </button>
                    <div className="diet-dropdown__surface" role="menu" data-dropdown-surface>
                      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          className="diet-btn"
                          data-size="lg"
                          data-variant="neutral"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setBtnColor('green');
                            setIsColorDropdownOpen(false);
                            postPreviewPatch({ color: 'green' });
                          }}
                        >
                          <span className="diet-btn__label">Button Color Green</span>
                        </button>
                        <button
                          type="button"
                          className="diet-btn"
                          data-size="lg"
                          data-variant="neutral"
                          style={{ justifyContent: 'flex-start' }}
                          onClick={() => {
                            setBtnColor('red');
                            setIsColorDropdownOpen(false);
                            postPreviewPatch({ color: 'red' });
                          }}
                        >
                          <span className="diet-btn__label">Button Color Red</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <label className="diet-input" data-size="md">
                    <span className="diet-input__label">Corner radius</span>
                    <div className="diet-input__inner" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="diet-input__field"
                        type="range"
                        min={0}
                        max={32}
                        step={1}
                        value={radiusPx}
                        aria-label="Corner radius"
                        onChange={(e) => {
                          const v = Math.max(0, Math.min(32, Math.round(Number(e.target.value))));
                          setRadiusPx(v);
                          postPreviewPatch({ radiusPx: v });
                        }}
                      />
                      <span className="label-small" style={{ minWidth: 32, textAlign: 'right' }}>{radiusPx}px</span>
                    </div>
                  </label>
                  </div>
                </>
              ) : (
                <div className={styles.placeholder}>
                  <div style={{ opacity: 0.5, textAlign: 'center', padding: '16px' }}>
                    {activeMenu} panel
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Workspace */}
        <section id="workspace" className={styles.workspace} aria-label="workspace">
          <header id="wsheader" className={styles.wsheader} aria-label="wsheader">
            <div className={styles.wsheaderRow}>
              <div id="wsheader-left" className={styles['wsheader-left']}></div>
              <div id="wsheader-center" className={styles['wsheader-center']}>
                <div className="diet-segmented" data-size="lg" role="group" aria-label="Device">
                  {/* Left: Desktop */}
                  <label className="diet-segment" data-type="icon-only">
                    <input
                      className="diet-segment__input"
                      type="radio"
                      name="ck-device"
                      value="desktop"
                      checked={device === 'desktop'}
                      onChange={() => setDevice('desktop')}
                    />
                    <span className="diet-segment__surface" />
                    <span
                      className="diet-segment__icon"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: getIcon('desktopcomputer') }}
                    />
                    <span className="diet-segment__sr">Desktop</span>
                  </label>
                  {/* Right: Mobile */}
                  <label className="diet-segment" data-type="icon-only">
                    <input
                      className="diet-segment__input"
                      type="radio"
                      name="ck-device"
                      value="mobile"
                      checked={device === 'mobile'}
                      onChange={() => setDevice('mobile')}
                    />
                    <span className="diet-segment__surface" />
                    <span
                      className="diet-segment__icon"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: getIcon('iphone') }}
                    />
                    <span className="diet-segment__sr">Mobile</span>
                  </label>
                </div>
              </div>
              <div id="wsheader-right" className={styles['wsheader-right']}>
                <div className="diet-segmented" data-size="lg" role="group" aria-label="Theme">
                  <label className="diet-segment" data-type="icon-only">
                    <input
                      className="diet-segment__input"
                      type="radio"
                      name="ck-theme"
                      value="light"
                      checked={theme === 'light'}
                      onChange={() => setTheme('light')}
                    />
                    <span className="diet-segment__surface" />
                    <span className="diet-segment__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon('lightbulb') }} />
                    <span className="diet-segment__sr">Light</span>
                  </label>
                  <label className="diet-segment" data-type="icon-only">
                    <input
                      className="diet-segment__input"
                      type="radio"
                      name="ck-theme"
                      value="dark"
                      checked={theme === 'dark'}
                      onChange={() => setTheme('dark')}
                    />
                    <span className="diet-segment__surface" />
                    <span className="diet-segment__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: getIcon('moon.fill') }} />
                    <span className="diet-segment__sr">Dark</span>
                  </label>
                </div>
              </div>
            </div>
          </header>
          <div id="widget_preview" className={styles.widget_preview} aria-label="widget_preview">
            {publicId && publicId.trim().length > 0 && publicId !== 'demo' ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <iframe
                  ref={iframeARef}
                  title="Widget Preview A"
                  src={buildPreviewSrc()}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: activeFrame === 0 ? 1 : 0, transition: 'opacity 200ms ease' }}
                />
                <iframe
                  ref={iframeBRef}
                  title="Widget Preview B"
                  src={buildPreviewSrc()}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: activeFrame === 1 ? 1 : 0, transition: 'opacity 200ms ease' }}
                />
              </div>
            ) : (
              <div style={{ display: 'grid', placeContent: 'center', height: '100%', color: 'rgba(0,0,0,0.55)', textAlign: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Preview unavailable</div>
                  <div style={{ fontSize: 14 }}>Provide a valid publicId (e.g., open /bob?publicId=wgt_xxxxxx) to load the widget.</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right secondary drawer */}
      </div>
    </div>
  );
}
