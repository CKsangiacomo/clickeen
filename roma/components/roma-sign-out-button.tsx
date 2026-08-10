'use client';

import { useState } from 'react';

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
      onClick={handleSignOut}
      disabled={pending}
      aria-busy={pending}
    >
      <span className="roma-nav__label diet-button__label">
        {pending ? 'Signing out...' : 'Sign out'}
      </span>
    </button>
  );
}
