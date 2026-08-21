import { RomaAccountNoticeModal } from '../../../components/roma-account-notice-modal';
import { RomaShell } from '../../../components/roma-shell';
import ROMA_NAVIGATION_UI_COPY from '../../../l10n/navigation/en.json';

export default function HomePage() {
  return (
    <RomaShell activeDomain="home" title={ROMA_NAVIGATION_UI_COPY.domains.home} pageHeader={false}>
      <RomaAccountNoticeModal />
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
