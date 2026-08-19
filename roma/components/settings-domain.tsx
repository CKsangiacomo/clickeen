'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatAccountRoleLabel, formatAccountTierLabel } from '../lib/format';
import { resolvePersonLabel } from '../lib/person-profile';
import { useRomaAccountApi } from './account-api';
import { AccountLocaleSettingsCard } from './account-locale-settings-card';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
import { useRomaAccountContext } from './roma-account-context';

type AccountMember = {
  userId: string;
  role: string;
  profile: {
    givenName: string | null;
    familyName: string | null;
    primaryEmail: string;
  } | null;
};

type AccountMembersResponse = {
  members: AccountMember[];
};

const SETTINGS_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to manage this account.',
  'coreui.errors.auth.contextUnavailable': 'Account settings are unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this account.',
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
  return fallback;
}

export function SettingsDomain() {
  const { activeAccount, accountContext, data, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const activeAccountId = accountContext.accountId;

  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [nextOwnerUserId, setNextOwnerUserId] = useState('');
  const [ownerTransferLoading, setOwnerTransferLoading] = useState(false);
  const [ownerTransferError, setOwnerTransferError] = useState<string | null>(null);
  const [ownerTransferConfirmationCandidate, setOwnerTransferConfirmationCandidate] = useState<AccountMember | null>(null);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const response = await accountApi.fetchRaw(`/api/account/team`, {
        method: 'GET',
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
      setMembersError(resolveSettingsErrorCopy(reason, 'Failed to load account members. Please try again.'));
    } finally {
      setMembersLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    if (activeAccount?.role === 'owner') {
      void loadMembers();
    }
  }, [activeAccount?.role, loadMembers]);

  const transferOwner = useCallback(async (ownerUserId: string) => {
    if (!activeAccountId) return;
    setOwnerTransferLoading(true);
    setOwnerTransferError(null);
    try {
      const response = await accountApi.fetchRaw(`/api/account/owner-transfer`, {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ nextOwnerUserId: ownerUserId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
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
  }, [accountApi, activeAccountId]);

  const canManageAccount = activeAccount.role === 'owner';
  const canEditLocales = activeAccount.role === 'owner' || activeAccount.role === 'admin';
  const ownerCandidates = members?.members.filter((member) => member.userId !== data.user.id && member.role !== 'owner') ?? [];
  const selectedOwnerCandidate = ownerCandidates.find((member) => member.userId === nextOwnerUserId) ?? null;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {accountContext.accountLabel}
        </p>
        <p className="body-s">
          Plan: {formatAccountTierLabel(activeAccount.tier)} | Your role: {formatAccountRoleLabel(activeAccount.role)}
        </p>
        {activeAccount.websiteUrl ? <p className="body-s">Website: {activeAccount.websiteUrl}</p> : null}
        <div className="rd-canvas-module__actions">
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/widgets">
            <span className="diet-button__label">Open widgets</span>
          </Link>
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/assets">
            <span className="diet-button__label">Open assets</span>
          </Link>
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/billing">
            <span className="diet-button__label">Open billing</span>
          </Link>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">Plan</h2>
        <p className="body-m">Current plan: {formatAccountTierLabel(activeAccount.tier)}</p>
        <p className="body-s">Plan changes are handled outside Roma until the billing provider integration is connected.</p>
      </section>

      <AccountLocaleSettingsCard accountId={activeAccountId} canEdit={canEditLocales} onSaved={() => reload()} />

      <section className="rd-canvas-module">
        <h2 className="heading-6">Ownership</h2>
        <p className="body-m">Owner transfer is the only way to change who the account belongs to.</p>
        {!canManageAccount ? <p className="body-s">Only the current owner can transfer ownership.</p> : null}
        {membersError ? <p className="body-m" role="alert">{membersError}</p> : null}
        <div className="roma-toolbar">
          <DieterDropdownActions
            className="roma-owner-select"
            value={nextOwnerUserId}
            onChange={setNextOwnerUserId}
            ariaLabel="Select next owner"
            disabled={!canManageAccount || membersLoading || ownerTransferLoading || ownerCandidates.length === 0}
            options={[
              { value: '', label: 'Select next owner' },
              ...ownerCandidates.map((member) => ({
                value: member.userId,
                label: `${resolvePersonLabel(member.profile, member.userId)} (${member.profile?.primaryEmail ?? member.userId})`,
              })),
            ]}
          />
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={() => setOwnerTransferConfirmationCandidate(selectedOwnerCandidate)}
            disabled={!canManageAccount || ownerTransferLoading || !selectedOwnerCandidate}
          >
            <span className="diet-button__label">{ownerTransferLoading ? 'Transferring…' : 'Transfer ownership'}</span>
          </button>
        </div>
        {ownerTransferLoading ? <p className="body-s" role="status">Transferring ownership...</p> : null}
        {ownerCandidates.length === 0 && canManageAccount ? <p className="body-s" role="status">Add another member before transferring ownership.</p> : null}
        {ownerTransferError ? <p className="body-m" role="alert">{ownerTransferError}</p> : null}
      </section>

      <RomaCommandConfirmationDialog
        open={ownerTransferConfirmationCandidate !== null}
        title="Transfer account ownership?"
        body={ownerTransferConfirmationCandidate
          ? `“${resolvePersonLabel(ownerTransferConfirmationCandidate.profile, ownerTransferConfirmationCandidate.userId)}” will become Owner of this account, and you will become Admin.`
          : ''}
        confirmLabel="Transfer ownership"
        onCancel={() => setOwnerTransferConfirmationCandidate(null)}
        onConfirm={() => {
          const candidate = ownerTransferConfirmationCandidate;
          setOwnerTransferConfirmationCandidate(null);
          if (candidate) void transferOwner(candidate.userId);
        }}
      />

    </>
  );
}
