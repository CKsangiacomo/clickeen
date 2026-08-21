'use client';

import { formatAccountTierLabel } from '../lib/format';
import { useRomaAccountContext } from './roma-account-context';
import billingCopy from '../l10n/billing/en.json';

export function BillingDomain() {
  const { activeAccount } = useRomaAccountContext();

  return (
    <>
      <section className="rd-canvas-module">
        <div className="roma-grid">
          <article className="roma-card">
            <h2 className="heading-6">{billingCopy.currentPlan}</h2>
            <p className="body-s">{formatAccountTierLabel(activeAccount.tier)}</p>
          </article>
        </div>
      </section>
    </>
  );
}
