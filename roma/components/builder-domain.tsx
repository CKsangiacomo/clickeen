'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCompiledWidget, normalizeCompiledWidgetType } from './compiled-widget-cache';
import { getWorkspaceInstance, prefetchWorkspaceInstance } from './workspace-instance-cache';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type BuilderDomainProps = {
  initialPublicId?: string;
  initialWorkspaceId?: string;
};

type BobReadyMessage = {
  type: 'bob:session-ready';
  sessionId?: string | null;
  bootMode?: 'message' | 'url' | null;
};

type BobSwitchMessage = {
  type: 'bob:request-instance-switch';
  publicId?: string | null;
};

type BobOpenEditorAckMessage = {
  type: 'bob:open-editor-ack';
  requestId?: string | null;
  sessionId?: string | null;
};

type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId?: string | null;
  sessionId?: string | null;
};

type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId?: string | null;
  sessionId?: string | null;
  reasonKey?: string | null;
  message?: string | null;
};

type BobOpenEditorMessage = {
  type: 'ck:open-editor';
  requestId: string;
  sessionId: string;
  subjectMode: 'workspace';
  publicId: string;
  workspaceId: string;
  ownerAccountId?: string;
  label: string;
  widgetname: string;
  compiled: unknown;
  instanceData: Record<string, unknown>;
  localization?: unknown;
  policy?: unknown;
  enforcement?: unknown;
};

type BobOpenEditorPayload = Omit<BobOpenEditorMessage, 'requestId' | 'sessionId'>;

function resolveBobBaseUrl(searchParams: { get(name: string): string | null }): string {
  const fromQuery = String(searchParams.get('bob') || '').trim();
  if (fromQuery) {
    try {
      return new URL(fromQuery).origin;
    } catch {
      // Ignore invalid override and fall back.
    }
  }

  // In local/dev, align Roma Builder with DevStudio's Bob default.
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3000';
  }

  const fromEnv = String(process.env.NEXT_PUBLIC_BOB_URL || '').trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      // Ignore invalid env and fall back.
    }
  }

  // Keep server/client rendering deterministic to avoid iframe src hydration mismatch.
  return 'https://bob.dev.clickeen.com';
}

function buildRomaBuilderRoute(args: {
  publicId: string;
  workspaceId: string;
  accountId: string;
  widgetType?: string;
  bobOverride: string;
}): string {
  const search = new URLSearchParams({
    workspaceId: args.workspaceId,
    publicId: args.publicId,
    subject: 'workspace',
  });
  if (args.accountId) search.set('accountId', args.accountId);
  if (args.widgetType) search.set('widgetType', args.widgetType);
  if (args.bobOverride) search.set('bob', args.bobOverride);
  return `/builder/${encodeURIComponent(args.publicId)}?${search.toString()}`;
}

