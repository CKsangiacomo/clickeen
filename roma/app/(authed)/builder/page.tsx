import { BuilderDomain } from '../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../components/roma-domain-error-boundary';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function BuilderLandingPage() {
  return (
    <RomaShell
      activeDomain="builder"
      title={ROMA_NAVIGATION_UI_COPY.domains.builder}
      headerRight={<RomaShellDefaultActions />}
    >
      <RomaDomainErrorBoundary domainLabel={ROMA_NAVIGATION_UI_COPY.domains.builder} resetKey="builder">
        <BuilderDomain />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
