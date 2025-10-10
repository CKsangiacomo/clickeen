export const runtime = 'edge';
export async function GET(_: Request, { params }: { params: { publicId: string }}) {
  const cfg = { publicId: params.publicId, theme: 'light', accent: '#2F80ED' };
  return new Response(JSON.stringify(cfg), { headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'public, max-age=60, stale-while-revalidate=300',
    'etag': '"demo-'+params.publicId+'"'
  }});
}
