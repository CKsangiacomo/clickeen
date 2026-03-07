'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function HomeDomain() {
  const me = useRomaMe();
  const searchParams = useSearchParams();
  const handoffId = useMemo(() => (searchParams.get('handoffId') || '').trim(), [searchParams]);
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const hasAccountContext = Boolean(context.accountId);

  if (me.loading) {
    return <section className="rd-canvas-module body-m">Loading identity and membership context...</section>;
  }

  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module">
        <p className="body-m">Failed to load Roma identity context: {me.error ?? 'unknown_error'}</p>
        <div className="rd-canvas-module__actions">
          <button className="diet-btn-txt" data-size="md" data-variant="primary" onClick={() => void me.reload()} type="button">
            <span className="diet-btn-txt__label body-m">Retry</span>
          </button>
        </div>
      </section>
    );
  }

  if (!hasAccountContext) {
    return (
      <section className="rd-canvas-module">
        <p className="body-m">No account context is available for this user.</p>
        <div className="rd-canvas-module__actions">
          <Link href="/settings" className="diet-btn-txt" data-size="md" data-variant="primary">
            <span className="diet-btn-txt__label body-m">Open settings</span>
          </Link>
          <Link href="/team" className="diet-btn-txt" data-size="md" data-variant="line2">
            <span className="diet-btn-txt__label body-m">Open team</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rd-canvas-module">
        {handoffId ? (
          <article className="roma-card">
            <p className="body-m">MiniBob continuation was not finalized in finish flow.</p>
          </article>
        ) : null}

        <p className="body-m">
          Account: {context.accountName || context.accountId}
          {context.accountSlug ? ` (${context.accountSlug})` : ''}
        </p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Create</h2>
            <p className="body-s">Create a widget and open Bob Builder immediately.</p>
            <div className="rd-canvas-module__actions">
              <Link href="/widgets?intent=create" className="diet-btn-txt" data-size="md" data-variant="primary">
                <span className="diet-btn-txt__label body-m">Create widget</span>
              </Link>
            </div>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Continue</h2>
            <p className="body-s">Open existing widget instances and jump into Builder.</p>
            <div className="rd-canvas-module__actions">
              <Link href="/widgets" className="diet-btn-txt" data-size="md" data-variant="line2">
                <span className="diet-btn-txt__label body-m">Open widgets</span>
              </Link>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
