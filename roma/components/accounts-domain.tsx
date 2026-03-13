'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy, resolveAccountShellReason } from '../lib/account-shell-copy';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountSummary = {
  accountId: string;
  role: string;
  name: string;
  slug: string;
  tier: string;
  websiteUrl: string | null;
};

type AccountsResponse = {
  accounts: AccountSummary[];
  defaults: {
    accountId: string | null;
  };
};

type AccountCreateResponse = {
  account: AccountSummary;
  defaults: {
    accountId: string | null;
  };
  isActive: boolean;
};

export function AccountsDomain() {
  const me = useRomaMe();
  const currentContext = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [createName, setCreateName] = useState('');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/accounts', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AccountsResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as AccountsResponse | null;
      if (!parsed || !Array.isArray(parsed.accounts)) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setAccounts(parsed);
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : String(nextError);
      setAccounts(null);
      setError(resolveAccountShellErrorCopy(reason, 'Failed to load workspaces. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me.loading && me.data) {
      void loadAccounts();
    }
  }, [loadAccounts, me.data, me.loading]);

  const createAccount = useCallback(async () => {
    const name = createName.trim();
    if (!name) {
      setError('Enter an account name to continue.');
      return;
    }

    setCreateLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as AccountCreateResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveAccountShellReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as AccountCreateResponse | null;
      if (!parsed?.account?.accountId) {
        throw new Error('coreui.errors.payload.invalid');
      }
      window.location.assign('/accounts');
    } catch (nextError) {
      const reason = nextError instanceof Error ? nextError.message : String(nextError);
      setError(resolveAccountShellErrorCopy(reason, 'Creating the workspace failed. Please try again.'));
    } finally {
      setCreateLoading(false);
    }
  }, [createName]);

  const activeAccountId = accounts?.defaults?.accountId ?? currentContext.accountId;

  if (me.loading) {
    return <section className="rd-canvas-module body-m">Loading workspace context...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Workspaces are unavailable right now. Please try again.',
        )}
      </section>
    );
  }

  return (
    <>
      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Create workspace</h2>
            <p className="body-s">Creating a new workspace is a person capability. Your role in another workspace does not limit it.</p>
            <label className="roma-field" style={{ marginTop: '12px' }}>
              <span className="label-s">Workspace name</span>
              <input
                className="roma-input body-m"
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="New account"
                maxLength={80}
                disabled={createLoading}
              />
            </label>
            <div className="rd-canvas-module__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="primary"
                type="button"
                onClick={() => void createAccount()}
                disabled={createLoading}
              >
                <span className="diet-btn-txt__label body-m">{createLoading ? 'Creating...' : 'Create workspace'}</span>
              </button>
            </div>
          </article>

          <article className="roma-card">
            <h2 className="heading-6">Active workspace</h2>
            <p className="body-s">
              Active account context still comes from Berlin bootstrap. Use the header switcher when you belong to more than one workspace.
            </p>
            <p className="body-m" style={{ marginTop: '12px' }}>
              {currentContext.accountName || 'No active workspace'}
              {currentContext.accountSlug ? ` (${currentContext.accountSlug})` : ''}
            </p>
          </article>
        </div>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 className="heading-6">Accessible workspaces</h2>
            <p className="body-s">These come from Berlin account truth, not local shell state.</p>
          </div>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void loadAccounts()}
            disabled={loading}
          >
            <span className="diet-btn-txt__label body-m">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {error ? <p className="body-m" style={{ marginTop: '12px' }}>{error}</p> : null}

        {accounts?.accounts?.length ? (
          <div className="roma-grid" style={{ marginTop: '12px' }}>
            {accounts.accounts.map((account) => {
              const isActive = account.accountId === activeAccountId;
              return (
                <article className="roma-card" key={account.accountId}>
                  <div className="roma-inline-stack" style={{ justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <h3 className="heading-6">{account.name}</h3>
                      <p className="body-s">{account.slug}</p>
                    </div>
                    <p className="body-s">{isActive ? 'Active' : account.role}</p>
                  </div>
                  <p className="body-s" style={{ marginTop: '12px' }}>
                    Role: {account.role} | Plan: {account.tier}
                  </p>
                  {account.websiteUrl ? <p className="body-s">Website: {account.websiteUrl}</p> : null}
                  <div className="rd-canvas-module__actions">
                    {isActive ? (
                      <Link href="/home" className="diet-btn-txt" data-size="md" data-variant="line2">
                        <span className="diet-btn-txt__label body-m">Open workspace</span>
                      </Link>
                    ) : (
                      <p className="body-s">Use the header switcher to activate this workspace.</p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : !loading ? (
          <p className="body-m" style={{ marginTop: '12px' }}>No accessible workspaces were returned.</p>
        ) : null}
      </section>
    </>
  );
}
