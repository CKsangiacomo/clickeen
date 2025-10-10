'use client';

import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from './StudioShell.module.css';

const TEMPLATE_TILES = [
  { id: 'template-1', name: 'Template 1', src: '/studio/TMP/1.png' },
  { id: 'template-2', name: 'Template 2', src: '/studio/TMP/2.png' },
  { id: 'template-3', name: 'Template 3', src: '/studio/TMP/3.png' },
  { id: 'template-4', name: 'Template 4', src: '/studio/TMP/4.png' },
];

const DEFAULT_INSTANCE = 'demo';

function buildEmbedUrl({
  instanceId,
  theme,
  device,
  timestamp,
}: {
  instanceId: string;
  theme: 'light' | 'dark';
  device: 'desktop' | 'mobile';
  timestamp: number;
}) {
  const envBase = process.env.NEXT_PUBLIC_EMBED_BASE?.replace(/\/$/, '');
  const base = envBase || (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://c-keen-embed.vercel.app');
  const url = new URL(`${base}/e/${encodeURIComponent(instanceId)}`);
  url.searchParams.set('theme', theme);
  url.searchParams.set('device', device);
  url.searchParams.set('ts', String(timestamp));
  return url.toString();
}

export function StudioShell() {
  const [topOpen, setTopOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [instanceId] = useState(DEFAULT_INSTANCE);

  const [frames, setFrames] = useState<[{ id: 'frame-a'; src: string | null }, { id: 'frame-b'; src: string | null }]>(() => ([
    { id: 'frame-a', src: buildEmbedUrl({ instanceId, theme, device, timestamp: Date.now() }) },
    { id: 'frame-b', src: null },
  ]));
  const [activeFrame, setActiveFrame] = useState<0 | 1>(0);
  const [pendingFrame, setPendingFrame] = useState<0 | 1 | null>(null);
  const [isSkeletonVisible, setSkeletonVisible] = useState(false);

  const triggerRefresh = useCallback((opts?: { theme?: 'light' | 'dark'; device?: 'desktop' | 'mobile' }) => {
    const nextTheme = opts?.theme ?? theme;
    const nextDevice = opts?.device ?? device;
    const src = buildEmbedUrl({ instanceId, theme: nextTheme, device: nextDevice, timestamp: Date.now() });
    setSkeletonVisible(true);
    setFrames((prev) => {
      const incomingIndex: 0 | 1 = activeFrame === 0 ? 1 : 0;
      const nextFrames: typeof prev = [...prev];
      nextFrames[incomingIndex] = { ...nextFrames[incomingIndex], src };
      return nextFrames as typeof prev;
    });
    setPendingFrame(activeFrame === 0 ? 1 : 0);
  }, [activeFrame, device, instanceId, theme]);

  const handleThemeChange = useCallback((mode: 'light' | 'dark') => {
    if (mode === theme) return;
    setTheme(mode);
    triggerRefresh({ theme: mode });
  }, [theme, triggerRefresh]);

  const handleDeviceChange = useCallback((value: 'desktop' | 'mobile') => {
    if (device === value) return;
    setDevice(value);
    triggerRefresh({ device: value });
  }, [device, triggerRefresh]);

  const onTemplateSelected = useCallback((templateId: string) => {
    console.log('studio:template.change.request', templateId);
    triggerRefresh();
  }, [triggerRefresh]);

  return (
    <div
      className={styles.root}
      data-top={topOpen ? 'open' : 'closed'}
      data-left={leftOpen ? 'open' : 'closed'}
      data-right={rightOpen ? 'open' : 'closed'}
      data-preview="open"
    >
      <section className={clsx(styles.topDrawer, topOpen && styles.topDrawerOpen)}>
        <header className={styles.topDrawerHeader}>
          <button
            type="button"
            aria-expanded={topOpen}
            onClick={() => setTopOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
            <span className={styles.srOnly}>Toggle templates</span>
          </button>
          <span className={styles.topDrawerTitle}>Templates</span>
          <div />
        </header>
        <section className={styles.topDrawerContent} id="topdcontent" aria-hidden={!topOpen}>
          <div className={styles.templateGrid} role="list">
            {TEMPLATE_TILES.map((tile) => (
              <figure
                key={tile.id}
                role="listitem"
                className={styles.templateCard}
                tabIndex={0}
                onClick={() => onTemplateSelected(tile.id)}
                onKeyDown={(evt) => {
                  if (evt.key === 'Enter' || evt.key === ' ') {
                    evt.preventDefault();
                    onTemplateSelected(tile.id);
                  }
                }}
              >
                <img src={tile.src} alt={tile.name} />
                <figcaption className={styles.templateName}>{tile.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </section>

      <div className={styles.main} data-left={leftOpen ? 'open' : 'closed'} data-right={rightOpen ? 'open' : 'closed'}>
        <aside className={clsx(styles.drawer, !leftOpen && styles.drawerCollapsed)}>
          <header className={styles.drawerHeader}>
            <button
              type="button"
              aria-expanded={leftOpen}
              onClick={() => setLeftOpen((open) => !open)}
              className={styles.toggleButton}
            >
              ☰
            </button>
            {leftOpen && <span className={styles.badge}>Bob</span>}
          </header>
          <div className={styles.drawerBody}>
            <div className={styles.templateCard}>Editor placeholder</div>
          </div>
        </aside>

        <section className={styles.workspace}>
          <header className={styles.workspaceHeader}>
            <div className={styles.workspaceControls}>
              <button type="button" className={styles.chip}>Dropdown ▾</button>
            </div>
            <div className={styles.workspaceControls}>
              <div className={styles.segment} role="group" aria-label="Theme">
                <button
                  type="button"
                  data-active={theme === 'light'}
                  aria-pressed={theme === 'light'}
                  onClick={() => handleThemeChange('light')}
                >
                  ☀︎
                </button>
                <button
                  type="button"
                  data-active={theme === 'dark'}
                  aria-pressed={theme === 'dark'}
                  onClick={() => handleThemeChange('dark')}
                >
                  ☾
                </button>
              </div>
              <div className={styles.segment} role="group" aria-label="Device">
                <button
                  type="button"
                  data-active={device === 'desktop'}
                  aria-pressed={device === 'desktop'}
                  onClick={() => handleDeviceChange('desktop')}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  data-active={device === 'mobile'}
                  aria-pressed={device === 'mobile'}
                  onClick={() => handleDeviceChange('mobile')}
                >
                  Mobile
                </button>
              </div>
            </div>
            <div className={clsx(styles.workspaceControls)} style={{ justifyContent: 'flex-end' }}>
              <button className={styles.ctaButton} type="button">Preview</button>
            </div>
          </header>
          <div className={styles.preview}>
            <div className={styles.previewStack}>
            {frames.map((frame, index) => (
              (() => {
                const isActive = index === activeFrame;
                const isPending = pendingFrame === index;
                const isVisible = isPending || (!pendingFrame && isActive);
                return (
              <iframe
                key={frame.id}
                src={frame.src ?? undefined}
                className={clsx(
                  styles.previewFrame,
                  isVisible ? styles.previewFrameVisible : styles.previewFrameHidden
                )}
                style={{ zIndex: pendingFrame === index ? 2 : index === activeFrame ? 1 : 0 }}
                onLoad={() => {
                  if (pendingFrame === index) {
                    setActiveFrame(index as 0 | 1);
                    setPendingFrame(null);
                    setSkeletonVisible(false);
                  }
                }}
                title={index === activeFrame ? 'Workspace preview' : 'Workspace preview (incoming)'}
              />
                );
              })()
            ))}
            {isSkeletonVisible && <div className={styles.skeleton} aria-hidden="true" />}
          </div>
        </div>
        </section>

        <aside className={clsx(styles.drawer, !rightOpen && styles.drawerCollapsed)}>
          <header className={styles.drawerHeader}>
            <button
              type="button"
              aria-expanded={rightOpen}
              onClick={() => setRightOpen((open) => !open)}
              className={styles.toggleButton}
            >
              ☰
            </button>
            {rightOpen && <span className={styles.badge}>Assist</span>}
          </header>
          <div className={styles.drawerBody}>
            <div className={styles.templateCard}>Assistant placeholder</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
