'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRomaMe } from './use-roma-me';

type AcceptInviteDomainProps = {
  token: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

export function AcceptInviteDomain({ token }: AcceptInviteDomainProps) {
  const me = useRomaMe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = `/accept-invite/${encodeURIComponent(token)}`;

  const acceptInvitation = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | { ok?: boolean } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      window.location.assign('/home');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  };

  if (!isUuid(token)) {
    return (
      <main className="rd-canvas" style={{ padding: '32px' }}>
        <section className="rd-canvas-module body-m">Invitation link is invalid.</section>
      </main>
    );
  }

  if (me.loading) {
    return (
      <main className="rd-canvas" style={{ padding: '32px' }}>
        <section className="rd-canvas-module body-m">Loading invitation context...</section>
      </main>
    );
  }

  if (!me.data) {
    return (
      <main className="rd-canvas" style={{ padding: '32px' }}>
        <section className="rd-canvas-module">
          <h1 className="heading-h3">Accept invitation</h1>
          <p className="body-m">Sign in with the invited email address before accepting this account invitation.</p>
          <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
            <Link className="diet-btn-txt" data-size="md" data-variant="solid" href={`/login?next=${encodeURIComponent(nextPath)}`}>
              <span className="diet-btn-txt__label body-m">Go to login</span>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="rd-canvas" style={{ padding: '32px' }}>
      <section className="rd-canvas-module">
        <h1 className="heading-h3">Accept invitation</h1>
        <p className="body-m">Signed in as {me.data.user.email ?? 'unknown email'}.</p>
        <p className="body-s">Berlin will only accept this invitation if the signed-in email matches the invited email.</p>
        {error ? <p className="body-m">{error}</p> : null}
        <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="solid"
            type="button"
            onClick={() => void acceptInvitation()}
            disabled={loading}
          >
            <span className="diet-btn-txt__label body-m">{loading ? 'Accepting...' : 'Accept invitation'}</span>
          </button>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/home">
            <span className="diet-btn-txt__label body-m">Cancel</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
