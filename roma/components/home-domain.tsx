'use client';

import Link from 'next/link';
import { useRomaAccountContext } from './roma-account-context';

export function HomeDomain() {
  const { accountContext } = useRomaAccountContext();

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {accountContext.accountName} ({accountContext.accountSlug})
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
