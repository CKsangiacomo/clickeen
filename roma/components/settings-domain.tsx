'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../lib/format';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountSummaryResponse = {
  accountId: string;
  status: string;
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
    const hasDomainPayload = Boolean(
      snapshot &&
        snapshot.accountSummary.accountId === accountId &&
        snapshot.workspaceSummary.workspaceId === workspaceId &&
        snapshot.workspaceSummary.accountId === accountId &&
        Array.isArray(snapshot.accountWorkspaces),
    );
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'settings',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setAccountSummary(null);
      setWorkspaceSummary(null);
      setAccountWorkspaces([]);
      setError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    const payload: SettingsContextPayload = {
      accountSummary: safeSnapshot.accountSummary,
      workspaceSummary: safeSnapshot.workspaceSummary,
      accountWorkspaces: safeSnapshot.accountWorkspaces,
    };
    setAccountSummary(payload.accountSummary);
    setWorkspaceSummary(payload.workspaceSummary);
    setAccountWorkspaces(payload.accountWorkspaces.slice().sort((a, b) => a.name.localeCompare(b.name)));
    setError(null);
  }, [accountId, workspaceId, me.data]);

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

  if (me.loading) return <section className="rd-canvas-module body-m">Loading settings context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return (
      <>
        <section className="rd-canvas-module">
          <p className="body-m">Select an active workspace to continue in Roma.</p>
          {error ? <p className="body-m">Failed to switch workspace: {error}</p> : null}
          {selectableWorkspaces.length === 0 ? <p className="body-m">No workspace memberships found for this user.</p> : null}
        </section>
        {selectableWorkspaces.length > 0 ? (
          <section className="rd-canvas-module">
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Workspace</th>
                  <th className="table-header label-s">Slug</th>
                  <th className="table-header label-s">Tier</th>
                  <th className="table-header label-s">Action</th>
                </tr>
              </thead>
              <tbody>
                {selectableWorkspaces.map((workspace) => (
                  <tr key={workspace.workspaceId}>
                    <td className="body-s">{workspace.name}</td>
                    <td className="body-s">{workspace.slug}</td>
                    <td className="body-s">{workspace.tier}</td>
                    <td className="roma-cell-actions">
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="primary"
                        type="button"
                        onClick={() => void handleSelectWorkspace(workspace.workspaceId)}
                        disabled={Boolean(switchingWorkspaceId)}
                      >
                        <span className="diet-btn-txt__label body-m">
                          {switchingWorkspaceId === workspace.workspaceId ? 'Switching...' : 'Use workspace'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {accountId} | Active workspace: {context.workspaceName || workspaceId}
          {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
        </p>

        <p className="body-m">User: {me.data.user.email ?? me.data.user.id}</p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">roma.errors.bootstrap.domain_unavailable</p>
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void me.reload()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
      </section>

      {accountSummary ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Account Role</h2>
              <p className="body-s">{accountSummary.role}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Account Status</h2>
              <p className="body-s">{accountSummary.status}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Workspace Count</h2>
              <p className="body-s">{formatNumber(accountSummary.workspaceCount)}</p>
            </article>
          </div>
        </section>
      ) : null}

      {workspaceSummary ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Active Workspace</h2>
              <p className="body-s">{workspaceSummary.name}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Slug</h2>
              <p className="body-s">{workspaceSummary.slug}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Tier</h2>
              <p className="body-s">{workspaceSummary.tier}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Workspace Role</h2>
              <p className="body-s">{workspaceSummary.role}</p>
            </article>
          </div>
        </section>
      ) : null}

      {accountWorkspaces.length > 0 ? (
        <section className="rd-canvas-module">
          <table className="roma-table">
            <thead>
              <tr>
                <th className="table-header label-s">Workspace</th>
                <th className="table-header label-s">Slug</th>
                <th className="table-header label-s">Tier</th>
                <th className="table-header label-s">Active</th>
                <th className="table-header label-s">Updated</th>
                <th className="table-header label-s">Action</th>
              </tr>
            </thead>
            <tbody>
              {accountWorkspaces.map((workspace) => (
                <tr key={workspace.workspaceId}>
                  <td className="body-s">{workspace.name}</td>
                  <td className="body-s">{workspace.slug}</td>
                  <td className="body-s">{workspace.tier}</td>
                  <td className="body-s">{workspace.workspaceId === workspaceId ? 'Yes' : 'No'}</td>
                  <td className="body-s">{formatTimestamp(workspace.updatedAt ?? workspace.createdAt)}</td>
                  <td className="roma-cell-actions">
                    {workspace.workspaceId === workspaceId ? (
                      <span className="label-s">Active</span>
                    ) : (
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="line2"
                        type="button"
                        onClick={() => void handleSelectWorkspace(workspace.workspaceId)}
                        disabled={Boolean(switchingWorkspaceId)}
                      >
                        <span className="diet-btn-txt__label body-m">
                          {switchingWorkspaceId === workspace.workspaceId ? 'Switching...' : 'Use workspace'}
                        </span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {!error && accountSummary && accountWorkspaces.length === 0 ? (
        <section className="rd-canvas-module">
          <p className="body-m">No workspaces found for this account.</p>
        </section>
      ) : null}

      {accountSummary ? (
        <section className="rd-canvas-module">
          <div className="rd-canvas-module__actions">
            <span className="label-s">Account ID</span>
            <code className="body-s">{accountSummary.accountId}</code>
          </div>
        </section>
      ) : null}
    </>
  );
}
