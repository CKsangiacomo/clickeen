import { BuilderDomain } from '../../../components/builder-domain';
import { RomaDomainErrorBoundary } from '../../../components/roma-domain-error-boundary';
import { RomaShell, RomaShellDefaultActions } from '../../../components/roma-shell';

type BuilderLandingPageProps = {
  searchParams: Promise<{ new?: string | string[]; duplicate?: string | string[] }>;
};

function firstQueryValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : Array.isArray(value) ? String(value[0] || '').trim() : '';
}

export default async function BuilderLandingPage({ searchParams }: BuilderLandingPageProps) {
  const query = await searchParams;
  const hasDraft = Boolean(firstQueryValue(query.new) || firstQueryValue(query.duplicate));
  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      {...(hasDraft
        ? { fullCanvas: true }
        : { headerRight: <RomaShellDefaultActions /> })}
    >
      <RomaDomainErrorBoundary domainLabel="Builder" resetKey="builder">
        <BuilderDomain />
      </RomaDomainErrorBoundary>
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
