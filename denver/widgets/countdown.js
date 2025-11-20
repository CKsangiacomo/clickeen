function u(t,n={}){let e=n.nonce||"",s=t?.title??"Countdown",c=!!t?.showTitle,o=!!t?.fastMode,r=Number(t?.durationSeconds??3600),i=o?50:1e3,a=`${l}`;return`<!doctype html><html><head><meta charset="utf-8" />
    <style nonce="${d(e)}">${a}</style>
  </head><body>
    <section class="ck-countdown">
      <h2 class="ck-countdown__title" ${c?"":"hidden"}>${d(s)}</h2>
      <div class="ck-countdown__digits" data-role="digits">00:00:00</div>
    </section>
    <script nonce="${d(e)}">(${p})(${JSON.stringify({duration:r,speed:i})})</script>
  </body></html>`}function d(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var l=`
  :root{ color-scheme: light; }
  body{ margin:0; background:#f8fafc; color:#0f172a; font:14px/1.4 system-ui; }
  .ck-countdown{ display:grid; gap:12px; padding:16px; }
  .ck-countdown__title{ margin:0; font:600 18px/1.3 system-ui; color:#0f172a; }
  .ck-countdown__digits{ font:600 24px/1.2 ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background:#f1f5f9; border-radius:8px; padding:12px 16px; color:#0f172a; letter-spacing:1px; }
`,p=function(t){return function(){let n=document.querySelector('[data-role="digits"]');if(!n)return;let e=Date.now()+Math.max(0,t.duration)*1e3,s=()=>{let c=Math.max(0,e-Date.now()),o=Math.floor(c/1e3),r=Math.floor(o/3600).toString().padStart(2,"0"),i=Math.floor(o%3600/60).toString().padStart(2,"0"),a=Math.floor(o%60).toString().padStart(2,"0");n.textContent=`${r}:${i}:${a}`,c>0&&setTimeout(s,t.speed)};s()}};export{u as render};
