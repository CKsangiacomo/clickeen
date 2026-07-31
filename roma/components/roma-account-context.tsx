'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
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
  accountContext: ResolvedRomaContext & {
    accountId: string;
    accountPublicId: string;
    accountLabel: string;
  };
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
    const accountId = accountContext.accountId;
    const accountPublicId = accountContext.accountPublicId;
    if (!activeAccount || !accountId || !accountPublicId || !accountContext.accountLabel) {
      return null;
    }
    const accountPolicy = resolveAccountPolicyFromRomaAuthz(me.data, accountId);
    if (!accountPolicy) return null;

    return {
      data: me.data,
      activeAccount,
      accountContext: {
        accountId,
        accountPublicId,
        accountLabel: accountContext.accountLabel,
      },
      accountPolicy,
      reload: me.reload,
    };
  }, [me.data, me.reload]);

  return <RomaAccountContext.Provider value={{ me, value }}>{children}</RomaAccountContext.Provider>;
}

export function RomaAccountBoundary({ children }: { children: ReactNode }) {
  const state = useContext(RomaAccountContext);
  if (!state) {
    throw new Error('RomaAccountBoundary must be used within RomaAccountProvider');
  }

  const { me, value } = state;
  if ((!value && me.loading) || me.error === AUTH_REQUIRED_REASON_KEY) {
    return (
      <section
        className="rd-canvas-module roma-account-loading"
        role="status"
        aria-label={me.error === AUTH_REQUIRED_REASON_KEY ? 'Opening sign in' : 'Loading page'}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </section>
    );
  }

  if (me.error || !value) {
    return (
      <section className="rd-canvas-module" role="alert">
        <p className="body-m">
          {resolveAccountShellErrorCopy(
            me.error ?? 'coreui.errors.auth.contextUnavailable',
            'This account is unavailable right now. Please try again.',
          )}
        </p>
        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void me.reload()}
          >
            <span className="diet-btn-txt__label body-m">Retry</span>
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
