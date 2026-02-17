'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type MinibobHandoffCompleteResponse = {
  handoffId: string;
  accountId: string;
  workspaceId: string;
  sourcePublicId: string;
  publicId: string;
  builderRoute: string;
  replay: boolean;
};

function nextIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function HomeDomain() {
  const me = useRomaMe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handoffAttemptRef = useRef<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<'idle' | 'running' | 'failed'>('idle');
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const handoffId = useMemo(() => (searchParams.get('handoffId') || '').trim(), [searchParams]);
  const handoffPublicIdHint = useMemo(() => (searchParams.get('publicId') || '').trim(), [searchParams]);
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const hasWorkspaceContext = Boolean(context.accountId && context.workspaceId);

  const completeHandoff = useCallback(async () => {
    if (!handoffId || !hasWorkspaceContext) return;
    const attemptKey = `${handoffId}:${context.accountId}:${context.workspaceId}`;
    if (handoffAttemptRef.current === attemptKey) return;
    handoffAttemptRef.current = attemptKey;

    setHandoffStatus('running');
    setHandoffError(null);
    try {
      const payload = await fetchParisJson<MinibobHandoffCompleteResponse>('/api/paris/minibob/handoff/complete', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': nextIdempotencyKey(),
        },
        body: JSON.stringify({
          handoffId,
          accountId: context.accountId,
          workspaceId: context.workspaceId,
        }),
      });
      router.replace(payload.builderRoute);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHandoffStatus('failed');
      setHandoffError(message);
    }
  }, [context.accountId, context.workspaceId, handoffId, hasWorkspaceContext, router]);

  useEffect(() => {
    if (!handoffId || !me.data || !hasWorkspaceContext) return;
    void completeHandoff();
  }, [completeHandoff, handoffId, hasWorkspaceContext, me.data]);

  if (me.loading) {
    return <section className="roma-module-surface">Loading identity and membership context...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="roma-module-surface">
        <p>Failed to load Roma identity context: {me.error ?? 'unknown_error'}</p>
        <div className="roma-module-surface__actions">
          <button className="diet-btn-txt" data-size="md" data-variant="primary" onClick={() => void me.reload()} type="button">
            <span className="diet-btn-txt__label">Retry</span>
          </button>
        </div>
      </section>
    );
  }

  if (!hasWorkspaceContext) {
    return (
      <section className="roma-module-surface">
        <p>No workspace context is available for this account membership.</p>
        <div className="roma-module-surface__actions">
          <Link href="/settings" className="diet-btn-txt" data-size="md" data-variant="primary">
            <span className="diet-btn-txt__label">Open settings</span>
          </Link>
          <Link href="/team" className="diet-btn-txt" data-size="md" data-variant="line2">
            <span className="diet-btn-txt__label">Open team</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="roma-module-surface">
      {handoffId ? (
        <article className="roma-card">
          <h2>MiniBob Continuation</h2>
          <p>
            {handoffStatus === 'running'
              ? 'Continuing from MiniBob and opening Builder...'
              : handoffStatus === 'failed'
                ? `MiniBob continuation failed: ${handoffError ?? 'unknown_error'}`
                : handoffPublicIdHint
                  ? `Pending continuation for ${handoffPublicIdHint}.`
                  : 'Pending continuation detected from MiniBob.'}
          </p>
          {handoffStatus === 'failed' ? (
            <div className="roma-module-surface__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="primary"
                type="button"
                onClick={() => {
                  handoffAttemptRef.current = null;
                  void completeHandoff();
                }}
              >
                <span className="diet-btn-txt__label">Retry continuation</span>
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      <p>
        Active workspace: {context.workspaceName || context.workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>

      <div className="roma-grid roma-grid--three">
        <article className="roma-card">
          <h2>Create</h2>
          <p>Create a widget and open Bob Builder immediately.</p>
          <div className="roma-module-surface__actions">
            <Link href="/widgets?intent=create" className="diet-btn-txt" data-size="md" data-variant="primary">
              <span className="diet-btn-txt__label">Create widget</span>
            </Link>
          </div>
        </article>
        <article className="roma-card">
          <h2>Continue</h2>
          <p>Open existing widget instances and jump into Builder.</p>
          <div className="roma-module-surface__actions">
            <Link href="/widgets" className="diet-btn-txt" data-size="md" data-variant="line2">
              <span className="diet-btn-txt__label">Open widgets</span>
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
