'use client';

import { isUuid } from '@clickeen/ck-contracts';
import Link from 'next/link';
import { useState } from 'react';
import ROMA_AUTH_UI_COPY from '../l10n/auth/en.json';
import { RomaLoadingState } from './roma-system-state';
import { useRomaMe } from './use-roma-me';

type AcceptInviteDomainProps = {
  token: string;
};

export function AcceptInviteDomain({ token }: AcceptInviteDomainProps) {
  const me = useRomaMe();
  const [loading, setLoading] = useState(false);
  const nextPath = `/accept-invite/${encodeURIComponent(token)}`;

  const acceptInvitation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      });
      if (response.ok) {
        window.location.assign('/home');
      }
    } catch {
      return;
    } finally {
      setLoading(false);
    }
  };

  if (!isUuid(token)) {
    return null;
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
            <div className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <Link className="diet-button" data-size="medium" data-type="primary" href={`/login?next=${encodeURIComponent(nextPath)}`}>
                <span className="diet-button__label">{ROMA_AUTH_UI_COPY.invitation.goToLogin}</span>
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
              <span className="diet-button__label">
                {loading
                  ? ROMA_AUTH_UI_COPY.invitation.accepting
                  : ROMA_AUTH_UI_COPY.invitation.accept}
              </span>
            </button>
            <Link className="diet-button" data-size="medium" data-type="tertiary" href="/home">
              <span className="diet-button__label">{ROMA_AUTH_UI_COPY.invitation.cancel}</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
