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

const HOSTED_ASSET_BRIDGE_KEY = '__CK_CLICKEEN_HOSTED_ACCOUNT_ASSET_BRIDGE__';

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

  const hostedAccountMode = (() => {
    const policy = args.stateRef.current.policy;
    const subject = policy ? resolvePolicySubject(policy) : null;
    return subject ? isHostedAccountMode(subject) : false;
  })();
  const hostedPublicId = String(args.stateRef.current.meta?.publicId || '').trim();

  useEffect(() => {
    const root = globalThis as Record<string, unknown>;
    if (!hostedAccountMode) {
      delete root[HOSTED_ASSET_BRIDGE_KEY];
      return;
    }

    const bridge = {
      listAssets: async (): Promise<unknown> => {
        if (!hostedPublicId) {
          throw new Error('coreui.errors.builder.command.hostUnavailable');
        }
        const result = await dispatchHostAccountCommand({
          command: 'list-assets',
          publicId: hostedPublicId,
        });
        if (!result.ok) {
          throw new Error(result.message || `HTTP_${result.status}`);
        }
        return result.payload ?? null;
      },
      resolveAssets: async (assetIds: string[]): Promise<unknown> => {
        if (!hostedPublicId) {
          throw new Error('coreui.errors.builder.command.hostUnavailable');
        }
        const result = await dispatchHostAccountCommand({
          command: 'resolve-assets',
          publicId: hostedPublicId,
          body: { assetIds },
        });
        if (!result.ok) {
          throw new Error(result.message || `HTTP_${result.status}`);
        }
        return result.payload ?? null;
      },
      uploadAsset: async (file: Blob, headers?: Record<string, string>): Promise<unknown> => {
        if (!hostedPublicId) {
          throw new Error('coreui.errors.builder.command.hostUnavailable');
        }
        const result = await dispatchHostAccountCommand({
          command: 'upload-asset',
          publicId: hostedPublicId,
          ...(headers ? { headers } : {}),
          body: file,
        });
        if (!result.ok) {
          throw new Error(result.message || `HTTP_${result.status}`);
        }
        return result.payload ?? null;
      },
    };

    root[HOSTED_ASSET_BRIDGE_KEY] = bridge;
    return () => {
      if (root[HOSTED_ASSET_BRIDGE_KEY] === bridge) {
        delete root[HOSTED_ASSET_BRIDGE_KEY];
      }
    };
  }, [dispatchHostAccountCommand, hostedAccountMode, hostedPublicId]);

  const fetchApi = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = normalizeInputUrl(input);
    const policy = args.stateRef.current.policy;
    const subject = policy ? resolvePolicySubject(policy) : null;
    if (subject && isHostedAccountMode(subject)) {
      const publicId = String(args.stateRef.current.meta?.publicId || '').trim();
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
  }, [args.stateRef, dispatchHostAccountCommand, isHostedAccountMode, normalizeInputUrl, readRequestJsonBody]);

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
