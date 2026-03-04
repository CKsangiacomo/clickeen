'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import openEditorLifecycleContractJson from '../../tooling/contracts/open-editor-lifecycle.v1.json';
import { getCompiledWidget, normalizeCompiledWidgetType } from './compiled-widget-cache';
import { getAccountInstance, prefetchAccountInstance } from './account-instance-cache';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type BuilderDomainProps = {
  initialPublicId?: string;
  initialAccountId?: string;
};

type OpenEditorLifecycleContract = {
  events: {
    openEditor: string;
    sessionReady: string;
    ack: string;
    applied: string;
    failed: string;
  };
  timing: {
    ackRetryMs: number;
    maxAckAttempts: number;
    timeoutMs: number;
  };
};

const OPEN_EDITOR_LIFECYCLE: OpenEditorLifecycleContract = openEditorLifecycleContractJson;

type BobReadyMessage = {
  type: typeof OPEN_EDITOR_LIFECYCLE.events.sessionReady;
  sessionId?: string | null;
  bootMode?: 'message' | 'url' | null;
};

type BobSwitchMessage = {
  type: 'bob:request-instance-switch';
  publicId?: string | null;
};

type BobOpenEditorAckMessage = {
  type: typeof OPEN_EDITOR_LIFECYCLE.events.ack;
  requestId?: string | null;
  sessionId?: string | null;
};

type BobOpenEditorAppliedMessage = {
  type: typeof OPEN_EDITOR_LIFECYCLE.events.applied;
  requestId?: string | null;
  sessionId?: string | null;
};

type BobOpenEditorFailedMessage = {
  type: typeof OPEN_EDITOR_LIFECYCLE.events.failed;
  requestId?: string | null;
  sessionId?: string | null;
  reasonKey?: string | null;
  message?: string | null;
};

type BobAssetEntitlementDeniedMessage = {
  type: 'bob:asset-entitlement-denied';
  reasonKey?: string | null;
};

