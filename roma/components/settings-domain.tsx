'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolvePersonLabel } from '../lib/person-profile';
import { AccountLocaleSettingsCard } from './account-locale-settings-card';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountMembersResponse = {
  members: Array<{
    userId: string;
    role: string;
    profile: {
      givenName: string | null;
      familyName: string | null;
      primaryEmail: string;
    } | null;
  }>;
};

const SETTINGS_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to manage this workspace.',
  'coreui.errors.auth.contextUnavailable': 'Account settings are unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this workspace.',
  'coreui.errors.db.readFailed': 'Failed to load account settings. Please try again.',
  'coreui.errors.db.writeFailed': 'Saving account settings failed. Please try again.',
  'coreui.errors.payload.invalid': 'The account settings request was invalid. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
};

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

function resolveSettingsErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = SETTINGS_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return normalized;
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

  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

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
      const reason = error instanceof Error ? error.message : String(error);
      setMembers(null);
      setMembersError(resolveSettingsErrorCopy(reason, 'Failed to load workspace members. Please try again.'));
    } finally {
      setMembersLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => {
    if (activeAccount?.role === 'owner') {
      void loadMembers();
    }
  }, [activeAccount?.role, loadMembers]);

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
      const reason = error instanceof Error ? error.message : String(error);
      setOwnerTransferError(resolveSettingsErrorCopy(reason, 'Ownership transfer failed. Please try again.'));
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
      const reason = error instanceof Error ? error.message : String(error);
      setDeleteError(resolveSettingsErrorCopy(reason, 'Account deletion failed. Please try again.'));
    } finally {
      setDeleteLoading(false);
    }
  }, [accountCapsule, activeAccountId]);

  if (me.loading) {
    return <section className="rd-canvas-module body-m">Loading account context...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveSettingsErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Account settings are unavailable right now.',
        )}
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

  const canManageAccount = activeAccount.role === 'owner';
  const canEditLocales = activeAccount.role === 'owner' || activeAccount.role === 'admin';
  const ownerCandidates =
    members?.members.filter((member) => member.userId !== me.data?.user.id && member.role !== 'owner') ?? [];
  const deleteGuardMatches = deleteConfirm.trim() === activeAccount.slug;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {activeAccount.name} ({activeAccount.slug})
        </p>
        <p className="body-s">
          Plan: {activeAccount.tier} | Your role: {activeAccount.role}
        </p>
        {activeAccount.websiteUrl ? <p className="body-s">Website: {activeAccount.websiteUrl}</p> : null}
        <div className="rd-canvas-module__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/widgets">
            <span className="diet-btn-txt__label body-m">Open widgets</span>
          </Link>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/assets">
            <span className="diet-btn-txt__label body-m">Open assets</span>
          </Link>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/billing">
            <span className="diet-btn-txt__label body-m">Open billing</span>
          </Link>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Plan</h2>
        <p className="body-m">Current plan: {activeAccount.tier}</p>
        <p className="body-s">
          Plan and billing changes are handled through the billing/commercial flow, not directly in Account Settings.
        </p>
      </section>

      <AccountLocaleSettingsCard accountId={activeAccountId} canEdit={canEditLocales} authzCapsule={accountCapsule} />

      <section className="rd-canvas-module">
        <h2 className="heading-6">Ownership</h2>
        <p className="body-m">Owner transfer is the only way to change who the account belongs to.</p>
        {!canManageAccount ? <p className="body-s">Only the current owner can transfer ownership.</p> : null}
        {membersError ? <p className="body-m">{membersError}</p> : null}
        <div className="roma-toolbar">
          <select
            className="roma-select"
            value={nextOwnerUserId}
            onChange={(event) => setNextOwnerUserId(event.target.value)}
            aria-label="Select next owner"
            disabled={!canManageAccount || membersLoading || ownerTransferLoading || ownerCandidates.length === 0}
          >
            <option value="">Select next owner</option>
            {ownerCandidates.map((member) => (
            <option key={member.userId} value={member.userId}>
                {resolvePersonLabel(member.profile, member.userId)} ({member.profile?.primaryEmail ?? member.userId})
            </option>
          ))}
          </select>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void transferOwner()}
            disabled={!canManageAccount || ownerTransferLoading || !nextOwnerUserId}
          >
            <span className="diet-btn-txt__label body-m">
              {ownerTransferLoading ? 'Transferring…' : 'Transfer ownership'}
            </span>
          </button>
        </div>
        {ownerCandidates.length === 0 && canManageAccount ? (
          <p className="body-s">Add another member before transferring ownership.</p>
        ) : null}
        {ownerTransferError ? <p className="body-m">{ownerTransferError}</p> : null}
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Delete account</h2>
        <p className="body-m">This removes the account and all account-scoped data. It is owner-only final account control.</p>
        {!canManageAccount ? <p className="body-s">Only the current owner can delete the account.</p> : null}
        <label className="roma-field">
          <span className="label-s">Type account slug to confirm</span>
          <input
            className="roma-input body-m"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
            disabled={!canManageAccount || deleteLoading}
          />
        </label>
        <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void deleteAccount()}
            disabled={!canManageAccount || deleteLoading || !deleteGuardMatches}
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
