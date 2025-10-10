import { createSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ConfirmPage() {
  // Supabase SSR client will read the code from the URL and set the session via cookies
  const supabase = createSupabaseServer();
  // Touch auth to ensure cookie set
  await supabase.auth.getUser();

  return (
    <main style={{padding:24}}>
      <h1>Signed in</h1>
      <p>Return to the dashboard: <a href="/">Home</a></p>
    </main>
  );
}