type BobOpenEditorMessage = {
  type: typeof OPEN_EDITOR_LIFECYCLE.events.openEditor;
  requestId: string;
  sessionId: string;
  subjectMode: 'account';
  publicId: string;
  accountId: string;
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

function resolveBobBaseUrl(): string {
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
  accountId: string;
  widgetType?: string;
}): string {
  const search = new URLSearchParams({
    accountId: args.accountId,
    publicId: args.publicId,
    subject: 'account',
  });
  if (args.widgetType) search.set('widgetType', args.widgetType);
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

export function BuilderDomain({ initialPublicId = '', initialAccountId = '' }: BuilderDomainProps) {
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
  const accountId = useMemo(() => {
    const fromQuery = String(searchParams.get('accountId') || '').trim();
    if (fromQuery) return fromQuery;
    const fromProp = String(initialAccountId || '').trim();
    if (fromProp) return fromProp;
    return context.accountId;
  }, [context.accountId, initialAccountId, searchParams]);
  const widgetTypeHint = useMemo(() => normalizeCompiledWidgetType(searchParams.get('widgetType')), [searchParams]);
  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(), []);
  const searchQuery = searchParams.toString();
  const currentUrl = useMemo(() => (searchQuery ? `${pathname}?${searchQuery}` : pathname), [pathname, searchQuery]);
  const pathPublicId = useMemo(() => decodeBuilderPathPublicId(pathname), [pathname]);

  const bobSrc = useMemo(() => {
    if (!accountId) return '';
    const url = new URL('/bob', `${bobBaseUrl}/`);
    url.searchParams.set('boot', 'message');
    url.searchParams.set('accountId', accountId);
    url.searchParams.set('subject', 'account');
    url.searchParams.set('surface', 'roma');
    return url.toString();
  }, [accountId, bobBaseUrl]);

  useEffect(() => {
    if (!accountId || !activePublicId) return;
    const nextRoute = buildRomaBuilderRoute({
      publicId: activePublicId,
      accountId,
      widgetType: widgetTypeHint,
    });
    if (nextRoute === currentUrl) return;
    router.replace(nextRoute, { scroll: false });
  }, [accountId, activePublicId, currentUrl, router, widgetTypeHint]);

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
    if (!accountId || !activePublicId) return;
    void prefetchAccountInstance(accountId, activePublicId);
  }, [accountId, activePublicId]);

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
            if (attempts >= OPEN_EDITOR_LIFECYCLE.timing.maxAckAttempts) {
              fail(new Error('coreui.errors.builder.open.ackTimeout'));
              return;
            }
            retryTimer = window.setTimeout(send, OPEN_EDITOR_LIFECYCLE.timing.ackRetryMs);
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

          if (data.type === OPEN_EDITOR_LIFECYCLE.events.ack) {
            acknowledged = true;
            if (retryTimer != null) {
              window.clearTimeout(retryTimer);
              retryTimer = null;
            }
            return;
          }

          if (data.type === OPEN_EDITOR_LIFECYCLE.events.applied) {
            succeed();
            return;
          }

          if (data.type === OPEN_EDITOR_LIFECYCLE.events.failed) {
            const failed = data as BobOpenEditorFailedMessage;
            const reason =
              (typeof failed.reasonKey === 'string' && failed.reasonKey.trim()) ||
              (typeof failed.message === 'string' && failed.message.trim()) ||
              'coreui.errors.builder.open.failed';
            fail(new Error(reason));
          }
        };

        window.addEventListener('message', onMessage);
        timeoutTimer = window.setTimeout(() => {
          fail(new Error('coreui.errors.builder.open.timeout'));
        }, OPEN_EDITOR_LIFECYCLE.timing.timeoutMs);

        send();
      });
    },
    [bobBaseUrl],
  );

  const openActiveInstanceInBob = useCallback(async () => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !accountId || !activePublicId) return;

    const openSeq = ++openDispatchSeqRef.current;
    setOpenError(null);

    try {
      const compileFetchStartedAt = performance.now();
      const hintedCompiledPromise = widgetTypeHint ? getCompiledWidget(widgetTypeHint) : null;
      const instanceResult = await getAccountInstance({
        accountId,
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
        type: OPEN_EDITOR_LIFECYCLE.events.openEditor,
        subjectMode: 'account',
        publicId: resolvedPublicId,
        accountId,
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
  }, [accountId, activePublicId, postOpenEditorAndWait, widgetTypeHint]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== bobBaseUrl) return;
      const source = iframeRef.current?.contentWindow;
      if (!source || event.source !== source) return;
      const data = event.data as BobReadyMessage | BobSwitchMessage | BobAssetEntitlementDeniedMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === OPEN_EDITOR_LIFECYCLE.events.sessionReady) {
        const ready = data as BobReadyMessage;
        const sessionId = typeof ready.sessionId === 'string' ? ready.sessionId.trim() : '';
        if (!sessionId) {
          setOpenError('coreui.errors.builder.open.sessionMissing');
          return;
        }
        if (ready.bootMode && ready.bootMode !== 'message') {
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
        const switchMessage = data as BobSwitchMessage;
        const nextPublicId = String(switchMessage.publicId || '').trim();
        if (!nextPublicId) return;
        if (nextPublicId === activePublicId) return;
        setActivePublicId(nextPublicId);
        return;
      }
      if (data.type === 'bob:asset-entitlement-denied') {
        const denial = data as BobAssetEntitlementDeniedMessage;
        const reasonKey = String(denial.reasonKey || '').trim();
        const search = new URLSearchParams();
        if (accountId) search.set('accountId', accountId);
        if (reasonKey) search.set('reasonKey', reasonKey);
        const nextRoute = search.size ? `/assets?${search.toString()}` : '/assets';
        router.push(nextRoute, { scroll: false });
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [accountId, activePublicId, bobBaseUrl, openActiveInstanceInBob, router]);

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

  const hasAccountId = Boolean(accountId);
  const waitingForAccountContext = !hasAccountId && me.loading;

  if (!hasAccountId) {
    if (waitingForAccountContext) {
      return (
        <div className="rd-canvas-module">
          <p className="body-m">Loading builder context…</p>
        </div>
      );
    }

    return (
      <div className="rd-canvas-module">
        <p className="body-m">No account context found for Builder.</p>
        <div className="rd-canvas-module__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/settings">
            <span className="diet-btn-txt__label body-m">Open settings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!activePublicId) {
    return (
      <div className="rd-canvas-module">
        <p className="body-m">No instance selected for Builder.</p>
        <p className="body-m">Select a concrete instance from Widgets or Templates and open Edit.</p>
        <div className="rd-canvas-module__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/widgets">
            <span className="diet-btn-txt__label body-m">Open widgets</span>
          </Link>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/templates">
            <span className="diet-btn-txt__label body-m">Open templates</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {openError ? (
        <div className="rd-canvas-module">
          <p className="body-m">Failed to open instance: {openError}</p>
          <div className="rd-canvas-module__actions">
            <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void openActiveInstanceInBob()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        </div>
      ) : null}
      <iframe ref={iframeRef} src={bobSrc || 'about:blank'} className="roma-builder__iframe" title="Bob Builder" />
    </>
  );
}
