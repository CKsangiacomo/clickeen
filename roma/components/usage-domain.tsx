'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes, formatNumber } from '../lib/format';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

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

export function UsageDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const workspaceId = context.workspaceId;
  const accountProfile = me.data?.authz?.accountProfile ?? me.data?.authz?.profile ?? null;
  const accountRole = me.data?.authz?.accountRole ?? me.data?.authz?.role ?? null;
  const entitlements = me.data?.authz?.entitlements ?? null;

  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AccountUsageResponse | null>(null);

  useEffect(() => {
    if (!accountId) {
      setUsage(null);
      setError(null);
      return;
    }
    const snapshot = me.data?.domains?.usage ?? null;
    if (!snapshot || snapshot.accountId !== accountId) {
      setUsage(null);
      setError('Bootstrap usage snapshot unavailable.');
      return;
    }
    setUsage(snapshot);
    setError(null);
  }, [accountId, me.data?.domains?.usage]);

  if (me.loading) return <section className="roma-module-surface">Loading usage context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return <section className="roma-module-surface">Missing account/workspace context for usage diagnostics.</section>;
  }

  const enabledFlags = entitlements ? Object.values(entitlements.flags || {}).filter(Boolean).length : 0;
  const capCount = entitlements ? Object.keys(entitlements.caps || {}).length : 0;
  const budgetCount = entitlements ? Object.keys(entitlements.budgets || {}).length : 0;

  return (
    <section className="roma-module-surface">
      <p>
        Account: {accountId} | Workspace: {context.workspaceName || workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>

      {error ? <p>Failed to load usage diagnostics: {error}</p> : null}

      {usage ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Workspaces</h2>
            <p>{formatNumber(usage.usage.workspaces)}</p>
          </article>
          <article className="roma-card">
            <h2>Widget Instances</h2>
            <p>
              {formatNumber(usage.usage.instances.published)} published / {formatNumber(usage.usage.instances.total)} total
            </p>
          </article>
          <article className="roma-card">
            <h2>Assets</h2>
            <p>
              {formatNumber(usage.usage.assets.active)} active ({formatBytes(usage.usage.assets.bytesActive)})
            </p>
          </article>
        </div>
      ) : null}

      {accountProfile || accountRole ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Policy Profile</h2>
            <p>{accountProfile ?? 'unknown'}</p>
          </article>
          <article className="roma-card">
            <h2>Role</h2>
            <p>{accountRole ?? 'unknown'}</p>
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
          <strong>Account Entitlements</strong>
          <pre>{JSON.stringify(entitlements, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
