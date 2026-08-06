import { PageBuilder } from '../../../../components/page-builder';
import { RomaShell } from '../../../../components/roma-shell';

export default function NewPage() {
  return <RomaShell activeDomain="pages" title="New page" fullCanvas pageHeader={false}><PageBuilder /></RomaShell>;
}
