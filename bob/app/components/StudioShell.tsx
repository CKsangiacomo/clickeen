'use client';

import { useCallback, useState } from 'react';
import clsx from 'clsx';
import styles from './StudioShell.module.css';

type ThemeMode = 'light' | 'dark';
type DeviceMode = 'desktop' | 'mobile';

type Frame = { id: 'frame-a' | 'frame-b'; src: string | null };

const TEMPLATE_PRESETS = [
  { id: 'template-1', name: 'Minimal Form', preview: 'linear-gradient(135deg, #0a62ff 0%, #7fb0ff 100%)' },
  { id: 'template-2', name: 'Playful Quiz', preview: 'linear-gradient(135deg, #ff6d6d 0%, #ffa07a 100%)' },
  { id: 'template-3', name: 'Pricing Comparison', preview: 'linear-gradient(135deg, #21c8a0 0%, #7fe7d0 100%)' },
  { id: 'template-4', name: 'Testimonials', preview: 'linear-gradient(135deg, #605dff 0%, #9f9bff 100%)' },
];

const DEFAULT_INSTANCE_ID = 'demo';

function buildEmbedUrl({
  instanceId,
  theme,
  device,
}: {
  instanceId: string;
  theme: ThemeMode;
  device: DeviceMode;
}) {
  // Prefer canonical env var from docs; fallback to previous name for compatibility
  const envBase = (process.env.NEXT_PUBLIC_VENICE_URL || process.env.NEXT_PUBLIC_EMBED_BASE)?.replace(/\/$/, '');
  const base =
    envBase ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : 'https://c-keen-embed.vercel.app');

  const url = new URL(`${base}/e/${encodeURIComponent(instanceId)}`);
  url.searchParams.set('theme', theme);
  url.searchParams.set('device', device);
  url.searchParams.set('ts', String(Date.now()));
  return url.toString();
}

export default function StudioShell() {
  const [topOpen, setTopOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [instanceId] = useState(DEFAULT_INSTANCE_ID);

  const initialSrc = buildEmbedUrl({ instanceId: DEFAULT_INSTANCE_ID, theme: 'light', device: 'desktop' });
  const [frames, setFrames] = useState<Frame[]>([
    { id: 'frame-a', src: initialSrc },
    { id: 'frame-b', src: null },
  ]);
  const [activeFrame, setActiveFrame] = useState<0 | 1>(0);
  const [pendingFrame, setPendingFrame] = useState<0 | 1 | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const triggerRefresh = useCallback(
    (next?: { theme?: ThemeMode; device?: DeviceMode }) => {
      const nextTheme = next?.theme ?? theme;
      const nextDevice = next?.device ?? device;
      const src = buildEmbedUrl({ instanceId, theme: nextTheme, device: nextDevice });

      setShowSkeleton(true);
      setFrames((prev) => {
        const incomingIndex: 0 | 1 = activeFrame === 0 ? 1 : 0;
        const nextFrames: Frame[] = [...prev];
        nextFrames[incomingIndex] = { ...nextFrames[incomingIndex], src };
        return nextFrames;
      });
      setPendingFrame(activeFrame === 0 ? 1 : 0);
    },
    [activeFrame, device, instanceId, theme],
  );

  const handleThemeChange = useCallback(
    (mode: ThemeMode) => {
      if (mode === theme) return;
      setTheme(mode);
      triggerRefresh({ theme: mode });
    },
    [theme, triggerRefresh],
  );

  const handleDeviceChange = useCallback(
    (mode: DeviceMode) => {
      if (mode === device) return;
      setDevice(mode);
      triggerRefresh({ device: mode });
    },
    [device, triggerRefresh],
  );

  const handleTemplateSelect = useCallback(
    (templateId: string) => {
      console.info('studio:template.change.request', templateId);
      triggerRefresh();
    },
    [triggerRefresh],
  );

  return (
    <div
      className={styles.root}
      data-top={topOpen ? 'open' : 'closed'}
      data-left={leftOpen ? 'open' : 'closed'}
      data-right={rightOpen ? 'open' : 'closed'}
    >
      <section className={clsx(styles.topDrawer, topOpen && styles.topDrawerOpen)}>
        <header className={styles.topDrawerHeader}>
          <button type="button" aria-expanded={topOpen} onClick={() => setTopOpen((open) => !open)}>
            <span aria-hidden="true">☰</span>
            <span className={styles.srOnly}>Toggle templates</span>
          </button>
          <span className={styles.topDrawerTitle}>Templates</span>
          <div />
        </header>
        <section className={styles.topDrawerContent} aria-hidden={!topOpen}>
          <div className={styles.templateGrid} role="list">
            {TEMPLATE_PRESETS.map((tile) => (
              <button
                key={tile.id}
                type="button"
                className={styles.templateCard}
                onClick={() => handleTemplateSelect(tile.id)}
                role="listitem"
              >
                <span className={styles.templatePreview} style={{ background: tile.preview }} aria-hidden="true" />
                <span className={styles.templateName}>{tile.name}</span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <div className={styles.main} data-left={leftOpen ? 'open' : 'closed'} data-right={rightOpen ? 'open' : 'closed'}>
        <aside className={clsx(styles.drawer, !leftOpen && styles.drawerCollapsed)}>
          <header className={styles.drawerHeader}>
            <button type="button" aria-expanded={leftOpen} onClick={() => setLeftOpen((open) => !open)}>
              ☰
            </button>
            {leftOpen && <span className={styles.badge}>Editor</span>}
          </header>
          <div className={styles.drawerBody}>
            <div className={styles.placeholderCard}>Editor controls coming soon.</div>
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
            <div className={styles.workspaceControls} data-align="right">
              <button className={styles.ctaButton} type="button">
                Preview
              </button>
            </div>
          </header>

          <div className={styles.previewArea}>
            <div className={styles.previewStack}>
              {frames.map((frame, index) => {
                const isActive = index === activeFrame;
                const isPending = pendingFrame === index;
                const isVisible = isPending || (!pendingFrame && isActive);
                return (
                  <iframe
                    key={frame.id}
                    src={frame.src ?? undefined}
                    className={clsx(styles.previewFrame, isVisible ? styles.previewFrameVisible : styles.previewFrameHidden)}
                    style={{ zIndex: isPending ? 2 : isActive ? 1 : 0 }}
                    onLoad={() => {
                      if (pendingFrame === index) {
                        setActiveFrame(index as 0 | 1);
                        setPendingFrame(null);
                        setShowSkeleton(false);
                      }
                    }}
                    title={isActive ? 'Workspace preview' : 'Workspace preview (incoming)'}
                  />
                );
              })}
              {showSkeleton && <div className={styles.skeleton} aria-hidden="true" />}
            </div>
          </div>
        </section>

        <aside className={clsx(styles.drawer, !rightOpen && styles.drawerCollapsed)}>
          <header className={styles.drawerHeader}>
            <button type="button" aria-expanded={rightOpen} onClick={() => setRightOpen((open) => !open)}>
              ☰
            </button>
            {rightOpen && <span className={styles.badge}>Assist</span>}
          </header>
          <div className={styles.drawerBody}>
            <div className={styles.placeholderCard}>Assist surface coming soon.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
