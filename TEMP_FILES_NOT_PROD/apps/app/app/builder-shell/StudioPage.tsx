import { Metadata } from 'next';
import { StudioShell } from './components/StudioShell';

export const metadata: Metadata = {
  title: 'Studio · Clickeen',
};

export default function StudioPage() {
  // Future: pull real workspace + instance context
  return <StudioShell />;
}
