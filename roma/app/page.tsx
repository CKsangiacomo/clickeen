import { redirect } from 'next/navigation';
import { DEFAULT_HOME_ROUTE } from '../lib/domains';

export default function RootPage() {
  redirect(DEFAULT_HOME_ROUTE);
}
