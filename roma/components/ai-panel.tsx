'use client';

import { useEffect, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { useRomaMe } from './use-roma-me';

type AiProfileResponse = {
  workspaceId: string;
  profile: string;
  role: string;
  widgetCopilot: {
    requestedAgentId: string;
    canonicalAgentId: string;
    profile: string;
    provider: string;
    model: string;
    strict: boolean;
    reasonKey: string | null;
    upsell: string | null;
  };
};

type AiLimitsResponse = {
  workspaceId: string;
  profile: string;
  role: string;
  caps: Record<string, number | null>;
  budgets: Record<string, { max: number | null; used: number }>;
};

export function AiPanel() {
  const me = useRomaMe();
  const [workspaceId, setWorkspaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AiProfileResponse | null>(null);
  const [limits, setLimits] = useState<AiLimitsResponse | null>(null);
  const [outcomesState, setOutcomesState] = useState<string>('not_loaded');

  useEffect(() => {
    if (!me.data) return;
    const preferred = me.data.defaults.workspaceId ?? me.data.workspaces[0]?.workspaceId ?? '';
    setWorkspaceId((current) => current || preferred);
  }, [me.data]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profilePayload, limitsPayload] = await Promise.all([
          fetchParisJson<AiProfileResponse>(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/ai/profile`),
          fetchParisJson<AiLimitsResponse>(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/ai/limits`),
        ]);

        let outcomesLabel = 'available';
        try {
          await fetchParisJson(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/ai/outcomes`);
          outcomesLabel = 'available';
        } catch (outcomesError) {
          const message = outcomesError instanceof Error ? outcomesError.message : String(outcomesError);
          outcomesLabel = `unavailable (${message})`;
        }

        if (cancelled) return;
        setProfile(profilePayload);
        setLimits(limitsPayload);
        setOutcomesState(outcomesLabel);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setProfile(null);
        setLimits(null);
        setOutcomesState('not_loaded');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (me.loading) return <section className="roma-module-surface">Loading AI workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (me.data.workspaces.length === 0) {
    return <section className="roma-module-surface">No workspace membership found for AI diagnostics.</section>;
  }

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="ai-workspace-select">
          Workspace
        </label>
        <select
          id="ai-workspace-select"
          className="roma-select"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {me.data.workspaces.map((workspace) => (
            <option key={workspace.workspaceId} value={workspace.workspaceId}>
              {workspace.name} ({workspace.slug})
            </option>
          ))}
        </select>
      </div>

      {loading ? <p>Loading AI profile and limits...</p> : null}
      {error ? <p>Failed to load AI diagnostics: {error}</p> : null}

      {profile ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Policy Profile</h2>
            <p>{profile.profile}</p>
          </article>
          <article className="roma-card">
            <h2>Copilot Agent</h2>
            <p>{profile.widgetCopilot.canonicalAgentId}</p>
          </article>
          <article className="roma-card">
            <h2>Outcomes</h2>
            <p>{outcomesState}</p>
          </article>
        </div>
      ) : null}

      {profile ? (
        <div className="roma-codeblock">
          <strong>AI Profile</strong>
          <pre>{JSON.stringify(profile, null, 2)}</pre>
        </div>
      ) : null}

      {limits ? (
        <div className="roma-codeblock">
          <strong>AI Limits</strong>
          <pre>{JSON.stringify({ caps: limits.caps, budgets: limits.budgets }, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
