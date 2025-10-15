"use client";

import { useEffect, useRef, useState } from 'react';

interface PreviewProps {
  publicId: string;
  theme: 'light' | 'dark';
  device: 'desktop' | 'mobile';
  swapSignal?: number; // increment to request swap
  registerPatchSender?: (sender: (payload: any) => void) => void;
}

export function Preview({ publicId, theme, device, swapSignal = 0, registerPatchSender }: PreviewProps) {
  const [activeFrame, setActiveFrame] = useState<0 | 1>(0);
  const iframeARef = useRef<HTMLIFrameElement | null>(null);
  const iframeBRef = useRef<HTMLIFrameElement | null>(null);
  const [ts, setTs] = useState<number>(() => Date.now());

  const buildSrc = () => `/api/preview/e/${encodeURIComponent(publicId)}?preview=1&theme=${theme}&device=${device}&ts=${ts}`;

  const getActiveWindow = () => (activeFrame === 0 ? iframeARef.current?.contentWindow : iframeBRef.current?.contentWindow);

  // expose patch sender
  useEffect(() => {
    if (!registerPatchSender) return;
    const sender = (payload: any) => {
      try {
        const win = getActiveWindow();
        if (!win) return;
        win.postMessage(payload, '*');
      } catch {}
    };
    registerPatchSender(sender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFrame]);

  // when swapSignal changes, swap buffers by reloading hidden frame
  useEffect(() => {
    const hiddenRef = activeFrame === 0 ? iframeBRef : iframeARef;
    const handler = () => {
      setActiveFrame((prev) => (prev === 0 ? 1 : 0));
      hiddenRef.current?.removeEventListener('load', handler as any);
    };
    if (hiddenRef.current) {
      try {
        hiddenRef.current.removeEventListener('load', handler as any);
      } catch {}
      setTs(Date.now());
      hiddenRef.current.addEventListener('load', handler as any);
      hiddenRef.current.src = buildSrc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapSignal]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        ref={iframeARef}
        title="Widget Preview A"
        src={buildSrc()}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: activeFrame === 0 ? 1 : 0, transition: 'opacity 200ms ease' }}
      />
      <iframe
        ref={iframeBRef}
        title="Widget Preview B"
        src={buildSrc()}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, opacity: activeFrame === 1 ? 1 : 0, transition: 'opacity 200ms ease' }}
      />
    </div>
  );
}

