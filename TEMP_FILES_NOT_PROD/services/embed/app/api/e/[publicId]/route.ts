export const runtime = 'edge';
export async function GET(request: Request, { params }: { params: { publicId: string }}) {
  const url = new URL(request.url);
  const isPreview = url.searchParams.has('preview') || url.searchParams.has('cfg');
  const cacheControl = isPreview
    ? 'no-store'
    : 'public, max-age=60, stale-while-revalidate=300';
  const templateVersion = url.searchParams.get('v') || '1';
  
  const js = `
(()=> {
  var id = 'ckeen-${params.publicId}';
  var host = document.getElementById(id) || document.querySelector('[data-ckeen="${params.publicId}"]');
  if (!host) { host = document.createElement('div'); host.id = id; (document.currentScript?.parentElement || document.body).appendChild(host); }
  // Compute the origin of this script (the embed service), then import from that origin
  var embedOrigin = (function(){ try { return new URL(document.currentScript.src).origin } catch { return '' } })();
  var s = document.createElement('script');
  s.type = 'module';
  s.textContent = \`
    const ORIGIN = \${embedOrigin};
    import { renderContactForm } from \${ORIGIN ? \`\${ORIGIN}/embed-bundle.js\` : '/embed-bundle.js'};
    
    // Initialize widget with config
    const initialConfig = ${url.searchParams.get('cfg') ? `JSON.parse(atob('${url.searchParams.get('cfg')}'))` : '{}'};
    const widget = renderContactForm(host, initialConfig);
    
    ${isPreview ? `
    // Preview mode: add postMessage listener for live updates
    window.addEventListener('message', (ev) => {
      const allowed = ['http://localhost:3000', 'https://c-keen-site.vercel.app'];
      if (!allowed.includes(ev.origin)) return;
      
      const msg = ev.data;
      if (!msg || msg.type !== 'ckeen:preview:update') return;
      
      try {
        // Validate and update config
        const next = { ...initialConfig, ...msg.config };
        if (widget && typeof widget.update === 'function') {
          widget.update(next);
        }
      } catch (e) {
        console.warn('Preview update failed:', e);
      }
    });
    
    // Signal ready to parent
    window.parent?.postMessage({ type: 'ckeen:preview:ready' }, '*');
    ` : ''}
  \`;
  document.currentScript?.after(s);
})();`;
  
  return new Response(js, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Cache-TTL': '60',
      'X-Cache-Fresh': isPreview ? 'false' : 'true',
      'X-Template-Version': templateVersion
    }
  });
}
