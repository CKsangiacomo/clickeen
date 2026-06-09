'use client';

import { parseAccountLocaleListStrict, parseAccountLocalePolicyStrict } from '@clickeen/ck-contracts';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRomaAccountApi } from './account-api';
import { getCompiledWidget } from './compiled-widget-cache';
import { useRomaAccountContext } from './roma-account-context';

type BuilderDomainProps = {
  initialInstanceId?: string;
};

const OPEN_EDITOR_TIMEOUT_MS = 7000;
const UNSAVED_OPEN_REASON = 'coreui.errors.builder.open.unsavedChanges';

type BobReadyMessage = {
  type: 'bob:session-ready';
};

type BobDirtyStateChangedMessage = {
  type: 'bob:dirty-state-changed';
  isDirty?: boolean;
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

type BobAccountCommand =
  | 'update-instance'
  | AccountAssetHostCommand
  | 'list-translations'
  | 'read-translation'
  | 'save-translation'
  | 'generate-translations'
  | 'read-translation-generation'
  | 'run-copilot'
  | 'attach-ai-outcome';

type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId?: string | null;
  command?: BobAccountCommand | null;
  instanceId?: string | null;
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
  accountPublicId: string;
  instanceId: string;
  baseLocale: string;
  label: string;
  widgetname: string;
  compiled: unknown;
  instanceData: Record<string, unknown>;
  publishStatus?: 'published' | 'unpublished';
  meta?: Record<string, unknown> | null;
  policy?: unknown;
  copilot?: unknown;
  translationSetup?: {
    v: 1;
    baseLocale: string;
    planTranslationsMax: number | null;
    selectedTargetLocales: string[];
  };
};

type BobOpenEditorPayload = Omit<BobOpenEditorMessage, 'requestId'>;

type BuilderOpenResponse = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
  publishStatus?: 'published' | 'unpublished';
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
  'coreui.errors.builder.open.unsavedChanges': 'Save current edits before opening another widget.',
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
  body?: unknown;
}): { method: 'GET' | 'PUT' | 'POST' | 'DELETE'; path: string } | null {
  const instanceId = String(args.instanceId || '').trim();
  const body = args.body && typeof args.body === 'object' && !Array.isArray(args.body)
    ? (args.body as Record<string, unknown>)
    : null;
  const locale = typeof body?.locale === 'string' ? body.locale.trim() : '';

  switch (args.command) {
    case 'update-instance':
      if (!instanceId) return null;
      return {
        method: 'PUT',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}`,
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
    case 'list-translations':
      if (!instanceId) return null;
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations`,
      };
    case 'read-translation':
      if (!instanceId || !locale) return null;
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/${encodeURIComponent(locale)}`,
      };
    case 'save-translation':
      if (!instanceId || !locale) return null;
      return {
        method: 'PUT',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/${encodeURIComponent(locale)}`,
      };
    case 'generate-translations':
      if (!instanceId) return null;
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/generate`,
      };
    case 'read-translation-generation':
      if (!instanceId) return null;
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/generation`,
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

function buildTranslationSetup(args: {
  baseLocale: string;
  activeAccount: ReturnType<typeof useRomaAccountContext>['activeAccount'];
  accountPolicy: ReturnType<typeof useRomaAccountContext>['accountPolicy'];
}): BobOpenEditorPayload['translationSetup'] {
  const selectedTargetLocales = parseAccountLocaleListStrict(args.activeAccount.selectedTargetLocales)
    .filter((locale) => locale !== args.baseLocale);
  const planTranslationsMax = args.accountPolicy.limits['l10n.locales.max'];
  return {
    v: 1,
    baseLocale: args.baseLocale,
    planTranslationsMax: typeof planTranslationsMax === 'number' && Number.isFinite(planTranslationsMax)
      ? Math.max(0, Math.floor(planTranslationsMax))
      : null,
    selectedTargetLocales,
  };
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

function normalizeReturnTo(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//') || normalized.includes('\\')) {
    return '';
  }
  return normalized;
}

