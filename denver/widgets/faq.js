function x(e,t={}){let r=t.nonce||"",c=e?.title??"",o=!!e?.showTitle,l=!!e?.showSearch,d=Array.isArray(e?.items)?e.items:[],s=(e?.behavior?.expandAll??!0)===!0,p=!!e?.behavior?.expandFirst,f=`/* inline basic styling for editing preview */
    ${k}
  `,g=d.map((n,u)=>{let _=n?.question??"",h=n?.answer??(n?.answerHtml?y(n.answerHtml):""),i=s||p&&u===0;return`
      <li class="ck-faq__item">
        <button class="ck-faq__q" type="button" aria-expanded="${i?"true":"false"}">${a(_)}</button>
        <div class="ck-faq__a" role="region" style="${i?"display:block":""}">${a(h)}</div>
      </li>`}).join("");return`<!doctype html><html><head><meta charset="utf-8" />
    <style nonce="${a(r)}">${f}</style>
  </head><body>
    <section class="ck-faq" data-role="faq" ${s?'data-expanded-all="true"':""}>
      <header class="ck-faq__header">
        <h2 class="ck-faq__title" ${o?"":"hidden"}>${a(c)}</h2>
        <div class="ck-faq__search" ${l?"":"hidden"}>
          <input type="search" placeholder="Search" />
        </div>
      </header>
      <ul class="ck-faq__list">${g}</ul>
    </section>
    <script nonce="${a(r)}">(${q})()</script>
  </body></html>`}function a(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var k=`
  :root{ --space-3:12px; --space-4:16px; }
  body{ margin:0; background:#f8fafc; color:#0f172a; font:14px/1.4 system-ui; }
  .ck-faq { display: grid; gap: var(--space-4); padding:16px; }
  .ck-faq__header{ display:flex; align-items:center; justify-content:space-between; }
  .ck-faq__title{ margin:0; font-weight:600; font-size:18px; }
  .ck-faq__list{ list-style:none; padding:0; margin:0; display:grid; gap: var(--space-3); }
  .ck-faq__item{ border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
  .ck-faq__q{ width:100%; text-align:left; padding:12px 14px; background:none; border:0; cursor:pointer; font-weight:600; }
  .ck-faq__a{ padding:0 14px 12px; color:#475569; display:none; }
  .ck-faq__q[aria-expanded="true"] + .ck-faq__a{ display:block; }
  .ck-faq[data-expanded-all="true"] .ck-faq__a{ display:block; }
`,q=function(){return function(){document.querySelectorAll(".ck-faq__q").forEach(e=>{e.addEventListener("click",()=>{let t=e.getAttribute("aria-expanded")==="true";e.setAttribute("aria-expanded",(!t).toString())})})}};function y(e){try{let t=globalThis.document?.createElement("div");if(t)return t.innerHTML=e,(t.textContent||t.innerText||"").trim()}catch{}return String(e).replace(/<[^>]*>/g,"")}export{x as render};
