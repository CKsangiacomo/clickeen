#!/usr/bin/env node
const zlib = require('node:zlib');

function renderFormsContactPage({ title, publicId, theme = 'light', device = 'desktop' }) {
  const cfg = { title, submitText: 'Send', fields: { name: true, email: true, message: true } };
  const width = device === 'mobile' ? '360px' : '720px';
  const bgPage = theme === 'dark' ? '#0e0f13' : '#f6f7f9';
  const textPage = theme === 'dark' ? '#f5f6f8' : '#0b0b0f';
  const cardBg = theme === 'dark' ? '#14161b' : '#ffffff';
  const border = theme === 'dark' ? 'rgba(250,250,255,0.18)' : 'rgba(10,10,12,0.16)';
  const surface = theme === 'dark' ? '#1c1c1e' : '#f6f7f9';
  const accent = '#0a84ff';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;background:${bgPage};color:${textPage}}
  .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:${width};max-width:100%;background:${cardBg};border-radius:16px;box-shadow:0 24px 60px rgba(12,16,24,.16);padding:24px;border:1px solid ${border}}
  h1{margin:0 0 12px;font-size:18px}
  form{display:grid;gap:12px}
  .field{display:grid;gap:6px}
  label{font-size:12px;font-weight:600;letter-spacing:.02em;color:rgba(11,11,15,.65);text-transform:uppercase}
  input[type=text],input[type=email],textarea{width:100%;border:1px solid ${border};background:${surface};color:inherit;border-radius:8px;padding:10px 12px;font:inherit}
  textarea{min-height:120px;resize:vertical}
  button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:32px;padding:0 16px;border-radius:8px;border:0;background:${accent};color:#fff;font-size:14px;cursor:pointer}
  button:focus-visible{outline:none;box-shadow:0 0 0 2px ${cardBg},0 0 0 4px ${accent}}
  footer{margin-top:12px;display:flex;justify-content:flex-end;font-size:12px}
  footer a{color:${accent};text-decoration:none}
  </style></head><body><div class="wrap"><article class="card"><h1>${String(cfg.title)}</h1>
  <form action="/s/${encodeURIComponent(publicId)}" method="post" novalidate>
  <div class="field"><label>Name</label><input type="text" /></div>
  <div class="field"><label>Email</label><input type="email" /></div>
  <div class="field"><label>Message</label><textarea></textarea></div>
  <div><button type="submit">Send</button></div>
  </form><footer><a href="https://clickeen.com/?ref=widget&id=${encodeURIComponent(publicId)}">Made with Clickeen</a></footer>
  </article></div></body></html>`;
}

function toGzipBytes(html) {
  const gz = zlib.gzipSync(Buffer.from(html, 'utf8'));
  return gz.length;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const threshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 10240; // 10KB default
  const html = renderFormsContactPage({ title: 'Contact Us', publicId: 'wgt_abcdef', theme: 'light', device: 'desktop' });
  const bytes = toGzipBytes(html);
  const pass = bytes <= threshold;
  console.log('SSR budget check: forms.contact (light/desktop)');
  console.log(`  gzipped bytes: ${bytes}`);
  console.log(`  threshold   : ${threshold}`);
  console.log(`  result      : ${pass ? 'PASS' : 'FAIL'}`);
  if (strict && !pass) process.exit(1);
}

main();

