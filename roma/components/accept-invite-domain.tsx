'use client';

import { isUuid } from '@clickeen/ck-contracts';
import Link from 'next/link';
import { useState } from 'react';
import { useRomaMe } from './use-roma-me';
import { RomaLoadingState } from './roma-system-state';

type AcceptInviteDomainProps = {
  token: string;
};

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

const ACCEPT_INVITE_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again before accepting this invitation.',
  'coreui.errors.auth.contextUnavailable': 'Invitation acceptance is unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'Sign in with the invited email address to accept this invitation.',
  'coreui.errors.account.invitationNotFound': 'This invitation no longer exists.',
  'coreui.errors.account.invitationInvalidOrExpired': 'This invitation is invalid or has expired.',
  'coreui.errors.account.memberAlreadyExists': 'This account already has a member with that email address.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
};

function resolveAcceptInviteErrorCopy(reason: unknown, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = ACCEPT_INVITE_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return fallback;
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
      setError(
        resolveAcceptInviteErrorCopy(
          nextError instanceof Error ? nextError.message : nextError,
          'Accepting this invitation failed. Please try again.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isUuid(token)) {
    return (
      <main className="page roma-standalone-page">
        <div className="page__content">
          <section className="rd-canvas-module body-m" role="alert">Invitation link is invalid.</section>
        </div>
      </main>
    );
  }

  if (me.loading) {
    return (
      <main className="page roma-standalone-page">
        <div className="page__content">
          <RomaLoadingState className="rd-canvas-module" />
        </div>
      </main>
    );
  }

  if (!me.data) {
    return (
      <main className="page roma-standalone-page">
        <div className="page__content">
          <section className="rd-canvas-module">
            <h1 className="heading-3">Accept invitation</h1>
            <p className="body-m">Sign in with the invited email address before accepting this account invitation.</p>
            <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <Link className="diet-button" data-size="medium" data-type="primary" href={`/login?next=${encodeURIComponent(nextPath)}`}>
                <span className="diet-button__label">Go to login</span>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page roma-standalone-page">
      <div className="page__content">
        <section className="rd-canvas-module">
          <h1 className="heading-3">Accept invitation</h1>
          <p className="body-m">Signed in as {me.data.user.email ?? 'unknown email'}.</p>
          <p className="body-s">The signed-in email must match the invited email.</p>
          {error ? <p className="body-m" role="alert">{error}</p> : null}
          <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
            <button
              className="diet-button"
              data-size="medium"
              data-type="primary"
              data-loading={loading || undefined}
              type="button"
              aria-busy={loading || undefined}
              onClick={() => void acceptInvitation()}
              disabled={loading}
            >
              {loading ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">{loading ? 'Accepting...' : 'Accept invitation'}</span>
            </button>
            <Link className="diet-button" data-size="medium" data-type="tertiary" href="/home">
              <span className="diet-button__label">Cancel</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
