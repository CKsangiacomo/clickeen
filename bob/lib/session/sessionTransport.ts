import { useCallback, useRef, type MutableRefObject } from 'react';
import type { AccountAssetsTransport } from '../../../dieter/components/shared/account-assets';
import {
  type BobAccountCommand,
  type BobAccountCommandMessage,
  type HostAccountCommandResultMessage,
  type SessionMeta,
  type SessionState,
} from './sessionTypes';

export type ExecuteAccountCommandArgs = {
  command: BobAccountCommand;
  publicId: string;
  body?: unknown;
};

export type ExecuteAccountCommand = (
  commandArgs: ExecuteAccountCommandArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

function createHostUnavailableResponse(): Response {
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

function createJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload ?? null), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

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

  const accountAssets = useRef<AccountAssetsTransport | null>(null);

  const fetchDirect = useCallback((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const nativeFetch = nativeFetchRef.current ?? fetch.bind(globalThis);
    return nativeFetch(input, init);
  }, []);

  const dispatchHostedAssetCommand = useCallback(
    async (commandArgs: {
      command: Extract<BobAccountCommand, 'list-assets' | 'resolve-assets' | 'upload-asset'>;
      headers?: Record<string, string>;
      body?: unknown;
    }): Promise<Response> => {
      const publicId = String(args.metaRef.current?.publicId || '').trim();
      if (!publicId) {
        return createHostUnavailableResponse();
      }
      const result = await dispatchHostAccountCommand({
        command: commandArgs.command,
        publicId,
        ...(commandArgs.headers ? { headers: commandArgs.headers } : {}),
        ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
      });
      return createJsonResponse(result.status, result.payload);
    },
    [args.metaRef, dispatchHostAccountCommand],
  );

  if (!accountAssets.current) {
    accountAssets.current = {
      listAssets: async () => dispatchHostedAssetCommand({ command: 'list-assets' }),
      resolveAssets: async (assetIds: string[]) => {
        const headers = {
          accept: 'application/json',
          'content-type': 'application/json',
        };
        const body = { assetIds };
        return dispatchHostedAssetCommand({
          command: 'resolve-assets',
          headers,
          body,
        });
      },
      uploadAsset: async (file: File, source = 'api') => {
        const headers = {
          accept: 'application/json',
          'content-type': file.type || 'application/octet-stream',
          'x-filename': file.name || 'upload.bin',
          'x-source': source,
        };
        return dispatchHostedAssetCommand({
          command: 'upload-asset',
          headers,
          body: file,
        });
      },
    };
  }

  const fetchApi = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const inputUrl = normalizeInputUrl(input);
    const publicId = String(args.metaRef.current?.publicId || '').trim();
    if (inputUrl === '/api/ai/widget-copilot' || inputUrl === '/api/ai/outcome') {
      if (!publicId) {
        return createHostUnavailableResponse();
      }
      const body = await readRequestJsonBody(input, init);
      const result = await dispatchHostAccountCommand({
        command: inputUrl === '/api/ai/widget-copilot' ? 'run-copilot' : 'attach-ai-outcome',
        publicId,
        ...(typeof body === 'undefined' ? {} : { body }),
      });
      return createJsonResponse(result.status, result.payload);
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
    return fetchDirect(input, init);
  }, [
    args.metaRef,
    fetchDirect,
    dispatchHostAccountCommand,
    normalizeInputUrl,
    readRequestJsonBody,
  ]);

  const executeAccountCommand: ExecuteAccountCommand = useCallback(
    async (commandArgs: ExecuteAccountCommandArgs) => {
      const result = await dispatchHostAccountCommand({
        command: commandArgs.command,
        publicId: commandArgs.publicId,
        ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
      });
      return { ok: result.ok, status: result.status, json: result.payload };
    },
    [dispatchHostAccountCommand],
  );

  return {
    accountAssets: accountAssets.current,
    hostOriginRef,
    fetchApi,
    executeAccountCommand,
  };
}
