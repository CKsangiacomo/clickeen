'use client';
import { useState } from 'react';

export default function SnippetBox({ publicId, version, isDev }: { publicId: string; version: number; isDev: boolean }) {
  const src = isDev
    ? `http://localhost:3002/api/e/${publicId}`
    : `https://cdn.c-keen.com/e/${publicId}.js?v=${version}`;
  const snippet = `<div id="ckeen-${publicId}"></div>\n<script async defer src="${src}"></script>`;
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
      <textarea readOnly value={snippet} style={{ width: '100%', height: 100, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, padding: 12, borderRadius: 8, border: '1px solid #ddd' }} />
      <button onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(()=>setCopied(false), 2000); }}
        style={{ alignSelf: 'start', padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', background: copied ? '#e6ffed' : 'white' }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
