'use client';

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { CompiledWidget } from '../types';
import type { Policy } from '@clickeen/ck-policy';
import { sanitizeConfig } from '@clickeen/ck-policy';
import {
  DEFAULT_LOCALE_STATE,
  type BobExportInstanceDataResponseMessage,
  type HostExportInstanceDataMessage,
  type BobOpenEditorAckMessage,
  type BobOpenEditorAppliedMessage,
  type BobOpenEditorFailedMessage,
  type BobSessionReadyMessage,
  type EditorOpenMessage,
  type SessionState,
  type SubjectMode,
} from './sessionTypes';
import {
  assertPolicy,
  extractErrorReasonKey,
  resolveBootModeFromUrl,
  resolveSubjectModeFromUrl,
} from './sessionPolicy';
import { normalizeLocalizationSnapshotForOpenMode } from './sessionLocalization';
import { applyDefaultsIntoConfig } from './sessionConfig';
import { applyWidgetNormalizations } from './sessionNormalization';
import type { OpenRequestStatusEntry } from './sessionTransport';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function useSessionBoot(args: {
  state: SessionState;
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
  fetchApi: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  bootModeRef: MutableRefObject<'message' | 'url'>;
  hostOriginRef: MutableRefObject<string | null>;
  sessionIdRef: MutableRefObject<string>;
  openRequestStatusRef: MutableRefObject<Map<string, OpenRequestStatusEntry>>;
  applyMinibobInjectedState: (nextState: Record<string, unknown>) => boolean;
}) {
  const pendingMinibobInjectionRef = useRef<Record<string, unknown> | null>(null);

  const loadInstance = useCallback(
    async (
      message: EditorOpenMessage,
    ): Promise<{ ok: true; publicId?: string; widgetname?: string } | { ok: false; error: string }> => {
      try {
        const compiled = message.compiled;
        if (!compiled) {
          throw new Error('[useWidgetSession] Missing compiled widget payload');
        }
        if (compiled.controls.length === 0) {
          throw new Error('[useWidgetSession] Widget compiled without controls[]');
        }

        if (!compiled.defaults || typeof compiled.defaults !== 'object' || Array.isArray(compiled.defaults)) {
          throw new Error('[useWidgetSession] compiled.defaults must be an object');
        }
        const defaults = compiled.defaults as Record<string, unknown>;

        let resolved: Record<string, unknown> = {};
        const nextAccountId = message.accountId;
        const nextOwnerAccountId = message.ownerAccountId;
        let nextLabel = typeof message.label === 'string' && message.label.trim() ? message.label.trim() : '';
        const nextLocalizationSnapshotRaw: unknown = message.localization;
        const nextAssetApiBase =
          typeof message.assetApiBase === 'string' && message.assetApiBase.trim()
            ? message.assetApiBase.trim()
            : undefined;
        const nextAssetUploadEndpoint =
          typeof message.assetUploadEndpoint === 'string' && message.assetUploadEndpoint.trim()
            ? message.assetUploadEndpoint.trim()
            : undefined;

        const nextSubjectMode: SubjectMode = message.subjectMode ?? resolveSubjectModeFromUrl();
        let nextPolicy: Policy | null = null;

        const incoming = message.instanceData as Record<string, unknown> | null | undefined;
        if (incoming != null && (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))) {
          throw new Error('[useWidgetSession] instanceData must be an object');
        }

        if (message.policy && typeof message.policy === 'object') {
          nextPolicy = assertPolicy(message.policy);
        } else {
          throw new Error('[useWidgetSession] Missing policy in open-editor payload');
        }

        if (incoming == null && message.publicId && message.accountId) {
          throw new Error('[useWidgetSession] Missing instanceData in open-editor payload');
        }
        resolved = incoming == null ? structuredClone(defaults) : structuredClone(incoming);
        if (!nextPolicy) {
          throw new Error('[useWidgetSession] Missing policy in open-editor payload');
        }

        if (!nextLabel) {
          nextLabel = String(message.publicId || '').trim() || 'Untitled widget';
        }

        resolved = applyDefaultsIntoConfig(compiled.normalization, defaults, resolved);
        resolved = sanitizeConfig({
          config: resolved,
          limits: compiled.limits ?? null,
          policy: nextPolicy,
          context: 'load',
        });
        resolved = applyWidgetNormalizations(compiled.normalization, resolved);
        const localizationSnapshot = normalizeLocalizationSnapshotForOpenMode(nextLocalizationSnapshotRaw, {
          strict: args.bootModeRef.current === 'message',
        });

        args.setState((prev) => ({
          ...prev,
          compiled,
          instanceData: resolved,
          baseInstanceData: resolved,
          savedBaseInstanceData: structuredClone(resolved),
          isDirty: false,
          minibobPersonalizationUsed: false,
          policy: nextPolicy,
          selectedPath: null,
          error: null,
          upsell: null,
          locale: {
            ...DEFAULT_LOCALE_STATE,
            baseLocale: localizationSnapshot.baseLocale,
            activeLocale: localizationSnapshot.baseLocale,
            allowedLocales: localizationSnapshot.allowedLocales,
            readyLocales: localizationSnapshot.readyLocales,
            overlayEntries: localizationSnapshot.overlayEntries,
            accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
            accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
          },
          lastUpdate: {
            source: 'load',
            path: '',
            ts: Date.now(),
          },
          undoSnapshot: null,
          meta: {
            publicId: message.publicId,
            accountId: nextAccountId,
            ownerAccountId: nextOwnerAccountId,
            accountCapsule:
              typeof message.accountCapsule === 'string' && message.accountCapsule.trim()
                ? message.accountCapsule.trim()
                : undefined,
            assetApiBase: nextAssetApiBase,
            assetUploadEndpoint: nextAssetUploadEndpoint,
            widgetname: compiled.widgetname,
            label: nextLabel,
          },
        }));
        return {
          ok: true,
          publicId: message.publicId,
          widgetname: compiled.widgetname,
        };
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useWidgetSession] Failed to load instance', err, message);
        }
        const messageText = err instanceof Error ? err.message : String(err);
        args.setState((prev) => ({
          ...prev,
          compiled: null,
          instanceData: {},
          baseInstanceData: {},
          savedBaseInstanceData: {},
          isDirty: false,
          minibobPersonalizationUsed: false,
          error: { source: 'load', message: messageText },
          upsell: null,
          locale: { ...DEFAULT_LOCALE_STATE },
          meta: null,
        }));
        return { ok: false, error: messageText };
      }
    },
    [args.setState],
  );

  const loadFromUrlParams = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const publicId = (params.get('publicId') || '').trim();
    if (!publicId) return;

    const subject = resolveSubjectModeFromUrl();
    if (subject === 'account') {
      throw new Error('coreui.errors.builder.accountMode.hostRequired');
    }

    const instanceUrl = `/api/instance/${encodeURIComponent(publicId)}?subject=${encodeURIComponent(subject)}`;
    const instanceRes = await args.fetchApi(instanceUrl, { cache: 'no-store' });
    const instanceJson = (await instanceRes.json().catch(() => null)) as any;
    if (!instanceRes.ok) {
      throw new Error(extractErrorReasonKey(instanceJson, `HTTP_${instanceRes.status}`));
    }
    if (!instanceJson || typeof instanceJson !== 'object') {
      throw new Error('coreui.errors.payload.invalid');
    }
    if (instanceJson.error) {
      const reasonKey = instanceJson.error?.reasonKey ? String(instanceJson.error.reasonKey) : 'coreui.errors.unknown';
      throw new Error(reasonKey);
    }
    const widgetType = typeof instanceJson.widgetType === 'string' ? instanceJson.widgetType : '';
    if (!widgetType) {
      throw new Error('coreui.errors.instance.widgetMissing');
    }
    const localizationPayload: unknown = instanceJson.localization;
    const displayName =
      typeof instanceJson.displayName === 'string' && instanceJson.displayName.trim()
        ? instanceJson.displayName.trim()
        : String(instanceJson.publicId ?? publicId).trim() || 'Untitled widget';

    const compiledRes = await args.fetchApi(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, { cache: 'no-store' });
    if (!compiledRes.ok) {
      throw new Error(`[useWidgetSession] Failed to compile widget ${widgetType} (HTTP ${compiledRes.status})`);
    }
    const compiled = (await compiledRes.json().catch(() => null)) as CompiledWidget | null;
    if (!compiled) throw new Error('[useWidgetSession] Invalid compiled widget payload');

    const nextPolicy: Policy | undefined =
      instanceJson.policy && typeof instanceJson.policy === 'object'
        ? assertPolicy(instanceJson.policy)
        : undefined;

    await loadInstance({
      type: 'ck:open-editor',
      widgetname: widgetType,
      compiled,
      instanceData: instanceJson.config,
      localization: localizationPayload,
      policy: nextPolicy,
      publicId: instanceJson.publicId ?? publicId,
      accountId: typeof instanceJson.accountId === 'string' ? instanceJson.accountId : undefined,
      ownerAccountId:
        typeof instanceJson.ownerAccountId === 'string' ? instanceJson.ownerAccountId : undefined,
      label: displayName,
      subjectMode: subject,
    });
  }, [args.fetchApi, loadInstance]);

  useEffect(() => {
    const mode = resolveSubjectModeFromUrl();
    if (mode !== 'minibob') return;

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'ck:minibob-preview-state') return;

      const requestId = typeof (data as any).requestId === 'string' ? (data as any).requestId.trim() : '';
      const nextState = data.state;
      if (!isRecord(nextState)) return;

      let applied = false;
      try {
        applied = args.applyMinibobInjectedState(nextState);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useWidgetSession] Minibob state injection rejected', err);
        }
      }

      if (!applied) {
        try {
          pendingMinibobInjectionRef.current = structuredClone(nextState);
        } catch {
          pendingMinibobInjectionRef.current = nextState;
        }
      }

      if (requestId) {
        try {
          const target =
            event.source && typeof (event.source as Window).postMessage === 'function'
              ? (event.source as Window)
              : window.parent;
          const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
          target?.postMessage({ type: 'ck:minibob-preview-state-applied', requestId, ok: applied }, targetOrigin);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [args.applyMinibobInjectedState]);

  useEffect(() => {
    const mode = resolveSubjectModeFromUrl();
    if (mode !== 'minibob') return;
    if (!args.state.compiled) return;
    const pending = pendingMinibobInjectionRef.current;
    if (!pending) return;

    try {
      if (args.applyMinibobInjectedState(pending)) {
        pendingMinibobInjectionRef.current = null;
      }
    } catch {
      // ignore
    }
  }, [args.applyMinibobInjectedState, args.state.compiled]);

  useEffect(() => {
    const bootMode = resolveBootModeFromUrl();
    args.bootModeRef.current = bootMode;
    const postToParent = (
      payload:
        | BobSessionReadyMessage
        | BobOpenEditorAckMessage
        | BobOpenEditorAppliedMessage
        | BobOpenEditorFailedMessage
        | BobExportInstanceDataResponseMessage,
      origin: string,
    ) => {
      try {
        window.parent?.postMessage(payload, origin);
      } catch {}
    };

    function handleMessage(event: MessageEvent) {
      const data = event.data as (EditorOpenMessage | HostExportInstanceDataMessage) | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'ck:open-editor') {
        if (bootMode !== 'message') return;
        const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
        const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
        const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
        args.hostOriginRef.current = targetOrigin === '*' ? args.hostOriginRef.current : targetOrigin;
        if (!requestId || !sessionId) {
          postToParent(
            {
              type: 'bob:open-editor-failed',
              reasonKey: 'coreui.errors.builder.open.invalidRequest',
              message: 'Missing requestId/sessionId',
            },
            targetOrigin,
          );
          return;
        }
        if (sessionId !== args.sessionIdRef.current) {
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey: 'coreui.errors.builder.open.sessionMismatch',
              message: 'Session mismatch',
            },
            targetOrigin,
          );
          return;
        }

        const existing = args.openRequestStatusRef.current.get(requestId);
        postToParent(
          {
            type: 'bob:open-editor-ack',
            requestId,
            sessionId,
          },
          targetOrigin,
        );
        if (existing) {
          if (existing.status === 'applied') {
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                sessionId,
                publicId: existing.publicId,
                widgetname: existing.widgetname,
              },
              targetOrigin,
            );
          } else if (existing.status === 'failed') {
            postToParent(
              {
                type: 'bob:open-editor-failed',
                requestId,
                sessionId,
                reasonKey: existing.error || 'coreui.errors.builder.open.failed',
                message: existing.error,
              },
              targetOrigin,
            );
          }
          return;
        }

        const rawSubjectMode =
          typeof (data as { subjectMode?: unknown }).subjectMode === 'string'
            ? String((data as { subjectMode?: unknown }).subjectMode).trim().toLowerCase()
            : '';
        if (rawSubjectMode && rawSubjectMode !== 'account' && rawSubjectMode !== 'minibob') {
          const reasonKey = 'coreui.errors.builder.open.invalidRequest';
          args.openRequestStatusRef.current.set(requestId, {
            status: 'failed',
            error: reasonKey,
          });
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey,
              message: 'Invalid subjectMode in open-editor payload',
            },
            targetOrigin,
          );
          return;
        }

        args.openRequestStatusRef.current.set(requestId, { status: 'processing' });
        if (args.openRequestStatusRef.current.size > 50) {
          const oldest = args.openRequestStatusRef.current.keys().next().value;
          if (oldest) args.openRequestStatusRef.current.delete(oldest);
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('[useWidgetSession] load-instance payload', data);
        }
        void loadInstance(data).then((result) => {
          if (result.ok) {
            args.openRequestStatusRef.current.set(requestId, {
              status: 'applied',
              publicId: result.publicId,
              widgetname: result.widgetname,
            });
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                sessionId,
                publicId: result.publicId,
                widgetname: result.widgetname,
              },
              targetOrigin,
            );
            return;
          }
          args.openRequestStatusRef.current.set(requestId, {
            status: 'failed',
            error: result.error,
          });
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              sessionId,
              reasonKey: result.error || 'coreui.errors.builder.open.failed',
              message: result.error,
            },
            targetOrigin,
          );
        });
        return;
      }

      if (data.type === 'host:export-instance-data') {
        const requestId = typeof data.requestId === 'string' ? data.requestId : '';
        if (!requestId) return;
        const snapshot = args.stateRef.current;
        const exportMode = data.exportMode === 'current' ? 'current' : 'base';

        (async () => {
          try {
            const instanceData = exportMode === 'current' ? snapshot.instanceData : snapshot.baseInstanceData;

            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: true,
              instanceData,
              meta: snapshot.meta,
              isDirty: snapshot.isDirty,
            };

            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            postToParent(reply, targetOrigin);
          } catch (err) {
            const messageText = err instanceof Error ? err.message : String(err);
            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: false,
              error: messageText,
            };
            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            postToParent(reply, targetOrigin);
          }
        })();
      }
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      postToParent(
        {
          type: 'bob:session-ready',
          sessionId: args.sessionIdRef.current,
          bootMode,
        },
        '*',
      );
    }
    if (bootMode === 'url') {
      loadFromUrlParams().catch((err) => {
        const messageText = err instanceof Error ? err.message : String(err);
        args.setState((prev) => ({
          ...prev,
          compiled: null,
          instanceData: {},
          baseInstanceData: {},
          savedBaseInstanceData: {},
          isDirty: false,
          minibobPersonalizationUsed: false,
          error: { source: 'load', message: messageText },
          upsell: null,
          locale: { ...DEFAULT_LOCALE_STATE },
          meta: null,
        }));
      });
    }
    return () => window.removeEventListener('message', handleMessage);
  }, [
    args.applyMinibobInjectedState,
    args.bootModeRef,
    args.fetchApi,
    args.hostOriginRef,
    args.openRequestStatusRef,
    args.sessionIdRef,
    args.setState,
    args.stateRef,
    loadFromUrlParams,
    loadInstance,
  ]);

  return {
    loadInstance,
  };
}
