'use client';

import type { CompiledWidget } from '@clickeen/bob/types';
import type { AccountAssetHostCommand } from '@clickeen/ck-contracts';
import type { ProductCopilotTurnEvent } from '@clickeen/ck-contracts/ai';
import type { AgentRuntimePolicyUi, Policy } from '@clickeen/ck-policy';
import type { AccountFontLibrary } from '@clickeen/widget-foundation';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { resolveBobBaseUrl } from '../lib/env/bob';
import {
  createHostSaveRequestMessage,
  readBobSaveControlPhase,
  type BobSaveControlPhase,
  type BobSaveControlStateMessage,
} from '../lib/builder-host-protocol';
import { formatAccountTierLabel } from '../lib/format';
import { ROMA_UI_COPY } from '../lib/ui-copy';
import { useRomaAccountApi } from './account-api';
import { getWidgetEditorArtifact } from './widget-editor-artifact';
import { useRomaAccountContext } from './roma-account-context';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import {
  RomaUpsellDialog,
  resolveTargetPlan,
  type UpsellPresentation,
} from './roma-upsell-dialog';
import { RomaPageHeader } from './roma-page-header';
import { useRomaShellActions } from './roma-shell';
import { WidgetPublicationControls, WidgetPublicationState } from './widget-publication-controls';
import {
  upsertRomaWidgetInstanceCache,
  type WidgetInstance,
} from './use-roma-widgets';

type BuilderDomainProps = {
  initialInstanceId?: string;
  initialWidgetType?: string;
};

const OPEN_EDITOR_TIMEOUT_MS = 7000;
const UNSAVED_OPEN_REASON = 'coreui.errors.builder.open.unsavedChanges';

type BobReadyMessage = {
  type: 'bob:session-ready';
};

type BobDirtyStateChangedMessage = {
  type: 'bob:dirty-state-changed';
  isDirty: boolean;
};

type BobOpenEditorAppliedMessage = {
  type: 'bob:open-editor-applied';
  requestId: string;
};

type BobOpenEditorFailedMessage = {
  type: 'bob:open-editor-failed';
  requestId: string;
  reasonKey: string;
  message?: string;
};

type BobAccountCommand =
  | 'save-instance'
  | AccountAssetHostCommand
  | 'list-translations'
  | 'read-translation'
  | 'generate-translations'
  | 'run-copilot'
  | 'cancel-copilot';

type BobSavedInstanceAccountCommand = Exclude<
  BobAccountCommand,
  AccountAssetHostCommand | 'cancel-copilot' | 'save-instance'
>;

