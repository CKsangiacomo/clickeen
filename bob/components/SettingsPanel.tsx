'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveVeniceBaseUrl } from '../lib/env/venice';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import { TdMenuContent } from './TdMenuContent';

type JobStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

type BusinessProfile = {
  name?: string;
  category?: string;
  description?: string;
  nap?: { phone?: string; city?: string; state?: string };
  services?: string[];
};

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readProfile(value: unknown): BusinessProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as BusinessProfile;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.left = '-1000px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function SettingsPanel() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const workspaceId = session.meta?.workspaceId ? String(session.meta.workspaceId) : '';
  const publicId = session.meta?.publicId ? String(session.meta.publicId) : '';
  const policy = session.policy;
  const settingsHtml = compiled?.panels?.find((panel) => panel.id === 'settings')?.html ?? '';

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<Record<string, unknown> | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const onboardingEnabled = Boolean(policy.flags?.['personalization.onboarding.enabled']);

  const loadProfile = useCallback(async () => {
    if (!workspaceId) {
      setProfile(null);
      setProfileUpdatedAt(null);
      setProfileError(null);
      return;
    }

    setProfileLoading(true);
    try {
      const res = await fetch(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/business-profile`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = readString(payload?.error) || readString(payload?.message) || 'Failed to load business profile';
        throw new Error(message);
      }
      setProfile(readProfile(payload?.profile));
      setProfileUpdatedAt(readString(payload?.updatedAt) || null);
      setProfileError(null);
    } catch (err) {
      setProfile(null);
      setProfileUpdatedAt(null);
      setProfileError(err instanceof Error ? err.message : String(err));
    } finally {
      setProfileLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!jobId) return;
    if (jobStatus !== 'queued' && jobStatus !== 'running') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/paris/personalization/onboarding/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = readString(payload?.error) || readString(payload?.message) || 'Failed to fetch job status';
          throw new Error(message);
        }
        if (cancelled) return;
        const status = readString(payload?.status) as JobStatus;
        setJobStatus(status || 'running');
        setJobError(payload?.error?.message ? String(payload.error.message) : null);
        setPersistError(payload?.persistError ? String(payload.persistError) : null);
        if (payload?.result && typeof payload.result === 'object') {
          setJobResult(payload.result as Record<string, unknown>);
        }
        if (status === 'completed') {
          void loadProfile();
        }
      } catch (err) {
        if (cancelled) return;
        setJobStatus('failed');
        setJobError(err instanceof Error ? err.message : String(err));
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobId, jobStatus, loadProfile]);

  const profileSummary = useMemo(() => {
    if (!profile) return null;
    const name = readString(profile.name);
    const category = readString(profile.category);
    const description = readString(profile.description);
    const phone = readString(profile.nap?.phone);
    const location = [readString(profile.nap?.city), readString(profile.nap?.state)].filter(Boolean).join(', ');
    const services = Array.isArray(profile.services) ? profile.services.filter((s) => typeof s === 'string') : [];
    return { name, category, description, phone, location, services };
  }, [profile]);

  const seoGeoEnabled = Boolean((session.instanceData as any)?.seoGeo?.enabled === true);

  const embed = useMemo(() => {
    let veniceBase = '';
    try {
      veniceBase = resolveVeniceBaseUrl().replace(/\/+$/, '');
    } catch {
      veniceBase = '';
    }
    const loaderSrc = veniceBase ? `${veniceBase}/embed/latest/loader.js` : '';
    const canRender = Boolean(publicId && loaderSrc);

    const safeSnippet = canRender
      ? `<script
  src="${loaderSrc}"
  data-public-id="${publicId}"
  data-trigger="immediate"
></script>`
      : '';

    const indexableSnippet = canRender
      ? `<script
  src="${loaderSrc}"
  data-public-id="${publicId}"
  data-trigger="immediate"
  data-discoverability="true"
  data-max-width="0"
  data-min-height="420"
  data-width="100%"
></script>`
      : '';

    const previewShadowHref = publicId
      ? `/bob/preview-shadow?publicId=${encodeURIComponent(publicId)}&theme=light&device=desktop&mode=discoverability`
      : '/bob/preview-shadow?mode=discoverability';

    return { veniceBase, loaderSrc, canRender, safeSnippet, indexableSnippet, previewShadowHref };
  }, [publicId]);

  const copySnippet = useCallback(async (label: string, snippet: string) => {
    setCopyStatus(null);
    const ok = await copyToClipboard(snippet);
    setCopyStatus(ok ? `Copied: ${label}` : `Copy failed: ${label}`);
    window.setTimeout(() => setCopyStatus(null), 1800);
  }, []);

  const runOnboarding = async () => {
    setJobError(null);
    setPersistError(null);
    setJobResult(null);
    const resolvedUrl = normalizeWebsiteUrl(websiteUrl);
    if (!workspaceId) {
      setJobError('Workspace context missing. Open this editor from a workspace.');
      return;
    }
    if (!resolvedUrl) {
      setJobError('Enter a website URL to personalize.');
      return;
    }
    if (!onboardingEnabled) {
      session.requestUpsell('coreui.upsell.reason.personalization.onboarding');
      return;
    }

    setJobStatus('queued');
    try {
      const res = await fetch('/api/paris/personalization/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          url: resolvedUrl,
          locale: session.locale.baseLocale,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = readString(payload?.error?.message) || readString(payload?.message) || 'Failed to start onboarding personalization';
        throw new Error(message);
      }
      const nextJobId = readString(payload?.jobId);
      if (!nextJobId) {
        throw new Error('Personalization job did not return a jobId');
      }
      setJobId(nextJobId);
      setJobStatus('queued');
    } catch (err) {
      setJobStatus('failed');
      setJobError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!compiled) {
    return (
      <div className="tdmenucontent">
        <div className="heading-3">Settings</div>
        <div className="label-s label-muted">Load an instance to configure settings.</div>
      </div>
    );
  }

  return (
    <TdMenuContent
      panelId="settings"
      panelHtml={settingsHtml}
      widgetKey={compiled.widgetname}
      instanceData={session.instanceData}
      applyOps={session.applyOps}
      undoLastOps={session.undoLastOps}
      canUndo={session.canUndo}
      lastUpdate={session.lastUpdate}
      dieterAssets={compiled.assets.dieter}
      translateMode={false}
      readOnly={false}
      translateAllowlist={session.locale.allowlist}
      header={<div className="label-s label-muted">Localization controls are now in Content → Translate.</div>}
      footer={
        <div className="tdmenucontent__footer">
          <div>
            <div className="heading-4">Embed</div>
            <div className="label-s label-muted">Use these snippets to embed this instance on your site.</div>

            {!publicId ? <div className="settings-panel__error">Instance publicId missing.</div> : null}
            {publicId && !embed.veniceBase ? (
              <div className="settings-panel__error">Missing NEXT_PUBLIC_VENICE_URL (cannot build embed snippet).</div>
            ) : null}

            {embed.canRender ? (
              <>
                <div className="settings-panel__row">
                  <div className="label-s">Safe embed (iframe)</div>
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="neutral"
                    type="button"
                    onClick={() => void copySnippet('safe embed', embed.safeSnippet)}
                  >
                    <span className="diet-btn-txt__label">Copy</span>
                  </button>
                </div>
                <pre className="settings-panel__code">
                  <code>{embed.safeSnippet}</code>
                </pre>

                {seoGeoEnabled ? (
                  <>
                    <div className="settings-panel__row">
                      <div className="label-s">Discoverability embed (AI/SEO)</div>
                      <div className="settings-panel__actions-inline">
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="primary"
                          type="button"
                          onClick={() => void copySnippet('discoverability embed', embed.indexableSnippet)}
                        >
                          <span className="diet-btn-txt__label">Copy</span>
                        </button>
                        <a
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="neutral"
                          href={embed.previewShadowHref}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="diet-btn-txt__label">Preview</span>
                        </a>
                      </div>
                    </div>
                    <pre className="settings-panel__code">
                      <code>{embed.indexableSnippet}</code>
                    </pre>
                  </>
                ) : (
                  <div className="label-s label-muted">
                    Enable “SEO/GEO optimization” above to unlock the discoverability snippet.
                  </div>
                )}

                {copyStatus ? (
                  <div className={copyStatus.startsWith('Copied') ? 'settings-panel__success' : 'settings-panel__error'}>
                    {copyStatus}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div>
            <div className="heading-4">Onboarding personalization</div>
            <div className="label-s label-muted">
              Generate a business profile from a website to prefill onboarding and recommendations.
            </div>

            <div className="tdmenucontent__fields">
              <div className="diet-textfield" data-size="md">
                <label className="diet-textfield__control">
                  <span className="diet-textfield__display-label label-s">Business website</span>
                  <input
                    className="diet-textfield__field body-s"
                    type="url"
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="settings-panel__actions">
              <button
                className="diet-btn-txt"
                data-size="lg"
                data-variant="primary"
                type="button"
                onClick={runOnboarding}
                disabled={jobStatus === 'running' || jobStatus === 'queued'}
              >
                <span className="diet-btn-txt__label">
                  {jobStatus === 'running' || jobStatus === 'queued' ? 'Running...' : 'Generate profile'}
                </span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="lg"
                data-variant="neutral"
                type="button"
                onClick={loadProfile}
                disabled={!workspaceId || profileLoading}
              >
                <span className="diet-btn-txt__label">{profileLoading ? 'Refreshing...' : 'Refresh profile'}</span>
              </button>
            </div>

            {jobId ? (
              <div className="settings-panel__status">
                <div className="label-s">
                  Status: <strong>{jobStatus}</strong>
                </div>
                <div className="caption">Job {jobId.slice(0, 8)}</div>
              </div>
            ) : null}
            {jobError ? <div className="settings-panel__error">{jobError}</div> : null}
            {persistError ? <div className="settings-panel__warning">{persistError}</div> : null}
          </div>

          <div>
            <div className="heading-4">Stored business profile</div>
            {profileError ? <div className="settings-panel__error">{profileError}</div> : null}
            {!profileError && !profileSummary ? (
              <div className="label-s label-muted">{profileLoading ? 'Loading profile...' : 'No profile stored yet.'}</div>
            ) : null}
            {profileSummary ? (
              <div className="settings-panel__note">
                <div className="label-s">
                  {profileSummary.name || 'Unnamed business'}
                  {profileSummary.category ? ` - ${profileSummary.category}` : ''}
                </div>
                {profileSummary.description ? <div className="body-s">{profileSummary.description}</div> : null}
                {profileSummary.phone || profileSummary.location ? (
                  <div className="caption">{[profileSummary.phone, profileSummary.location].filter(Boolean).join(' - ')}</div>
                ) : null}
                {profileSummary.services && profileSummary.services.length > 0 ? (
                  <div className="caption">Services: {profileSummary.services.slice(0, 6).join(', ')}</div>
                ) : null}
                {profileUpdatedAt ? <div className="caption">Updated {profileUpdatedAt}</div> : null}
              </div>
            ) : null}
            {jobResult?.recommendations ? (
              <div className="settings-panel__success">
                Recommendations ready. Review templates and copy packs during onboarding.
              </div>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
