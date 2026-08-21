'use client';

import { useState } from 'react';
import ROMA_SHELL_UI_COPY from '../l10n/shell/en.json';

export function RomaSignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      await fetch('/api/session/logout', {
        method: 'POST',
        headers: {
          accept: 'application/json',
        },
        cache: 'no-store',
      });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button
      type="button"
      className="roma-nav__signout diet-button"
      data-size="large"
      data-type="secondary"
      data-loading={pending || undefined}
      onClick={handleSignOut}
      disabled={pending}
      aria-busy={pending || undefined}
    >
      {pending ? <span className="diet-spinner" aria-hidden="true" /> : null}
      <span className="roma-nav__label diet-button__label">
        {pending ? ROMA_SHELL_UI_COPY.commands.signingOut : ROMA_SHELL_UI_COPY.commands.signOut}
      </span>
    </button>
  );
}
