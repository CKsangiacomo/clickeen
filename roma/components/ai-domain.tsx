'use client';

import { formatAccountTierLabel } from '../lib/format';
import aiCopy from '../l10n/ai/en.json';
import { useRomaAccountContext } from './roma-account-context';

export function AiDomain() {
  const { activeAccount, accountPolicy, data } = useRomaAccountContext();

  const copilotTurnLimit = data.authz.entitlements.limits['copilot.turns.monthly.max'];
  const copilotTurnsLabel = copilotTurnLimit === null ? aiCopy.unlimited : `${copilotTurnLimit}`;

  return (
    <>
      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">{aiCopy.currentPlan}</h2>
            <p className="body-s">{formatAccountTierLabel(activeAccount.tier)}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">{aiCopy.profile}</h2>
            <p className="body-s">{formatAccountTierLabel(accountPolicy.profile)}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">{aiCopy.copilotTurnLimit}</h2>
            <p className="body-s">{copilotTurnsLabel}</p>
          </article>
        </div>
      </section>
    </>
  );
}