type BobAccountCommandMessageBase = {
  type: 'bob:account-command';
  requestId: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type BobAccountCommandMessage =
  | (BobAccountCommandMessageBase & {
      command: BobSavedInstanceAccountCommand;
      instanceId: string;
    })
  | (BobAccountCommandMessageBase & {
      command: 'save-instance';
      instanceId?: string;
    })
  | (BobAccountCommandMessageBase & {
      command: AccountAssetHostCommand;
      instanceId?: string;
    })
  | (BobAccountCommandMessageBase & {
      command: 'cancel-copilot';
      body: { requestId: string };
    });

type BobWidgetUpsellMessage = {
  type: 'bob:upsell';
  capability: string;
  messageId: string;
  required: boolean | number;
};

type BobSystemUpsellMessage = {
  type: 'bob:upsell';
  reasonKey: string;
  detail?: string;
};

type BobUpsellMessage = BobWidgetUpsellMessage | BobSystemUpsellMessage;

function resolveBobSystemUpsellBody(reasonKey: string): string {
  switch (reasonKey) {
    case 'coreui.upsell.reason.limitReached':
      return 'This exceeds your current plan limit.';
    case 'coreui.upsell.reason.platform.uploads':
      return 'Uploads are not available on your current plan.';
    default:
      throw new Error(reasonKey);
  }
}

function composeWidgetUpsellBody(args: {
  compiled: CompiledWidget;
  policy: Policy;
  capability: string;
  messageId: string;
  required: boolean | number;
}): UpsellPresentation {
  const targetPlan = resolveTargetPlan(args.policy, args.capability, args.required);
  return targetPlan
    ? {
        body: args.compiled.upsell.messages[args.messageId]
          .replaceAll('{currentPlan}', formatAccountTierLabel(args.policy.profile))
          .replaceAll('{targetPlan}', formatAccountTierLabel(targetPlan)),
        upgradeAvailable: true,
      }
    : {
        body: `Your current plan is ${formatAccountTierLabel(args.policy.profile)}. You have reached the maximum capacity currently available for this feature.`,
        upgradeAvailable: false,
      };
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
  instanceId: string | null;
  baseLocale: string;
  label: string | null;
  widgetname: string;
  compiled: CompiledWidget;
  instanceData: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
  policy: unknown;
  copilot: AgentRuntimePolicyUi | null;
  translationSetup: {
    baseLocale: string;
    planTranslationsMax: number | null;
    activeLocales: string[];
  };
};

type BobOpenEditorPayload = Omit<BobOpenEditorMessage, 'requestId'>;

type BuilderOpenResponseBase = {
  displayName: string | null;
  widgetType: string;
  baseLocale: string;
  config: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
  copilot: AgentRuntimePolicyUi | null;
};

type BuilderOpenResponse = BuilderOpenResponseBase & (
  | {
      instanceId: string;
      publishStatus: 'published' | 'unpublished';
      publishedAt: string | null;
      sourceUpdatedAt: string;
    }
  | {
      instanceId: null;
      publishStatus: null;
      publishedAt: null;
      sourceUpdatedAt: null;
    }
);

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

function buildRomaNewBuilderRoute(args: { widgetType: string }): string {
  return `/builder/new/${encodeURIComponent(args.widgetType)}`;
}

function resolveBobAccountCommandRequest(args: {
  command: BobAccountCommand;
  instanceId?: string;
  body?: unknown;
}): { method: 'GET' | 'PUT' | 'POST' | 'DELETE'; path: string } | null {
  const instanceId = args.instanceId ?? '';

  switch (args.command) {
    case 'save-instance':
      return instanceId
        ? {
            method: 'PUT',
            path: `/api/account/instances/${encodeURIComponent(instanceId)}`,
          }
        : {
            method: 'POST',
            path: '/api/account/instances',
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
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations`,
      };
    case 'read-translation':
      const { locale } = args.body as { locale: string };
      return {
        method: 'GET',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/${encodeURIComponent(locale)}`,
      };
    case 'generate-translations':
      return {
        method: 'POST',
        path: `/api/account/instances/${encodeURIComponent(instanceId)}/translations/generate`,
      };
    case 'run-copilot':
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
  const planTranslationsMax = args.accountPolicy.limits['l10n.locales.max'];
  return {
    baseLocale: args.baseLocale,
    planTranslationsMax,
    activeLocales: args.activeAccount.activeLocales,
  };
}

function isAccountAssetCommand(command: BobAccountCommand): command is AccountAssetHostCommand {
  return command === 'list-assets' || command === 'resolve-assets' || command === 'upload-asset';
}

async function readJsonOrStreamedCommandResult(args: {
  response: Response;
  onActivity: (event: AgentActivityEvent) => void;
}): Promise<{ status: number; payload: unknown }> {
  const contentType = args.response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') || !args.response.body) {
    return { status: args.response.status, payload: await args.response.json() };
  }

  const reader = args.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalPayload: { status: number; payload: unknown } | null = null;

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
    const data = dataLines.join('\n');
    if (eventName === 'activity') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === 'string') args.onActivity({ message });
      return;
    }
    if (eventName === 'result') {
      finalPayload = JSON.parse(data) as { status: number; payload: unknown };
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
  if (!finalPayload) throw new Error('coreui.errors.builder.command.missingResult');
  return finalPayload;
}

type CopilotStreamOutcome =
  | { ok: true; status: number }
  | { ok: false; status: number; message: string }
  | { ok: 'cancelled' };

