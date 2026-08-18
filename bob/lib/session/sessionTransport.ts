import { useCallback, useRef, type MutableRefObject } from 'react';
import type {
  AccountAssetRecord,
  ResolvedAccountAsset,
} from '@clickeen/ck-contracts';
import type { AccountAssetsClient } from '../../../dieter/components/shared/account-assets';
import type { ProductCopilotTurnEvent } from '@clickeen/ck-contracts/ai';
import {
  type BobAccountCommand,
  type BobAccountCommandMessage,
  type BobSystemUpsellMessage,
  type BobWidgetUpsellMessage,
  type AgentActivityEvent,
  type HostAgentActivityMessage,
  type HostAccountCommandResultMessage,
  type SessionMeta,
} from './sessionTypes';

export type ExecuteAccountCommandArgs = {
  command: BobAccountCommand;
  instanceId: string;
  body?: unknown;
};

export type ExecuteAccountCommand = (
  commandArgs: ExecuteAccountCommandArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

export type ListTranslationsArgs = {
  instanceId: string;
  baseLocale: string;
};

export type ListTranslations = (
  args: ListTranslationsArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

export type ReadTranslationArgs = {
  instanceId: string;
  locale: string;
};

export type ReadTranslation = (
  args: ReadTranslationArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

export type GenerateTranslationsArgs = {
  instanceId: string;
  onActivity?: (event: AgentActivityEvent) => void;
};

export type GenerateTranslations = (
  args: GenerateTranslationsArgs
) => Promise<{ ok: boolean; status: number; json: any }>;

type HostCopilotEventMessage = {
  type: 'host:copilot-event';
  requestId: string;
  instanceId?: string;
  event: ProductCopilotTurnEvent;
};

export type CopilotRequestHandle = {
  requestId: string;
  completed: Promise<{ ok: boolean; status: number; payload: unknown }>;
};

export type RunCopilotArgs = {
  instanceId: string;
  body?: unknown;
  timeoutMs?: number;
  onCopilotEvent?: (event: ProductCopilotTurnEvent) => void;
};

export type RunCopilot = (args: RunCopilotArgs) => CopilotRequestHandle;

export type CancelCopilot = (requestId: string) => void;

const HOST_ORIGIN_WAIT_MS = 3_000;
const HOST_ORIGIN_POLL_MS = 25;

type AccountAssetsTransport = {
  listAssets: () => Promise<Response>;
  resolveAssets: (assetRefs: string[]) => Promise<Response>;
  uploadAsset: (file: File, source: string) => Promise<Response>;
};

function accountAssetError(error: { kind: string; reasonKey: string; detail?: string }): Error {
  return Object.assign(new Error(error.reasonKey), { kind: error.kind, detail: error.detail });
}

export function createAccountAssetsClient(transport: AccountAssetsTransport): AccountAssetsClient {
  return {
    resolveUploadUpsellReason(error): string | null {
      return error instanceof Error && (error as Error & { kind?: string }).kind === 'DENY'
        ? error.message
        : null;
    },

    async listAssets(): Promise<AccountAssetRecord[]> {
      const response = await transport.listAssets();
      const payload = (await response.json()) as {
        assets: AccountAssetRecord[];
        error: { kind: string; reasonKey: string; detail?: string };
      };
      if (!response.ok) {
        throw accountAssetError(payload.error);
      }
      return payload.assets;
    },

    async resolveAssets(assetRefsRaw: string[]): Promise<{
      assetsByRef: Map<string, ResolvedAccountAsset>;
    }> {
      const response = await transport.resolveAssets(assetRefsRaw);
      const payload = (await response.json()) as {
        assets: ResolvedAccountAsset[];
        error: { kind: string; reasonKey: string; detail?: string };
      };
      if (!response.ok) {
        throw accountAssetError(payload.error);
      }
      return {
        assetsByRef: new Map(payload.assets.map((asset) => [asset.assetRef, asset])),
      };
    },

    async uploadAsset(file: File, source: string): Promise<AccountAssetRecord> {
      if (!(file instanceof File) || file.size <= 0) {
        throw new Error('coreui.errors.payload.empty');
      }
      const response = await transport.uploadAsset(file, source);
      const payload = (await response.json()) as AccountAssetRecord & {
        error: { kind: string; reasonKey: string; detail?: string };
      };
      if (!response.ok) {
        throw accountAssetError(payload.error);
      }
      return payload;
    },
  };
}

function createHostUnavailableResponse(): Response {
  return Response.json(
    {
      error: {
        reasonKey: 'coreui.errors.builder.command.hostUnavailable',
        message: 'Builder lost its connection to the account host.',
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
  metaRef: MutableRefObject<SessionMeta>;
}) {
  const hostOriginRef = useRef<string | null>(null);

  const postUpsell = useCallback((message: BobWidgetUpsellMessage | BobSystemUpsellMessage) => {
    const targetOrigin = hostOriginRef.current;
    if (!targetOrigin) {
      throw new Error('coreui.errors.builder.command.hostUnavailable');
    }
    window.parent.postMessage(message, targetOrigin);
  }, []);

  const requestWidgetUpsell = useCallback(
    (capability: string, messageId: string, required: boolean | number) => {
      postUpsell({ type: 'bob:upsell', capability, messageId, required });
    },
    [postUpsell],
  );

  const requestSystemUpsell = useCallback(
    (reasonKey: string, detail?: string) => {
      postUpsell({
        type: 'bob:upsell',
        reasonKey,
        ...(detail ? { detail } : {}),
      });
    },
    [postUpsell],
  );

  const waitForHostOrigin = useCallback(async (): Promise<string | null> => {
    const existing = hostOriginRef.current;
    if (existing) return existing;
    if (typeof window === 'undefined') return null;

    const deadline = Date.now() + HOST_ORIGIN_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, HOST_ORIGIN_POLL_MS));
      const next = hostOriginRef.current;
      if (next) return next;
    }
    return null;
  }, []);

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
    async (commandArgs: {
      command: BobAccountCommand;
      instanceId?: string;
      headers?: Record<string, string>;
      body?: unknown;
      timeoutMs?: number;
      onActivity?: (event: AgentActivityEvent) => void;
    }): Promise<{ ok: boolean; status: number; payload: any; message?: string }> => {
      const targetOrigin = await waitForHostOrigin();
      if (!targetOrigin) {
        return Promise.reject(new Error('coreui.errors.builder.command.hostUnavailable'));
      }

      const requestId = crypto.randomUUID();
      const message: BobAccountCommandMessage = {
        type: 'bob:account-command',
        requestId,
        command: commandArgs.command,
        ...(commandArgs.instanceId ? { instanceId: commandArgs.instanceId } : {}),
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
          const data = event.data as HostAccountCommandResultMessage | HostAgentActivityMessage | null;
          if (!data || typeof data !== 'object') return;
          if (data.requestId !== requestId) return;
          if (data.type === 'host:agent-activity') {
            commandArgs.onActivity?.(data.event);
            return;
          }
          if (data.type !== 'host:account-command-result') return;
          cleanup();
          resolve({
            ok: data.ok,
            status: data.status,
            payload: data.payload,
            message: data.message,
          });
        };

        window.addEventListener('message', onMessage);
        timeoutTimer = window.setTimeout(() => {
          cleanup();
          reject(new Error('coreui.errors.builder.command.timeout'));
        }, commandArgs.timeoutMs ?? 15_000);

        try {
          window.parent?.postMessage(message, targetOrigin);
        } catch (error) {
          cleanup();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    [waitForHostOrigin],
  );

  const accountAssets = useRef<AccountAssetsTransport | null>(null);

  const dispatchHostedAssetCommand = useCallback(
    async (commandArgs: {
      command: Extract<BobAccountCommand, 'list-assets' | 'resolve-assets' | 'upload-asset'>;
      headers?: Record<string, string>;
      body?: unknown;
    }): Promise<Response> => {
      const instanceId = args.metaRef.current?.instanceId;
      const result = await dispatchHostAccountCommand({
        command: commandArgs.command,
        ...(instanceId ? { instanceId } : {}),
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
      resolveAssets: async (assetRefs: string[]) => {
        const headers = {
          accept: 'application/json',
          'content-type': 'application/json',
        };
        const body = { assetRefs };
        return dispatchHostedAssetCommand({
          command: 'resolve-assets',
          headers,
          body,
        });
      },
      uploadAsset: async (file: File, source: string) => {
        const headers = {
          accept: 'application/json',
          'content-type': file.type,
          'x-filename': file.name,
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
    const instanceId = args.metaRef.current?.instanceId;
    if (inputUrl === '/api/ai/widget-copilot') {
      if (!instanceId) {
        return createHostUnavailableResponse();
      }
      const body = await readRequestJsonBody(input, init);
      const result = await dispatchHostAccountCommand({
        command: 'run-copilot',
        instanceId,
        // Copilot turns are variable-latency: a large draft_edit (many ops) on a
        // reasoning model can exceed the 15s default and trip
        // coreui.errors.builder.command.timeout. Match the 120s ceiling other host
        // commands use. Proper long-term fix is end-to-end streaming (121C §6).
        timeoutMs: 120_000,
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
    return fetch(input, init);
  }, [
    args.metaRef,
    dispatchHostAccountCommand,
    normalizeInputUrl,
    readRequestJsonBody,
  ]);

  const executeAccountCommand: ExecuteAccountCommand = useCallback(
    async (commandArgs: ExecuteAccountCommandArgs) => {
      const result = await dispatchHostAccountCommand({
        command: commandArgs.command,
        instanceId: commandArgs.instanceId,
        ...(commandArgs.command === 'update-instance' ? { timeoutMs: 120_000 } : {}),
        ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
      });
      return { ok: result.ok, status: result.status, json: result.payload };
    },
    [dispatchHostAccountCommand],
  );

  const listTranslations: ListTranslations = useCallback(
    async (commandArgs: ListTranslationsArgs) => {
      const result = await dispatchHostAccountCommand({
        command: 'list-translations',
        instanceId: commandArgs.instanceId,
        body: {
          baseLocale: commandArgs.baseLocale,
        },
      });
      return { ok: result.ok, status: result.status, json: result.payload };
    },
    [dispatchHostAccountCommand],
  );

  const readTranslation: ReadTranslation = useCallback(
    async (commandArgs: ReadTranslationArgs) => {
      const result = await dispatchHostAccountCommand({
        command: 'read-translation',
        instanceId: commandArgs.instanceId,
        body: {
          locale: commandArgs.locale,
        },
      });
      return { ok: result.ok, status: result.status, json: result.payload };
    },
    [dispatchHostAccountCommand],
  );

  const generateTranslations: GenerateTranslations = useCallback(
    async (commandArgs: GenerateTranslationsArgs) => {
      const result = await dispatchHostAccountCommand({
        command: 'generate-translations',
        instanceId: commandArgs.instanceId,
        timeoutMs: 120_000,
        onActivity: commandArgs.onActivity,
      });
      return { ok: result.ok, status: result.status, json: result.payload };
    },
    [dispatchHostAccountCommand],
  );

  const runCopilot: RunCopilot = useCallback(
    (commandArgs: RunCopilotArgs) => {
      const requestId = crypto.randomUUID();

      const completed = (async () => {
        const targetOrigin = await waitForHostOrigin();
        if (!targetOrigin) {
          throw new Error('coreui.errors.builder.command.hostUnavailable');
        }

        const message: BobAccountCommandMessage = {
          type: 'bob:account-command',
          requestId,
          command: 'run-copilot',
          ...(commandArgs.instanceId ? { instanceId: commandArgs.instanceId } : {}),
          ...(typeof commandArgs.body === 'undefined' ? {} : { body: commandArgs.body }),
        };

        return new Promise<{ ok: boolean; status: number; payload: unknown }>((resolve, reject) => {
          let timeoutTimer: number | null = null;

          const cleanup = () => {
            if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
            window.removeEventListener('message', onMessage);
          };

          const onMessage = (event: MessageEvent) => {
            if (event.origin !== targetOrigin) return;
            if (event.source !== window.parent) return;
            const data = event.data as HostAccountCommandResultMessage | HostCopilotEventMessage | null;
            if (!data || typeof data !== 'object') return;
            if (data.requestId !== requestId) return;
            if (data.type === 'host:copilot-event') {
              commandArgs.onCopilotEvent?.(data.event);
              return;
            }
            if (data.type !== 'host:account-command-result') return;
            cleanup();
            resolve({
              ok: data.ok,
              status: data.status,
              payload: data.payload,
            });
          };

          window.addEventListener('message', onMessage);
          timeoutTimer = window.setTimeout(() => {
            cleanup();
            reject(new Error('coreui.errors.builder.command.timeout'));
          }, commandArgs.timeoutMs ?? 120_000);

          try {
            window.parent?.postMessage(message, targetOrigin);
          } catch (error) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      })();

      return { requestId, completed };
    },
    [waitForHostOrigin],
  );

  const cancelCopilot: CancelCopilot = useCallback(
    (requestId: string) => {
      void waitForHostOrigin().then((targetOrigin) => {
        if (!targetOrigin) return;
        const message: BobAccountCommandMessage = {
          type: 'bob:account-command',
          requestId: crypto.randomUUID(),
          command: 'cancel-copilot',
          body: { requestId },
        };
        try {
          window.parent?.postMessage(message, targetOrigin);
        } catch {}
      });
    },
    [waitForHostOrigin],
  );

  return {
    accountAssets: accountAssets.current,
    hostOriginRef,
    requestWidgetUpsell,
    requestSystemUpsell,
    fetchApi,
    executeAccountCommand,
    listTranslations,
    readTranslation,
    generateTranslations,
    runCopilot,
    cancelCopilot,
  };
}
