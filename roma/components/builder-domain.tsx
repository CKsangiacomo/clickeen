'use client';

import { parseAccountL10nPolicyStrict } from '@clickeen/ck-contracts';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRomaAccountApi } from './account-api';
import { getCompiledWidget } from './compiled-widget-cache';
import { useRomaAccountContext } from './roma-account-context';

type BuilderDomainProps = {
  initialInstanceId?: string;
};

const OPEN_EDITOR_TIMEOUT_MS = 7000;

type BobReadyMessage = {
  type: 'bob:session-ready';
};

type BobSwitchMessage = {
  type: 'bob:request-instance-switch';
  instanceId?: string | null;
};

type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId?: string | null;
};

type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId?: string | null;
  reasonKey?: string | null;
  message?: string | null;
};

type BobAccountCommand = 'update-instance' | AccountAssetHostCommand | 'load-translations' | 'run-copilot' | 'attach-ai-outcome';

type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId?: string | null;
  command?: BobAccountCommand | null;
  instanceId?: string | null;
  headers?: Record<string, string> | null;
  body?: unknown;
};

type HostAccountCommandResultMessage = {
  type: 'host:account-command-result';
  requestId: string;
  command: BobAccountCommand;
  instanceId?: string;
  ok: boolean;
  status: number;
  payload?: unknown;
  message?: string;
};

type BobOpenEditorMessage = {
  type: 'ck:open-editor';
  requestId: string;
  instanceId: string;
  baseLocale: string;
  label: string;
  widgetname: string;
  compiled: unknown;
  instanceData: Record<string, unknown>;
  meta?: Record<string, unknown> | null;
  policy?: unknown;
  copilot?: unknown;
};

type BobOpenEditorPayload = Omit<BobOpenEditorMessage, 'requestId'>;

type BuilderOpenResponse = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
  meta?: Record<string, unknown> | null;
  copilot?: unknown;
};

const BUILDER_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to open Builder.',
  'coreui.errors.auth.contextUnavailable': 'Builder is unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to open this widget in Builder.',
  'coreui.errors.network.timeout': 'Builder took too long to respond. Please try again.',
  'coreui.errors.misconfigured': 'Builder is temporarily unavailable. Please try again.',
  'coreui.errors.payload.invalid': 'Builder received an invalid response. Please try again.',
  'coreui.errors.instance.notFound': 'This widget could not be found. It may have been deleted.',
  'coreui.errors.instance.widgetMissing': 'This widget is missing required data and cannot open right now.',
  'coreui.errors.instance.config.invalid': 'This widget has invalid saved data and cannot open right now.',
  'coreui.errors.builder.open.stale': 'Builder refreshed while opening this widget. Please retry.',
  'coreui.errors.builder.open.timeout': 'Builder took too long to respond. Please retry.',
  'coreui.errors.builder.open.failed': 'Builder could not open this widget. Please try again.',
};

function resolveBuilderErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = BUILDER_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.') || normalized.startsWith('roma.')) {
    return fallback;
  }
  return normalized;
}

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

function buildRomaBuilderRoute(args: { instanceId: string }): string {
  return `/builder/${encodeURIComponent(args.instanceId)}`;
}

