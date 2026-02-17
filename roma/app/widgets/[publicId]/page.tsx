import Link from 'next/link';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';

export const runtime = 'edge';

type WidgetPageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function WidgetDetailPage({ params }: WidgetPageProps) {
  const { publicId } = await params;
  return (
    <RomaShell activeDomain="widgets" title={`Widget ${publicId}`} headerRight={<RomaShellDefaultActions />}>
      <section className="roma-module-surface" aria-label="Widget detail placeholder">
        <p>Next step: bind widget summary, publish status, and locale pipeline diagnostics from Paris.</p>
        <div className="roma-module-surface__actions">
          <Link
            href={`/builder/${encodeURIComponent(publicId)}`}
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
          >
            <span className="diet-btn-txt__label">Open in builder</span>
          </Link>
          <Link href="/widgets" className="diet-btn-txt" data-size="md" data-variant="line2">
            <span className="diet-btn-txt__label">Back to widgets</span>
          </Link>
        </div>
      </section>
    </RomaShell>
  );
}
