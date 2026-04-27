'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveErrorMessage(reasonKey: string | null): string {
  if (reasonKey === 'coreui.errors.auth.required') return 'Please sign in to continue.';
  if (reasonKey === 'coreui.errors.auth.provider.notEnabled') return 'Google login is not enabled yet for this environment.';
  if (reasonKey === 'coreui.errors.auth.provider.denied') return 'Google sign-in was denied or blocked. Try a different Google account.';
  if (reasonKey === 'coreui.errors.auth.provider.invalidCallback') return 'Google sign-in failed. Try again.';
  if (reasonKey === 'coreui.errors.auth.provider.exchangeFailed') return 'Google sign-in could not complete token exchange. Try again.';
  if (reasonKey === 'coreui.errors.auth.finish.invalidOrExpired') return 'Your sign-in session expired. Please try again.';
  if (reasonKey === 'coreui.errors.auth.finish.alreadyConsumed') return 'This sign-in callback was already used. Please start login again.';
  if (reasonKey === 'coreui.errors.auth.unavailable') return 'Auth service is temporarily unavailable. Please try again.';
  if (reasonKey === 'coreui.errors.auth.provider.invalid') return 'Google login is not configured correctly for this environment.';
  if (reasonKey === 'coreui.errors.auth.intent.invalid') return 'This sign-in link is invalid. Please start again.';
  if (reasonKey === 'coreui.errors.auth.next.invalid') return 'This sign-in redirect is invalid. Please start again.';
  if (reasonKey === 'roma.errors.auth.config_missing') return 'Auth service is not configured for Roma.';
  if (reasonKey === 'berlin.errors.auth.config_missing') return 'Auth service is not configured for this environment.';
  if (reasonKey === 'coreui.errors.account.createFailed') return 'Account setup failed. Please try again.';
  if (reasonKey === 'coreui.errors.auth.contextUnavailable') return 'Account context is unavailable. Please try again.';
  if (reasonKey === 'coreui.errors.db.writeFailed') return 'Account setup could not be saved. Please try again.';
  if (reasonKey === 'coreui.errors.db.readFailed') return 'Account setup could not be loaded. Please try again.';
  if (reasonKey === 'coreui.errors.auth.login_failed') return 'Sign in failed. Try again.';
  if (reasonKey) return reasonKey;
  return 'Sign in failed. Try again.';
}

export default function RomaLoginPage() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get('next')), [searchParams]);
  const intent = useMemo(() => String(searchParams.get('intent') || '').trim(), [searchParams]);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  useEffect(() => {
    const reason = searchParams.get('error');
    if (!reason) return;
    setErrorReason(reason);
    setError(resolveErrorMessage(reason));
  }, [searchParams]);

  return (
    <main className="rd-domain">
      <section className="rd-canvas">
        <article className="rd-canvas-module" style={{ maxWidth: 520 }}>
          <h1 className="heading-2" style={{ margin: 0 }}>Sign in to Roma</h1>
          <p className="body-m">Use your Google account to sign in.</p>
          <div style={{ marginBottom: 18 }}>
            <form action="/api/session/login/google" method="get" className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <input name="next" type="hidden" value={nextPath} />
              {intent ? <input name="intent" type="hidden" value={intent} /> : null}
              <button aria-label="Continue with Google" className="diet-btn-txt" data-size="lg" data-variant="primary" type="submit">
                <span className="diet-btn-txt__label body-l">Continue with Google</span>
              </button>
            </form>
          </div>
          {error ? (
            <div className="body-s" role="alert">
              <p style={{ margin: 0 }}>{error}</p>
              {errorReason ? <p style={{ margin: '6px 0 0' }}>Error code: {errorReason}</p> : null}
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
