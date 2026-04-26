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
    accountName: string;
    accountSlug: string;
  };
  accountPolicy: RomaAuthzPolicy;
  reload: () => Promise<void>;
};

const RomaAccountContext = createContext<RomaAccountContextValue | null>(null);

export function RomaAccountBoundary({ children }: { children: ReactNode }) {
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
    if (!activeAccount || !accountId || !accountContext.accountName || !accountContext.accountSlug) {
      return null;
    }
    const accountPolicy = resolveAccountPolicyFromRomaAuthz(me.data, accountId);
    if (!accountPolicy) return null;

    return {
      data: me.data,
      activeAccount,
      accountContext: {
        accountId,
        accountName: accountContext.accountName,
        accountSlug: accountContext.accountSlug,
      },
      accountPolicy,
      reload: me.reload,
    };
  }, [me.data, me.reload]);

  if (me.loading) {
    return <section className="roma-module-surface body-m">Loading account context...</section>;
  }

  if (me.error === AUTH_REQUIRED_REASON_KEY) {
    return <section className="roma-module-surface body-m">Redirecting to sign in...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="roma-module-surface">
        <p className="body-m">
          {resolveAccountShellErrorCopy(me.error ?? 'coreui.errors.auth.contextUnavailable', 'Account context is unavailable right now. Please try again.')}
        </p>
        <div className="rd-canvas-module__actions">
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void me.reload()}>
            <span className="diet-btn-txt__label body-m">Retry</span>
          </button>
        </div>
      </section>
    );
  }

  if (!value) {
    return (
      <section className="roma-module-surface">
        <p className="body-m">No account context is available.</p>
        <div className="rd-canvas-module__actions">
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void me.reload()}>
            <span className="diet-btn-txt__label body-m">Reload</span>
          </button>
        </div>
      </section>
    );
  }

  return <RomaAccountContext.Provider value={value}>{children}</RomaAccountContext.Provider>;
}

export function useRomaAccountContext(): RomaAccountContextValue {
  const value = useContext(RomaAccountContext);
  if (!value) {
    throw new Error('coreui.errors.auth.contextUnavailable');
  }
  return value;
}
