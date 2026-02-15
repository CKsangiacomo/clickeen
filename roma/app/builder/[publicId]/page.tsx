import { BuilderApp } from '@clickeen/bob/builder';
import { redirect } from 'next/navigation';
import { ControlPlaneShell } from '../../../components/control-plane-shell';
import { ModuleSurface } from '../../../components/module-surface';

export const runtime = 'edge';

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
  const workspaceId = singleParam(query.workspaceId);
  const accountId = singleParam(query.accountId);
  const queryPublicId = singleParam(query.publicId);
  const subject = singleParam(query.subject) || 'workspace';

  if (workspaceId && (queryPublicId !== publicId || subject !== 'workspace')) {
    const nextParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      const normalized = singleParam(value);
      if (!normalized) return;
      nextParams.set(key, normalized);
    });
    nextParams.set('workspaceId', workspaceId);
    nextParams.set('publicId', publicId);
    nextParams.set('subject', 'workspace');
    if (accountId) nextParams.set('accountId', accountId);
    redirect(`/builder/${encodeURIComponent(publicId)}?${nextParams.toString()}`);
  }

  if (!workspaceId) {
    return (
      <ControlPlaneShell
        moduleKey="builder"
        title="Builder"
        subtitle={`Missing workspace context for ${publicId}.`}
        focusMode
      >
        <ModuleSurface
          description="Builder requires `workspaceId` in route context. Select an instance from `/instances` to open an authorized builder session."
          primaryHref="/instances"
          primaryLabel="Go to instances"
          secondaryHref="/home"
          secondaryLabel="Back to home"
        />
      </ControlPlaneShell>
    );
  }

  return <BuilderApp />;
}

export const dynamic = 'force-dynamic';
