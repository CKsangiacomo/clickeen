import { useCallback, useRef, type MutableRefObject } from 'react';
import {
  type BobAccountCommand,
  type BobAccountCommandMessage,
  type BootMode,
  type HostAccountCommandResultMessage,
  type SessionState,
  type SubjectMode,
} from './sessionTypes';
import { resolveBootModeFromUrl, resolveSurfaceFromUrl } from './sessionPolicy';

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
  method: 'PUT' | 'POST' | 'DELETE';
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
  const surfaceRef = useRef<string>(resolveSurfaceFromUrl());
  const hostOriginRef = useRef<string | null>(null);
  const openRequestStatusRef = useRef<Map<string, OpenRequestStatusEntry>>(new Map());

  const fetchApi = useCallback((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const capsule = args.stateRef.current.meta?.accountCapsule?.trim();
    const inputUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : '';
    if (!capsule || !inputUrl.startsWith('/api/accounts/')) {
      return fetch(input, init);
    }

    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    headers.set('x-ck-authz-capsule', capsule);
    return fetch(input, {
      ...init,
      headers,
    });
  }, [args.stateRef]);

  const shouldDelegateAccountCommand = useCallback((subject: SubjectMode): boolean => {
    if (subject !== 'account' || bootModeRef.current !== 'message') return false;
    return surfaceRef.current === 'roma' || surfaceRef.current === 'devstudio-support';
  }, []);

  const dispatchHostAccountCommand = useCallback(
    (commandArgs: {
      command: BobAccountCommand;
      accountId: string;
      publicId: string;
      locale?: string;
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
        accountId: String(commandArgs.accountId || '').trim(),
        publicId: String(commandArgs.publicId || '').trim(),
        ...(commandArgs.locale ? { locale: String(commandArgs.locale || '').trim() } : {}),
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

  const executeAccountCommand: ExecuteAccountCommand = useCallback(
    async (commandArgs: ExecuteAccountCommandArgs) => {
      if (shouldDelegateAccountCommand(commandArgs.subject)) {
        const result = await dispatchHostAccountCommand({
          command: commandArgs.command,
          accountId: commandArgs.accountId,
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
    [dispatchHostAccountCommand, fetchApi, shouldDelegateAccountCommand],
  );

  return {
    bootModeRef,
    surfaceRef,
    hostOriginRef,
    sessionIdRef,
    openRequestStatusRef,
    fetchApi,
    executeAccountCommand,
  };
}
