import { useCallback, useRef, type MutableRefObject } from 'react';
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

  const isHostedAccountMode = useCallback((subject: SubjectMode): boolean => {
    return subject === 'account' && bootModeRef.current === 'message';
  }, []);

  const dispatchHostAccountCommand = useCallback(
    (commandArgs: {
      command: BobAccountCommand;
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

  const dispatchAccountApiThroughHost = useCallback(
    async (inputUrl: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response | null> => {
      if (inputUrl !== '/api/ai/widget-copilot' && inputUrl !== '/api/ai/outcome') return null;
      const policy = args.stateRef.current.policy;
      if (!policy) {
        return Response.json(
          { message: 'Editor context is not ready. Wait for the host to finish booting and try again.' },
          { status: 409 },
        );
      }
      const subject = resolvePolicySubject(policy);
      if (!isHostedAccountMode(subject)) return null;

      const accountId = String(args.stateRef.current.meta?.accountId || '').trim();
      const publicId = String(args.stateRef.current.meta?.publicId || '').trim();
      if (!accountId || !publicId) {
        return Response.json(
          { message: 'Account context is missing. Reopen the instance from Roma and try again.' },
          { status: 409 },
        );
      }

      let body: unknown = undefined;
      const rawBody = input instanceof Request ? undefined : init?.body;
      if (typeof rawBody === 'string' && rawBody.trim()) {
        try {
          body = JSON.parse(rawBody) as unknown;
        } catch {
          body = rawBody;
        }
      }

      const result = await dispatchHostAccountCommand({
        command: inputUrl === '/api/ai/widget-copilot' ? 'run-copilot' : 'attach-ai-outcome',
        publicId,
        ...(typeof body === 'undefined' ? {} : { body }),
      });
      return new Response(JSON.stringify(result.payload ?? null), {
        status: result.status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    },
    [args.stateRef, dispatchHostAccountCommand, isHostedAccountMode],
  );

  const fetchApi = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : '';

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
    return fetch(input, init);
  }, [args.stateRef, dispatchAccountApiThroughHost, isHostedAccountMode]);

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
