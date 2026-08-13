'use client';

import { parseAccountLocaleListStrict, parseAccountLocalePolicyStrict } from '@clickeen/ck-contracts';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import { isProductCopilotTurnEvent, type ProductCopilotTurnEvent } from '@clickeen/ck-contracts/ai';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveBobBaseUrl } from '../lib/env/bob';
import { buildWidgetPublicActions, type WidgetPublicActions } from '../lib/public-widget-actions';
import { useRomaAccountApi } from './account-api';
import { getWidgetEditorArtifact } from './widget-editor-artifact';
import { useRomaAccountContext } from './roma-account-context';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaShellActions } from './roma-shell';
import { WidgetCopyCodeDialog } from './widget-copy-code-dialog';

type BuilderDomainProps = {
  initialInstanceId?: string;
};

const OPEN_EDITOR_TIMEOUT_MS = 7000;
const OPEN_EDITOR_RECONCILE_DELAYS_MS = [250, 1000, 2500] as const;
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
  | 'generate-translations'
  | 'run-copilot'
  | 'cancel-copilot';

type BobAccountCommandMessage = {
  type: 'bob:account-command';
  requestId?: string | null;
  command?: BobAccountCommand | null;
  instanceId?: string | null;
  headers?: Record<string, string>;
  body?: unknown;
};

type BobUpsellMessage = {
  type: 'bob:upsell';
  cta?: 'upgrade' | string | null;
  reasonKey?: string | null;
};

type BobHostActionMessage = {
  type: 'bob:host-action';
  action?: 'open-navigation' | 'copy-code' | string | null;
};

function resolveBobUpsellReason(reasonKey: string | null | undefined): string {
  if (reasonKey === 'coreui.upsell.reason.limitReached') return "You've reached your plan limit.";
  if (reasonKey === 'coreui.upsell.reason.flagBlocked') return 'This option is not available on your current plan.';
  return 'This action requires a plan upgrade.';
}

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

type AgentActivityEvent = {
  message: string;
};

type HostAgentActivityMessage = {
  type: 'host:agent-activity';
  requestId: string;
  command: BobAccountCommand;
  instanceId?: string;
  event: AgentActivityEvent;
};

type HostCopilotEventMessage = {
  type: 'host:copilot-event';
  requestId: string;
  instanceId?: string;
  event: ProductCopilotTurnEvent;
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
  publicPackage: {
    indexHtml: string;
    stylesCss: string;
    runtimeJs: string;
  };
  fontLibrary: AccountFontLibrary;
  publishStatus?: 'published' | 'unpublished';
  publicActions: WidgetPublicActions | null;
  policy?: unknown;
  copilot?: unknown;
  translationSetup?: {
        baseLocale: string;
    planTranslationsMax: number | null;
    activeLocales: string[];
  };
};

type BobOpenEditorPayload = Omit<BobOpenEditorMessage, 'requestId'>;

type BuilderOpenResponse = {
  instanceId: string;
  displayName: string;
  widgetType: string;
  config: Record<string, unknown>;
  publicPackage: {
    indexHtml: string;
    stylesCss: string;
    runtimeJs: string;
  };
  fontLibrary: AccountFontLibrary;
  publishStatus?: 'published' | 'unpublished';
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
  const invalidConfigPrefix = 'coreui.errors.instance.config.invalid:';
  if (normalized.startsWith(invalidConfigPrefix)) {
    const path = normalized.slice(invalidConfigPrefix.length).trim();
    return path
      ? `This widget has invalid saved data at ${path} and cannot open right now.`
      : BUILDER_REASON_COPY['coreui.errors.instance.config.invalid'];
  }
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.') || normalized.startsWith('roma.')) {
    return fallback;
  }
  return normalized;
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
    case 'generate-translations':
      if (!instanceId) return null;
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/generate`,
      };
    case 'run-copilot':
      if (!instanceId) return null;
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/copilot`,
      };
    case 'cancel-copilot':
      // Handled locally via the AbortController registry — does not map to a Roma route.
      return null;
    default:
      return null;
  }
}

function buildTranslationSetup(args: {
  baseLocale: string;
  activeAccount: ReturnType<typeof useRomaAccountContext>['activeAccount'];
  accountPolicy: ReturnType<typeof useRomaAccountContext>['accountPolicy'];
}): BobOpenEditorPayload['translationSetup'] {
  const activeLocales = parseAccountLocaleListStrict(args.activeAccount.activeLocales)
    .filter((locale) => locale !== args.baseLocale);
  const planTranslationsMax = args.accountPolicy.limits['l10n.locales.max'];
  return {
        baseLocale: args.baseLocale,
    planTranslationsMax: typeof planTranslationsMax === 'number' && Number.isFinite(planTranslationsMax)
      ? Math.max(0, Math.floor(planTranslationsMax))
      : null,
    activeLocales,
  };
}

