'use client';

import { useMemo } from 'react';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function AiDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;

  const authz = me.data?.authz ?? null;
  const profile = authz?.profile ?? null;
  const role = authz?.role ?? null;
  const entitlements = authz?.entitlements ?? null;

  const aiCaps = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(entitlements?.caps || {}).filter(([key]) => key.startsWith('ai.') || key.includes('copilot')),
      ),
    [entitlements?.caps],
  );
  const aiBudgets = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(entitlements?.budgets || {}).filter(
          ([key]) => key.startsWith('budget.ai') || key.startsWith('budget.copilot'),
        ),
      ),
    [entitlements?.budgets],
  );

  const copilotAgentId = profile === 'free' ? 'sdr.widget.copilot.v1' : 'cs.widget.copilot.v1';

  if (me.loading) return <section className="rd-canvas-module body-m">Loading AI account context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for AI diagnostics.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>
      </section>

      {profile || role ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Policy Profile</h2>
              <p className="body-s">{profile ?? 'unknown'}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Copilot Agent</h2>
              <p className="body-s">{copilotAgentId}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Role</h2>
              <p className="body-s">{role ?? 'unknown'}</p>
            </article>
          </div>
        </section>
      ) : null}

      {profile ? (
        <section className="rd-canvas-module">
          <div className="roma-codeblock">
            <strong className="overline-small">AI Entitlements (bootstrap)</strong>
            <pre>{JSON.stringify({ profile, role, caps: aiCaps, budgets: aiBudgets }, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </>
  );
}
