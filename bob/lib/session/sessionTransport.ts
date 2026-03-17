import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import {
  type BobAccountCommand,
  type BobAccountCommandMessage,
  type BootMode,
  type HostAccountCommandResultMessage,
  type SessionState,
  type SubjectMode,
} from './sessionTypes';
import { resolveBootModeFromUrl, resolvePolicySubject } from './sessionPolicy';

export type OpenRequestStatusEntry = {
  status: 'processing' | 'applied' | 'failed';
  publicId?: string;
  widgetname?: string;
  error?: string;
};

export type ExecuteAccountCommandArgs = {
  subject: SubjectMode;
  command: BobAccountCommand;
  url: string;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  accountId: string;
  publicId: string;
  locale?: string;
  body?: unknown;
};

export type ExecuteAccountCommand = (
  commandArgs: ExecuteAccountCommandArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

export function useSessionTransport(args: {
  stateRef: MutableRefObject<SessionState>;
}) {
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const bootModeRef = useRef<BootMode>(resolveBootModeFromUrl());
  const hostOriginRef = useRef<string | null>(null);
  const openRequestStatusRef = useRef<Map<string, OpenRequestStatusEntry>>(new Map());
  const nativeFetchRef = useRef<typeof fetch | null>(
    typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null,
  );

  const normalizeInputUrl = useCallback((input: RequestInfo | URL): string => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : '';
    if (!raw) return '';
    try {
      const base =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://bob.dev.clickeen.com';
      const url = new URL(raw, base);
      return `${url.pathname}${url.search}`;
    } catch {
      return raw;
    }
  }, []);

  const readRequestJsonBody = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
    if (typeof init?.body === 'string') {
      try {
        return JSON.parse(init.body) as unknown;
      } catch {
        return init.body;
      }
    }
    if (input instanceof Request) {
      const text = await input.clone().text().catch(() => '');
      if (!text.trim()) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return undefined;
  }, []);

  const readRequestBlobBody = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Blob | undefined> => {
    if (init?.body instanceof Blob) return init.body;
    if (input instanceof Request) {
      return input.clone().blob().catch(() => undefined);
    }
    return undefined;
  }, []);

  const readForwardableHeaders = useCallback((input: RequestInfo | URL, init?: RequestInit): Record<string, string> => {
    const merged = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      const overrides = new Headers(init.headers);
      overrides.forEach((value, key) => merged.set(key, value));
    }
    const forwarded: Record<string, string> = {};
    for (const [key, value] of merged.entries()) {
      const normalizedKey = key.trim().toLowerCase();
      const normalizedValue = value.trim();
      if (!normalizedValue) continue;
      switch (normalizedKey) {
        case 'accept':
        case 'content-type':
        case 'x-filename':
        case 'x-source':
        case 'x-clickeen-surface':
        case 'x-public-id':
        case 'x-widget-type':
          forwarded[normalizedKey] = normalizedValue;
          break;
        default:
          break;
      }
    }
    return forwarded;
  }, []);

  const isHostedAccountMode = useCallback((subject: SubjectMode): boolean => {
    return subject === 'account' && bootModeRef.current === 'message';
  }, []);

  const dispatchHostAccountCommand = useCallback(
    (commandArgs: {
      command: BobAccountCommand;
      publicId: string;
      locale?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }): Promise<{ ok: boolean; status: number; payload: any; message?: string }> => {
      const targetOrigin = hostOriginRef.current;
      const sessionId = sessionIdRef.current.trim();
      if (!targetOrigin || !sessionId) {
        return Promise.reject(new Error('coreui.errors.builder.command.hostUnavailable'));
      }

      const requestId = crypto.randomUUID();
      const message: BobAccountCommandMessage = {
        type: 'bob:account-command',
        requestId,
        sessionId,
        command: commandArgs.command,
        publicId: String(commandArgs.publicId || '').trim(),
        ...(commandArgs.locale ? { locale: String(commandArgs.locale || '').trim() } : {}),
        ...(commandArgs.headers ? { headers: commandArgs.headers } : {}),
        ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
      };

      return new Promise((resolve, reject) => {
        let timeoutTimer: number | null = null;

        const cleanup = () => {
          if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
          window.removeEventListener('message', onMessage);
        };

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== targetOrigin) return;
          if (event.source !== window.parent) return;
          const data = event.data as HostAccountCommandResultMessage | null;
          if (!data || typeof data !== 'object' || data.type !== 'host:account-command-result') return;
          if (data.requestId !== requestId || data.sessionId !== sessionId) return;
          cleanup();
          resolve({
            ok: data.ok === true,
            status: typeof data.status === 'number' ? data.status : 500,
            payload: data.payload ?? null,
            message: typeof data.message === 'string' ? data.message : undefined,
          });
        };

        window.addEventListener('message', onMessage);
        timeoutTimer = window.setTimeout(() => {
          cleanup();
          reject(new Error('coreui.errors.builder.command.timeout'));
        }, 15_000);

        try {
          window.parent?.postMessage(message, targetOrigin);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    [],
  );

  const dispatchAccountApiThroughHost = useCallback(
    async (inputUrl: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> => {
      const policy = args.stateRef.current.policy;
      if (!policy) {
        return null;
      }
      const subject = resolvePolicySubject(policy);
      if (!isHostedAccountMode(subject)) return null;

      const accountId = String(args.stateRef.current.meta?.accountId || '').trim();
      const publicId = String(args.stateRef.current.meta?.publicId || '').trim();
      if (!accountId || !publicId) {
        const normalizedUrl = normalizeInputUrl(input);
        if (
          normalizedUrl.startsWith('/api/account/') ||
          normalizedUrl.startsWith('/api/accounts/') ||
          normalizedUrl === '/api/ai/widget-copilot' ||
          normalizedUrl === '/api/ai/outcome'
        ) {
          return Response.json(
            { message: 'Account context is missing. Reopen the instance from Roma and try again.' },
            { status: 409 },
          );
        }
        return null;
      }

      const normalizedUrl = normalizeInputUrl(input);
      if (!normalizedUrl) return null;

      if (normalizedUrl === '/api/ai/widget-copilot' || normalizedUrl === '/api/ai/outcome') {
        const body = await readRequestJsonBody(input, init);
        const result = await dispatchHostAccountCommand({
          command: normalizedUrl === '/api/ai/widget-copilot' ? 'run-copilot' : 'attach-ai-outcome',
          publicId,
          ...(typeof body === 'undefined' ? {} : { body }),
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      const pathname = normalizedUrl.replace(/\?.*$/, '');
      const isAssetsListRoute =
        pathname === '/api/account/assets' || /^\/api\/accounts\/[0-9a-f-]{36}\/assets$/i.test(pathname);
      const isAssetsResolveRoute =
        pathname === '/api/account/assets/resolve' ||
        /^\/api\/accounts\/[0-9a-f-]{36}\/assets\/resolve$/i.test(pathname);
      const isAssetsUploadRoute =
        pathname === '/api/account/assets/upload' ||
        /^\/api\/accounts\/[0-9a-f-]{36}\/assets\/upload$/i.test(pathname);

      if (!isAssetsListRoute && !isAssetsResolveRoute && !isAssetsUploadRoute) return null;

      if (isAssetsListRoute) {
        const result = await dispatchHostAccountCommand({
          command: 'list-assets',
          publicId,
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      if (isAssetsResolveRoute) {
        const body = await readRequestJsonBody(input, init);
        const result = await dispatchHostAccountCommand({
          command: 'resolve-assets',
          publicId,
          ...(typeof body === 'undefined' ? {} : { body }),
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }

      const body = await readRequestBlobBody(input, init);
      const headers = readForwardableHeaders(input, init);
      const result = await dispatchHostAccountCommand({
        command: 'upload-asset',
        publicId,
        ...(Object.keys(headers).length ? { headers } : {}),
        ...(typeof body === 'undefined' ? {} : { body }),
      });
      return new Response(JSON.stringify(result.payload ?? null), {
        status: result.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    },
    [
      args.stateRef,
      dispatchHostAccountCommand,
      isHostedAccountMode,
      normalizeInputUrl,
      readForwardableHeaders,
      readRequestBlobBody,
      readRequestJsonBody,
    ],
  );

  const fetchApi = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = normalizeInputUrl(input);

    const delegated = await dispatchAccountApiThroughHost(inputUrl, input, init);
    if (delegated) return delegated;
    const policy = args.stateRef.current.policy;
    const subject = policy ? resolvePolicySubject(policy) : null;
    if (
      (inputUrl.startsWith('/api/account/') || inputUrl.startsWith('/api/accounts/')) &&
      subject &&
      isHostedAccountMode(subject)
    ) {
      return Response.json(
        {
          error: {
            reasonKey: 'coreui.errors.builder.command.hostOnly',
            message: 'Hosted account mode must delegate account routes through the parent host.',
          },
        },
        { status: 409 },
      );
    }
    const nativeFetch = nativeFetchRef.current ?? fetch.bind(globalThis);
    return nativeFetch(input, init);
  }, [args.stateRef, dispatchAccountApiThroughHost, isHostedAccountMode, normalizeInputUrl]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
    const nativeFetch = nativeFetchRef.current ?? window.fetch.bind(window);
    nativeFetchRef.current = nativeFetch;

    const delegatedFetch: typeof window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
      fetchApi(input, init)) as typeof window.fetch;

    window.fetch = delegatedFetch;
    globalThis.fetch = delegatedFetch;
    return () => {
      window.fetch = nativeFetch;
      globalThis.fetch = nativeFetch;
    };
  }, [fetchApi]);

  const executeAccountCommand: ExecuteAccountCommand = useCallback(
    async (commandArgs: ExecuteAccountCommandArgs) => {
      if (isHostedAccountMode(commandArgs.subject)) {
        const result = await dispatchHostAccountCommand({
          command: commandArgs.command,
          publicId: commandArgs.publicId,
          ...(commandArgs.locale ? { locale: commandArgs.locale } : {}),
          ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
        });
        return { ok: result.ok, status: result.status, json: result.payload };
      }

      const init: RequestInit = { method: commandArgs.method };
      if (typeof commandArgs.body !== 'undefined') {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(commandArgs.body);
      }
      const response = await fetchApi(commandArgs.url, init);
      const json = (await response.json().catch(() => null)) as any;
      return { ok: response.ok, status: response.status, json };
    },
    [dispatchHostAccountCommand, fetchApi, isHostedAccountMode],
  );

  return {
    bootModeRef,
    hostOriginRef,
    sessionIdRef,
    openRequestStatusRef,
    fetchApi,
    executeAccountCommand,
  };
}