export function BuilderDomain({ initialInstanceId = '' }: BuilderDomainProps) {
  const { activeAccount, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bobReadyRef = useRef(false);
  const openDispatchSeqRef = useRef(0);
  const bobAppliedInstanceIdRef = useRef('');
  const bobIsDirtyRef = useRef(false);
  const activeInstanceIdRef = useRef('');
  const [activeInstanceId, setActiveInstanceId] = useState(() => {
    const fromPath = decodeBuilderPathInstanceId(pathname);
    if (fromPath) return fromPath;
    return String(initialInstanceId || '').trim();
  });
  const [openError, setOpenError] = useState<string | null>(null);

  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(), []);
  const currentUrl = pathname;
  const pathInstanceId = useMemo(() => decodeBuilderPathInstanceId(pathname), [pathname]);
  const returnTo = useMemo(() => normalizeReturnTo(searchParams.get('returnTo')), [searchParams]);

  useEffect(() => {
    activeInstanceIdRef.current = activeInstanceId;
  }, [activeInstanceId]);

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
    async (args: { source: Window; requestId: string; command: BobAccountCommand; instanceId?: string; body?: unknown }) => {
      const reply = (payload: Omit<HostAccountCommandResultMessage, 'type'>) => {
        const message: HostAccountCommandResultMessage = {
          type: 'host:account-command-result',
          ...payload,
        };
        args.source.postMessage(message, bobBaseUrl);
      };
      const commandUsesActiveInstance = !isAccountAssetCommand(args.command);
      const requestedInstanceId = typeof args.instanceId === 'string' ? args.instanceId.trim() : '';
      const scopedInstanceId = commandUsesActiveInstance
        ? (bobAppliedInstanceIdRef.current || activeInstanceId).trim()
        : requestedInstanceId;
      if (commandUsesActiveInstance && requestedInstanceId && requestedInstanceId !== scopedInstanceId) {
        reply({
          requestId: args.requestId,
          command: args.command,
          instanceId: scopedInstanceId || requestedInstanceId,
          ok: false,
          status: 409,
          message: 'coreui.errors.builder.instanceScopeMismatch',
        });
        return;
      }

      const route = resolveBobAccountCommandRequest({
        command: args.command,
        instanceId: scopedInstanceId,
        body: args.body,
      });

      if (!route) {
        reply({
          requestId: args.requestId,
          command: args.command,
          ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
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
          ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
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
          ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
          ok: false,
          status: 500,
          message,
        });
      }
    },
    [accountApi, activeInstanceId, bobBaseUrl],
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
      const baseLocale = parseAccountLocalePolicyStrict(activeAccount.localePolicy).baseLocale;
      const translationSetup = buildTranslationSetup({
        baseLocale,
        activeAccount,
        accountPolicy,
      });
      const message: BobOpenEditorPayload = {
        type: 'ck:open-editor',
        accountPublicId: activeAccount.accountPublicId,
        instanceId: resolvedInstanceId,
        baseLocale,
        label,
        widgetname: widgetType,
        compiled,
        instanceData: config,
        publishStatus: builderOpen.publishStatus,
        meta: builderOpen.meta ?? null,
        policy: accountPolicy,
        copilot: builderOpen.copilot ?? null,
        translationSetup,
      };
      await postOpenEditorAndWait({
        targetWindow,
        message,
        openSeq,
      });
      if (openSeq !== openDispatchSeqRef.current) return;
      bobAppliedInstanceIdRef.current = resolvedInstanceId;
      bobIsDirtyRef.current = false;
      setOpenError(null);
    } catch (error) {
      if (openSeq !== openDispatchSeqRef.current) return;
      const message = error instanceof Error ? error.message : String(error);
      if (message === UNSAVED_OPEN_REASON && bobAppliedInstanceIdRef.current) {
        const appliedInstanceId = bobAppliedInstanceIdRef.current;
        setActiveInstanceId(appliedInstanceId);
        const appliedRoute = buildRomaBuilderRoute({ instanceId: appliedInstanceId });
        if (appliedRoute !== currentUrl) {
          router.replace(appliedRoute, { scroll: false });
        }
      }
      setOpenError(message);
    }
  }, [accountApi, accountPolicy, activeAccount, activeInstanceId, currentUrl, postOpenEditorAndWait, router]);

  const openActiveInstanceInBobRef = useRef(openActiveInstanceInBob);
  useEffect(() => {
    openActiveInstanceInBobRef.current = openActiveInstanceInBob;
  }, [openActiveInstanceInBob]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== bobBaseUrl) return;
      const source = iframeRef.current?.contentWindow;
      if (!source || event.source !== source) return;
      const data = event.data as BobReadyMessage | BobDirtyStateChangedMessage | BobAccountCommandMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'bob:session-ready') {
        bobReadyRef.current = true;
        if (activeInstanceId) {
          void openActiveInstanceInBobRef.current();
        }
        return;
      }
      if (data.type === 'bob:dirty-state-changed') {
        bobIsDirtyRef.current = data.isDirty === true;
        return;
      }
      if (data.type === 'bob:account-command') {
        const message = data as BobAccountCommandMessage;
        const requestId = typeof message.requestId === 'string' ? message.requestId.trim() : '';
        const command = message.command ?? null;
        const instanceId = typeof message.instanceId === 'string' ? message.instanceId.trim() : '';
        if (!requestId || !command) return;
        if (!instanceId && !isAccountAssetCommand(command)) return;
        void runBobAccountCommand({
          source,
          requestId,
          command,
          ...(instanceId ? { instanceId } : {}),
          ...(typeof message.body === 'undefined' ? {} : { body: message.body }),
        });
        return;
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [activeInstanceId, bobBaseUrl, runBobAccountCommand]);

  useEffect(() => {
    bobReadyRef.current = false;
    openDispatchSeqRef.current += 1;
    bobAppliedInstanceIdRef.current = '';
    bobIsDirtyRef.current = false;
    setOpenError(null);
  }, [bobSrc]);

  useEffect(() => {
    if (!activeInstanceId) {
      setOpenError(null);
      return;
    }
    if (!bobReadyRef.current) return;
    void openActiveInstanceInBobRef.current();
  }, [activeInstanceId]);

  useEffect(() => {
    const confirmDiscard = () => {
      if (!bobIsDirtyRef.current) return true;
      return window.confirm('You have unsaved Builder edits. Leave and discard them?');
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!bobIsDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleClick = (event: MouseEvent) => {
      if (!bobIsDirtyRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const navigable = target.closest('a[href], button.roma-nav__signout');
      if (!navigable) return;
      if (confirmDiscard()) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePopState = () => {
      if (!bobIsDirtyRef.current) return;
      if (confirmDiscard()) return;
      const holdInstanceId = bobAppliedInstanceIdRef.current || activeInstanceIdRef.current;
      const holdRoute = holdInstanceId ? buildRomaBuilderRoute({ instanceId: holdInstanceId }) : '/builder';
      window.history.pushState(null, '', holdRoute);
      if (holdInstanceId) {
        setActiveInstanceId(holdInstanceId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

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
      {returnTo ? (
        <div className="rd-canvas-module">
          <div className="rd-canvas-module__actions">
            <Link className="diet-btn-txt" data-size="md" data-variant="line2" href={returnTo}>
              <span className="diet-btn-txt__label body-m">
                {returnTo.startsWith('/pages') ? 'Return to page' : 'Return'}
              </span>
            </Link>
          </div>
        </div>
      ) : null}
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
