'use client';

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { can } from '@clickeen/ck-policy';
import { applyLocalizationOps, computeL10nFingerprint, type AllowlistEntry } from '../l10n/instance';
import { resolveAftermathSaveMessage } from './sessionLocalization';
import { resolvePolicySubject } from './sessionPolicy';
import type { SessionState } from './sessionTypes';
import type { ExecuteAccountCommand } from './sessionTransport';

export function useSessionSaving(args: {
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
  executeAccountCommand: ExecuteAccountCommand;
  persistLocaleEdits: () => Promise<void>;
  loadLocaleAllowlist: (widgetType: string) => Promise<AllowlistEntry[]>;
  monitorLocaleTranslationsAfterSave: (
    initialDetail?: string | null
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const save = useCallback(async () => {
    const snapshot = args.stateRef.current;
    const policy = snapshot.policy;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    if (!policy) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Editor context is not ready.' },
      }));
      return;
    }
    const subject = resolvePolicySubject(policy);

    if (!publicId || !accountId) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Missing instance context for save.' },
      }));
      return;
    }
    if (!widgetType) {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'coreui.errors.widgetType.invalid' },
      }));
      return;
    }
    if (policy.role === 'viewer') {
      args.setState((prev) => ({
        ...prev,
        error: { source: 'save', message: 'Read-only mode: saving is disabled.' },
      }));
      return;
    }

    const gate = can(policy, 'instance.update');
    if (!gate.allow) {
      args.setState((prev) => ({
        ...prev,
        error: null,
          upsell: {
            reasonKey: gate.reasonKey,
            detail: gate.detail,
            cta: prev.policy?.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
      return;
    }

    if (!snapshot.isDirty && snapshot.locale.activeLocale !== snapshot.locale.baseLocale && snapshot.locale.dirty) {
      await args.persistLocaleEdits();
      return;
    }

    args.setState((prev) => ({ ...prev, isSaving: true, error: null }));

    let textChanged = false;
    if (
      subject === 'account' &&
      snapshot.locale.allowedLocales.some((locale) => locale !== snapshot.locale.baseLocale)
    ) {
      try {
        const allowlist = snapshot.locale.allowlist.length
          ? snapshot.locale.allowlist
          : await args.loadLocaleAllowlist(widgetType);
        const [savedFingerprint, nextFingerprint] = await Promise.all([
          computeL10nFingerprint(snapshot.savedBaseInstanceData, allowlist),
          computeL10nFingerprint(snapshot.baseInstanceData, allowlist),
        ]);
        textChanged = savedFingerprint !== nextFingerprint;
      } catch {
        textChanged = false;
      }
    }

    try {
      const { ok, json } = await args.executeAccountCommand({
        subject,
        command: 'update-instance',
        method: 'PUT',
        url: `/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
          publicId,
        )}?subject=${encodeURIComponent(subject)}`,
        accountId,
        publicId,
        body: { config: snapshot.baseInstanceData },
      });
      if (!ok) {
        const err = json?.error;
        if (err?.kind === 'DENY' && err?.upsell === 'UP') {
          args.setState((prev) => ({
            ...prev,
            isSaving: false,
            error: null,
            upsell: {
              reasonKey: err.reasonKey || 'coreui.errors.unknown',
              detail: err.detail,
              cta: prev.policy?.profile === 'minibob' ? 'signup' : 'upgrade',
            },
          }));
          return;
        }
        if (err?.kind === 'VALIDATION') {
          args.setState((prev) => ({
            ...prev,
            isSaving: false,
            error: { source: 'save', message: err.reasonKey || 'Save failed.', paths: err.paths },
          }));
          return;
        }
        args.setState((prev) => ({
          ...prev,
          isSaving: false,
          error: { source: 'save', message: err?.reasonKey || 'Save failed.' },
        }));
        return;
      }

      const current = args.stateRef.current;
      const nextBase =
        json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
          ? structuredClone(json.config)
          : structuredClone(current.baseInstanceData);
      const aftermathMessage = resolveAftermathSaveMessage(json?.aftermath);
      const nextLocale =
        aftermathMessage && subject === 'account' && textChanged
          ? {
              ...current.locale,
              sync: {
                stage: 'failed' as const,
                detail: aftermathMessage,
                lastUpdatedAt: current.locale.sync.lastUpdatedAt,
                lastError: aftermathMessage,
              },
            }
          : current.locale;
      const nextState: SessionState = {
        ...current,
        isSaving: false,
        isDirty: false,
        error: aftermathMessage ? { source: 'save', message: aftermathMessage, committed: true } : null,
        upsell: null,
        savedBaseInstanceData: structuredClone(nextBase),
        baseInstanceData: structuredClone(nextBase),
        locale: nextLocale,
        instanceData:
          current.locale.activeLocale !== current.locale.baseLocale
            ? applyLocalizationOps(applyLocalizationOps(nextBase, current.locale.baseOps), current.locale.userOps)
            : nextBase,
      };
      args.stateRef.current = nextState;
      args.setState(nextState);

      if (
        !aftermathMessage &&
        subject === 'account' &&
        textChanged &&
        !current.locale.dirty
      ) {
        window.setTimeout(() => {
          void args.monitorLocaleTranslationsAfterSave('Translations are updating.');
        }, 0);
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({ ...prev, isSaving: false, error: { source: 'save', message: messageText } }));
    }
  }, [
    args.executeAccountCommand,
    args.loadLocaleAllowlist,
    args.monitorLocaleTranslationsAfterSave,
    args.persistLocaleEdits,
    args.setState,
    args.stateRef,
  ]);

  return {
    save,
  };
}
