'use client';

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { CompiledWidget } from '../types';
import type { Policy } from '@clickeen/ck-policy';
import {
  hasUnsavedDocument,
  type BobExportInstanceDataResponseMessage,
  type HostExportInstanceDataMessage,
  type BobOpenEditorAppliedMessage,
  type BobOpenEditorFailedMessage,
  type BobSessionReadyMessage,
  type EditorOpenMessage,
  type SessionState,
} from './sessionTypes';
import {
  assertPolicy,
  extractErrorReasonKey,
  resolveBootModeFromUrl,
  resolveSubjectModeFromUrl,
} from './sessionPolicy';

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

        let resolved: Record<string, unknown> = {};
        const nextAccountId = message.accountId;
        const nextOwnerAccountId = message.ownerAccountId;
        let nextLabel = typeof message.label === 'string' && message.label.trim() ? message.label.trim() : '';
        const nextAssetApiBase =
          typeof message.assetApiBase === 'string' && message.assetApiBase.trim()
            ? message.assetApiBase.trim()
            : undefined;
        const nextAssetUploadEndpoint =
          typeof message.assetUploadEndpoint === 'string' && message.assetUploadEndpoint.trim()
            ? message.assetUploadEndpoint.trim()
            : undefined;

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
        if (incoming == null) {
          throw new Error('[useWidgetSession] Missing instanceData in open-editor payload');
        }
        resolved = structuredClone(incoming);
        if (!nextPolicy) {
          throw new Error('[useWidgetSession] Missing policy in open-editor payload');
        }

        if (!nextLabel) {
          nextLabel = String(message.publicId || '').trim() || 'Untitled widget';
        }

        args.setState((prev) => ({
          ...prev,
          compiled,
          instanceData: resolved,
          savedBaseInstanceData: structuredClone(resolved),
          policy: nextPolicy,
          selectedPath: null,
          error: null,
          upsell: null,
          lastUpdate: {
            source: 'load',
            path: '',
            ts: Date.now(),
          },
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
          savedBaseInstanceData: {},
          error: { source: 'load', message: messageText },
          upsell: null,
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
        const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
        args.hostOriginRef.current = targetOrigin === '*' ? args.hostOriginRef.current : targetOrigin;
        if (!requestId) {
          postToParent(
            {
              type: 'bob:open-editor-failed',
              reasonKey: 'coreui.errors.builder.open.invalidRequest',
              message: 'Missing requestId',
            },
            targetOrigin,
          );
          return;
        }

        const rawSubjectMode =
          typeof (data as { subjectMode?: unknown }).subjectMode === 'string'
            ? String((data as { subjectMode?: unknown }).subjectMode).trim().toLowerCase()
            : '';
        if (rawSubjectMode && rawSubjectMode !== 'account' && rawSubjectMode !== 'minibob') {
          const reasonKey = 'coreui.errors.builder.open.invalidRequest';
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
              reasonKey,
              message: 'Invalid subjectMode in open-editor payload',
            },
            targetOrigin,
          );
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log('[useWidgetSession] load-instance payload', data);
        }
        void loadInstance(data).then((result) => {
          if (result.ok) {
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                publicId: result.publicId,
                widgetname: result.widgetname,
              },
              targetOrigin,
            );
            return;
          }
          postToParent(
            {
              type: 'bob:open-editor-failed',
              requestId,
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

        (async () => {
          try {
            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: true,
              instanceData: snapshot.instanceData,
              meta: snapshot.meta,
              isDirty: hasUnsavedDocument(snapshot),
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
          savedBaseInstanceData: {},
          error: { source: 'load', message: messageText },
          upsell: null,
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
    args.setState,
    args.stateRef,
    loadFromUrlParams,
    loadInstance,
  ]);

  return {
    loadInstance,
  };
}