function decodeBuilderPathPublicId(pathname: string): string {
  const match = /^\/builder\/([^/?#]+)$/.exec(pathname);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function BuilderDomain({ initialPublicId = '', initialWorkspaceId = '' }: BuilderDomainProps) {
  const me = useRomaMe();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bobReadyRef = useRef(false);
  const bobSessionIdRef = useRef('');
  const openDispatchSeqRef = useRef(0);
  const [activePublicId, setActivePublicId] = useState(() => {
    const fromPath = decodeBuilderPathPublicId(pathname);
    if (fromPath) return fromPath;
    return String(initialPublicId || '').trim();
  });
  const [openError, setOpenError] = useState<string | null>(null);

  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const workspaceId = useMemo(() => {
    const fromQuery = String(searchParams.get('workspaceId') || '').trim();
    if (fromQuery) return fromQuery;
    const fromProp = String(initialWorkspaceId || '').trim();
    if (fromProp) return fromProp;
    return context.workspaceId;
  }, [context.workspaceId, initialWorkspaceId, searchParams]);
  const accountId = context.accountId;
  const bobOverride = useMemo(() => String(searchParams.get('bob') || '').trim(), [searchParams]);
  const widgetTypeHint = useMemo(() => normalizeCompiledWidgetType(searchParams.get('widgetType')), [searchParams]);
  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(searchParams), [searchParams]);
  const searchQuery = searchParams.toString();
  const currentUrl = useMemo(() => (searchQuery ? `${pathname}?${searchQuery}` : pathname), [pathname, searchQuery]);
  const pathPublicId = useMemo(() => decodeBuilderPathPublicId(pathname), [pathname]);

  const bobSrc = useMemo(() => {
    if (!workspaceId) return '';
    const url = new URL('/bob', `${bobBaseUrl}/`);
    url.searchParams.set('boot', 'message');
    url.searchParams.set('workspaceId', workspaceId);
    url.searchParams.set('subject', 'workspace');
    return url.toString();
  }, [bobBaseUrl, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !activePublicId) return;
    const nextRoute = buildRomaBuilderRoute({
      publicId: activePublicId,
      workspaceId,
      accountId,
      widgetType: widgetTypeHint,
      bobOverride,
    });
    if (nextRoute === currentUrl) return;
    router.replace(nextRoute, { scroll: false });
  }, [accountId, activePublicId, bobOverride, currentUrl, router, widgetTypeHint, workspaceId]);

  useEffect(() => {
    const queryPublicId = String(searchParams.get('publicId') || '').trim();
    const resolved = pathPublicId || queryPublicId || String(initialPublicId || '').trim();
    if (!resolved) {
      if (activePublicId) setActivePublicId('');
      return;
    }
    if (resolved === activePublicId) return;
    setActivePublicId(resolved);
  }, [activePublicId, initialPublicId, pathPublicId, searchParams]);

  useEffect(() => {
    if (!workspaceId || !activePublicId) return;
    void prefetchWorkspaceInstance(workspaceId, activePublicId);
  }, [activePublicId, workspaceId]);

  const postOpenEditorAndWait = useCallback(
    (
      args: {
        targetWindow: Window;
        message: BobOpenEditorPayload;
        openSeq: number;
      },
    ): Promise<void> => {
      const sessionId = bobSessionIdRef.current.trim();
      if (!sessionId) {
        return Promise.reject(new Error('coreui.errors.builder.open.sessionMissing'));
      }
      const requestId = crypto.randomUUID();
      const payload: BobOpenEditorMessage = {
        ...args.message,
        requestId,
        sessionId,
      };

      return new Promise((resolve, reject) => {
        let settled = false;
        let acknowledged = false;
        let attempts = 0;
        let retryTimer: number | null = null;
        let timeoutTimer: number | null = null;

        const cleanup = () => {
          if (retryTimer != null) window.clearTimeout(retryTimer);
          if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
          window.removeEventListener('message', onMessage);
        };

        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };

        const succeed = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const send = () => {
          if (settled) return;
          if (args.openSeq !== openDispatchSeqRef.current) {
            fail(new Error('coreui.errors.builder.open.stale'));
            return;
          }

          attempts += 1;
          args.targetWindow.postMessage(payload, bobBaseUrl);

          if (!acknowledged) {
            if (attempts >= 6) {
              fail(new Error('coreui.errors.builder.open.ackTimeout'));
              return;
            }
            retryTimer = window.setTimeout(send, 250);
          }
        };

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== bobBaseUrl) return;
          const source = iframeRef.current?.contentWindow;
          if (!source || event.source !== source) return;
          const data = event.data as
            | BobOpenEditorAckMessage
            | BobOpenEditorAppliedMessage
            | BobOpenEditorFailedMessage
            | null;
          if (!data || typeof data !== 'object') return;
          const dataRequestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
          const dataSessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
          if (dataRequestId !== requestId || dataSessionId !== sessionId) return;

          if (data.type === 'bob:open-editor-ack') {
            acknowledged = true;
            if (retryTimer != null) {
              window.clearTimeout(retryTimer);
              retryTimer = null;
            }
            return;
          }

          if (data.type === 'bob:open-editor-applied') {
            succeed();
            return;
          }

          if (data.type === 'bob:open-editor-failed') {
            const reason =
              (typeof data.reasonKey === 'string' && data.reasonKey.trim()) ||
              (typeof data.message === 'string' && data.message.trim()) ||
              'coreui.errors.builder.open.failed';
            fail(new Error(reason));
          }
        };

        window.addEventListener('message', onMessage);
        timeoutTimer = window.setTimeout(() => {
          fail(new Error('coreui.errors.builder.open.timeout'));
        }, 7000);

        send();
      });
    },
    [bobBaseUrl],
  );

  const openActiveInstanceInBob = useCallback(async () => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !workspaceId || !activePublicId) return;

    const openSeq = ++openDispatchSeqRef.current;
    setOpenError(null);

    try {
      const compileFetchStartedAt = performance.now();
      const hintedCompiledPromise = widgetTypeHint ? getCompiledWidget(widgetTypeHint) : null;
      const instanceResult = await getWorkspaceInstance({
        workspaceId,
        publicId: activePublicId,
      });
      const instance = instanceResult.payload;

      const widgetType = typeof instance.widgetType === 'string' ? instance.widgetType.trim() : '';
      if (!widgetType) throw new Error('coreui.errors.instance.widgetMissing');

      const normalizedInstanceWidgetType = normalizeCompiledWidgetType(widgetType);
      const compiledResult =
        hintedCompiledPromise && normalizedInstanceWidgetType === widgetTypeHint
          ? await hintedCompiledPromise
          : await getCompiledWidget(widgetType);
      const compiled = compiledResult.payload;

      if (openSeq !== openDispatchSeqRef.current) return;

      const resolvedPublicId =
        typeof instance.publicId === 'string' && instance.publicId.trim() ? instance.publicId.trim() : activePublicId;
      const label =
        typeof instance.displayName === 'string' && instance.displayName.trim()
          ? instance.displayName.trim()
          : resolvedPublicId;
      if (!instance.config || typeof instance.config !== 'object' || Array.isArray(instance.config)) {
        throw new Error('coreui.errors.instance.config.invalid');
      }
      const config = instance.config as Record<string, unknown>;
      const ownerAccountId =
        typeof instance.ownerAccountId === 'string' && instance.ownerAccountId.trim() ? instance.ownerAccountId.trim() : '';
      if (!ownerAccountId) {
        throw new Error('coreui.errors.instance.ownerAccountMissing');
      }

      const message: BobOpenEditorPayload = {
        type: 'ck:open-editor',
        subjectMode: 'workspace',
        publicId: resolvedPublicId,
        workspaceId,
        ownerAccountId,
        label,
        widgetname: widgetType,
        compiled,
        instanceData: config,
        localization: instance.localization,
        policy: instance.policy,
        enforcement: instance.enforcement,
      };
      await postOpenEditorAndWait({
        targetWindow,
        message,
        openSeq,
      });
      if (openSeq !== openDispatchSeqRef.current) return;
      if (process.env.NODE_ENV === 'development') {
        console.log('[RomaBuilder] instance open timing', {
          publicId: resolvedPublicId,
          widgetType: normalizedInstanceWidgetType,
          instanceSource: instanceResult.source,
          compiledSource: compiledResult.source,
          elapsedMs: Math.round(performance.now() - compileFetchStartedAt),
        });
      }
      setOpenError(null);
    } catch (error) {
      if (openSeq !== openDispatchSeqRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setOpenError(message);
    }
  }, [accountId, activePublicId, postOpenEditorAndWait, widgetTypeHint, workspaceId]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== bobBaseUrl) return;
      const source = iframeRef.current?.contentWindow;
      if (!source || event.source !== source) return;
      const data = event.data as BobReadyMessage | BobSwitchMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'bob:session-ready') {
        const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
        if (!sessionId) {
          setOpenError('coreui.errors.builder.open.sessionMissing');
          return;
        }
        if (data.bootMode && data.bootMode !== 'message') {
          setOpenError('coreui.errors.builder.open.bootModeInvalid');
          return;
        }
        bobSessionIdRef.current = sessionId;
        bobReadyRef.current = true;
        if (activePublicId) {
          void openActiveInstanceInBob();
        }
        return;
      }
      if (data.type === 'bob:request-instance-switch') {
        const nextPublicId = String(data.publicId || '').trim();
        if (!nextPublicId) return;
        if (nextPublicId === activePublicId) return;
        setActivePublicId(nextPublicId);
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [activePublicId, bobBaseUrl, openActiveInstanceInBob]);

  useEffect(() => {
    bobReadyRef.current = false;
    bobSessionIdRef.current = '';
    openDispatchSeqRef.current += 1;
    setOpenError(null);
  }, [bobSrc]);

  useEffect(() => {
    if (!activePublicId) {
      setOpenError(null);
      return;
    }
    if (!bobReadyRef.current) return;
    void openActiveInstanceInBob();
  }, [activePublicId, openActiveInstanceInBob]);

  const hasWorkspaceId = Boolean(workspaceId);
  const waitingForWorkspaceContext = !hasWorkspaceId && me.loading;

  if (!hasWorkspaceId) {
    if (waitingForWorkspaceContext) {
      return (
        <div className="roma-module-surface">
          <p>Loading builder context…</p>
        </div>
      );
    }

    return (
      <div className="roma-module-surface">
        <p>No workspace context found for Builder.</p>
        <div className="roma-module-surface__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/settings">
            <span className="diet-btn-txt__label">Open settings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!activePublicId) {
    return (
      <div className="roma-module-surface">
        <p>No instance selected for Builder.</p>
        <p>Select a concrete instance from Widgets or Templates and open Edit.</p>
        <div className="roma-module-surface__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/widgets">
            <span className="diet-btn-txt__label">Open widgets</span>
          </Link>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/templates">
            <span className="diet-btn-txt__label">Open templates</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {openError ? (
        <div className="roma-module-surface">
          <p>Failed to open instance: {openError}</p>
          <div className="roma-module-surface__actions">
            <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void openActiveInstanceInBob()}>
              <span className="diet-btn-txt__label">Retry</span>
            </button>
          </div>
        </div>
      ) : null}
      <iframe ref={iframeRef} src={bobSrc || 'about:blank'} className="roma-builder__iframe" title="Bob Builder" />
    </>
  );
}
