'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../lib/format';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountSummaryResponse = {
  accountId: string;
  status: string;
  isPlatform: boolean;
  role: string;
  workspaceCount: number;
};

type WorkspaceSummaryResponse = {
  workspaceId: string;
  accountId: string;
  tier: string;
  name: string;
  slug: string;
  role: string;
};

type AccountWorkspacesResponse = {
  accountId: string;
  role: string;
  workspaces: Array<{
    workspaceId: string;
    accountId: string;
    tier: string;
    name: string;
    slug: string;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
};

type SettingsContextPayload = {
  accountSummary: AccountSummaryResponse;
  workspaceSummary: WorkspaceSummaryResponse;
  accountWorkspaces: AccountWorkspacesResponse['workspaces'];
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function SettingsDomain() {
  const router = useRouter();
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId.trim();
  const workspaceId = context.workspaceId.trim();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryResponse | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummaryResponse | null>(null);
  const [accountWorkspaces, setAccountWorkspaces] = useState<AccountWorkspacesResponse['workspaces']>([]);
  const selectableWorkspaces = useMemo(
    () => me.data?.workspaces.slice().sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [me.data?.workspaces],
  );

  useEffect(() => {
    if (!accountId || !workspaceId) {
      setAccountSummary(null);
      setWorkspaceSummary(null);
      setAccountWorkspaces([]);
      setError(null);
      return;
    }
    const snapshot = me.data?.domains?.settings ?? null;
    if (
      !snapshot ||
      snapshot.accountSummary.accountId !== accountId ||
      snapshot.workspaceSummary.workspaceId !== workspaceId ||
      snapshot.workspaceSummary.accountId !== accountId ||
      !Array.isArray(snapshot.accountWorkspaces)
    ) {
      setAccountSummary(null);
      setWorkspaceSummary(null);
      setAccountWorkspaces([]);
      setError('Bootstrap settings snapshot unavailable.');
      return;
    }
    const payload: SettingsContextPayload = {
      accountSummary: snapshot.accountSummary,
      workspaceSummary: snapshot.workspaceSummary,
      accountWorkspaces: snapshot.accountWorkspaces,
    };
    setAccountSummary(payload.accountSummary);
    setWorkspaceSummary(payload.workspaceSummary);
    setAccountWorkspaces(payload.accountWorkspaces.slice().sort((a, b) => a.name.localeCompare(b.name)));
    setError(null);
  }, [accountId, workspaceId, me.data?.domains?.settings]);

  const handleSelectWorkspace = useCallback(
    async (nextWorkspaceId: string) => {
      const normalizedWorkspaceId = String(nextWorkspaceId || '').trim();
      if (!normalizedWorkspaceId) return;
      setSwitchingWorkspaceId(normalizedWorkspaceId);
      setError(null);
      try {
        await me.setActiveWorkspace(normalizedWorkspaceId);
        router.replace('/settings', { scroll: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setSwitchingWorkspaceId((current) => (current === normalizedWorkspaceId ? null : current));
      }
    },
    [me, router],
  );

  if (me.loading) return <section className="roma-module-surface">Loading settings context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return (
      <section className="roma-module-surface">
        <p>Select an active workspace to continue in Roma.</p>
        {error ? <p>Failed to switch workspace: {error}</p> : null}
        {selectableWorkspaces.length === 0 ? <p>No workspace memberships found for this user.</p> : null}
        {selectableWorkspaces.length > 0 ? (
          <table className="roma-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Slug</th>
                <th>Tier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {selectableWorkspaces.map((workspace) => (
                <tr key={workspace.workspaceId}>
                  <td>{workspace.name}</td>
                  <td>{workspace.slug}</td>
                  <td>{workspace.tier}</td>
                  <td className="roma-cell-actions">
                    <button
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="primary"
                      type="button"
                      onClick={() => void handleSelectWorkspace(workspace.workspaceId)}
                      disabled={Boolean(switchingWorkspaceId)}
                    >
                      <span className="diet-btn-txt__label">
                        {switchingWorkspaceId === workspace.workspaceId ? 'Switching...' : 'Use workspace'}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    );
  }

  return (
    <section className="roma-module-surface">
      <p>
        Account: {accountId} | Active workspace: {context.workspaceName || workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>

      <p>User: {me.data.user.email ?? me.data.user.id}</p>

      {error ? <p>Failed to load settings context: {error}</p> : null}

      {accountSummary ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Account Role</h2>
            <p>{accountSummary.role}</p>
          </article>
          <article className="roma-card">
            <h2>Account Status</h2>
            <p>{accountSummary.status}</p>
          </article>
          <article className="roma-card">
            <h2>Platform Account</h2>
            <p>{accountSummary.isPlatform ? 'Yes' : 'No'}</p>
          </article>
          <article className="roma-card">
            <h2>Workspace Count</h2>
            <p>{formatNumber(accountSummary.workspaceCount)}</p>
          </article>
        </div>
      ) : null}

      {workspaceSummary ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Active Workspace</h2>
            <p>{workspaceSummary.name}</p>
          </article>
          <article className="roma-card">
            <h2>Slug</h2>
            <p>{workspaceSummary.slug}</p>
          </article>
          <article className="roma-card">
            <h2>Tier</h2>
            <p>{workspaceSummary.tier}</p>
          </article>
          <article className="roma-card">
            <h2>Workspace Role</h2>
            <p>{workspaceSummary.role}</p>
          </article>
        </div>
      ) : null}

      {accountWorkspaces.length > 0 ? (
        <table className="roma-table">
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Slug</th>
              <th>Tier</th>
              <th>Active</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {accountWorkspaces.map((workspace) => (
              <tr key={workspace.workspaceId}>
                <td>{workspace.name}</td>
                <td>{workspace.slug}</td>
                <td>{workspace.tier}</td>
                <td>{workspace.workspaceId === workspaceId ? 'Yes' : 'No'}</td>
                <td>{formatTimestamp(workspace.updatedAt ?? workspace.createdAt)}</td>
                <td className="roma-cell-actions">
                  {workspace.workspaceId === workspaceId ? (
                    <span className="roma-label">Active</span>
                  ) : (
                    <button
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="line2"
                      type="button"
                      onClick={() => void handleSelectWorkspace(workspace.workspaceId)}
                      disabled={Boolean(switchingWorkspaceId)}
                    >
                      <span className="diet-btn-txt__label">
                        {switchingWorkspaceId === workspace.workspaceId ? 'Switching...' : 'Use workspace'}
                      </span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!error && accountSummary && accountWorkspaces.length === 0 ? (
        <p>No workspaces found for this account.</p>
      ) : null}

      {accountSummary ? (
        <div className="roma-module-surface__actions">
          <span className="roma-label">Account ID</span>
          <code>{accountSummary.accountId}</code>
        </div>
      ) : null}
    </section>
  );
}
