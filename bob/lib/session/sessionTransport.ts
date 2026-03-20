import { useCallback, useRef, type MutableRefObject } from 'react';
import {
  type BobAccountCommand,
  type BobAccountCommandMessage,
  type HostAccountCommandResultMessage,
  type SessionMeta,
  type SessionState,
} from './sessionTypes';

export type ExecuteAccountCommandArgs = {
  command: BobAccountCommand;
  url: string;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  publicId: string;
  body?: unknown;
};

export type ExecuteAccountCommand = (
  commandArgs: ExecuteAccountCommandArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

export function useSessionTransport(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
}) {
  const hostOriginRef = useRef<string | null>(null);
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

  const readRequestBody = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<unknown> => {
    if (typeof init?.body !== 'undefined') {
      if (typeof init.body === 'string') {
        try {
          return JSON.parse(init.body) as unknown;
        } catch {
          return init.body;
        }
      }
      return init.body;
    }
    if (!(input instanceof Request)) return undefined;
    const contentType = input.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const text = await input.clone().text().catch(() => '');
      if (!text.trim()) return undefined;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return input.clone().blob().catch(() => undefined);
  }, []);

  const readRequestHeaders = useCallback((input: RequestInfo | URL, init?: RequestInit): Record<string, string> => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      const headerKey = String(key || '').trim().toLowerCase();
      const headerValue = String(value || '').trim();
      if (!headerKey || !headerValue) return;
      normalized[headerKey] = headerValue;
    });
    return normalized;
  }, []);

  const isHostedBuilderSession = useCallback((): boolean => {
    const publicId = String(args.metaRef.current?.publicId || '').trim();
    return Boolean(hostOriginRef.current && publicId);
  }, [args.metaRef]);

  const dispatchHostAccountCommand = useCallback(
    (commandArgs: {
      command: BobAccountCommand;
      publicId: string;
      headers?: Record<string, string>;
      body?: unknown;
    }): Promise<{ ok: boolean; status: number; payload: any; message?: string }> => {
      const targetOrigin = hostOriginRef.current;
      if (!targetOrigin) {
        return Promise.reject(new Error('coreui.errors.builder.command.hostUnavailable'));
      }

      const requestId = crypto.randomUUID();
      const message: BobAccountCommandMessage = {
        type: 'bob:account-command',
        requestId,
        command: commandArgs.command,
        publicId: String(commandArgs.publicId || '').trim(),
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
          if (data.requestId !== requestId) return;
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

  const fetchApi = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = normalizeInputUrl(input);
    if (isHostedBuilderSession()) {
      const publicId = String(args.metaRef.current?.publicId || '').trim();
      if (inputUrl === '/api/ai/widget-copilot' || inputUrl === '/api/ai/outcome') {
        if (!publicId) {
          return Response.json(
            {
              error: {
                reasonKey: 'coreui.errors.builder.command.hostUnavailable',
                message: 'Builder lost its connection to the workspace host.',
              },
            },
            { status: 409 },
          );
        }
        const body = await readRequestJsonBody(input, init);
        const result = await dispatchHostAccountCommand({
          command: inputUrl === '/api/ai/widget-copilot' ? 'run-copilot' : 'attach-ai-outcome',
          publicId,
          ...(typeof body === 'undefined' ? {} : { body }),
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (inputUrl === '/api/account/assets' || inputUrl.startsWith('/api/account/assets?')) {
        if (!publicId) {
          return Response.json(
            {
              error: {
                reasonKey: 'coreui.errors.builder.command.hostUnavailable',
                message: 'Builder lost its connection to the workspace host.',
              },
            },
            { status: 409 },
          );
        }
        const result = await dispatchHostAccountCommand({
          command: 'list-assets',
          publicId,
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (inputUrl === '/api/account/assets/resolve') {
        if (!publicId) {
          return Response.json(
            {
              error: {
                reasonKey: 'coreui.errors.builder.command.hostUnavailable',
                message: 'Builder lost its connection to the workspace host.',
              },
            },
            { status: 409 },
          );
        }
        const body = await readRequestBody(input, init);
        const headers = readRequestHeaders(input, init);
        const result = await dispatchHostAccountCommand({
          command: 'resolve-assets',
          publicId,
          ...(Object.keys(headers).length ? { headers } : {}),
          ...(typeof body === 'undefined' ? {} : { body }),
        });
        return new Response(JSON.stringify(result.payload ?? null), {
          status: result.status,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      }
      if (inputUrl === '/api/account/assets/upload') {
        if (!publicId) {
          return Response.json(
            {
              error: {
                reasonKey: 'coreui.errors.builder.command.hostUnavailable',
                message: 'Builder lost its connection to the workspace host.',
              },
            },
            { status: 409 },
          );
        }
        const body = await readRequestBody(input, init);
        const headers = readRequestHeaders(input, init);
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
      }
      if (inputUrl.startsWith('/api/account/') || inputUrl.startsWith('/api/accounts/')) {
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
    }
    const nativeFetch = nativeFetchRef.current ?? fetch.bind(globalThis);
    return nativeFetch(input, init);
  }, [
    args.metaRef,
    dispatchHostAccountCommand,
    isHostedBuilderSession,
    normalizeInputUrl,
    readRequestBody,
    readRequestHeaders,
    readRequestJsonBody,
  ]);

  const executeAccountCommand: ExecuteAccountCommand = useCallback(
    async (commandArgs: ExecuteAccountCommandArgs) => {
      if (isHostedBuilderSession()) {
        const result = await dispatchHostAccountCommand({
          command: commandArgs.command,
          publicId: commandArgs.publicId,
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
    [dispatchHostAccountCommand, fetchApi, isHostedBuilderSession],
  );

  return {
    hostOriginRef,
    fetchApi,
    executeAccountCommand,
  };
}
