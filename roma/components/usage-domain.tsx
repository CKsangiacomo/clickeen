'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes, formatNumber } from '../lib/format';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
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
    const hasDomainPayload = Boolean(snapshot && snapshot.accountId === accountId);
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'usage',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setUsage(null);
      setError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    setUsage(safeSnapshot);
    setError(null);
  }, [accountId, me.data]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading usage context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId || !workspaceId) {
    return <section className="rd-canvas-module body-m">Missing account/workspace context for usage diagnostics.</section>;
  }

  const enabledFlags = entitlements ? Object.values(entitlements.flags || {}).filter(Boolean).length : 0;
  const capCount = entitlements ? Object.keys(entitlements.caps || {}).length : 0;
  const budgetCount = entitlements ? Object.keys(entitlements.budgets || {}).length : 0;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {accountId} | Workspace: {context.workspaceName || workspaceId}
          {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
        </p>

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

      {usage ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Workspaces</h2>
              <p className="body-s">{formatNumber(usage.usage.workspaces)}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Widget Instances</h2>
              <p className="body-s">
                {formatNumber(usage.usage.instances.published)} published / {formatNumber(usage.usage.instances.total)} total
              </p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Assets</h2>
              <p className="body-s">
                {formatNumber(usage.usage.assets.active)} active ({formatBytes(usage.usage.assets.bytesActive)})
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {accountProfile || accountRole ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Policy Profile</h2>
              <p className="body-s">{accountProfile ?? 'unknown'}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Role</h2>
              <p className="body-s">{accountRole ?? 'unknown'}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Entitlements</h2>
              <p className="body-s">
                {enabledFlags} flags on / {capCount} caps / {budgetCount} budgets
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {entitlements ? (
        <section className="rd-canvas-module">
          <div className="roma-codeblock">
            <strong className="overline-small">Account Entitlements</strong>
            <pre>{JSON.stringify(entitlements, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </>
  );
}
