'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccountLocaleSettingsCard } from './account-locale-settings-card';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountTier = 'free' | 'tier1' | 'tier2' | 'tier3';

type AccountMembersResponse = {
  members: Array<{
    userId: string;
    role: string;
    profile: {
      displayName: string;
      primaryEmail: string;
    } | null;
  }>;
};

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
    }
  | { ok?: false; error?: unknown };

function normalizeAccountTier(value: unknown): AccountTier {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'tier1' || raw === 'tier2' || raw === 'tier3') return raw;
  return 'free';
}

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

export function SettingsDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const activeAccountId = context.accountId;

  const activeAccount = useMemo(
    () => (me.data?.accounts ?? []).find((entry) => entry.accountId === activeAccountId) ?? null,
    [me.data?.accounts, activeAccountId],
  );
  const accountCapsule =
    me.data?.authz?.accountCapsule && me.data.authz.accountCapsule.trim()
      ? me.data.authz.accountCapsule.trim()
      : '';

  const [nextTier, setNextTier] = useState<AccountTier>('free');
  useEffect(() => {
    setNextTier(normalizeAccountTier(activeAccount?.tier));
  }, [activeAccount?.tier]);

  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [planChangeLoading, setPlanChangeLoading] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const [planChangeResult, setPlanChangeResult] = useState<PlanChangeResponse | null>(null);

  const [nextOwnerUserId, setNextOwnerUserId] = useState('');
  const [ownerTransferLoading, setOwnerTransferLoading] = useState(false);
  const [ownerTransferError, setOwnerTransferError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!activeAccountId) {
      setMembers(null);
      setMembersError(null);
      return;
    }
    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(activeAccountId)}/members`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AccountMembersResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      const parsed = payload as AccountMembersResponse | null;
      if (!parsed || !Array.isArray(parsed.members)) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setMembers(parsed);
      setMembersError(null);
    } catch (error) {
      setMembers(null);
      setMembersError(error instanceof Error ? error.message : String(error));
    } finally {
      setMembersLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    if (activeAccount?.role === 'owner') {
      void loadMembers();
    }
  }, [activeAccount?.role, loadMembers]);

  const applyPlanChange = useCallback(async () => {
    if (!activeAccountId) return;
    setPlanChangeLoading(true);
    setPlanChangeError(null);
    setPlanChangeResult(null);
    try {
      const payload = await fetchParisJson<PlanChangeResponse>(
        `/api/accounts/${encodeURIComponent(activeAccountId)}/lifecycle/plan-change?confirm=1`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(accountCapsule ? { 'x-ck-authz-capsule': accountCapsule } : {}),
          },
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
  }, [accountCapsule, activeAccountId, me, nextTier]);

  const transferOwner = useCallback(async () => {
    if (!activeAccountId || !nextOwnerUserId) return;
    setOwnerTransferLoading(true);
    setOwnerTransferError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(activeAccountId)}/owner-transfer`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accountCapsule ? { 'x-ck-authz-capsule': accountCapsule } : {}),
        },
        body: JSON.stringify({ nextOwnerUserId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      window.location.assign('/home');
    } catch (error) {
      setOwnerTransferError(error instanceof Error ? error.message : String(error));
    } finally {
      setOwnerTransferLoading(false);
    }
  }, [accountCapsule, activeAccountId, nextOwnerUserId]);

  const deleteAccount = useCallback(async () => {
    if (!activeAccountId) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(activeAccountId)}`, {
        method: 'DELETE',
        headers: {
          'content-type': 'application/json',
          ...(accountCapsule ? { 'x-ck-authz-capsule': accountCapsule } : {}),
        },
        body: JSON.stringify({ confirmAccountId: activeAccountId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      window.location.assign('/home');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeleteLoading(false);
    }
  }, [accountCapsule, activeAccountId]);

  if (me.loading)
    return <section className="rd-canvas-module body-m">Loading account context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        Failed to load account context: {me.error ?? 'unknown_error'}
      </section>
    );
  }

  if (!activeAccountId || !activeAccount) {
    return (
      <section className="rd-canvas-module">
        <p className="body-m">No account context is available.</p>
        <button
          className="diet-btn-txt"
          data-size="md"
          data-variant="primary"
          type="button"
          onClick={() => void me.reload()}
        >
          <span className="diet-btn-txt__label body-m">Reload</span>
        </button>
      </section>
    );
  }

  const canManagePlan = activeAccount.role === 'owner';
  const ownerCandidates =
    members?.members.filter((member) => member.userId !== me.data?.user.id && member.role !== 'owner') ?? [];
  const canDeleteAccount = activeAccount.role === 'owner';
  const deleteGuardMatches = deleteConfirm.trim() === activeAccount.slug;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {activeAccount.name} ({activeAccount.slug})
        </p>
        <p className="body-s">
          Account ID: {activeAccount.accountId} | Tier: {activeAccount.tier} | Role:{' '}
          {activeAccount.role}
        </p>
        {activeAccount.websiteUrl ? (
          <p className="body-s">Website: {activeAccount.websiteUrl}</p>
        ) : null}
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
        <h2 className="heading-6">Plan tier</h2>
        <p className="body-m">
          Plan changes apply per account (brand/site/client = 1 payer account).
        </p>
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
            <span className="diet-btn-txt__label body-m">
              {planChangeLoading ? 'Applying…' : 'Apply tier'}
            </span>
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

      <AccountLocaleSettingsCard
        accountId={activeAccountId}
        canEdit={activeAccount.role !== 'viewer'}
        authzCapsule={accountCapsule}
      />

      <section className="rd-canvas-module">
        <h2 className="heading-6">Ownership</h2>
        <p className="body-m">Owner transfer is the only way to change who the account belongs to.</p>
        {!canManagePlan ? <p className="body-s">Only the current owner can transfer ownership.</p> : null}
        {membersError ? <p className="body-m">{membersError}</p> : null}
        <div className="roma-toolbar">
          <select
            className="roma-select"
            value={nextOwnerUserId}
            onChange={(event) => setNextOwnerUserId(event.target.value)}
            aria-label="Select next owner"
            disabled={!canManagePlan || membersLoading || ownerTransferLoading || ownerCandidates.length === 0}
          >
            <option value="">Select next owner</option>
            {ownerCandidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.profile?.displayName ?? member.userId} ({member.profile?.primaryEmail ?? member.userId})
              </option>
            ))}
          </select>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void transferOwner()}
            disabled={!canManagePlan || ownerTransferLoading || !nextOwnerUserId}
          >
            <span className="diet-btn-txt__label body-m">
              {ownerTransferLoading ? 'Transferring…' : 'Transfer ownership'}
            </span>
          </button>
        </div>
        {ownerCandidates.length === 0 && canManagePlan ? (
          <p className="body-s">Add another member before transferring ownership.</p>
        ) : null}
        {ownerTransferError ? <p className="body-m">{ownerTransferError}</p> : null}
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Delete account</h2>
        <p className="body-m">This removes the account and all account-scoped data. It is owner-only final account control.</p>
        {!canDeleteAccount ? <p className="body-s">Only the current owner can delete the account.</p> : null}
        <label className="roma-field">
          <span className="label-s">Type account slug to confirm</span>
          <input
            className="roma-input body-m"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            disabled={!canDeleteAccount || deleteLoading}
          />
        </label>
        <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void deleteAccount()}
            disabled={!canDeleteAccount || deleteLoading || !deleteGuardMatches}
          >
            <span className="diet-btn-txt__label body-m">
              {deleteLoading ? 'Deleting…' : 'Delete account'}
            </span>
          </button>
        </div>
        {deleteError ? <p className="body-m">{deleteError}</p> : null}
      </section>
    </>
  );
}
