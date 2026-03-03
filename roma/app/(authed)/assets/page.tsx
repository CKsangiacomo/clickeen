import { AssetsDomain } from '../../../components/assets-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function AssetsPage() {
  return <DomainPageShell activeDomain="assets" title="Assets" fallback="Loading assets context..." Component={AssetsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