function isAccountAssetCommand(command: BobAccountCommand): boolean {
  return command === 'list-assets' || command === 'resolve-assets' || command === 'upload-asset';
}

function isStreamedCommandResult(value: unknown): value is { status: number; payload: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.status === 'number' && Number.isFinite(record.status) && 'payload' in record;
}

async function readJsonOrStreamedCommandResult(args: {
  response: Response;
  onActivity: (event: AgentActivityEvent) => void;
}): Promise<unknown> {
  const contentType = args.response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') || !args.response.body) {
    return args.response.json().catch(() => null);
  }

  const reader = args.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: unknown = null;

  const consumeEvent = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }
    if (!dataLines.length) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (eventName === 'activity' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === 'string') args.onActivity({ message });
      return;
    }
    if (eventName === 'result') {
      finalPayload = parsed;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      consumeEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  const tail = `${buffer}${decoder.decode()}`.trim();
  if (tail) consumeEvent(tail);
  if (!isStreamedCommandResult(finalPayload)) {
    return {
      status: 502,
      payload: {
        error: {
          kind: 'UPSTREAM_UNAVAILABLE',
          reasonKey: 'coreui.errors.builder.command.invalid',
          detail: 'host_command_stream_missing_result',
        },
      },
    };
  }
  return finalPayload;
}

type CopilotStreamOutcome =
  | { ok: true; status: number }
  | { ok: false; status: number; message: string }
  | { ok: 'cancelled' };

/**
 * PRD 128D Phase 4/5 — Reads the Product Copilot SSE stream relayed by Roma
 * and forwards each validated ProductCopilotTurnEvent to Bob as a
 * host:copilot-event. Unlike readJsonOrStreamedCommandResult, this does NOT
 * look for a terminal `result` frame: the stream is a turn event log whose
 * terminal marker is agent_turn_finished / agent_turn_error / agent_turn_stopped.
 *
 * Rejection is terminal and visible: on a malformed frame Roma emits a final
 * synthetic agent_turn_error (so Bob's UI shows the failure) and returns a
 * non-ok outcome that the caller translates into host:account-command-result.
 */
