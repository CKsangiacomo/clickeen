'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import settingsCopy from '../l10n/settings/en.json';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { formatAccountRoleLabel, formatAccountTierLabel } from '../lib/format';
import { resolvePersonLabel } from '../lib/person-profile';
import { useRomaAccountApi } from './account-api';
import { AccountLocaleSettingsCard } from './account-locale-settings-card';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
import { RomaEmptyState, RomaLoadingState } from './roma-system-state';
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

export function SettingsDomain() {
  const { activeAccount, accountContext, data, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const activeAccountId = accountContext.accountId;

  const [members, setMembers] = useState<AccountMembersResponse | null>(null);
  const [membersFailed, setMembersFailed] = useState(false);
  const [membersLoading, setMembersLoading] = useState(activeAccount.role === 'owner');

  const [nextOwnerUserId, setNextOwnerUserId] = useState('');
  const [ownerTransferLoading, setOwnerTransferLoading] = useState(false);
  const [ownerTransferConfirmationCandidate, setOwnerTransferConfirmationCandidate] = useState<AccountMember | null>(null);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersFailed(false);
    try {
      const payload = await accountApi.fetchJson<AccountMembersResponse>(`/api/account/team`, {
        method: 'GET',
      });
      setMembers(payload);
      setMembersFailed(false);
    } catch {
      setMembers(null);
      setMembersFailed(true);
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
    setOwnerTransferLoading(true);
    try {
      await accountApi.fetchJson(`/api/account/owner-transfer`, {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ nextOwnerUserId: ownerUserId }),
      });
      setOwnerTransferConfirmationCandidate(null);
      window.location.assign('/home');
      return true;
    } catch {
      return false;
    } finally {
      setOwnerTransferLoading(false);
    }
  }, [accountApi]);

  const canManageAccount = activeAccount.role === 'owner';
  const canEditLocales = activeAccount.role === 'owner' || activeAccount.role === 'admin';
  const ownerCandidates = members
    ? members.members.filter((member) => member.userId !== data.user.id && member.role !== 'owner')
    : null;
  const selectedOwnerCandidate = ownerCandidates?.find((member) => member.userId === nextOwnerUserId) ?? null;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          <span className="label-s">{settingsCopy.account}</span> {accountContext.accountLabel}
        </p>
        <p className="body-s">
          <span className="label-s">{settingsCopy.plan}</span> {formatAccountTierLabel(activeAccount.tier)} ·{' '}
          <span className="label-s">{settingsCopy.role}</span> {formatAccountRoleLabel(activeAccount.role)}
        </p>
        {activeAccount.websiteUrl ? <p className="body-s"><span className="label-s">{settingsCopy.website}</span> {activeAccount.websiteUrl}</p> : null}
        <div className="rd-canvas-module__actions">
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/widgets">
            <span className="diet-button__label">{settingsCopy.openWidgets}</span>
          </Link>
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/assets">
            <span className="diet-button__label">{settingsCopy.openAssets}</span>
          </Link>
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/billing">
            <span className="diet-button__label">{settingsCopy.openBilling}</span>
          </Link>
        </div>
      </section>

      <section className="rd-canvas-module">
        <h2 className="heading-6">{settingsCopy.plan}</h2>
        <p className="label-s">{settingsCopy.currentPlan}</p>
        <p className="body-m">{formatAccountTierLabel(activeAccount.tier)}</p>
      </section>

      <AccountLocaleSettingsCard accountId={activeAccountId} canEdit={canEditLocales} onSaved={() => reload()} />

      <section className="rd-canvas-module">
        <h2 className="heading-6">{settingsCopy.ownership}</h2>
        {membersFailed ? <button className="diet-button" data-size="medium" data-type="tertiary" type="button" onClick={() => void loadMembers()}><span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span></button> : null}
        {canManageAccount && membersLoading && !members && !membersFailed ? <RomaLoadingState /> : null}
        {(!canManageAccount || ownerCandidates) ? <div className="roma-toolbar">
          <DieterDropdownActions
            className="roma-owner-select"
            value={nextOwnerUserId}
            onChange={setNextOwnerUserId}
            ariaLabel={settingsCopy.selectNextOwner}
            disabled={!canManageAccount || membersLoading || ownerTransferLoading || !ownerCandidates?.length}
            options={[
              { value: '', label: settingsCopy.selectNextOwner },
              ...(ownerCandidates ?? []).map((member) => ({
                value: member.userId,
                label: resolvePersonLabel(member.profile)!,
              })),
            ]}
          />
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={() => {
              setOwnerTransferConfirmationCandidate(selectedOwnerCandidate);
            }}
            disabled={!canManageAccount || ownerTransferLoading || !selectedOwnerCandidate}
          >
            <span className="diet-button__label">{settingsCopy.transferOwnership}</span>
          </button>
        </div> : null}
        {ownerCandidates?.length === 0 && canManageAccount ? (
          <RomaEmptyState>{settingsCopy.noOwnerCandidates}</RomaEmptyState>
        ) : null}
      </section>

      <RomaCommandConfirmationDialog
        open={ownerTransferConfirmationCandidate !== null}
        title={settingsCopy.transferOwnership}
        body={ownerTransferConfirmationCandidate
          ? resolvePersonLabel(ownerTransferConfirmationCandidate.profile)
          : null}
        confirmLabel={settingsCopy.transferOwnership}
        pending={ownerTransferLoading}
        onCancel={() => setOwnerTransferConfirmationCandidate(null)}
        onConfirm={() => {
          const candidate = ownerTransferConfirmationCandidate;
          if (candidate) void transferOwner(candidate.userId);
        }}
      />

    </>
  );
}
