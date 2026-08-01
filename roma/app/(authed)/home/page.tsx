import { RomaAccountNoticeModal } from '../../../components/roma-account-notice-modal';
import { RomaShell } from '../../../components/roma-shell';

export default function HomePage() {
  return (
    <RomaShell activeDomain="home" title="Home" pageHeader={false}>
      <RomaAccountNoticeModal />
    </RomaShell>
  );
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
