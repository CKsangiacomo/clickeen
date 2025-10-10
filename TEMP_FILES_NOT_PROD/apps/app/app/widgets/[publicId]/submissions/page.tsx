export const dynamic = 'force-dynamic';
async function getData(publicId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // Find widget UUID by publicId
  const wi = await fetch(`${url}/rest/v1/widget_instances?public_id=eq.${publicId}&select=id&limit=1`, { headers }).then(r=>r.json());
  const id = wi?.[0]?.id;
  if (!id) return [];
  // Pull last 50 submissions
  return fetch(`${url}/rest/v1/form_submissions?widget_instance_id=eq.${id}&order=created_at.desc&limit=50`, { headers })
    .then(r=>r.json()).catch(()=>[]);
}
export default async function Page({ params }: { params: { publicId: string }}) {
  const rows = await getData(params.publicId);
  return (
    <main style={{padding:24}}>
      <h1>Submissions for {params.publicId}</h1>
      <ul>
        {rows.map((r:any)=>(
          <li key={r.id}><code>{new Date(r.created_at).toLocaleString()}</code> — <pre style={{display:'inline'}}>{JSON.stringify(r.payload)}</pre></li>
        ))}
      </ul>
    </main>
  );
}
