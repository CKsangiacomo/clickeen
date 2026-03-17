'use client';

import { useMemo } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { resolveActiveRomaAccount, resolveActiveRomaContext, useRomaMe } from './use-roma-me';

export function AiDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveActiveRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccount = useMemo(() => resolveActiveRomaAccount(me.data), [me.data]);

  const authz = me.data?.authz ?? null;
  const profile = authz?.profile ?? null;
  const entitlements = authz?.entitlements ?? null;
  const copilotBudget = entitlements?.budgets?.['budget.copilot.turns'] ?? null;
  const copilotTurnsLabel =
    typeof copilotBudget?.max === 'number' && Number.isFinite(copilotBudget.max)
      ? `${copilotBudget.max}`
      : 'Unlimited';

  if (me.loading) return <section className="rd-canvas-module body-m">Loading AI account context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'AI settings are unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account is available for AI settings right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {context.accountName || 'Current account'}</p>
        {context.accountSlug ? <p className="body-s">Slug: {context.accountSlug}</p> : null}
        <p className="body-m">AI access follows your current account plan.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount?.tier ?? 'unknown'}</p>
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