/**
 * PRD 128D Phase 4/5 — Reads the Product Copilot SSE stream relayed by Roma
 * and forwards each ProductCopilotTurnEvent to Bob as a
 * host:copilot-event. Unlike readJsonOrStreamedCommandResult, this does NOT
 * look for a terminal `result` frame: the stream is a turn event log whose
 * terminal marker is agent_turn_finished / agent_turn_error / agent_turn_stopped.
 *
 * Transport rejection is terminal and visible: on malformed JSON Roma emits a final
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
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('data:')) {
        // Per SSE spec, a single leading space after the colon is stripped.
        dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
      }
    }
    if (!dataLines.length) return null; // keepalive / comment frame

    let parsed: ProductCopilotTurnEvent;
    try {
      parsed = JSON.parse(dataLines.join('\n')) as ProductCopilotTurnEvent;
    } catch {
      return reject('Malformed JSON in copilot event frame.');
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

function decodeBuilderPathWidgetType(pathname: string): string {
  const match = /^\/builder\/new\/([^/?#]+)$/.exec(pathname);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function BuilderDomain({ initialInstanceId = '', initialWidgetType = '' }: BuilderDomainProps) {
  const { activeAccount, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const router = useRouter();
  const pathname = usePathname();
  const { openNavigation } = useRomaShellActions();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const navigationButtonRef = useRef<HTMLButtonElement | null>(null);
  const bobReadyRef = useRef(false);
  const openDispatchSeqRef = useRef(0);
  const openingTargetKeyRef = useRef('');
  const openedTargetKeyRef = useRef('');
  const bobAppliedInstanceIdRef = useRef('');
  const bobIsDirtyRef = useRef(false);
  const publicationPendingRef = useRef(false);
  const publicationIdlePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const resolvePublicationIdleRef = useRef<(() => void) | null>(null);
  const activeCompiledWidgetRef = useRef<CompiledWidget | null>(null);
  const activeInstanceIdRef = useRef('');
  const activeWidgetTypeRef = useRef('');
  const suppressNextOpenInstanceIdRef = useRef('');
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  const allowPopStateRef = useRef(false);
  const copilotAbortControllers = useRef<Map<string, AbortController>>(new Map());
  const [activeInstanceId, setActiveInstanceId] = useState(() => {
    const fromPath = decodeBuilderPathInstanceId(pathname);
    if (fromPath) return fromPath;
    return String(initialInstanceId || '').trim();
  });
  const [activeWidgetType, setActiveWidgetType] = useState(() => {
    if (initialInstanceId) return '';
    return decodeBuilderPathWidgetType(pathname) || String(initialWidgetType || '').trim();
  });
  const [openError, setOpenError] = useState<string | null>(null);
  const [openRetryPending, setOpenRetryPending] = useState(false);
  const [publicationInstance, setPublicationInstance] = useState<WidgetInstance | null>(null);
  const [bobIsDirty, setBobIsDirty] = useState(false);
  const [bobSaveControlPhase, setBobSaveControlPhase] = useState<BobSaveControlPhase>('hidden');
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [upsell, setUpsell] = useState<UpsellPresentation | null>(null);

  const bobBaseUrl = useMemo(() => resolveBobBaseUrl(), []);
  const currentUrl = pathname;

  const handlePublicationPendingChange = useCallback((pending: boolean) => {
    if (pending === publicationPendingRef.current) return;
    publicationPendingRef.current = pending;
    if (pending) {
      publicationIdlePromiseRef.current = new Promise<void>((resolve) => {
        resolvePublicationIdleRef.current = resolve;
      });
      return;
    }
    resolvePublicationIdleRef.current?.();
    resolvePublicationIdleRef.current = null;
    publicationIdlePromiseRef.current = Promise.resolve();
  }, []);

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

  useEffect(() => {
    activeWidgetTypeRef.current = activeWidgetType;
  }, [activeWidgetType]);

  // Active account authoring truth: Roma hosts one current-account Builder session and opens Bob with one explicit payload.
  const bobSrc = useMemo(() => {
    return new URL('/bob', `${bobBaseUrl}/`).toString();
  }, [bobBaseUrl]);

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
      const requestedInstanceId = args.instanceId ?? '';
      const scopedInstanceId = commandUsesActiveInstance
        ? (bobAppliedInstanceIdRef.current || activeInstanceId)
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
      if (
        commandUsesActiveInstance &&
        args.command !== 'save-instance' &&
        !scopedInstanceId
      ) {
        reply({
          requestId: args.requestId,
          command: args.command,
          ok: false,
          status: 409,
          message: 'coreui.errors.builder.saveFirst',
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

      if (args.command === 'save-instance' && publicationPendingRef.current) {
        await publicationIdlePromiseRef.current;
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
        const commandResult = await readJsonOrStreamedCommandResult({
          response,
          onActivity: sendActivity,
        });
        const { status, payload } = commandResult;
        const succeeded = status >= 200 && status < 300;
        let resolvedReplyInstanceId = scopedInstanceId;

        if (succeeded && args.command === 'save-instance') {
          if (!scopedInstanceId) {
            const created = payload as {
              instanceId: string;
              widgetType: string;
              displayName: string | null;
              status: 'unpublished';
              publishedAt: null;
              updatedAt: string;
              baseLocale: string;
            };
            resolvedReplyInstanceId = created.instanceId;
            const nextInstance: WidgetInstance = {
              instanceId: created.instanceId,
              widgetType: created.widgetType,
              displayName: created.displayName,
              status: created.status,
              publishedAt: created.publishedAt,
              updatedAt: created.updatedAt,
            };
            bobAppliedInstanceIdRef.current = created.instanceId;
            activeInstanceIdRef.current = created.instanceId;
            activeWidgetTypeRef.current = '';
            suppressNextOpenInstanceIdRef.current = created.instanceId;
            openedTargetKeyRef.current = `saved:${created.instanceId}`;
            setActiveInstanceId(created.instanceId);
            setActiveWidgetType('');
            setPublicationInstance(nextInstance);
            upsertRomaWidgetInstanceCache(activeAccount.accountPublicId, nextInstance);
            window.history.replaceState(
              window.history.state,
              '',
              buildRomaBuilderRoute({ instanceId: created.instanceId }),
            );
          } else {
            const savedAt = (payload as { updatedAt?: unknown } | null)?.updatedAt;
            if (typeof savedAt === 'string') {
              setPublicationInstance((current) => {
                if (!current || current.instanceId !== scopedInstanceId) return current;
                const next = { ...current, updatedAt: savedAt };
                upsertRomaWidgetInstanceCache(activeAccount.accountPublicId, next);
                return next;
              });
            }
          }
        }

        reply({
          requestId: args.requestId,
          command: args.command,
          ...(resolvedReplyInstanceId ? { instanceId: resolvedReplyInstanceId } : {}),
          ok: succeeded,
          status,
          payload,
          message:
            succeeded || !payload || typeof payload !== 'object'
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
    [accountApi, activeAccount.accountPublicId, activeInstanceId, bobBaseUrl],
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
          if (data.requestId !== requestId) return;

          if (data.type === 'bob:open-editor-applied') {
            succeed();
            return;
          }

          if (data.type === 'bob:open-editor-failed') {
            fail(new Error(data.reasonKey));
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

  const openActiveInstanceInBob = useCallback(async (force = false, preserveError = false) => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow || (!activeInstanceId && !activeWidgetType)) return;
    const targetKey = activeInstanceId
      ? `saved:${activeInstanceId}`
      : `new:${activeWidgetType}`;
    if (!force && (openingTargetKeyRef.current === targetKey || openedTargetKeyRef.current === targetKey)) {
      return;
    }
    openingTargetKeyRef.current = targetKey;

    const openSeq = ++openDispatchSeqRef.current;
    setBobSaveControlPhase('hidden');
    if (!preserveError) setOpenError(null);

    try {
      const openPath = activeInstanceId
        ? `/api/builder/${encodeURIComponent(activeInstanceId)}/open`
        : `/api/builder/new/${encodeURIComponent(activeWidgetType)}/open`;
      const builderOpen = await accountApi.fetchJson<BuilderOpenResponse>(openPath);
      const widgetType = builderOpen.widgetType;
      const compiled = await getWidgetEditorArtifact(widgetType);

      if (openSeq !== openDispatchSeqRef.current) return;

      const resolvedInstanceId = builderOpen.instanceId;
      const label = builderOpen.displayName;
      const config = builderOpen.config;
      const baseLocale = builderOpen.baseLocale;
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
        fontLibrary: builderOpen.fontLibrary,
        policy: accountPolicy,
        copilot: builderOpen.copilot,
        translationSetup,
      };
      await postOpenEditorAndWait({
        targetWindow,
        message,
        openSeq,
      });
      if (openSeq !== openDispatchSeqRef.current) return;
      activeCompiledWidgetRef.current = compiled;
      bobAppliedInstanceIdRef.current = resolvedInstanceId ?? '';
      const newDraftIsDirty = resolvedInstanceId === null;
      bobIsDirtyRef.current = newDraftIsDirty;
      setBobIsDirty(newDraftIsDirty);
      setPublicationInstance(
        resolvedInstanceId && builderOpen.publishStatus
          ? {
              instanceId: resolvedInstanceId,
              widgetType,
              displayName: label,
              status: builderOpen.publishStatus,
              publishedAt: builderOpen.publishedAt,
              updatedAt: builderOpen.sourceUpdatedAt,
            }
          : null,
      );
      openedTargetKeyRef.current = targetKey;
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
      setBobSaveControlPhase('hidden');
    } finally {
      if (openingTargetKeyRef.current === targetKey) {
        openingTargetKeyRef.current = '';
      }
    }
  }, [accountApi, accountPolicy, activeAccount, activeInstanceId, activeWidgetType, currentUrl, postOpenEditorAndWait, router]);

  const retryOpenActiveInstance = useCallback(async () => {
    setOpenRetryPending(true);
    try {
      await openActiveInstanceInBob(true, true);
    } finally {
      setOpenRetryPending(false);
    }
  }, [openActiveInstanceInBob]);

  const openActiveInstanceInBobRef = useRef(openActiveInstanceInBob);
  useEffect(() => {
    openActiveInstanceInBobRef.current = openActiveInstanceInBob;
  }, [openActiveInstanceInBob]);

  const handleBobIframeLoad = useCallback(() => {
    setBobSaveControlPhase('hidden');
    bobReadyRef.current = true;
    if (!activeInstanceIdRef.current && !activeWidgetTypeRef.current) return;
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
      const data = event.data as BobReadyMessage | BobDirtyStateChangedMessage | BobSaveControlStateMessage | BobAccountCommandMessage | BobUpsellMessage | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'bob:session-ready') {
        bobReadyRef.current = true;
        if (activeInstanceId || activeWidgetType) {
          void openActiveInstanceInBobRef.current();
        }
        return;
      }
      if (data.type === 'bob:dirty-state-changed') {
        bobIsDirtyRef.current = data.isDirty;
        setBobIsDirty(data.isDirty);
        return;
      }
      const saveControlPhase = readBobSaveControlPhase({
        data,
        eventOrigin: event.origin,
        bobOrigin: bobBaseUrl,
        eventSource: event.source,
        iframeWindow: source,
      });
      if (saveControlPhase) {
        setBobSaveControlPhase(saveControlPhase);
        return;
      }
      if (data.type === 'bob:upsell') {
        const presentation = 'capability' in data
          ? composeWidgetUpsellBody({
              compiled: activeCompiledWidgetRef.current!,
              policy: accountPolicy,
              capability: data.capability,
              messageId: data.messageId,
              required: data.required,
            })
          : {
              body: resolveBobSystemUpsellBody(data.reasonKey),
              upgradeAvailable: true,
            };
        setUpsell(presentation);
        return;
      }
      if (data.type === 'bob:account-command') {
        const message = data as BobAccountCommandMessage;
        const requestId = message.requestId;
        const command = message.command;
        if (command === 'cancel-copilot') {
          const targetRequestId = message.body.requestId;
          const controller = copilotAbortControllers.current.get(targetRequestId);
          if (controller) {
            controller.abort();
            copilotAbortControllers.current.delete(targetRequestId);
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
        if (isAccountAssetCommand(command)) {
          void runBobAccountCommand({
            source,
            requestId,
            command,
            ...(message.instanceId ? { instanceId: message.instanceId } : {}),
            ...(message.headers ? { headers: message.headers } : {}),
            ...(typeof message.body === 'undefined' ? {} : { body: message.body }),
          });
        } else {
          void runBobAccountCommand({
            source,
            requestId,
            command,
            instanceId: message.instanceId,
            ...(message.headers ? { headers: message.headers } : {}),
            ...(typeof message.body === 'undefined' ? {} : { body: message.body }),
          });
        }
        return;
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [accountPolicy, activeInstanceId, activeWidgetType, bobBaseUrl, runBobAccountCommand]);

  useEffect(() => {
    bobReadyRef.current = false;
    openDispatchSeqRef.current += 1;
    openingTargetKeyRef.current = '';
    openedTargetKeyRef.current = '';
    activeCompiledWidgetRef.current = null;
    bobAppliedInstanceIdRef.current = '';
    bobIsDirtyRef.current = false;
    setBobSaveControlPhase('hidden');
    setPublicationInstance(null);
    setBobIsDirty(false);
    setOpenError(null);
  }, [bobSrc]);

  useEffect(() => {
    if (
      activeInstanceId &&
      suppressNextOpenInstanceIdRef.current === activeInstanceId
    ) {
      suppressNextOpenInstanceIdRef.current = '';
      return;
    }
    setBobSaveControlPhase('hidden');
    if (!activeInstanceId && !activeWidgetType) {
      setOpenError(null);
      return;
    }
    if (!bobReadyRef.current) return;
    void openActiveInstanceInBobRef.current();
  }, [activeInstanceId, activeWidgetType]);

  const requestBobSave = useCallback(() => {
    if (bobSaveControlPhase !== 'save') return;
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) return;
    targetWindow.postMessage(createHostSaveRequestMessage(), bobBaseUrl);
  }, [bobBaseUrl, bobSaveControlPhase]);

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
      const holdRoute = holdInstanceId
        ? buildRomaBuilderRoute({ instanceId: holdInstanceId })
        : activeWidgetTypeRef.current
          ? buildRomaNewBuilderRoute({ widgetType: activeWidgetTypeRef.current })
          : '/builder';
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

  if (!activeInstanceId && !activeWidgetType) {
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
            <button
              className="diet-button"
              data-size="medium"
              data-type="primary"
              data-loading={openRetryPending || undefined}
              type="button"
              aria-busy={openRetryPending || undefined}
              onClick={() => void retryOpenActiveInstance()}
              disabled={openRetryPending}
            >
              {openRetryPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">Retry</span>
            </button>
          </div>
        </div>
      ) : null}
      <RomaPageHeader
        width="full"
        title={publicationInstance?.displayName || (activeInstanceId ? 'Loading widget…' : 'Untitled widget')}
        navigationTrigger={(
          <button
            ref={navigationButtonRef}
            className="roma-nav-trigger diet-button"
            data-size="medium"
            data-type="quaternary"
            type="button"
            aria-label="Open navigation"
            aria-controls="roma-primary-navigation"
            onClick={() => openNavigation(navigationButtonRef.current)}
          >
            <Image
              className="diet-icon"
              src="/dieter/icons/svg/line.3.horizontal.decrease.circle.svg"
              alt=""
              width={20}
              height={20}
            />
          </button>
        )}
        headingExtras={publicationInstance ? (
          <WidgetPublicationState
            instance={publicationInstance}
            dirty={bobIsDirty}
            onPendingChange={handlePublicationPendingChange}
            onInstanceChange={(next) => {
              setPublicationInstance(next);
            }}
          />
        ) : (
          <p className="body-xs">
            {activeInstanceId ? 'Loading publication status…' : 'Save to create this widget'}
          </p>
        )}
        actions={publicationInstance || bobSaveControlPhase !== 'hidden' ? (
          <>
            {publicationInstance ? (
              <WidgetPublicationControls
                instance={publicationInstance}
                dirty={bobIsDirty}
                showToggle={false}
                controlSize="large"
                onPendingChange={handlePublicationPendingChange}
                onInstanceChange={(next) => {
                  setPublicationInstance(next);
                }}
              />
            ) : null}
            {bobSaveControlPhase === 'save' ? (
              <button
                className="diet-button"
                data-size="large"
                data-type="primary"
                data-tone="save"
                type="button"
                onClick={requestBobSave}
              >
                <span className="diet-button__label">{ROMA_UI_COPY.commands.save}</span>
              </button>
            ) : null}
            {bobSaveControlPhase === 'saving' ? (
              <button
                className="diet-button"
                data-size="large"
                data-type="primary"
                data-tone="save"
                data-loading="true"
                type="button"
                aria-busy="true"
                disabled
              >
                <span className="diet-spinner" aria-hidden="true" />
                <span className="diet-button__label">{ROMA_UI_COPY.commands.saving}</span>
              </button>
            ) : null}
            {bobSaveControlPhase === 'saved' ? (
              <button
                className="diet-button"
                data-size="large"
                data-type="primary"
                data-tone="save"
                data-state="success"
                type="button"
                disabled
              >
                <span
                  className="diet-icon diet-icon-mask"
                  aria-hidden="true"
                  style={{
                    '--diet-icon-source': 'url("/dieter/icons/svg/checkmark.svg")',
                  } as CSSProperties}
                />
                <span className="diet-button__label">{ROMA_UI_COPY.commands.saved}</span>
              </button>
            ) : null}
          </>
        ) : undefined}
      />
      <iframe
        ref={iframeRef}
        src={bobSrc}
        className="roma-builder__iframe"
        title="Bob Builder"
        onLoad={handleBobIframeLoad}
      />
      <RomaUnsavedChangesDialog
        open={unsavedDialogOpen}
        message="You have unsaved Builder edits."
        onKeepEditing={keepEditing}
        onDiscard={discardAndContinue}
      />
      <RomaUpsellDialog
        open={Boolean(upsell)}
        reason={upsell?.body}
        upgradeAvailable={upsell?.upgradeAvailable}
        onClose={() => setUpsell(null)}
      />
    </>
  );
}
