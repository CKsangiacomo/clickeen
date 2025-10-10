export default function Page(){
  const demoWs = '00000000-0000-0000-0000-000000000001';
  return (
    <main style={{padding:24, display:'grid', gap:12}}>
      <h1>Dashboard</h1>
      <p><a href={`/workspaces/${demoWs}/members`}>Open demo workspace members →</a></p>
      <p><a href="/workspaces">My Workspaces →</a></p>
    </main>
  );
}
