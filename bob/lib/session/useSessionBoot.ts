'use client';

import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Policy } from '@clickeen/ck-policy';
import {
  type BobOpenEditorAppliedMessage,
  type BobOpenEditorFailedMessage,
  type BobSessionReadyMessage,
  type EditorOpenMessage,
  type SessionMeta,
  type SessionState,
  type CopilotRuntimeUi,
  serializeInstanceDataSignature,
} from './sessionTypes';

export function useSessionBoot(args: {
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  setPolicy: Dispatch<SetStateAction<Policy | null>>;
  setCopilot: Dispatch<SetStateAction<CopilotRuntimeUi>>;
  hostOriginRef: MutableRefObject<string | null>;
}) {
  const { setState, setMeta, setPolicy, setCopilot, hostOriginRef } = args;
  const loadInstance = useCallback(
    async (
      message: EditorOpenMessage,
    ): Promise<{ ok: true; instanceId?: string; widgetname?: string } | { ok: false; error: string }> => {
      try {
        const compiled = message.compiled;
        const baseLocale = typeof message.baseLocale === 'string' ? message.baseLocale.trim() : '';
        let nextLabel = typeof message.label === 'string' && message.label.trim() ? message.label.trim() : '';
        const rawInstanceData = message.instanceData;
        if (!baseLocale) {
          return {
            ok: false,
            error: 'coreui.errors.builder.open.invalidRequest',
          };
        }
        if (!rawInstanceData || typeof rawInstanceData !== 'object' || Array.isArray(rawInstanceData)) {
          return {
            ok: false,
            error: 'coreui.errors.instance.config.invalid',
          };
        }
        const instanceData = rawInstanceData as Record<string, unknown>;
        const savedInstanceDataSignature = serializeInstanceDataSignature(instanceData);
        const nextPolicy = (message.policy as Policy | null | undefined) ?? null;
        const nextCopilot = (message.copilot as CopilotRuntimeUi | undefined) ?? null;

        if (!nextLabel) {
          nextLabel = String(message.instanceId || '').trim() || 'Untitled widget';
        }

        setPolicy(nextPolicy);
        setCopilot(nextCopilot);
        setMeta({
          accountPublicId: message.accountPublicId,
          instanceId: message.instanceId,
          baseLocale,
          widgetname: compiled.widgetname,
          publishStatus: message.publishStatus,
          label: nextLabel,
          meta: message.meta ?? null,
          translationSetup: message.translationSetup ?? null,
        });
        setState((prev) => ({
          ...prev,
          compiled,
          instanceData,
          savedInstanceDataSignature,
          isDirty: false,
          error: null,
          lastUpdate: {
            source: 'load',
            path: '',
            ts: Date.now(),
          },
        }));
        return {
          ok: true,
          instanceId: message.instanceId,
          widgetname: compiled.widgetname,
        };
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[useWidgetSession] Failed to load instance', err, message);
        }
        const messageText = err instanceof Error ? err.message : String(err);
        setPolicy(null);
        setCopilot(null);
        setMeta(null);
        setState((prev) => ({
          ...prev,
          compiled: null,
          instanceData: {},
          savedInstanceDataSignature: serializeInstanceDataSignature({}),
          isDirty: false,
          error: { source: 'load', message: messageText },
        }));
        return { ok: false, error: messageText };
      }
    },
    [setCopilot, setMeta, setPolicy, setState],
  );

  useEffect(() => {
    const postToParent = (
      payload:
        | BobSessionReadyMessage
        | BobOpenEditorAppliedMessage
        | BobOpenEditorFailedMessage,
      origin: string,
    ) => {
      try {
        window.parent?.postMessage(payload, origin);
      } catch {}
    };

    function handleMessage(event: MessageEvent) {
      const data = event.data as EditorOpenMessage | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'ck:open-editor') {
        const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
        const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
        hostOriginRef.current = targetOrigin === '*' ? hostOriginRef.current : targetOrigin;
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

        void loadInstance(data).then((result) => {
          if (result.ok) {
            postToParent(
              {
                type: 'bob:open-editor-applied',
                requestId,
                instanceId: result.instanceId,
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
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      postToParent(
        {
          type: 'bob:session-ready',
        },
        '*',
      );
    }
    return () => window.removeEventListener('message', handleMessage);
  }, [
    hostOriginRef,
    loadInstance,
  ]);

  return {
    loadInstance,
  };
}
