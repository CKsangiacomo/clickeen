'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import ROMA_SHELL_UI_COPY from '../l10n/shell/en.json';
import { RomaLoadingState } from './roma-system-state';
import {
  resolveAccountPolicyFromRomaAuthz,
  resolveActiveRomaAccount,
  resolveActiveRomaContext,
  useRomaMe,
  type ResolvedRomaContext,
  type RomaActiveAccount,
  type RomaAuthzPolicy,
  type RomaMeResponse,
} from './use-roma-me';

const AUTH_REQUIRED_REASON_KEY = 'coreui.errors.auth.required';

type RomaAccountContextValue = {
  data: RomaMeResponse;
  activeAccount: RomaActiveAccount;
  accountContext: ResolvedRomaContext;
  accountPolicy: RomaAuthzPolicy;
  reload: () => Promise<void>;
};

type RomaAccountProviderState = {
  me: ReturnType<typeof useRomaMe>;
  value: RomaAccountContextValue | null;
};

const RomaAccountContext = createContext<RomaAccountProviderState | null>(null);

export function RomaAccountProvider({ children }: { children: ReactNode }) {
  const me = useRomaMe();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (me.error !== AUTH_REQUIRED_REASON_KEY) return;
    if (!pathname || pathname === '/login') return;
    if (pathname.startsWith('/api/')) return;

    const search = searchParams.toString();
    const next = search ? `${pathname}?${search}` : pathname;
    window.location.replace(`/login?error=${AUTH_REQUIRED_REASON_KEY}&next=${encodeURIComponent(next)}`);
  }, [me.error, pathname, searchParams]);

  const value = useMemo<RomaAccountContextValue | null>(() => {
    if (!me.data) return null;
    const activeAccount = resolveActiveRomaAccount(me.data);
    const accountContext = resolveActiveRomaContext(me.data);

    return {
      data: me.data,
      activeAccount,
      accountContext,
      accountPolicy: resolveAccountPolicyFromRomaAuthz(me.data),
      reload: me.reload,
    };
  }, [me.data, me.reload]);

  return <RomaAccountContext.Provider value={{ me, value }}>{children}</RomaAccountContext.Provider>;
}

export function RomaAccountBoundary({ children }: { children: ReactNode }) {
  const state = useContext(RomaAccountContext);
  const [retryPending, setRetryPending] = useState(false);
  const [retryReason, setRetryReason] = useState<string | null>(null);
  if (!state) {
    throw new Error('RomaAccountBoundary must be used within RomaAccountProvider');
  }

  const { me, value } = state;
  const visibleError = me.error ?? (retryPending ? retryReason : null);
  const retry = async () => {
    if (retryPending) return;
    setRetryReason(me.error ?? 'coreui.errors.auth.contextUnavailable');
    setRetryPending(true);
    try {
      await me.reload();
    } finally {
      setRetryPending(false);
    }
  };

  if (!value && me.loading && !retryPending) {
    return <RomaLoadingState className="rd-canvas-module roma-account-loading" />;
  }

  if (visibleError || !value) {
    return (
      <section className="rd-canvas-module" role="alert">
        <div className="rd-canvas-module__actions">
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            data-loading={retryPending || undefined}
            type="button"
            aria-busy={retryPending || undefined}
            onClick={() => void retry()}
            disabled={retryPending}
          >
            {retryPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{ROMA_SHELL_UI_COPY.commands.retry}</span>
          </button>
        </div>
      </section>
    );
  }

  return children;
}

export function useRomaAccountContext(): RomaAccountContextValue {
  const state = useContext(RomaAccountContext);
  if (!state?.value) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  return state.value;
}
