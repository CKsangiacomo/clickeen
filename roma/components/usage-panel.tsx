'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { useRomaMe } from './use-roma-me';

type AccountUsageResponse = {
  accountId: string;
  role: string;
  usage: {
    workspaces: number;
    instances: {
      total: number;
      published: number;
      unpublished: number;
    };
    assets: {
      total: number;
      active: number;
      bytesActive: number;
    };
  };
};

type WorkspacePolicyResponse = {
  workspaceId: string;
  profile: string;
  role: string;
  policy: {
    flags: Record<string, boolean>;
    caps: Record<string, number | null>;
    budgets: Record<string, { max: number | null; used: number }>;
  };
};

type WorkspaceEntitlementsResponse = {
  workspaceId: string;
  profile: string;
  role: string;
  entitlements: {
    flags: Record<string, boolean>;
    caps: Record<string, number | null>;
    budgets: Record<string, { max: number | null; used: number }>;
  };
};

export function UsagePanel() {
  const me = useRomaMe();
  const [accountId, setAccountId] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AccountUsageResponse | null>(null);
  const [policy, setPolicy] = useState<WorkspacePolicyResponse | null>(null);
  const [entitlements, setEntitlements] = useState<WorkspaceEntitlementsResponse | null>(null);

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
        const [usagePayload, policyPayload, entitlementPayload] = await Promise.all([
          fetchParisJson<AccountUsageResponse>(`/api/paris/accounts/${encodeURIComponent(accountId)}/usage`),
          fetchParisJson<WorkspacePolicyResponse>(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/policy`),
          fetchParisJson<WorkspaceEntitlementsResponse>(
            `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/entitlements`,
          ),
        ]);
        if (cancelled) return;
        setUsage(usagePayload);
        setPolicy(policyPayload);
        setEntitlements(entitlementPayload);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setUsage(null);
        setPolicy(null);
        setEntitlements(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId, workspaceId]);

  if (me.loading) return <section className="roma-module-surface">Loading usage context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return <section className="roma-module-surface">Missing account/workspace context for usage diagnostics.</section>;
  }

  const enabledFlags = policy ? Object.values(policy.policy.flags).filter(Boolean).length : 0;
  const capCount = policy ? Object.keys(policy.policy.caps).length : 0;
  const budgetCount = policy ? Object.keys(policy.policy.budgets).length : 0;

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="usage-account-select">
          Account
        </label>
        <select
          id="usage-account-select"
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
        <label className="roma-label" htmlFor="usage-workspace-select">
          Workspace
        </label>
        <select
          id="usage-workspace-select"
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

      {loading ? <p>Loading usage and entitlement diagnostics...</p> : null}
      {error ? <p>Failed to load usage diagnostics: {error}</p> : null}

      {usage ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Workspaces</h2>
            <p>{usage.usage.workspaces}</p>
          </article>
          <article className="roma-card">
            <h2>Instances</h2>
            <p>
              {usage.usage.instances.published} published / {usage.usage.instances.total} total
            </p>
          </article>
          <article className="roma-card">
            <h2>Assets</h2>
            <p>
              {usage.usage.assets.active} active ({usage.usage.assets.bytesActive} bytes)
            </p>
          </article>
        </div>
      ) : null}

      {policy ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Policy Profile</h2>
            <p>{policy.profile}</p>
          </article>
          <article className="roma-card">
            <h2>Role</h2>
            <p>{policy.role}</p>
          </article>
          <article className="roma-card">
            <h2>Entitlements</h2>
            <p>
              {enabledFlags} flags on / {capCount} caps / {budgetCount} budgets
            </p>
          </article>
        </div>
      ) : null}

      {entitlements ? (
        <div className="roma-codeblock">
          <strong>Workspace Entitlements</strong>
          <pre>{JSON.stringify(entitlements.entitlements, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
