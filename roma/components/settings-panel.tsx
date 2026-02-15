'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { useRomaMe } from './use-roma-me';

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

export function SettingsPanel() {
  const me = useRomaMe();
  const [accountId, setAccountId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountSummary, setAccountSummary] = useState<AccountSummaryResponse | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummaryResponse | null>(null);

  const workspaceOptions = useMemo(() => {
    if (!me.data) return [];
    if (!accountId) return me.data.workspaces;
    return me.data.workspaces.filter((workspace) => workspace.accountId === accountId);
  }, [me.data, accountId]);

  useEffect(() => {
    if (!me.data) return;
    const preferredAccount = me.data.defaults.accountId ?? me.data.accounts[0]?.accountId ?? '';
    setAccountId((current) => current || preferredAccount);
  }, [me.data]);

  useEffect(() => {
    if (!me.data) return;
    const preferredWorkspace =
      me.data.defaults.workspaceId ??
      me.data.workspaces.find((workspace) => workspace.accountId === accountId)?.workspaceId ??
      me.data.workspaces[0]?.workspaceId ??
      '';
    setWorkspaceId((current) => {
      if (current && workspaceOptions.some((workspace) => workspace.workspaceId === current)) return current;
      return preferredWorkspace;
    });
  }, [me.data, accountId, workspaceOptions]);

  useEffect(() => {
    if (!accountId || !workspaceId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [accountPayload, workspacePayload] = await Promise.all([
          fetchParisJson<AccountSummaryResponse>(`/api/paris/accounts/${encodeURIComponent(accountId)}`),
          fetchParisJson<WorkspaceSummaryResponse>(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}`),
        ]);
        if (cancelled) return;
        setAccountSummary(accountPayload);
        setWorkspaceSummary(workspacePayload);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setAccountSummary(null);
        setWorkspaceSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId, workspaceId]);

  if (me.loading) return <section className="roma-module-surface">Loading settings context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return <section className="roma-module-surface">Missing account/workspace context for settings.</section>;
  }

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="settings-account-select">
          Account
        </label>
        <select
          id="settings-account-select"
          className="roma-select"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {me.data.accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountId}
            </option>
          ))}
        </select>

        <label className="roma-label" htmlFor="settings-workspace-select">
          Workspace
        </label>
        <select
          id="settings-workspace-select"
          className="roma-select"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {workspaceOptions.map((workspace) => (
            <option key={workspace.workspaceId} value={workspace.workspaceId}>
              {workspace.name} ({workspace.slug})
            </option>
          ))}
        </select>
      </div>

      {loading ? <p>Loading account/workspace settings context...</p> : null}
      {error ? <p>Failed to load settings context: {error}</p> : null}

      {accountSummary ? (
        <div className="roma-codeblock">
          <strong>Account Summary</strong>
          <pre>{JSON.stringify(accountSummary, null, 2)}</pre>
        </div>
      ) : null}

      {workspaceSummary ? (
        <div className="roma-codeblock">
          <strong>Workspace Summary</strong>
          <pre>{JSON.stringify(workspaceSummary, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
