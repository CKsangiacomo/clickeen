'use client';

import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Policy } from '@clickeen/ck-policy';
import {
  isAccountFontFamily,
  normalizeAccountFontLibrary,
  type AccountFontLibrary,
} from '@clickeen/widget-shell';
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
import { assertSessionConfigContract } from './sessionConfig';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectTypographyFontFamilies(instanceData: Record<string, unknown>): string[] {
  const families = new Set<string>();
  const typography = isRecord(instanceData.typography) ? instanceData.typography : null;
  if (!typography) return [];
  if (typeof typography.globalFamily === 'string' && typography.globalFamily.trim()) {
    families.add(typography.globalFamily.trim());
  }
  const roles = isRecord(typography.roles) ? typography.roles : null;
  if (!roles) return Array.from(families);
  Object.values(roles).forEach((role) => {
    if (!isRecord(role)) return;
    if (typeof role.family === 'string' && role.family.trim()) families.add(role.family.trim());
  });
  return Array.from(families);
}

function assertTypographyFontsInLibrary(args: {
  instanceData: Record<string, unknown>;
  fontLibrary: AccountFontLibrary;
}) {
  const missing = collectTypographyFontFamilies(args.instanceData)
    .filter((family) => !isAccountFontFamily(args.fontLibrary, family));
  if (missing.length) {
    throw new Error(`coreui.errors.typography.fontFamily.unknown:${missing.join(',')}`);
  }
}

export function useSessionBoot(args: {
  stateRef: MutableRefObject<SessionState>;
  metaRef: MutableRefObject<SessionMeta>;
  setState: Dispatch<SetStateAction<SessionState>>;
  setMeta: Dispatch<SetStateAction<SessionMeta>>;
  setPolicy: Dispatch<SetStateAction<Policy | null>>;
  setCopilot: Dispatch<SetStateAction<CopilotRuntimeUi>>;
  hostOriginRef: MutableRefObject<string | null>;
}) {
  const { stateRef, metaRef, setState, setMeta, setPolicy, setCopilot, hostOriginRef } = args;
  const loadInstance = useCallback(
    async (
      message: EditorOpenMessage,
    ): Promise<{ ok: true; instanceId?: string; widgetname?: string } | { ok: false; error: string }> => {
      try {
        const current = stateRef.current;
        if (current.isDirty && current.compiled) {
          return {
            ok: false,
            error: 'coreui.errors.builder.open.unsavedChanges',
          };
        }

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
        assertSessionConfigContract(instanceData, compiled);
        const fontLibrary = normalizeAccountFontLibrary(message.fontLibrary);
        if (!fontLibrary) {
          return {
            ok: false,
            error: 'coreui.errors.typography.fontLibrary.invalid',
          };
        }
        assertTypographyFontsInLibrary({ instanceData, fontLibrary });
        const savedInstanceDataSignature = serializeInstanceDataSignature(instanceData);
        const nextPolicy = (message.policy as Policy | null | undefined) ?? null;
        const nextCopilot = (message.copilot as CopilotRuntimeUi | undefined) ?? null;

        if (!nextLabel) {
          nextLabel = String(message.instanceId || '').trim() || 'Untitled widget';
        }

        const nextMeta: SessionMeta = {
          accountPublicId: message.accountPublicId,
          instanceId: message.instanceId,
          baseLocale,
          widgetname: compiled.widgetname,
          publishStatus: message.publishStatus,
          label: nextLabel,
          fontLibrary,
          translationSetup: message.translationSetup ?? null,
        };
        const nextState: SessionState = {
          ...current,
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
        };

        setPolicy(nextPolicy);
        setCopilot(nextCopilot);
        metaRef.current = nextMeta;
        stateRef.current = nextState;
        setMeta(nextMeta);
        setState(nextState);
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
        metaRef.current = null;
        setMeta(null);
        const nextState: SessionState = {
          ...stateRef.current,
          compiled: null,
          instanceData: {},
          savedInstanceDataSignature: serializeInstanceDataSignature({}),
          isDirty: false,
          error: { source: 'load', message: messageText },
        };
        stateRef.current = nextState;
        setState(nextState);
        return { ok: false, error: messageText };
      }
    },
    [metaRef, setCopilot, setMeta, setPolicy, setState, stateRef],
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
        if (event.source !== window.parent) return;
        const requestId = typeof data.requestId === 'string' ? data.requestId.trim() : '';
        const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
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
            if (targetOrigin !== '*') {
              hostOriginRef.current = targetOrigin;
            }
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
