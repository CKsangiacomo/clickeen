import { BuilderDomain } from '../../../../components/builder-domain';
import { RomaShell, RomaShellDefaultActions } from '../../../../components/roma-shell';

type BuilderPageProps = {
  params: Promise<{ publicId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function singleParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

export default async function BuilderPage({ params, searchParams }: BuilderPageProps) {
  const { publicId } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};
  const initialAccountId = singleParam(query.accountId);
  const initialPublicId = String(publicId || '').trim() || singleParam(query.publicId);

  return (
    <RomaShell
      activeDomain="builder"
      title="Builder"
      canvasClassName="rd-canvas rd-canvas--builder"
      headerRight={<RomaShellDefaultActions />}
    >
      <BuilderDomain initialPublicId={initialPublicId} initialAccountId={initialAccountId} />
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
