import Link from 'next/link';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';

export const runtime = 'edge';

type AssetPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetDetailPage({ params }: AssetPageProps) {
  const { assetId } = await params;
  return (
    <RomaShell activeDomain="assets" title={`Asset ${assetId}`} headerRight={<RomaShellDefaultActions />}>
      <section className="roma-module-surface" aria-label="Asset detail placeholder">
        <p>Next step: connect used-by graph and guard destructive actions through policy-aware endpoint contracts.</p>
        <div className="roma-module-surface__actions">
          <Link href="/assets" className="diet-btn-txt" data-size="md" data-variant="primary">
            <span className="diet-btn-txt__label">Back to assets</span>
          </Link>
        </div>
      </section>
    </RomaShell>
  );
}