function resolveBobAccountCommandRequest(args: {
  command: BobAccountCommand;
  instanceId?: string;
}): { method: 'GET' | 'PUT' | 'POST' | 'DELETE'; path: string } | null {
  const instanceId = String(args.instanceId || '').trim();

  switch (args.command) {
    case 'update-instance':
      if (!instanceId) return null;
      return {
        method: 'PUT',
        path: `/api/account/instance/${encodeURIComponent(instanceId)}`,
      };
    case 'list-assets':
      return {
        method: 'GET',
        path: '/api/account/assets',
      };
    case 'resolve-assets':
      return {
        method: 'POST',
        path: '/api/account/assets/resolve',
      };
    case 'upload-asset':
      return {
        method: 'POST',
        path: '/api/account/assets/upload',
      };
    case 'load-translations':
      if (!instanceId) return null;
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations`,
      };
    case 'run-copilot':
      if (!instanceId) return null;
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/copilot`,
      };
    case 'attach-ai-outcome':
      if (!instanceId) return null;
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/copilot/outcome`,
      };
    default:
      return null;
  }
}

function isAccountAssetCommand(command: BobAccountCommand): boolean {
  return command === 'list-assets' || command === 'resolve-assets' || command === 'upload-asset';
}

function decodeBuilderPathInstanceId(pathname: string): string {
  const match = /^\/builder\/([^/?#]+)$/.exec(pathname);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function BuilderDomain({ initialInstanceId = '' }: BuilderDomainProps) {
  const { activeAccount, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const router = useRouter();
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bobReadyRef = useRef(false);
  const openDispatchSeqRef = useRef(0);
  const [activeInstanceId, setActiveInstanceId] = useState(() => {
    const fromPath = decodeBuilderPathInstanceId(pathname);
    if (fromPath) return fromPath;
    return String(initialInstanceId || '').trim();
  });
  const [openError, setOpenError] = useState<string | null>(null);

  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(), []);
  const currentUrl = pathname;
  const pathInstanceId = useMemo(() => decodeBuilderPathInstanceId(pathname), [pathname]);

  // Active account authoring truth: Roma hosts one current-account Builder session and opens Bob with one explicit payload.
  const bobSrc = useMemo(() => {
    return new URL('/bob', `${bobBaseUrl}/`).toString();
  }, [bobBaseUrl]);

  useEffect(() => {
    if (!activeInstanceId) return;
    const nextRoute = buildRomaBuilderRoute({
      instanceId: activeInstanceId,
    });
    if (nextRoute === currentUrl) return;
    router.replace(nextRoute, { scroll: false });
  }, [activeInstanceId, currentUrl, router]);

  useEffect(() => {
    const resolved = pathInstanceId || String(initialInstanceId || '').trim();
    if (!resolved) {
      if (activeInstanceId) setActiveInstanceId('');
      return;
    }
    if (resolved === activeInstanceId) return;
    setActiveInstanceId(resolved);
  }, [activeInstanceId, initialInstanceId, pathInstanceId]);

  const runBobAccountCommand = useCallback(
    async (args: { source: Window; requestId: string; command: BobAccountCommand; instanceId?: string; headers?: Record<string, string>; body?: unknown }) => {
      const route = resolveBobAccountCommandRequest({
        command: args.command,
        instanceId: args.instanceId,
      });
      const reply = (payload: Omit<HostAccountCommandResultMessage, 'type'>) => {
        const message: HostAccountCommandResultMessage = {
          type: 'host:account-command-result',
          ...payload,
        };
        args.source.postMessage(message, bobBaseUrl);
      };

      if (!route) {
        reply({
          requestId: args.requestId,
          command: args.command,
          ...(args.instanceId ? { instanceId: args.instanceId } : {}),
          ok: false,
          status: 422,
          message: 'coreui.errors.builder.command.invalid',
        });
        return;
      }

      try {
        const init: RequestInit = {
          method: route.method,
        };
        const headers = new Headers(accountApi.buildHeaders());
        if (args.headers && typeof args.headers === 'object') {
          for (const [key, value] of Object.entries(args.headers)) {
            const normalizedKey = String(key || '').trim();
            const normalizedValue = String(value || '').trim();
            if (!normalizedKey || !normalizedValue) continue;
            headers.set(normalizedKey, normalizedValue);
          }
        }
        if (typeof args.body !== 'undefined' && route.method !== 'GET') {
          if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
          }
          const body = args.body;
          if (
            typeof body === 'string' ||
            body instanceof Blob ||
            body instanceof ArrayBuffer ||
            ArrayBuffer.isView(body) ||
            body instanceof FormData ||
            body instanceof URLSearchParams ||
            body instanceof ReadableStream
          ) {
            init.body = body as BodyInit;
          } else {
            init.body = JSON.stringify(body);
          }
        }
        init.headers = headers;

        const response = await accountApi.fetchRaw(route.path, init);
        const payload = (await response.json().catch(() => null)) as unknown;

        reply({
          requestId: args.requestId,
          command: args.command,
          ...(args.instanceId ? { instanceId: args.instanceId } : {}),
          ok: response.ok,
          status: response.status,
          payload,
          message:
            response.ok || !payload || typeof payload !== 'object'
              ? undefined
              : typeof (
                    payload as {
                      error?: { reasonKey?: unknown; message?: unknown };
                    }
                  ).error?.message === 'string'
                ? String((payload as { error?: { message?: unknown } }).error?.message)
                : typeof (payload as { error?: { reasonKey?: unknown } }).error?.reasonKey === 'string'
                  ? String((payload as { error?: { reasonKey?: unknown } }).error?.reasonKey)
                  : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reply({
          requestId: args.requestId,
          command: args.command,
          ...(args.instanceId ? { instanceId: args.instanceId } : {}),
          ok: false,
          status: 500,
          message,
        });
      }
    },
    [accountApi, bobBaseUrl],
  );

  const postOpenEditorAndWait = useCallback(
    (args: { targetWindow: Window; message: BobOpenEditorPayload; openSeq: number }): Promise<void> => {
      const requestId = crypto.randomUUID();
      const payload: BobOpenEditorMessage = {
        ...args.message,
        requestId,
      };

      return new Promise((resolve, reject) => {
        let settled = false;
        let timeoutTimer: number | null = null;

        const cleanup = () => {
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

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== bobBaseUrl) return;
          const source = iframeRef.current?.contentWindow;
          if (!source || event.source !== source) return;
          const data = event.data as BobOpenEditorAppliedMessage | BobOpenEditorFailedMessage | null;
          if (!data || typeof data !== 'object') return;
          const dataRequestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
          if (dataRequestId !== requestId) return;

          if (data.type === 'bob:open-editor-applied') {
            succeed();
            return;
          }

          if (data.type === 'bob:open-editor-failed') {
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
        }, OPEN_EDITOR_TIMEOUT_MS);

        if (args.openSeq !== openDispatchSeqRef.current) {
          fail(new Error('coreui.errors.builder.open.stale'));
          return;
        }
        args.targetWindow.postMessage(payload, bobBaseUrl);
      });
    },
    [bobBaseUrl],
  );

  const openActiveInstanceInBob = useCallback(async () => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || !activeInstanceId) return;

    const openSeq = ++openDispatchSeqRef.current;
    setOpenError(null);

    try {
      const builderOpen = await accountApi.fetchJson<BuilderOpenResponse>(`/api/builder/${encodeURIComponent(activeInstanceId)}/open`);
      const widgetType = builderOpen.widgetType;
      const { payload: compiled } = await getCompiledWidget(widgetType);

      if (openSeq !== openDispatchSeqRef.current) return;

      const resolvedInstanceId = builderOpen.instanceId;
      const label = typeof builderOpen?.displayName === 'string' && builderOpen.displayName.trim() ? builderOpen.displayName.trim() : resolvedInstanceId;
      const config = builderOpen.config as Record<string, unknown>;
      const baseLocale = parseAccountL10nPolicyStrict(activeAccount.l10nPolicy).baseLocale;
      const message: BobOpenEditorPayload = {
        type: 'ck:open-editor',
        instanceId: resolvedInstanceId,
        baseLocale,
        label,
        widgetname: widgetType,
        compiled,
        instanceData: config,
        meta: builderOpen.meta ?? null,
        policy: accountPolicy,
        copilot: builderOpen.copilot ?? null,
      };
      await postOpenEditorAndWait({
        targetWindow,
        message,
        openSeq,
      });
      if (openSeq !== openDispatchSeqRef.current) return;
      setOpenError(null);
    } catch (error) {
      if (openSeq !== openDispatchSeqRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      setOpenError(message);
    }
  }, [accountApi, accountPolicy, activeAccount.l10nPolicy, activeInstanceId, postOpenEditorAndWait]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== bobBaseUrl) return;
      const source = iframeRef.current?.contentWindow;
      if (!source || event.source !== source) return;
      const data = event.data as BobReadyMessage | BobSwitchMessage | BobAccountCommandMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'bob:session-ready') {
        bobReadyRef.current = true;
        if (activeInstanceId) {
          void openActiveInstanceInBob();
        }
        return;
      }
      if (data.type === 'bob:request-instance-switch') {
        const switchMessage = data as BobSwitchMessage;
        const nextInstanceId = String(switchMessage.instanceId || '').trim();
        if (!nextInstanceId) return;
        if (nextInstanceId === activeInstanceId) return;
        setActiveInstanceId(nextInstanceId);
        return;
      }
      if (data.type === 'bob:account-command') {
        const message = data as BobAccountCommandMessage;
        const requestId = typeof message.requestId === 'string' ? message.requestId.trim() : '';
        const command = message.command ?? null;
        const instanceId = typeof message.instanceId === 'string' ? message.instanceId.trim() : '';
        const headers = message.headers && typeof message.headers === 'object' ? message.headers : undefined;
        if (!requestId || !command) return;
        if (!instanceId && !isAccountAssetCommand(command)) return;
        void runBobAccountCommand({
          source,
          requestId,
          command,
          ...(instanceId ? { instanceId } : {}),
          ...(headers ? { headers } : {}),
          ...(typeof message.body === 'undefined' ? {} : { body: message.body }),
        });
        return;
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [activeInstanceId, bobBaseUrl, openActiveInstanceInBob, runBobAccountCommand]);

  useEffect(() => {
    bobReadyRef.current = false;
    openDispatchSeqRef.current += 1;
    setOpenError(null);
  }, [bobSrc]);

  useEffect(() => {
    if (!activeInstanceId) {
      setOpenError(null);
      return;
    }
    if (!bobReadyRef.current) return;
    void openActiveInstanceInBob();
  }, [activeInstanceId, openActiveInstanceInBob]);

  const builderOpenErrorCopy = resolveBuilderErrorCopy(openError || '', 'Builder could not open this widget. Please try again.');

  if (!activeInstanceId) {
    return (
      <div className="rd-canvas-module">
        <p className="body-m">No instance selected for Builder.</p>
        <p className="body-m">Select a concrete instance from Widgets and open Edit.</p>
        <div className="rd-canvas-module__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="primary" href="/widgets">
            <span className="diet-btn-txt__label body-m">Open widgets</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {openError ? (
        <div className="rd-canvas-module">
          <p className="body-m">{builderOpenErrorCopy}</p>
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
