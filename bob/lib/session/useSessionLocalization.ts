'use client';

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  applyLocalizationOps,
  buildL10nSnapshot,
  computeL10nFingerprint,
  filterAllowlistedOps,
  normalizeLocaleToken,
  type AllowlistEntry,
  type LocalizationOp,
} from '../l10n/instance';
import { resolveTokyoBaseUrl } from '../env/tokyo';
import {
  DEFAULT_LOCALE,
  type SessionState,
} from './sessionTypes';
import {
  normalizeLocalizationSnapshotForOpenMode,
  resolveLocalizedOverlayState,
  resolveLocaleOverlayEntry,
  upsertLocaleOverlayEntry,
} from './sessionLocalization';
import { resolvePolicySubject } from './sessionPolicy';
import type { ExecuteAccountCommand } from './sessionTransport';

export function useSessionLocalization(args: {
  state: SessionState;
  stateRef: MutableRefObject<SessionState>;
  setState: Dispatch<SetStateAction<SessionState>>;
  fetchApi: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  executeAccountCommand: ExecuteAccountCommand;
}) {
  const allowlistCacheRef = useRef<Map<string, AllowlistEntry[]>>(new Map());
  const localeRequestRef = useRef(0);
  const localeSyncRunRef = useRef(0);

  const loadLocaleAllowlist = useCallback(async (widgetType: string): Promise<AllowlistEntry[]> => {
    const cached = allowlistCacheRef.current.get(widgetType);
    if (cached) return cached;

    const base = resolveTokyoBaseUrl();
    const res = await fetch(`${base}/widgets/${encodeURIComponent(widgetType)}/localization.json`, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to load localization allowlist (${res.status}) ${text}`.trim());
    }
    const json = (await res.json().catch(() => null)) as {
      v?: number;
      paths?: Array<{ path?: string; type?: string }>;
    } | null;
    if (!json || json.v !== 1 || !Array.isArray(json.paths)) {
      throw new Error('Invalid localization allowlist');
    }
    const allowlist = json.paths
      .map((entry) => {
        const path = typeof entry?.path === 'string' ? entry.path.trim() : '';
        const type: AllowlistEntry['type'] = entry?.type === 'richtext' ? 'richtext' : 'string';
        return { path, type };
      })
      .filter((entry) => entry.path);
    allowlistCacheRef.current.set(widgetType, allowlist);
    return allowlist;
  }, []);

  useEffect(() => {
    const widgetType = args.state.compiled?.widgetname ?? args.state.meta?.widgetname;
    if (!widgetType) return;
    if (args.state.locale.allowlist.length) return;

    let cancelled = false;
    loadLocaleAllowlist(widgetType)
      .then((allowlist) => {
        if (cancelled) return;
        args.setState((prev) => {
          if (prev.locale.allowlist.length) return prev;
          return { ...prev, locale: { ...prev.locale, allowlist } };
        });
      })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useWidgetSession] Failed to load localization allowlist', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [args.state.compiled?.widgetname, args.state.locale.allowlist.length, args.state.meta?.widgetname, args.setState, loadLocaleAllowlist]);

  const fetchLocalizationSnapshot = useCallback(
    async (requestArgs: {
      publicId: string;
      accountId: string;
      subject: 'minibob' | 'account';
    }): Promise<
      | { ok: true; snapshot: ReturnType<typeof normalizeLocalizationSnapshotForOpenMode> }
      | { ok: false; message: string }
    > => {
      try {
        if (requestArgs.subject === 'account') {
          const { ok, status, json } = await args.executeAccountCommand({
            subject: requestArgs.subject,
            command: 'get-localization-snapshot',
            method: 'GET',
            url: `/api/accounts/${encodeURIComponent(requestArgs.accountId)}/instances/${encodeURIComponent(
              requestArgs.publicId,
            )}/localization?subject=${encodeURIComponent(requestArgs.subject)}`,
            accountId: requestArgs.accountId,
            publicId: requestArgs.publicId,
          });
          if (!ok) {
            const message =
              json?.error?.message ||
              json?.error?.reasonKey ||
              json?.error?.code ||
              `Failed to load localization snapshot (HTTP ${status})`;
            return { ok: false, message };
          }
          if (!json || typeof json !== 'object') {
            return { ok: false, message: 'Failed to load localization snapshot' };
          }
          return {
            ok: true,
            snapshot: normalizeLocalizationSnapshotForOpenMode(json.localization, { strict: true }),
          };
        }

        const res = await args.fetchApi(
          `/api/instance/${encodeURIComponent(requestArgs.publicId)}?subject=${encodeURIComponent(requestArgs.subject)}`,
          { cache: 'no-store' },
        );
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const message =
            json?.error?.message ||
            json?.error?.reasonKey ||
            json?.error?.code ||
            `Failed to load localization snapshot (HTTP ${res.status})`;
          return { ok: false, message };
        }
        if (!json || typeof json !== 'object') {
          return { ok: false, message: 'Failed to load localization snapshot' };
        }
        return {
          ok: true,
          snapshot: normalizeLocalizationSnapshotForOpenMode(json.localization, { strict: false }),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
      }
    },
    [args.executeAccountCommand, args.fetchApi],
  );

  const setLocalePreview = useCallback(async (rawLocale: string) => {
    const normalized = normalizeLocaleToken(rawLocale) ?? DEFAULT_LOCALE;
    const snapshot = args.stateRef.current;
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const baseLocale = snapshot.locale.baseLocale;
    const policy = snapshot.policy;
    if (!policy) {
      args.setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          error: 'Editor context is not ready.',
          loading: false,
          stale: false,
        },
      }));
      return;
    }
    const subject = resolvePolicySubject(policy);
    if (!widgetType) {
      args.setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          error: 'Missing instance context',
          loading: false,
          stale: false,
        },
      }));
      return;
    }

    const requestId = ++localeRequestRef.current;
    if (normalized === baseLocale) {
      args.setState((prev) => ({
        ...prev,
        instanceData: prev.baseInstanceData,
        locale: {
          ...prev.locale,
          activeLocale: normalized,
          baseOps: [],
          userOps: [],
          allowlist: prev.locale.allowlist,
          source: null,
          dirty: false,
          stale: false,
          loading: false,
          error: null,
        },
        undoSnapshot: null,
      }));
      return;
    }

    args.setState((prev) => ({
      ...prev,
      locale: { ...prev.locale, activeLocale: normalized, loading: true, error: null, dirty: false, stale: false },
      undoSnapshot: null,
    }));

    try {
      const allowlist = await loadLocaleAllowlist(widgetType);

      if (localeRequestRef.current !== requestId) return;
      let localizationSnapshot = {
        baseLocale: snapshot.locale.baseLocale,
        allowedLocales: snapshot.locale.allowedLocales,
        readyLocales: snapshot.locale.readyLocales,
        overlayEntries: snapshot.locale.overlayEntries,
        accountLocalesInvalid: snapshot.locale.accountLocalesInvalid,
        accountL10nPolicy: snapshot.locale.accountL10nPolicy,
      };

      if (
        subject === 'account' &&
        snapshot.meta?.publicId &&
        snapshot.meta?.accountId &&
        (!snapshot.locale.overlayEntries.length ||
          !resolveLocaleOverlayEntry(snapshot.locale.overlayEntries, normalized))
      ) {
        const fetched = await fetchLocalizationSnapshot({
          publicId: String(snapshot.meta.publicId),
          accountId: String(snapshot.meta.accountId),
          subject,
        });
        if (localeRequestRef.current !== requestId) return;
        if (fetched.ok) {
          localizationSnapshot = fetched.snapshot;
        }
      }

      const overlayEntry = resolveLocaleOverlayEntry(localizationSnapshot.overlayEntries, normalized);
      const { baseOps, userOps, source, stale, localizedData } = await resolveLocalizedOverlayState({
        baseInstanceData: snapshot.baseInstanceData,
        allowlist,
        overlayEntry,
        locale: normalized,
        warnOnMissingFingerprint: process.env.NODE_ENV === 'development',
      });
      if (localeRequestRef.current !== requestId) return;

      args.setState((prev) => ({
          ...prev,
          instanceData: localizedData,
          locale: {
            ...prev.locale,
            allowedLocales: localizationSnapshot.allowedLocales,
            readyLocales: localizationSnapshot.readyLocales,
            overlayEntries: localizationSnapshot.overlayEntries,
            accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
            accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
          activeLocale: normalized,
          baseOps,
          userOps,
          allowlist,
          source,
          dirty: false,
          stale,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      if (localeRequestRef.current !== requestId) return;
      const message = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, activeLocale: normalized, loading: false, error: message, stale: false },
      }));
    }
  }, [args.setState, args.stateRef, fetchLocalizationSnapshot, loadLocaleAllowlist]);

  const persistLocaleEdits = useCallback(async () => {
    const snapshot = args.stateRef.current;
    const policy = snapshot.policy;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const locale = snapshot.locale.activeLocale;
    if (!policy) {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Editor context is not ready.' },
      }));
      return;
    }
    const subject = resolvePolicySubject(policy);

    if (policy.role === 'viewer') {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Read-only mode: localization edits are disabled.' },
      }));
      return;
    }
    if (!publicId || !widgetType || !accountId || subject !== 'account') {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing instance context' },
      }));
      return;
    }
    if (locale === snapshot.locale.baseLocale) return;
    if (!snapshot.locale.dirty && !snapshot.locale.stale) {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'No localized changes to save' },
      }));
      return;
    }

    args.setState((prev) => ({ ...prev, isSaving: true, locale: { ...prev.locale, error: null } }));
    try {
      const allowlist = snapshot.locale.allowlist.length
        ? snapshot.locale.allowlist
        : await loadLocaleAllowlist(widgetType);
      const baseFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
      const userOps = snapshot.locale.userOps;
      const shouldDeleteUserLayer = snapshot.locale.dirty && userOps.length === 0;
      const { ok, json } = shouldDeleteUserLayer
        ? await args.executeAccountCommand({
            subject,
            command: 'delete-user-locale-layer',
            method: 'DELETE',
            url: `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
              publicId,
            )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
            accountId,
            publicId,
            locale,
          })
        : await args.executeAccountCommand({
            subject,
            command: 'put-user-locale-layer',
            method: 'PUT',
            url: `/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(
              publicId,
            )}/layers/user/${encodeURIComponent(locale)}?subject=${encodeURIComponent(subject)}`,
            accountId,
            publicId,
            locale,
            body: {
              ops: userOps,
              baseFingerprint,
              source: 'user',
              widgetType,
            },
          });
      if (!ok) {
        const errorCode = json?.error?.code || json?.error?.reasonKey;
        let message = json?.error?.message || errorCode || 'Failed to save localized changes';
        if (errorCode === 'FINGERPRINT_MISMATCH') {
          message = 'Base content changed. Switch to Base, click "Save", let translations update, then try saving overrides again.';
        }
        args.setState((prev) => ({
          ...prev,
          isSaving: false,
          locale: { ...prev.locale, error: message, loading: false },
        }));
        return;
      }
      const persistedBaseFingerprint =
        typeof json?.baseFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(json.baseFingerprint)
          ? json.baseFingerprint
          : baseFingerprint;
      const persistedBaseUpdatedAt =
        typeof json?.baseUpdatedAt === 'string' ? json.baseUpdatedAt : null;
      args.setState((prev) => ({
        ...prev,
        isSaving: false,
        locale: {
          ...prev.locale,
          overlayEntries: upsertLocaleOverlayEntry(prev.locale.overlayEntries, locale, (current) => ({
            locale,
            source: current?.source ?? 'user',
            baseFingerprint: persistedBaseFingerprint,
            baseUpdatedAt: persistedBaseUpdatedAt ?? current?.baseUpdatedAt ?? null,
            baseOps: current?.baseOps ?? [],
            userOps: shouldDeleteUserLayer ? [] : userOps,
            hasUserOps: shouldDeleteUserLayer ? false : userOps.length > 0,
          })),
          allowedLocales: prev.locale.allowedLocales,
          readyLocales: prev.locale.readyLocales,
          userOps: shouldDeleteUserLayer ? [] : userOps,
          dirty: false,
          stale: false,
          error: null,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({
        ...prev,
        isSaving: false,
        locale: { ...prev.locale, error: message },
      }));
    }
  }, [args.executeAccountCommand, args.setState, args.stateRef, loadLocaleAllowlist]);

  const rehydrateLocalizationSnapshot = useCallback(
    async (requestArgs: {
      publicId: string;
      accountId: string;
      subject: 'minibob' | 'account';
    }): Promise<{ ok: true } | { ok: false; message: string }> => {
      try {
        const localizationResult = await fetchLocalizationSnapshot(requestArgs);
        if (!localizationResult.ok) {
          args.setState((prev) => ({
            ...prev,
            locale: { ...prev.locale, loading: false, error: localizationResult.message },
          }));
          return localizationResult;
        }

        const localizationSnapshot = localizationResult.snapshot;
        const current = args.stateRef.current;
        const widgetType = current.compiled?.widgetname ?? current.meta?.widgetname;
        const baseLocale = localizationSnapshot.baseLocale;
        const previousActiveLocale = normalizeLocaleToken(current.locale.activeLocale) ?? baseLocale;
        const activeLocale = localizationSnapshot.allowedLocales.includes(previousActiveLocale)
          ? previousActiveLocale
          : baseLocale;
        let allowlist = current.locale.allowlist;
        if (!allowlist.length && widgetType) {
          allowlist = await loadLocaleAllowlist(widgetType);
        }

        let nextInstanceData = current.baseInstanceData;
        let nextBaseOps: LocalizationOp[] = [];
        let nextUserOps: LocalizationOp[] = [];
        let nextSource: string | null = null;
        let nextStale = false;

        if (activeLocale !== baseLocale) {
          const overlayEntry = resolveLocaleOverlayEntry(localizationSnapshot.overlayEntries, activeLocale);
          const localizedState = await resolveLocalizedOverlayState({
            baseInstanceData: current.baseInstanceData,
            allowlist,
            overlayEntry,
            locale: activeLocale,
          });
          nextBaseOps = localizedState.baseOps;
          nextUserOps = localizedState.userOps;
          nextSource = localizedState.source;
          nextStale = localizedState.stale;
          nextInstanceData = localizedState.localizedData;
        }

        args.setState((prev) => ({
          ...prev,
          instanceData: nextInstanceData,
          locale: {
            ...prev.locale,
            baseLocale,
            allowedLocales: localizationSnapshot.allowedLocales,
            readyLocales: localizationSnapshot.readyLocales,
            overlayEntries: localizationSnapshot.overlayEntries,
            accountLocalesInvalid: localizationSnapshot.accountLocalesInvalid,
            accountL10nPolicy: localizationSnapshot.accountL10nPolicy,
            activeLocale,
            baseOps: nextBaseOps,
            userOps: nextUserOps,
            source: nextSource,
            dirty: false,
            stale: nextStale,
            loading: false,
            error: null,
            allowlist,
          },
        }));
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        args.setState((prev) => ({
          ...prev,
          locale: { ...prev.locale, loading: false, error: message },
        }));
        return { ok: false, message };
      }
    },
    [args.setState, args.stateRef, fetchLocalizationSnapshot, loadLocaleAllowlist],
  );

  const reloadLocalizationSnapshot = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    const snapshot = args.stateRef.current;
    const policy = snapshot.policy;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    if (!policy) {
      return { ok: false as const, message: 'Editor context is not ready.' };
    }
    const subject = resolvePolicySubject(policy);

    if (!publicId || (subject !== 'minibob' && !accountId)) {
      const message = 'Missing instance context';
      return { ok: false as const, message };
    }

    args.setState((prev) => ({
      ...prev,
      locale: { ...prev.locale, loading: true, error: null },
    }));

    return rehydrateLocalizationSnapshot({ publicId, accountId, subject });
  }, [args.setState, args.stateRef, rehydrateLocalizationSnapshot]);

  const monitorLocaleTranslationsAfterSave = useCallback(async (initialDetail?: string | null) => {
    const readL10nStatus = async (requestArgs: {
      publicId: string;
      accountId: string;
      subject: 'account';
    }): Promise<
      | { stage: 'ready'; detail: string | null }
      | { stage: 'translating'; detail: string | null }
      | { stage: 'failed'; detail: string }
    > => {
      try {
        const { ok, status, json } = await args.executeAccountCommand({
          subject: requestArgs.subject,
          command: 'get-l10n-status',
          method: 'GET',
          url: `/api/accounts/${encodeURIComponent(requestArgs.accountId)}/instances/${encodeURIComponent(
            requestArgs.publicId,
          )}/l10n/status?subject=${encodeURIComponent(requestArgs.subject)}&_t=${Date.now()}`,
          accountId: requestArgs.accountId,
          publicId: requestArgs.publicId,
        });
        if (!ok) {
          const detail =
            json?.error?.message ||
            json?.error?.reasonKey ||
            json?.error?.code ||
            `Failed to load translation status (HTTP ${status})`;
          return { stage: 'failed', detail };
        }

        const locales = Array.isArray(json?.locales) ? json.locales : [];
        const failedLocale = locales.find(
          (entry: any) => entry?.status === 'failed' && typeof entry?.lastError === 'string' && entry.lastError.trim(),
        );
        if (failedLocale) {
          return { stage: 'failed', detail: String(failedLocale.lastError || '').trim() || 'Translation failed.' };
        }
        const failedCount = locales.filter((entry: any) => entry?.status === 'failed').length;
        if (failedCount > 0) return { stage: 'failed', detail: 'Translation failed for one or more locales.' };

        const pendingLocales = locales.filter((entry: any) => entry?.status && entry.status !== 'succeeded');
        if (pendingLocales.length > 0) {
          const byStatus = pendingLocales.reduce((acc: Record<string, number>, entry: any) => {
            const status = typeof entry?.status === 'string' ? entry.status : 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const running = byStatus.running || 0;
          const queued = byStatus.queued || 0;
          const dirty = byStatus.dirty || 0;
          const superseded = byStatus.superseded || 0;
          const detail =
            running > 0
              ? `${running} locale${running === 1 ? '' : 's'} translating.`
              : queued > 0
                ? `${queued} locale${queued === 1 ? '' : 's'} queued for translation.`
                : superseded > 0
                  ? `${superseded} locale${superseded === 1 ? '' : 's'} out of date.`
                  : dirty > 0
                    ? `${dirty} locale${dirty === 1 ? '' : 's'} pending translation.`
                    : 'Translations are updating.';
          return { stage: 'translating', detail };
        }

        return { stage: 'ready', detail: null };
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        return { stage: 'failed', detail };
      }
    };

    const pollUntilSynced = async (requestArgs: {
      runId: number;
      publicId: string;
      accountId: string;
      subject: 'account';
    }) => {
      const startedAt = Date.now();
      const pollIntervalMs = 1500;
      const timeoutMs = 45_000;

      while (requestArgs.runId === localeSyncRunRef.current) {
        const status = await readL10nStatus({
          publicId: requestArgs.publicId,
          accountId: requestArgs.accountId,
          subject: requestArgs.subject,
        });
        if (requestArgs.runId !== localeSyncRunRef.current) return;

        if (status.stage === 'failed') {
          const nowIso = new Date().toISOString();
          args.setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: status.detail,
              sync: {
                stage: 'failed',
                detail: status.detail,
                lastUpdatedAt: nowIso,
                lastError: status.detail,
              },
            },
          }));
          return;
        }

        if (status.stage === 'ready') {
          const hydrated = await rehydrateLocalizationSnapshot({
            publicId: requestArgs.publicId,
            accountId: requestArgs.accountId,
            subject: requestArgs.subject,
          });
          if (requestArgs.runId !== localeSyncRunRef.current) return;
          const nowIso = new Date().toISOString();
          if (!hydrated.ok) {
            args.setState((prev) => ({
              ...prev,
              locale: {
                ...prev.locale,
                loading: false,
                error: hydrated.message,
                sync: {
                  stage: 'failed',
                  detail: hydrated.message,
                  lastUpdatedAt: nowIso,
                  lastError: hydrated.message,
                },
              },
            }));
            return;
          }
          args.setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: null,
              sync: {
                stage: 'ready',
                detail: 'Translations synced.',
                lastUpdatedAt: nowIso,
                lastError: null,
              },
            },
          }));
          return;
        }

        args.setState((prev) => ({
          ...prev,
          locale: {
            ...prev.locale,
            loading: false,
            error: null,
            sync: {
              ...prev.locale.sync,
              stage: 'translating',
              detail: status.detail || 'Translations are running.',
              lastError: null,
            },
          },
        }));

        if (Date.now() - startedAt >= timeoutMs) {
          args.setState((prev) => ({
            ...prev,
            locale: {
              ...prev.locale,
              loading: false,
              error: null,
              sync: {
                ...prev.locale.sync,
                stage: 'translating',
                detail: 'Translations are still processing. You can keep editing; sync will complete shortly.',
                lastError: null,
              },
            },
          }));
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    };

    const snapshot = args.stateRef.current;
    const policy = snapshot.policy;
    const publicId = snapshot.meta?.publicId ? String(snapshot.meta.publicId) : '';
    const accountId = snapshot.meta?.accountId ? String(snapshot.meta.accountId) : '';
    if (!policy) {
      const message = 'Editor context is not ready.';
      args.setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }
    const subject = resolvePolicySubject(policy);

    if (!publicId || !accountId || subject !== 'account') {
      const message = 'Missing instance context';
      args.setState((prev) => ({
        ...prev,
        locale: {
          ...prev.locale,
          error: message,
          loading: false,
          sync: {
            stage: 'failed',
            detail: message,
            lastUpdatedAt: new Date().toISOString(),
            lastError: message,
          },
        },
      }));
      return { ok: false as const, message };
    }

    const runId = ++localeSyncRunRef.current;
    args.setState((prev) => ({
      ...prev,
      locale: {
        ...prev.locale,
        loading: true,
        error: null,
        sync: {
          stage: 'translating',
          detail: initialDetail?.trim() || 'Checking translation status...',
          lastUpdatedAt: prev.locale.sync.lastUpdatedAt,
          lastError: null,
        },
      },
    }));

    void pollUntilSynced({ runId, publicId, accountId, subject });
    return { ok: true as const };
  }, [args.executeAccountCommand, args.setState, args.stateRef, rehydrateLocalizationSnapshot]);

  const clearLocaleManualOverrides = useCallback(async () => {
    const snapshot = args.stateRef.current;
    const policy = snapshot.policy;
    const widgetType = snapshot.compiled?.widgetname ?? snapshot.meta?.widgetname;
    const locale = snapshot.locale.activeLocale;
    if (!policy) {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Editor context is not ready.' },
      }));
      return;
    }
    if (policy.role === 'viewer') {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Read-only mode: localization edits are disabled.' },
      }));
      return;
    }
    if (!widgetType) {
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: 'Missing widget context' },
      }));
      return;
    }
    if (locale === snapshot.locale.baseLocale) return;
    if (snapshot.locale.userOps.length === 0) return;

    try {
      const allowlist = snapshot.locale.allowlist.length
        ? snapshot.locale.allowlist
        : await loadLocaleAllowlist(widgetType);
      const overlayEntry = resolveLocaleOverlayEntry(snapshot.locale.overlayEntries, locale);
      const l10nSnapshot = buildL10nSnapshot(snapshot.baseInstanceData, allowlist);
      const snapshotPaths = new Set(Object.keys(l10nSnapshot));
      const baseFiltered = filterAllowlistedOps(overlayEntry?.baseOps ?? [], allowlist);
      const baseOps = baseFiltered.filtered.filter((op) => snapshotPaths.has(op.path));
      const currentFingerprint = await computeL10nFingerprint(snapshot.baseInstanceData, allowlist);
      const stale =
        snapshotPaths.size > 0 &&
        ((!overlayEntry?.baseFingerprint && (overlayEntry?.baseOps.length ?? 0) > 0) ||
          (overlayEntry?.baseFingerprint ? overlayEntry.baseFingerprint !== currentFingerprint : false));
      const localized = applyLocalizationOps(snapshot.baseInstanceData, baseOps);

      args.setState((prev) => ({
        ...prev,
        instanceData: localized,
        locale: {
          ...prev.locale,
          baseOps,
          userOps: [],
          allowlist,
          source: overlayEntry?.source ?? null,
          dirty: true,
          stale,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      args.setState((prev) => ({
        ...prev,
        locale: { ...prev.locale, error: message },
      }));
    }
  }, [args.setState, args.stateRef, loadLocaleAllowlist]);

  return {
    loadLocaleAllowlist,
    setLocalePreview,
    persistLocaleEdits,
    reloadLocalizationSnapshot,
    monitorLocaleTranslationsAfterSave,
    clearLocaleManualOverrides,
  };
}