async function readCopilotStreamedEvents(args: {
  response: Response;
  requestId: string;
  instanceId?: string;
  source: Window;
  bobBaseUrl: string;
  signal?: AbortSignal;
}): Promise<CopilotStreamOutcome> {
  const body = args.response.body;
  if (!body) {
    return { ok: false, status: 502, message: 'coreui.errors.copilot.failed' };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastUserTurnId = '';

  const postEvent = (event: ProductCopilotTurnEvent) => {
    const message: HostCopilotEventMessage = {
      type: 'host:copilot-event',
      requestId: args.requestId,
      ...(args.instanceId ? { instanceId: args.instanceId } : {}),
      event,
    };
    args.source.postMessage(message, args.bobBaseUrl);
  };

  const reject = (detail: string): CopilotStreamOutcome => {
    postEvent({
      version: 1,
      userTurnId: lastUserTurnId || args.requestId,
      type: 'agent_turn_error',
      data: {
        code: 'STREAM_INVALID',
        reasonKey: 'coreui.errors.copilot.failed',
        message: detail,
        requestId: args.requestId,
      },
    });
    return { ok: false, status: 502, message: 'coreui.errors.copilot.failed' };
  };

  const consumeFrame = (raw: string): CopilotStreamOutcome | null => {
    const lines = raw.split('\n');
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        // Per SSE spec, a single leading space after the colon is stripped.
        dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
      }
    }
    if (!dataLines.length) return null; // keepalive / comment frame

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return reject('Malformed JSON in copilot event frame.');
    }
    if (!isProductCopilotTurnEvent(parsed)) {
      return reject('Invalid copilot turn event payload.');
    }
    if (eventName !== parsed.type) {
      return reject(`Copilot event name mismatch (${eventName} vs ${parsed.type}).`);
    }
    lastUserTurnId = parsed.userTurnId;
    postEvent(parsed);
    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        // CRLF-normalize the buffer so frame boundary detection is consistent
        // regardless of which hop terminated its lines.
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      }
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');
        const outcome = consumeFrame(frame);
        if (outcome) {
          await reader.cancel().catch(() => {});
          return outcome;
        }
      }
      if (done) break;
    }
    const tail = `${buffer}${decoder.decode()}`
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
    if (tail) {
      const outcome = consumeFrame(tail);
      if (outcome) return outcome;
    }
  } catch (error) {
    // Downstream cancellation: release the reader without surfacing an error.
    // The cancel-copilot handler owns the host:account-command-result reply.
    if (args.signal?.aborted) {
      return { ok: 'cancelled' };
    }
    return reject(error instanceof Error ? error.message : String(error));
  }

  return { ok: true, status: 200 };
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
  const { openNavigation } = useRomaShellActions();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bobReadyRef = useRef(false);
  const openDispatchSeqRef = useRef(0);
  const bobAppliedInstanceIdRef = useRef('');
  const bobIsDirtyRef = useRef(false);
  const activeInstanceIdRef = useRef('');
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  const allowPopStateRef = useRef(false);
  const copilotAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const [activeInstanceId, setActiveInstanceId] = useState(() => {
    const fromPath = decodeBuilderPathInstanceId(pathname);
    if (fromPath) return fromPath;
    return String(initialInstanceId || '').trim();
  });
  const [openError, setOpenError] = useState<string | null>(null);
  const [publicActionContext, setPublicActionContext] = useState<{
    instanceName: string;
    actions: WidgetPublicActions;
  } | null>(null);
  const [copyCodeOpen, setCopyCodeOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [upsellReason, setUpsellReason] = useState<string | null>(null);

  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(), []);
  const currentUrl = pathname;
  const pathInstanceId = useMemo(() => decodeBuilderPathInstanceId(pathname), [pathname]);

  const keepEditing = useCallback(() => {
    pendingDiscardActionRef.current = null;
    setUnsavedDialogOpen(false);
  }, []);

  const discardAndContinue = useCallback(() => {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    setUnsavedDialogOpen(false);
    if (action) window.requestAnimationFrame(action);
  }, []);

  const requestGuardedNavigation = useCallback((action: () => void) => {
    if (!bobIsDirtyRef.current) {
      action();
      return;
    }
    pendingDiscardActionRef.current = action;
    setUnsavedDialogOpen(true);
  }, []);

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
    async (args: { source: Window; requestId: string; command: BobAccountCommand; instanceId?: string; headers?: Record<string, string>; body?: unknown }) => {
      const reply = (payload: Omit<HostAccountCommandResultMessage, 'type'>) => {
        const message: HostAccountCommandResultMessage = {
          type: 'host:account-command-result',
          ...payload,
        };
        args.source.postMessage(message, bobBaseUrl);
      };
      const sendActivity = (event: AgentActivityEvent) => {
        const message: HostAgentActivityMessage = {
          type: 'host:agent-activity',
          requestId: args.requestId,
          command: args.command,
          ...(args.instanceId ? { instanceId: args.instanceId } : {}),
          event,
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

      if (args.command === 'run-copilot') {
        const controller = new AbortController();
        copilotAbortControllers.current.set(args.requestId, controller);
        try {
          const init: RequestInit = {
            method: route.method,
            signal: controller.signal,
          };
          const headers = new Headers(accountApi.buildHeaders());
          for (const [key, value] of Object.entries(args.headers ?? {})) {
            headers.set(key, value);
          }
          headers.set('accept', 'text/event-stream');
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
          const outcome = await readCopilotStreamedEvents({
            response,
            requestId: args.requestId,
            ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
            source: args.source,
            bobBaseUrl,
            signal: controller.signal,
          });
          if (outcome.ok === 'cancelled') return;
          reply({
            requestId: args.requestId,
            command: args.command,
            ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
            ok: outcome.ok,
            status: outcome.status,
            ...(outcome.ok ? {} : { message: outcome.message }),
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          const message = error instanceof Error ? error.message : String(error);
          reply({
            requestId: args.requestId,
            command: args.command,
            ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
            ok: false,
            status: 500,
            message,
          });
        } finally {
          copilotAbortControllers.current.delete(args.requestId);
        }
        return;
      }

      try {
        const init: RequestInit = {
          method: route.method,
        };
        const headers = new Headers(accountApi.buildHeaders());
        for (const [key, value] of Object.entries(args.headers ?? {})) {
          headers.set(key, value);
        }
        // run-copilot is handled in its own streaming branch above; this path
        // only needs to force the SSE accept header for generate-translations.
        if (args.command === 'generate-translations') {
          headers.set('accept', 'text/event-stream');
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
        const resultPayload = await readJsonOrStreamedCommandResult({
          response,
          onActivity: sendActivity,
        });
        const streamedResult = isStreamedCommandResult(resultPayload) ? resultPayload : null;
        const status = streamedResult ? streamedResult.status : response.status;
        const payload = streamedResult ? streamedResult.payload : resultPayload;

        reply({
          requestId: args.requestId,
          command: args.command,
          ...(scopedInstanceId ? { instanceId: scopedInstanceId } : {}),
          ok: status >= 200 && status < 300,
          status,
          payload,
          message:
            (status >= 200 && status < 300) || !payload || typeof payload !== 'object'
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
    setCopyCodeOpen(false);
    setPublicActionContext(null);

    try {
      const builderOpen = await accountApi.fetchJson<BuilderOpenResponse>(`/api/builder/${encodeURIComponent(activeInstanceId)}/open`);
      const widgetType = builderOpen.widgetType;
      const compiled = await getWidgetEditorArtifact(widgetType);

      if (openSeq !== openDispatchSeqRef.current) return;

      const resolvedInstanceId = typeof builderOpen.instanceId === 'string' ? builderOpen.instanceId.trim() : '';
      if (!resolvedInstanceId || resolvedInstanceId !== activeInstanceId) {
        throw new Error('coreui.errors.payload.invalid');
      }
      if (builderOpen.publishStatus !== 'published' && builderOpen.publishStatus !== 'unpublished') {
        throw new Error('coreui.errors.payload.invalid');
      }
      const label = typeof builderOpen?.displayName === 'string' && builderOpen.displayName.trim() ? builderOpen.displayName.trim() : resolvedInstanceId;
      const config = builderOpen.config as Record<string, unknown>;
      const baseLocale = parseAccountLocalePolicyStrict(activeAccount.localePolicy).baseLocale;
      const translationSetup = buildTranslationSetup({
        baseLocale,
        activeAccount,
        accountPolicy,
      });
      const nextPublicActions = builderOpen.publishStatus === 'published'
        ? buildWidgetPublicActions({
            accountPublicId: activeAccount.accountPublicId,
            instanceId: resolvedInstanceId,
          })
        : null;
      const message: BobOpenEditorPayload = {
        type: 'ck:open-editor',
        accountPublicId: activeAccount.accountPublicId,
        instanceId: resolvedInstanceId,
        baseLocale,
        label,
        widgetname: widgetType,
        compiled,
        instanceData: config,
        publicPackage: builderOpen.publicPackage,
        fontLibrary: builderOpen.fontLibrary,
        publishStatus: builderOpen.publishStatus,
        publicActions: nextPublicActions,
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
      setPublicActionContext(nextPublicActions ? { instanceName: label, actions: nextPublicActions } : null);
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

  const handleBobIframeLoad = useCallback(() => {
    bobReadyRef.current = true;
    if (!activeInstanceIdRef.current) return;
    void openActiveInstanceInBobRef.current();
  }, []);

  useEffect(() => {
    const controllers = copilotAbortControllers.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== bobBaseUrl) return;
      const source = iframeRef.current?.contentWindow;
      if (!source || event.source !== source) return;
      const data = event.data as BobReadyMessage | BobDirtyStateChangedMessage | BobAccountCommandMessage | BobUpsellMessage | BobHostActionMessage | null;
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
      if (data.type === 'bob:upsell') {
        if (data.cta === 'upgrade') setUpsellReason(resolveBobUpsellReason(data.reasonKey));
        return;
      }
      if (data.type === 'bob:host-action') {
        if (data.action === 'open-navigation') {
          openNavigation(iframeRef.current);
        } else if (data.action === 'copy-code') {
          if (publicActionContext) setCopyCodeOpen(true);
          else setOpenError('coreui.errors.builder.publicActions.invalid');
        }
        return;
      }
      if (data.type === 'bob:account-command') {
        const message = data as BobAccountCommandMessage;
        const requestId = typeof message.requestId === 'string' ? message.requestId.trim() : '';
        const command = message.command ?? null;
        const instanceId = typeof message.instanceId === 'string' ? message.instanceId.trim() : '';
        if (!requestId || !command) return;
        if (command === 'cancel-copilot') {
          const controller = copilotAbortControllers.current.get(requestId);
          if (controller) {
            controller.abort();
            copilotAbortControllers.current.delete(requestId);
            const result: HostAccountCommandResultMessage = {
              type: 'host:account-command-result',
              requestId,
              command,
              ok: true,
              status: 200,
            };
            source.postMessage(result, bobBaseUrl);
          } else {
            const result: HostAccountCommandResultMessage = {
              type: 'host:account-command-result',
              requestId,
              command,
              ok: false,
              status: 404,
              message: 'coreui.errors.copilot.notFound',
            };
            source.postMessage(result, bobBaseUrl);
          }
          return;
        }
        if (!instanceId && !isAccountAssetCommand(command)) return;
        void runBobAccountCommand({
          source,
          requestId,
          command,
          ...(instanceId ? { instanceId } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
          ...(typeof message.body === 'undefined' ? {} : { body: message.body }),
        });
        return;
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [activeInstanceId, bobBaseUrl, openNavigation, publicActionContext, runBobAccountCommand]);

  useEffect(() => {
    bobReadyRef.current = false;
    openDispatchSeqRef.current += 1;
    bobAppliedInstanceIdRef.current = '';
    bobIsDirtyRef.current = false;
    setCopyCodeOpen(false);
    setPublicActionContext(null);
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
    if (!activeInstanceId) return;
    let cancelled = false;
    const timers = OPEN_EDITOR_RECONCILE_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        if (cancelled) return;
        const requestedInstanceId = activeInstanceIdRef.current;
        if (!requestedInstanceId) return;
        if (bobAppliedInstanceIdRef.current === requestedInstanceId) return;
        if (!iframeRef.current?.contentWindow) return;
        bobReadyRef.current = true;
        void openActiveInstanceInBobRef.current();
      }, delay),
    );
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeInstanceId, bobSrc]);

  useEffect(() => {
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
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestGuardedNavigation(() => {
        allowNavigationRef.current = true;
        (navigable as HTMLElement).click();
      });
    };

    const handlePopState = () => {
      if (!bobIsDirtyRef.current) return;
      if (allowPopStateRef.current) {
        allowPopStateRef.current = false;
        return;
      }
      const holdInstanceId = bobAppliedInstanceIdRef.current || activeInstanceIdRef.current;
      const holdRoute = holdInstanceId ? buildRomaBuilderRoute({ instanceId: holdInstanceId }) : '/builder';
      window.history.pushState(null, '', holdRoute);
      if (holdInstanceId) {
        setActiveInstanceId(holdInstanceId);
      }
      pendingDiscardActionRef.current = () => {
        allowPopStateRef.current = true;
        window.history.back();
      };
      setUnsavedDialogOpen(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
    };
  }, [requestGuardedNavigation]);

  const builderOpenErrorCopy = resolveBuilderErrorCopy(openError || '', 'Builder could not open this widget. Please try again.');

  if (!activeInstanceId) {
    return (
      <div className="rd-canvas-module">
        <p className="body-m">No instance selected for Builder.</p>
        <p className="body-m">Select a concrete instance from Widgets and open Edit.</p>
        <div className="rd-canvas-module__actions">
          <Link className="diet-button" data-size="medium" data-type="primary" href="/widgets">
            <span className="diet-button__label">Open widgets</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {openError ? (
        <div className="rd-canvas-module roma-builder-error">
          <p className="body-m">{builderOpenErrorCopy}</p>
          <div className="rd-canvas-module__actions">
            <button className="diet-button" data-size="medium" data-type="primary" type="button" onClick={() => void openActiveInstanceInBob()}>
              <span className="diet-button__label">Retry</span>
            </button>
          </div>
        </div>
      ) : null}
      <iframe
        ref={iframeRef}
        src={bobSrc}
        className="roma-builder__iframe"
        title="Bob Builder"
        onLoad={handleBobIframeLoad}
      />
      <WidgetCopyCodeDialog
        open={copyCodeOpen}
        instanceName={publicActionContext?.instanceName ?? ''}
        actions={publicActionContext?.actions ?? null}
        onClose={() => setCopyCodeOpen(false)}
      />
      <RomaUnsavedChangesDialog
        open={unsavedDialogOpen}
        message="You have unsaved Builder edits."
        onKeepEditing={keepEditing}
        onDiscard={discardAndContinue}
      />
      <RomaUpsellDialog
        open={Boolean(upsellReason)}
        reason={upsellReason ?? undefined}
        onClose={() => setUpsellReason(null)}
      />
    </>
  );
}
