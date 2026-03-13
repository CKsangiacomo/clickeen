import { AccountsDomain } from '../../../components/accounts-domain';
import { DomainPageShell } from '../domain-page-shell';

export default function AccountsPage() {
  return <DomainPageShell activeDomain="accounts" title="Accounts" fallback="Loading accounts..." Component={AccountsDomain} />;
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
