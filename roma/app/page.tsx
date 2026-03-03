import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { DEFAULT_HOME_ROUTE } from '../lib/domains';

export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('ck-access-token')?.value?.trim() || '';
  if (!accessToken) {
    redirect('/login');
  }
  redirect(DEFAULT_HOME_ROUTE);
}
