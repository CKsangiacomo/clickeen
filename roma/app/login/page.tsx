'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import ROMA_AUTH_UI_COPY from '../../l10n/auth/en.json';

function resolveNextPath(value: string | null): string {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('/')) return '/home';
  if (normalized.startsWith('//')) return '/home';
  return normalized;
}

export default function RomaLoginPage() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get('next')), [searchParams]);
  const intent = useMemo(() => String(searchParams.get('intent') || '').trim(), [searchParams]);

  return (
    <main className="page roma-standalone-page">
      <section className="page__content">
        <article className="rd-canvas-module" style={{ maxWidth: 520 }}>
          <div style={{ marginBottom: 18 }}>
            <form action="/api/session/login/google" method="get" className="rd-canvas-module__actions" style={{ justifyContent: 'flex-start' }}>
              <input name="next" type="hidden" value={nextPath} />
              {intent ? <input name="intent" type="hidden" value={intent} /> : null}
              <button aria-label={ROMA_AUTH_UI_COPY.login.continueWithGoogle} className="diet-button" data-size="large" data-type="primary" type="submit">
                <span className="diet-button__label">{ROMA_AUTH_UI_COPY.login.continueWithGoogle}</span>
              </button>
            </form>
          </div>
        </article>
      </section>
    </main>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
