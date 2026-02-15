import { redirect } from 'next/navigation';
import { DEFAULT_HOME_ROUTE } from '../lib/modules';

export default function RootPage() {
  redirect(DEFAULT_HOME_ROUTE);
}
