'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountTier = 'free' | 'tier1' | 'tier2' | 'tier3';

function normalizeAccountTier(value: unknown): AccountTier {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'tier1' || raw === 'tier2' || raw === 'tier3') return raw;
  return 'free';
}

type PlanChangeResponse =
  | {
      ok: true;
      accountId: string;
      fromTier: AccountTier;
      toTier: AccountTier;
      isTierDrop: boolean;
      noticeId?: string;
      keptLivePublicIds?: string[];
      unpublished?: string[];
      assetsPurged?: boolean;
    }
  | { ok?: false; error?: unknown };

type InstancesUnpublishResponse =
  | {
      ok: true;
      accountId: string;
      kept: string[];
      unpublished: string[];
      tokyo?: { deleteEnqueued?: number; failed?: string[] };
    }
  | { ok?: false; error?: unknown };

export function SettingsDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const activeAccountId = context.accountId;

  const accounts = useMemo(() => {
    const list = me.data?.accounts ?? [];
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [me.data?.accounts]);

  const activeAccount = useMemo(
    () => accounts.find((entry) => entry.accountId === activeAccountId) ?? null,
    [accounts, activeAccountId],
  );

  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const switchAccount = useCallback(
    async (accountId: string) => {
      const normalized = String(accountId || '').trim();
      if (!normalized) return;
      setSwitchingAccountId(normalized);
      try {
        await me.setActiveAccount(normalized);
      } finally {
        setSwitchingAccountId((current) => (current === normalized ? null : current));
      }
    },
    [me],
  );

  const [nextTier, setNextTier] = useState<AccountTier>('free');
  useEffect(() => {
    setNextTier(normalizeAccountTier(activeAccount?.tier));
  }, [activeAccount?.tier]);

  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const [planChangeResult, setPlanChangeResult] = useState<PlanChangeResponse | null>(null);

  const applyPlanChange = useCallback(async () => {
    if (!activeAccountId) return;
    setPlanChangeLoading(true);
    setPlanChangeError(null);
    setPlanChangeResult(null);
    try {
      const payload = await fetchParisJson<PlanChangeResponse>(
        `/api/paris/accounts/${encodeURIComponent(activeAccountId)}/lifecycle/plan-change?confirm=1`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ nextTier }),
        },
      );
      setPlanChangeResult(payload);
      await me.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlanChangeError(message);
    } finally {
      setPlanChangeLoading(false);
    }
  }, [activeAccountId, me, nextTier]);

  const [unpublishLoading, setUnpublishLoading] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
  const [unpublishResult, setUnpublishResult] = useState<InstancesUnpublishResponse | null>(null);

  const unpublishAllInstances = useCallback(async () => {
    if (!activeAccountId) return;
    setUnpublishLoading(true);
    setUnpublishError(null);
    setUnpublishResult(null);
    try {
      const payload = await fetchParisJson<InstancesUnpublishResponse>(
        `/api/paris/accounts/${encodeURIComponent(activeAccountId)}/instances/unpublish?confirm=1`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keepLivePublicIds: [] }),
        },
      );
      setUnpublishResult(payload);
      await me.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUnpublishError(message);
    } finally {
      setUnpublishLoading(false);
    }
  }, [activeAccountId, me]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading account context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load account context: {me.error ?? 'unknown_error'}</section>;
  }

  if (accounts.length === 0) {
    return <section className="rd-canvas-module body-m">No accounts found for this user.</section>;
  }

  if (!activeAccountId || !activeAccount) {
    return (
      <section className="rd-canvas-module">
        <p className="body-m">No active account selected.</p>
        <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void me.reload()}>
          <span className="diet-btn-txt__label body-m">Reload</span>
        </button>
      </section>
    );
  }

  const canManagePlan = activeAccount.role === 'owner';

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Active account: {activeAccount.name} ({activeAccount.slug})
        </p>
        <p className="body-s">
          Account ID: {activeAccount.accountId} | Tier: {activeAccount.tier} | Role: {activeAccount.role}
        </p>
        {activeAccount.websiteUrl ? <p className="body-s">Website: {activeAccount.websiteUrl}</p> : null}
        <div className="rd-canvas-module__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/widgets">
            <span className="diet-btn-txt__label body-m">Open widgets</span>
          </Link>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/assets">
            <span className="diet-btn-txt__label body-m">Open assets</span>
          </Link>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Switch account</h2>
        <table className="roma-table">
          <thead>
            <tr>
              <th className="table-header label-s">Name</th>
              <th className="table-header label-s">Slug</th>
              <th className="table-header label-s">Tier</th>
              <th className="table-header label-s">Role</th>
              <th className="table-header label-s">Active</th>
              <th className="table-header label-s">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isActive = account.accountId === activeAccountId;
              const switching = switchingAccountId === account.accountId;
              return (
                <tr key={account.accountId}>
                  <td className="body-s">{account.name}</td>
                  <td className="body-s">{account.slug}</td>
                  <td className="body-s">{account.tier}</td>
                  <td className="body-s">{account.role}</td>
                  <td className="body-s">{isActive ? 'Yes' : 'No'}</td>
                  <td className="roma-cell-actions">
                    <button
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="secondary"
                      type="button"
                      onClick={() => void switchAccount(account.accountId)}
                      disabled={isActive || Boolean(switchingAccountId)}
                    >
                      <span className="diet-btn-txt__label body-m">{switching ? 'Switching…' : 'Use account'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Plan tier</h2>
        <p className="body-m">Plan changes apply per account (brand/site/client = 1 payer account).</p>
        <div className="roma-toolbar">
          <select
            className="roma-select"
            value={nextTier}
            onChange={(event) => setNextTier(normalizeAccountTier(event.target.value))}
            aria-label="Select next tier"
            disabled={!canManagePlan || planChangeLoading}
          >
            <option value="free">free</option>
            <option value="tier1">tier1</option>
            <option value="tier2">tier2</option>
            <option value="tier3">tier3</option>
          </select>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void applyPlanChange()}
            disabled={!canManagePlan || planChangeLoading}
          >
            <span className="diet-btn-txt__label body-m">{planChangeLoading ? 'Applying…' : 'Apply tier'}</span>
          </button>
        </div>
        {!canManagePlan ? <p className="body-s">Only account owners can change tier.</p> : null}
        {planChangeError ? <p className="body-m">Plan change failed: {planChangeError}</p> : null}
        {planChangeResult && (planChangeResult as any).ok ? (
          <div className="roma-codeblock">
            <strong className="overline-small">Plan change result</strong>
            <pre>{JSON.stringify(planChangeResult, null, 2)}</pre>
          </div>
        ) : null}
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Danger zone: unpublish all</h2>
        <p className="body-m">Turns off every live instance for this account and enqueues Tokyo cleanup.</p>
        <button
          className="diet-btn-txt"
          data-size="md"
          data-variant="secondary"
          type="button"
          onClick={() => void unpublishAllInstances()}
          disabled={unpublishLoading || !canManagePlan}
        >
          <span className="diet-btn-txt__label body-m">{unpublishLoading ? 'Unpublishing…' : 'Unpublish all instances'}</span>
        </button>
        {!canManagePlan ? <p className="body-s">Only account owners can unpublish all instances.</p> : null}
        {unpublishError ? <p className="body-m">Unpublish failed: {unpublishError}</p> : null}
        {unpublishResult && (unpublishResult as any).ok ? (
          <div className="roma-codeblock">
            <strong className="overline-small">Unpublish result</strong>
            <pre>{JSON.stringify(unpublishResult, null, 2)}</pre>
          </div>
        ) : null}
      </section>
    </>
  );
}

