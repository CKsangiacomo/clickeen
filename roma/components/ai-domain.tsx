'use client';

import { formatAccountTierLabel } from '../lib/format';
import { useRomaAccountContext } from './roma-account-context';

export function AiDomain() {
  const { accountContext, activeAccount, accountPolicy, data } = useRomaAccountContext();

  const entitlements = data.authz?.entitlements ?? null;
  const copilotTurnLimit = entitlements?.limits?.['copilot.turns.monthly.max'] ?? null;
  const copilotTurnsLabel = typeof copilotTurnLimit === 'number' && Number.isFinite(copilotTurnLimit) ? `${copilotTurnLimit}` : 'Unlimited';

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountLabel}</p>
        <p className="body-m">This page shows account AI entitlement context. Copilot execution happens inside Builder.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{formatAccountTierLabel(activeAccount.tier)}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">AI profile</h2>
            <p className="body-s">{formatAccountTierLabel(accountPolicy.profile)}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Copilot monthly turn limit</h2>
            <p className="body-s">{copilotTurnsLabel}</p>
          </article>
        </div>
      </section>
    </>
  );
}
