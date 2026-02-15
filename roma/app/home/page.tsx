import { ControlPlaneShell } from '../../components/control-plane-shell';
import { HomePanel } from '../../components/home-panel';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <ControlPlaneShell
      moduleKey="home"
      title="Home"
      subtitle="Control-plane entry point for account and workspace operations."
    >
      <Suspense fallback={<section className="roma-module-surface">Loading home context...</section>}>
        <HomePanel />
      </Suspense>
    </ControlPlaneShell>
  );
}
