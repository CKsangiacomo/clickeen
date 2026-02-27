'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

function resolveErrorMessage(reasonKey: string | null): string {
  if (reasonKey === 'coreui.errors.auth.invalid_credentials') return 'Invalid email or password.';
  if (reasonKey === 'roma.errors.auth.config_missing') return 'Auth service is not configured for Roma.';
  if (reasonKey === 'coreui.errors.auth.login_failed') return 'Sign in failed. Try again.';
  if (reasonKey) return reasonKey;
  return 'Sign in failed. Try again.';
}

export default function RomaLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get('next')), [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const response = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim(),
      }),
    });
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const reasonKey =
        typeof payload?.error === 'object' && payload.error
          ? (payload.error as Record<string, unknown>).reasonKey
          : payload?.error;
      setError(resolveErrorMessage(typeof reasonKey === 'string' ? reasonKey : null));
      setLoading(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="rd-domain">
      <section className="rd-canvas">
        <article className="rd-canvas-module" style={{ maxWidth: 520 }}>
          <h1 className="heading-2" style={{ margin: 0 }}>Sign in to Roma</h1>
          <p className="body-m">Use your workspace account credentials.</p>
          <form className="roma-inline-stack" onSubmit={onSubmit}>
            <label className="label-s" htmlFor="roma-login-email">Email</label>
            <input
              id="roma-login-email"
              className="roma-input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
            <label className="label-s" htmlFor="roma-login-password">Password</label>
            <input
              id="roma-login-password"
              className="roma-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
            />
            {error ? <p className="body-s" role="alert">{error}</p> : null}
            <div className="rd-canvas-module__actions">
              <button className="diet-btn-txt" data-size="lg" data-variant="primary" disabled={loading} type="submit">
                <span className="diet-btn-txt__label body-l">{loading ? 'Signing in...' : 'Sign in'}</span>
              </button>
            </div>
          </form>
        </article>
      </section>
    </main>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
