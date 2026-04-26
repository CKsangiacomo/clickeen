'use client';

import { useRomaAccountContext } from './roma-account-context';

export function AiDomain() {
  const { accountContext, activeAccount, data } = useRomaAccountContext();

  const authz = data.authz ?? null;
  const profile = authz?.profile ?? null;
  const entitlements = authz?.entitlements ?? null;
  const copilotBudget = entitlements?.budgets?.['budget.copilot.turns'] ?? null;
  const copilotTurnsLabel = typeof copilotBudget?.max === 'number' && Number.isFinite(copilotBudget.max) ? `${copilotBudget.max}` : 'Unlimited';

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountName}</p>
        <p className="body-s">Slug: {accountContext.accountSlug}</p>
        <p className="body-m">AI access follows your current account plan.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount.tier}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">AI profile</h2>
            <p className="body-s">{profile ?? 'unknown'}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Copilot turns</h2>
            <p className="body-s">{copilotTurnsLabel}</p>
          </article>
        </div>
      </section>
    </>
  );
}
