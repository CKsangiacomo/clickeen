'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchParisJson } from './paris-http';
import { useRomaMe } from './use-roma-me';

type AccountCreateResponse = {
  accountId: string;
};

type WorkspaceCreateResponse = {
  accountId: string;
  workspace: {
    workspaceId: string;
    name: string;
    slug: string;
  };
};

type ClaimCompleteResponse = {
  accountId: string;
  workspaceId: string;
  publicId: string;
  mode: 'rebound' | 'materialized';
  builderRoute: string;
  replay: boolean;
};

function nextIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function HomePanel() {
  const me = useRomaMe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimAttemptRef = useRef<string | null>(null);

  const [pendingAccountId, setPendingAccountId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accountName, setAccountName] = useState('My Account');
  const [workspaceName, setWorkspaceName] = useState('My Workspace');
  const [workspaceSlug, setWorkspaceSlug] = useState('');

  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'running' | 'failed'>('idle');
  const [claimError, setClaimError] = useState<string | null>(null);

  const claimToken = useMemo(() => {
    const fromMain = (searchParams.get('claimToken') || '').trim();
    if (fromMain) return fromMain;
    return (searchParams.get('claim') || '').trim();
  }, [searchParams]);

  const claimPublicIdHint = useMemo(() => (searchParams.get('publicId') || '').trim(), [searchParams]);

  const accounts = useMemo(() => me.data?.accounts ?? [], [me.data?.accounts]);
  const workspaces = useMemo(() => me.data?.workspaces ?? [], [me.data?.workspaces]);

  useEffect(() => {
    if (pendingAccountId && accounts.some((account) => account.accountId === pendingAccountId)) {
      setPendingAccountId('');
    }
  }, [accounts, pendingAccountId]);

  useEffect(() => {
    if (selectedAccountId) return;
    const preferred = me.data?.defaults.accountId ?? accounts[0]?.accountId ?? pendingAccountId;
    if (preferred) setSelectedAccountId(preferred);
  }, [accounts, me.data?.defaults.accountId, pendingAccountId, selectedAccountId]);

  const activeAccountId = selectedAccountId || pendingAccountId || '';
  const accountWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.accountId === activeAccountId),
    [activeAccountId, workspaces],
  );
  const activeWorkspaceId = accountWorkspaces[0]?.workspaceId ?? '';

  const completeClaim = useCallback(
    async (accountId: string, workspaceId: string) => {
      if (!claimToken) return;
      const attemptKey = `${claimToken}:${accountId}:${workspaceId}`;
      if (claimAttemptRef.current === attemptKey) return;
      claimAttemptRef.current = attemptKey;

      setClaimStatus('running');
      setClaimError(null);
      try {
        const payload = await fetchParisJson<ClaimCompleteResponse>('/api/paris/claims/minibob/complete', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Idempotency-Key': nextIdempotencyKey(),
          },
          body: JSON.stringify({
            claimToken,
            accountId,
            workspaceId,
          }),
        });
        router.replace(payload.builderRoute);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setClaimStatus('failed');
        setClaimError(message);
      }
    },
    [claimToken, router],
  );

  useEffect(() => {
    if (!claimToken || !activeAccountId || !activeWorkspaceId || !me.data) return;
    void completeClaim(activeAccountId, activeWorkspaceId);
  }, [activeAccountId, activeWorkspaceId, claimToken, completeClaim, me.data]);

  const handleCreateAccount = useCallback(async () => {
    setCreatingAccount(true);
    setAccountError(null);
    setWorkspaceError(null);
    try {
      const payload = await fetchParisJson<AccountCreateResponse>('/api/paris/accounts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': nextIdempotencyKey(),
        },
        body: JSON.stringify({ name: accountName }),
      });
      setPendingAccountId(payload.accountId);
      setSelectedAccountId(payload.accountId);
      await me.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAccountError(message);
    } finally {
      setCreatingAccount(false);
    }
  }, [accountName, me]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!activeAccountId) return;
    setCreatingWorkspace(true);
    setWorkspaceError(null);
    try {
      await fetchParisJson<WorkspaceCreateResponse>(
        `/api/paris/accounts/${encodeURIComponent(activeAccountId)}/workspaces`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'Idempotency-Key': nextIdempotencyKey(),
          },
          body: JSON.stringify({
            name: workspaceName,
            ...(workspaceSlug.trim() ? { slug: workspaceSlug.trim() } : {}),
          }),
        },
      );
      await me.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
    } finally {
      setCreatingWorkspace(false);
    }
  }, [activeAccountId, me, workspaceName, workspaceSlug]);

  if (me.loading) {
    return <section className="roma-module-surface">Loading identity and membership context...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="roma-module-surface">
        <p>Failed to load control-plane identity context: {me.error ?? 'unknown_error'}</p>
        <div className="roma-module-surface__actions">
          <button className="roma-btn roma-btn--inline" onClick={() => void me.reload()} type="button">
            Retry
          </button>
        </div>
      </section>
    );
  }

  const hasAnyAccountContext = accounts.length > 0 || Boolean(pendingAccountId);

  return (
    <section className="roma-module-surface">
      {claimToken ? (
        <article className="roma-card">
          <h2>Pending MiniBob Claim</h2>
          <p>
            {claimStatus === 'running'
              ? 'Binding claim to selected account/workspace and preparing builder route...'
              : claimStatus === 'failed'
                ? `Claim failed: ${claimError ?? 'unknown_error'}`
                : claimPublicIdHint
                  ? `Pending claim context for ${claimPublicIdHint}.`
                  : 'Pending claim context detected from MiniBob handoff.'}
          </p>
          {claimStatus === 'failed' ? (
            <div className="roma-module-surface__actions">
              <button
                className="roma-btn roma-btn--inline"
                type="button"
                onClick={() => {
                  claimAttemptRef.current = null;
                  if (activeAccountId && activeWorkspaceId) {
                    void completeClaim(activeAccountId, activeWorkspaceId);
                  }
                }}
              >
                Retry claim
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      {!hasAnyAccountContext ? (
        <article className="roma-card">
          <h2>Create account</h2>
          <p>Bootstrap is explicit: no silent auto-provisioning. Start by creating your account container.</p>
          <div className="roma-toolbar">
            <label className="roma-label" htmlFor="account-name-input">
              Account name
            </label>
            <input
              id="account-name-input"
              className="roma-input"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="Acme, Inc."
            />
            <button
              className="roma-btn roma-btn--inline"
              type="button"
              onClick={() => void handleCreateAccount()}
              disabled={creatingAccount}
            >
              {creatingAccount ? 'Creating account...' : 'Create account'}
            </button>
          </div>
          {accountError ? <p>Account creation failed: {accountError}</p> : null}
        </article>
      ) : null}

      {hasAnyAccountContext ? (
        <article className="roma-card">
          <h2>Account context</h2>
          {accounts.length > 0 ? (
            <div className="roma-toolbar">
              <label className="roma-label" htmlFor="home-account-select">
                Account
              </label>
              <select
                id="home-account-select"
                className="roma-select"
                value={activeAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.accountId} ({account.derivedRole})
                  </option>
                ))}
                {pendingAccountId && !accounts.some((account) => account.accountId === pendingAccountId) ? (
                  <option value={pendingAccountId}>{pendingAccountId} (pending bootstrap)</option>
                ) : null}
              </select>
            </div>
          ) : (
            <p>Using pending account bootstrap context: {pendingAccountId}</p>
          )}
        </article>
      ) : null}

      {hasAnyAccountContext && accountWorkspaces.length === 0 ? (
        <article className="roma-card">
          <h2>Create first workspace</h2>
          <p>A workspace is required before entering builder and operational modules.</p>
          <div className="roma-toolbar">
            <label className="roma-label" htmlFor="workspace-name-input">
              Workspace name
            </label>
            <input
              id="workspace-name-input"
              className="roma-input"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Primary workspace"
            />
            <label className="roma-label" htmlFor="workspace-slug-input">
              Slug (optional)
            </label>
            <input
              id="workspace-slug-input"
              className="roma-input"
              value={workspaceSlug}
              onChange={(event) => setWorkspaceSlug(event.target.value)}
              placeholder="primary-workspace"
            />
            <button
              className="roma-btn roma-btn--inline"
              type="button"
              onClick={() => void handleCreateWorkspace()}
              disabled={creatingWorkspace || !activeAccountId}
            >
              {creatingWorkspace ? 'Creating workspace...' : 'Create workspace'}
            </button>
          </div>
          {workspaceError ? <p>Workspace creation failed: {workspaceError}</p> : null}
        </article>
      ) : null}

      {accountWorkspaces.length > 0 ? (
        <>
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2>User</h2>
              <p>{me.data.user.email ?? me.data.user.id}</p>
            </article>
            <article className="roma-card">
              <h2>Accounts</h2>
              <p>{accounts.length}</p>
            </article>
            <article className="roma-card">
              <h2>Workspaces</h2>
              <p>{workspaces.length}</p>
            </article>
          </div>
          <div className="roma-codeblock">
            <strong>Defaults</strong>
            <pre>{JSON.stringify(me.data.defaults, null, 2)}</pre>
          </div>
        </>
      ) : null}
    </section>
  );
}
