'use client';

import { useMemo } from 'react';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function AiDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const workspaceId = context.workspaceId;

  const authz = me.data?.authz ?? null;
  const profile = authz?.accountProfile ?? authz?.profile ?? null;
  const role = authz?.accountRole ?? authz?.role ?? null;
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

  if (me.loading) return <section className="roma-module-surface">Loading AI workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!workspaceId) {
    return <section className="roma-module-surface">No workspace membership found for AI diagnostics.</section>;
  }

  return (
    <section className="roma-module-surface">
      <p>
        Workspace: {context.workspaceName || workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>

      {profile || role ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Policy Profile</h2>
            <p>{profile ?? 'unknown'}</p>
          </article>
          <article className="roma-card">
            <h2>Copilot Agent</h2>
            <p>{copilotAgentId}</p>
          </article>
          <article className="roma-card">
            <h2>Role</h2>
            <p>{role ?? 'unknown'}</p>
          </article>
        </div>
      ) : null}

      {profile ? (
        <div className="roma-codeblock">
          <strong>AI Entitlements (bootstrap)</strong>
          <pre>{JSON.stringify({ profile, role, caps: aiCaps, budgets: aiBudgets }, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
