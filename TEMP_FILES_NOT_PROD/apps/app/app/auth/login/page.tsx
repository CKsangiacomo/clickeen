'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch('/auth/magic', {
      method: 'POST',
      body: JSON.stringify({ email }),
      headers: { 'content-type': 'application/json' }
    });
    if (res.ok) setSent(true);
    else setErr('Failed to send link');
  }

  return (
    <main style={{padding:24, maxWidth:420, margin:'0 auto'}}>
      <h1>Sign in</h1>
      {sent ? (
        <p>Check your email for a magic link.</p>
      ) : (
        <form onSubmit={sendMagicLink} style={{display:'grid', gap:12}}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
            style={{padding:8, border:'1px solid #ddd', borderRadius:8}}
          />
          <button type="submit" style={{padding:'8px 12px', border:'1px solid #ddd', borderRadius:8}}>
            Send magic link
          </button>
          {err && <p style={{color:'crimson'}}>{err}</p>}
        </form>
      )}
    </main>
  );
}
