'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../lib/format';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
import { fetchParisJson } from './paris-http';
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

type WorkspacePublishedInstance = {
  publicId: string;
  widgetType: string;
  displayName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
};

type RomaWidgetsListResponse = {
  instances?: Array<{
    publicId?: string | null;
    widgetType?: string | null;
    displayName?: string | null;
    status?: 'published' | 'unpublished' | string | null;
    source?: 'workspace' | 'curated' | string | null;
    workspaceId?: string | null;
  }> | null;
};

type WorkspaceTier = 'free' | 'tier1' | 'tier2' | 'tier3';

function normalizeWorkspaceTier(value: unknown): WorkspaceTier | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'free' || raw === 'tier1' || raw === 'tier2' || raw === 'tier3') return raw;
  return null;
}

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
  const isAccountOwner = useMemo(() => {
    const membership = me.data?.accounts.find((account) => account.accountId === accountId) ?? null;
    return membership?.derivedRole === 'account_owner';
  }, [accountId, me.data?.accounts]);

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

  const [publishedInstances, setPublishedInstances] = useState<WorkspacePublishedInstance[]>([]);
  const [publishedLoading, setPublishedLoading] = useState(false);
  const [publishedHasLoaded, setPublishedHasLoaded] = useState(false);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [keepLivePublicIds, setKeepLivePublicIds] = useState<string[]>([]);
  const [unpublishLoading, setUnpublishLoading] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
  const [unpublishResult, setUnpublishResult] = useState<null | {
    kept?: string[];
    unpublished?: string[];
    tokyo?: { deleteEnqueued?: number; failed?: string[] };
  }>(null);

  const refreshPublishedInstances = useCallback(async () => {
    if (!accountId) return;
    const workspaceSources =
      accountWorkspaces.length > 0
        ? accountWorkspaces.map((workspace) => ({
            workspaceId: workspace.workspaceId,
            name: workspace.name,
            slug: workspace.slug,
          }))
        : (me.data?.workspaces ?? [])
            .filter((workspace) => workspace.accountId === accountId)
            .map((workspace) => ({
              workspaceId: workspace.workspaceId,
              name: workspace.name,
              slug: workspace.slug,
            }));

    setPublishedLoading(true);
    setPublishedError(null);
    setPublishedHasLoaded(true);
    try {
      const payloads = await Promise.all(
        workspaceSources.map(async (workspace) => {
          const response = await fetchParisJson<RomaWidgetsListResponse>(
            `/api/paris/roma/widgets?workspaceId=${encodeURIComponent(workspace.workspaceId)}`,
            { method: 'GET' },
          );
          const instances = Array.isArray(response?.instances) ? response.instances : [];
          const published = instances
            .filter((instance) => instance && instance.source === 'workspace' && instance.status === 'published')
            .map((instance) => ({
              publicId: String(instance.publicId || '').trim(),
              widgetType: String(instance.widgetType || '').trim() || 'unknown',
              displayName: String(instance.displayName || '').trim() || 'Untitled widget',
              workspaceId: workspace.workspaceId,
              workspaceName: workspace.name,
              workspaceSlug: workspace.slug,
            }))
            .filter((instance) => Boolean(instance.publicId));
          return published;
        }),
      );

      const byPublicId = new Map<string, WorkspacePublishedInstance>();
      payloads.flat().forEach((instance) => {
        if (!byPublicId.has(instance.publicId)) byPublicId.set(instance.publicId, instance);
      });

      const next = Array.from(byPublicId.values()).sort((a, b) => a.publicId.localeCompare(b.publicId));
      setPublishedInstances(next);
      setKeepLivePublicIds((current) => current.filter((publicId) => byPublicId.has(publicId)));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPublishedError(message);
      setPublishedInstances([]);
    } finally {
      setPublishedLoading(false);
    }
  }, [accountId, accountWorkspaces, me.data?.workspaces]);

  const toggleKeepLive = useCallback((publicId: string) => {
    const normalized = String(publicId || '').trim();
    if (!normalized) return;
    setKeepLivePublicIds((current) => {
      if (current.includes(normalized)) return current.filter((id) => id !== normalized);
      return [...current, normalized].sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const unpublishOtherInstances = useCallback(async () => {
    if (!accountId) return;
    setUnpublishLoading(true);
    setUnpublishError(null);
    setUnpublishResult(null);
    try {
      const payload = await fetchParisJson<{
        kept?: string[];
        unpublished?: string[];
        tokyo?: { deleteEnqueued?: number; failed?: string[] };
      }>(`/api/paris/accounts/${encodeURIComponent(accountId)}/instances/unpublish?confirm=1`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ keepLivePublicIds }),
      });
      setUnpublishResult(payload ?? null);
      await me.reload();
      await refreshPublishedInstances();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUnpublishError(message);
    } finally {
      setUnpublishLoading(false);
    }
  }, [accountId, keepLivePublicIds, me, refreshPublishedInstances]);

  const [nextTier, setNextTier] = useState<WorkspaceTier>('free');
  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const [planChangeResult, setPlanChangeResult] = useState<null | {
    fromTier?: string;
    toTier?: string;
    isTierDrop?: boolean;
    workspacesUpdated?: number;
    unpublished?: string[];
    assetsPurged?: boolean;
    noticeId?: string;
  }>(null);

  useEffect(() => {
    const normalized = normalizeWorkspaceTier(workspaceSummary?.tier);
    if (!normalized) return;
    setNextTier(normalized);
  }, [workspaceSummary?.tier]);

  const applyPlanChange = useCallback(async () => {
    if (!accountId) return;
    if (!isAccountOwner) return;

    const keepCount = keepLivePublicIds.length;
    const willPurgeAssets = nextTier === 'free';
    const confirmed = window.confirm(
      [
        `Apply plan change for account ${accountId}?`,
        `Next tier: ${nextTier}`,
        keepCount > 0 ? `Keep live: ${keepCount} instance(s)` : `Keep live: auto-pick default`,
        willPurgeAssets ? `WARNING: dropping to free purges ALL account assets from Tokyo/R2.` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    if (!confirmed) return;

    setPlanChangeLoading(true);
    setPlanChangeError(null);
    setPlanChangeResult(null);
    try {
      const body: Record<string, unknown> = { nextTier };
      if (keepLivePublicIds.length > 0) body.keepLivePublicIds = keepLivePublicIds;
      const payload = await fetchParisJson<{
        fromTier?: string;
        toTier?: string;
        isTierDrop?: boolean;
        workspacesUpdated?: number;
        unpublished?: string[];
        assetsPurged?: boolean;
        noticeId?: string;
      }>(`/api/paris/accounts/${encodeURIComponent(accountId)}/lifecycle/plan-change?confirm=1`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      setPlanChangeResult(payload ?? null);
      await me.reload();
      await refreshPublishedInstances();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPlanChangeError(message);
    } finally {
      setPlanChangeLoading(false);
    }
  }, [accountId, isAccountOwner, keepLivePublicIds, me, nextTier, refreshPublishedInstances]);

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

      {accountSummary ? (
        <section className="rd-canvas-module">
          <div className="roma-inline-stack">
            <h2 className="heading-6">Plan change (tier)</h2>
            <p className="body-m">
              Updates the tier across every workspace in this account. If the tier drops, this immediately enforces the new plan (unpublish + Tokyo
              deletes; dropping to <code>free</code> force-deletes all assets for the account).
            </p>
            {!isAccountOwner ? (
              <p className="body-m">Plan changes require account owner access.</p>
            ) : (
              <div className="roma-toolbar">
                <select
                  className="roma-input"
                  value={nextTier}
                  onChange={(event) => {
                    const normalized = normalizeWorkspaceTier(event.target.value);
                    if (normalized) setNextTier(normalized);
                  }}
                  aria-label="Next tier"
                  disabled={planChangeLoading}
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
                  disabled={planChangeLoading}
                >
                  <span className="diet-btn-txt__label body-m">{planChangeLoading ? 'Applying...' : 'Apply plan change'}</span>
                </button>
              </div>
            )}
            {planChangeError ? <p className="body-m">Plan change failed: {planChangeError}</p> : null}
            {planChangeResult ? (
              <p className="body-m">
                Tier change: <code>{String(planChangeResult.fromTier ?? 'unknown')}</code> {'->'}{' '}
                <code>{String(planChangeResult.toTier ?? 'unknown')}</code>
                {typeof planChangeResult.workspacesUpdated === 'number' ? ` | workspaces updated: ${planChangeResult.workspacesUpdated}` : ''}
                {typeof planChangeResult.assetsPurged === 'boolean' ? ` | assets purged: ${planChangeResult.assetsPurged ? 'yes' : 'no'}` : ''}
                {Array.isArray(planChangeResult.unpublished) ? ` | instances unpublished: ${formatNumber(planChangeResult.unpublished.length)}` : ''}
              </p>
            ) : null}
            <p className="body-s">
              Tip: for tier drops, load published instances below and check the ones you want to keep live before applying the plan change. If nothing is
              selected, the system will auto-pick a default keep set.
            </p>
          </div>
        </section>
      ) : null}

      {accountSummary ? (
        <section className="rd-canvas-module">
          <h2 className="heading-6">Downgrade cleanup (instances)</h2>
          <p className="body-m">
            Keeps the selected live instances and unpublishes every other published instance in this account.
          </p>

          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void refreshPublishedInstances()}
              disabled={publishedLoading || unpublishLoading}
            >
              <span className="diet-btn-txt__label body-m">{publishedLoading ? 'Loading...' : 'Load published instances'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
          onClick={() => void unpublishOtherInstances()}
              disabled={unpublishLoading || publishedLoading || !publishedHasLoaded || publishedInstances.length === 0}
            >
              <span className="diet-btn-txt__label body-m">{unpublishLoading ? 'Unpublishing...' : 'Unpublish all others'}</span>
            </button>
          </div>

          {publishedError ? <p className="body-m">Failed to load published instances: {publishedError}</p> : null}
          {unpublishError ? <p className="body-m">Unpublish failed: {unpublishError}</p> : null}
          {unpublishResult ? (
            <p className="body-m">
              Kept: {formatNumber(unpublishResult.kept?.length ?? 0)} | Unpublished:{' '}
              {formatNumber(unpublishResult.unpublished?.length ?? 0)} | Tokyo deletes queued:{' '}
              {formatNumber(unpublishResult.tokyo?.deleteEnqueued ?? 0)}
            </p>
          ) : null}

          {!publishedHasLoaded ? (
            <p className="body-m">Click “Load published instances” to see what is currently live for this account.</p>
          ) : publishedInstances.length > 0 ? (
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Keep live</th>
                  <th className="table-header label-s">Instance</th>
                  <th className="table-header label-s">Public ID</th>
                  <th className="table-header label-s">Widget</th>
                  <th className="table-header label-s">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {publishedInstances.map((instance) => {
                  const checked = keepLivePublicIds.includes(instance.publicId);
                  return (
                    <tr key={instance.publicId}>
                      <td className="body-s">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKeepLive(instance.publicId)}
                          disabled={unpublishLoading || publishedLoading}
                        />
                      </td>
                      <td className="body-s">{instance.displayName}</td>
                      <td className="body-s">
                        <code>{instance.publicId}</code>
                      </td>
                      <td className="body-s">{instance.widgetType}</td>
                      <td className="body-s">
                        {instance.workspaceName}
                        {instance.workspaceSlug ? ` (${instance.workspaceSlug})` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="body-m">No published instances found.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
