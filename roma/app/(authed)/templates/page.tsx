import { TemplatesDomain } from '../../../components/templates-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function TemplatesPage() {
  return <DomainPageShell activeDomain="templates" title="Templates" Component={TemplatesDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
