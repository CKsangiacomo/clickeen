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
} from './sessionTypes';

export function useSessionBoot(args: {
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  setPolicy: Dispatch<SetStateAction<Policy | null>>;
  hostOriginRef: MutableRefObject<string | null>;
}) {
  const loadInstance = useCallback(
    async (
      message: EditorOpenMessage,
    ): Promise<{ ok: true; publicId?: string; widgetname?: string } | { ok: false; error: string }> => {
      try {
        const compiled = message.compiled;
        let nextLabel = typeof message.label === 'string' && message.label.trim() ? message.label.trim() : '';
        const resolved = structuredClone((message.instanceData ?? {}) as Record<string, unknown>);
        const nextPolicy = (message.policy as Policy | null | undefined) ?? null;

        if (!nextLabel) {
          nextLabel = String(message.publicId || '').trim() || 'Untitled widget';
        }

        args.setPolicy(nextPolicy);
        args.setMeta({
          publicId: message.publicId,
          widgetname: compiled.widgetname,
          label: nextLabel,
        });
        args.setState((prev) => ({
          ...prev,
          compiled,
          instanceData: resolved,
          error: null,
          lastUpdate: {
            source: 'load',
            path: '',
            ts: Date.now(),
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
        args.setPolicy(null);
        args.setMeta(null);
        args.setState((prev) => ({
          ...prev,
          compiled: null,
          instanceData: {},
          error: { source: 'load', message: messageText },
        }));
        return { ok: false, error: messageText };
      }
    },
    [args.setMeta, args.setPolicy, args.setState],
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
    args.hostOriginRef,
    args.setState,
    loadInstance,
  ]);

  return {
    loadInstance,
  };
}
