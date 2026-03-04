// ════════════════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════════════════

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fmt(n){return n.toLocaleString("cs-CZ",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtD(v){if(!v)return"";if(v.includes("-")){const[y,m,d]=v.split("-");return d+"."+m+"."+y;}return v;}
function fmtTS(ts){if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString("cs-CZ")+" "+d.toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"});}

// ── AUTOCOMPLETE suggestions (built from saved zakázky) ──────
function showAutocomplete(inp, priceFld){
  const q=(inp.value||"").toLowerCase().trim();
  let ac=document.getElementById("ac-list");
  if(!ac){ac=document.createElement("ul");ac.id="ac-list";ac.style.cssText="position:fixed;z-index:999;background:#fff;border:1.5px solid #d0d8e8;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.12);list-style:none;margin:0;padding:4px 0;font-size:12px;max-height:180px;overflow-y:auto;min-width:200px";document.body.appendChild(ac);}
  if(!q){ac.style.display="none";return;}
  const matches=_suggestions.filter(s=>s.label.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){ac.style.display="none";return;}
  const r=inp.getBoundingClientRect();
  ac.style.display="block";
  ac.style.left=r.left+"px";
  ac.style.top=(r.bottom+2)+"px";
  ac.style.width=Math.max(r.width,220)+"px";
  ac.innerHTML=matches.map((s,i)=>`<li data-i="${i}" style="padding:7px 13px;cursor:pointer;display:flex;justify-content:space-between;gap:10px"><span>${esc(s.label)}</span><span style="color:#6b7a99;font-family:'DM Mono',monospace">${s.cen?fmt(parseFloat(s.cen)||0)+" Kč/ks":""}</span></li>`).join("");
  ac.querySelectorAll("li").forEach(li=>{
    li.onmousedown=e=>{e.preventDefault();const s=matches[+li.dataset.i];inp.value=s.label;if(priceFld&&s.cen&&!priceFld.value)priceFld.value=s.cen;inp.dispatchEvent(new Event("input",{bubbles:true}));ac.style.display="none";};
    li.onmouseenter=()=>li.style.background="#f0f5ff";
    li.onmouseleave=()=>li.style.background="";
  });
}
document.addEventListener("click",()=>{const ac=document.getElementById("ac-list");if(ac)ac.style.display="none";});
document.addEventListener("scroll",()=>{const ac=document.getElementById("ac-list");if(ac)ac.style.display="none";},{passive:true});

// ════════════════════════════════════════════════════════
//  BUILD PRINT VIEW (shared A4 renderer)
// ════════════════════════════════════════════════════════







// ── AUTH ─────────────────────────────────────────────

// ── LIST RENDER ───────────────────────────────────────
let activeId = null;
function renderList(){
  const q=(document.getElementById('search-inp')?.value||'').toLowerCase().trim();
  const fs=document.getElementById('filter-stav')?.value||'';
  const ft=document.getElementById('filter-tech')?.value||'';
  const od=document.getElementById('filter-od')?.value||'';
  const doo=document.getElementById('filter-do')?.value||'';
  const all=window._zakazky||[];

  // Update technik filter options
  const techSel=document.getElementById('filter-tech');
  if(techSel){
    const techs=[...new Set(all.map(z=>z.technik||'').filter(Boolean))].sort();
    const cur=techSel.value;
    techSel.innerHTML='<option value="">Vš. technici</option>'+techs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    techSel.value=cur;
  }

  const filtered=all.filter(z=>{
    if(fs&&(z.stav||'nová')!==fs)return false;
    if(ft&&z.technik!==ft)return false;
    if(od&&z.termin&&z.termin<od)return false;
    if(doo&&z.termin&&z.termin>doo)return false;
    if(!q)return true;
    return(z.nazev||'').toLowerCase().includes(q)||
           (z.cislo||'').toLowerCase().includes(q)||
           (z.technik||'').toLowerCase().includes(q)||
           (z.zakaznik||'').toLowerCase().includes(q)||
           (z.prace||'').toLowerCase().includes(q)||
           (z.adresa||'').toLowerCase().includes(q)||
           (z.pozn||'').toLowerCase().includes(q)||
           (z.ico||'').toLowerCase().includes(q)||
           (z.zadani||'').toLowerCase().includes(q);
  });

  document.getElementById('count-badge').textContent='('+filtered.length+')';
  const scroll=document.getElementById('list-scroll');
  if(!filtered.length){scroll.innerHTML='<div class="list-status">Žádné zakázky</div>';return;}
  scroll.innerHTML=filtered.map(z=>`
    <div class="zcard${z.id===activeId?' active':''}" onclick="openDetail('${z.id}')">
      <div class="zcard-top">
        <input type="checkbox" class="bulk-cb" data-id="${z.id}"
          onclick="event.stopPropagation();toggleBulkSelect('${z.id}',this.checked)"
          style="width:15px;height:15px;margin-right:6px;flex-shrink:0;cursor:pointer;accent-color:var(--blue)"
          ${window._bulkSelected&&window._bulkSelected.has('${z.id}')?'checked':''}>
        <div class="zcard-title" style="flex:1">${esc(z.nazev||'—')}${z._offline?'<span class="offline-dot" title="Offline zakázka"></span>':''}</div>
        ${stavBadge(z.stav||'nová')}
      </div>
      <div class="zcard-meta">
        <span>📋 ${esc(z.cislo||'—')}</span>
        <span>👤 ${z.technici&&z.technici.length>1
          ? z.technici.map(u=>esc(u.name||u.uid)).join(', ')
          : esc(z.technik||'—')}</span>
        ${z.termin?`<span>📅 ${fmtD(z.termin)}</span>`:''}
        ${z.photos&&z.photos.length?`<span>📷 ${z.photos.length}</span>`:''}
      </div>
      ${!z.pricesSkipped&&z.cena?`<div class="zcard-cena">${esc(z.cena)}</div>`:''}
    </div>`).join('');
}

function stavBadge(stav){
  const c={
    'nová':             'stav-nova',
    'ke zpracování':    'stav-kezprac',
    'rozpracovaná':     'stav-rozprac',
    'na cestě':         'stav-naceste',
    'zpracovaná':       'stav-zpracovana',
    'fakturovaná':      'stav-fakturovana',
    'zaplacena':        'stav-zaplacena',
  };
  const icons={
    'nová':'🆕','ke zpracování':'👁','rozpracovaná':'🔧',
    'na cestě':'🚗','zpracovaná':'✅','fakturovaná':'🧾','zaplacena':'💰'
  };
  return `<span class="stav-badge ${c[stav]||'stav-nova'}">${icons[stav]||''} ${esc(stav||'nová')}</span>`;
}

// ── DETAIL ────────────────────────────────────────────
function openDetail(id){
  activeId=id;renderList();
  const z=(window._zakazky||[]).find(x=>x.id===id);
  if(!z)return;
  // Auto-transition: nová → ke zpracování when opened
  if((z.stav||'nová')==='nová'){
    z.stav='ke zpracování';
    window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id),
      {stav:'ke zpracování',updatedAt:window._fb.serverTimestamp()}).catch(()=>{});
  }
  document.getElementById('detail-empty').style.display='none';
  const di=document.getElementById('detail-inner');
  di.style.display='block';

  let tblRows='';
  (z.rows||[]).forEach((r,i)=>{const n=i+1;tblRows+=`<tr style="border-bottom:1px solid var(--border)">
    <td><input type="text"   id="dp${n}"  value="${esc(r.pol||'')}" oninput="dCalc()" placeholder="Položka..."></td>
    <td><input type="number" id="dq${n}"  value="${esc(r.poc||'')}" oninput="dCalc()" min="0" step="1"></td>
    <td><input type="number" id="dc${n}"  value="${esc(r.cen||'')}" oninput="dCalc()" min="0" step="0.01"></td>
    <td class="cel-col"><input id="dcel${n}" readonly tabindex="-1" value="${esc(r.cel||'')}"></td>
  </tr>`;});
  tblRows+=`<tr class="sep-tr"><td colspan="4">Cestovní náklady</td></tr>`;
  (z.exts||[]).forEach((e,i)=>{const n=i+1;tblRows+=`<tr style="border-bottom:1px solid var(--border)">
    <td><input type="text"   id="den${n}" value="${esc(e.label||EXT_LABELS[i]||'')}" oninput="dCalc()" style="font-style:italic"></td>
    <td><input type="number" id="deq${n}" value="${esc(e.poc||'')}" oninput="dCalc()" min="0" step="${EXT_STEPS[i]||1}"></td>
    <td><input type="number" id="dec${n}" value="${esc(e.cen||'')}" oninput="dCalc()" min="0" step="1"></td>
    <td class="cel-col"><input id="decel${n}" readonly tabindex="-1" value="${esc(e.cel||'')}"></td>
  </tr>`;});

  const photosHtml=z.photos&&z.photos.length
    ?`<div class="photo-grid-detail">`+z.photos.map((p,i)=>`
        <div style="border-radius:7px;overflow:hidden;border:1.5px solid var(--border);background:#fff;display:flex;flex-direction:column">
          <div style="position:relative;aspect-ratio:4/3;overflow:hidden;background:#f0f2f6">
            <img src="${p.cloudUrl||p.dataUrl}" loading="lazy"
              style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in"
              onclick="openLightbox('${p.cloudUrl||p.dataUrl}')">
            <!-- Akční tlačítka přes obrázek -->
            <div style="position:absolute;top:5px;right:5px;display:flex;gap:4px">
              <button title="Anotovat" onclick="openPhotoAnnot('${activeId}',${i})"
                style="background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center">✏️</button>
              <button title="Smazat fotku" onclick="deleteKancelPhoto('${activeId}',${i})"
                style="background:rgba(220,38,38,.8);color:#fff;border:none;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center">✕</button>
            </div>
            <!-- Upload status dot -->
            ${!p.cloudUrl?'<div style="position:absolute;bottom:5px;left:5px;background:#f0a500;color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700">lokální</div>':''}
          </div>
          <div style="padding:5px 7px;background:#fafbfc;border-top:1px solid #f0f2f6;flex:1">
            <input type="text" value="${esc(p.caption||p.name||'')}"
              placeholder="Popis fotografie…"
              style="width:100%;border:none;outline:none;font-size:10.5px;font-family:inherit;background:transparent;color:var(--text)"
              onchange="savePhotoCaption('${activeId}',${i},this.value)">
          </div>
        </div>`).join('')+`</div>`
    :`<div style="font-size:12px;color:var(--muted);font-style:italic">Žádné fotografie</div>`;

  const assignedTo=z.assignedTo?`<div style="font-size:11px;color:rgba(255,255,255,.65)">Přiřazeno: <strong style="color:#a0e070">${esc(z.assignedTo)}</strong></div>`:'';

  di.innerHTML=`
    <div class="detail-hdr">
      <div class="detail-hdr-left">
        <h2>${esc(z.nazev||'—')}</h2>
        <div class="meta">
          Číslo: <strong style="color:#fff">${esc(z.cislo||'—')}</strong> &nbsp;·&nbsp;
          Zákazník: ${esc(z.zakaznik||'—')}<br>
          Technik: ${z.technici&&z.technici.length>1
            ? z.technici.map(u=>`<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(255,255,255,.15);border-radius:4px;padding:1px 6px;margin:0 2px;font-size:11px">${esc(u.name||u.uid)}</span>`).join('')
            : esc(z.technik||'—')} &nbsp;·&nbsp;
          Termín: ${fmtD(z.termin)||'—'} &nbsp;·&nbsp;
          Přijato: ${fmtTS(z.createdAt)}
        </div>
        ${assignedTo}
      </div>
      <div class="detail-hdr-right">
        ${stavBadge(z.stav||'nová')}
        <select class="stav-sel" id="stav-sel" onchange="changeStav('${id}',this.value)">
          <option value="nová" ${(z.stav||'nová')==='nová'?'selected':''}>🆕 Nová</option>
          <option value="ke zpracování" ${z.stav==='ke zpracování'?'selected':''}>👁 Ke zpracování</option>
          <option value="rozpracovaná" ${z.stav==='rozpracovaná'?'selected':''}>🔧 Rozpracovaná</option>
          <option value="zpracovaná" ${z.stav==='zpracovaná'?'selected':''}>✅ Zpracovaná</option>
          <option value="čeká na díly" ${z.stav==='čeká na díly'?'selected':''}>🔩 Čeká na díly</option>
          <option value="ke kontrole" ${z.stav==='ke kontrole'?'selected':''}>🔍 Ke kontrole</option>
          <option value="ke fakturaci" ${z.stav==='ke fakturaci'?'selected':''}>📤 Ke fakturaci</option>
          <option value="vrácena" ${z.stav==='vrácena'?'selected':''}>↩ Vrácena k doplnění</option>
          <option value="fakturovaná" ${z.stav==='fakturovaná'?'selected':''}>🧾 Fakturovaná</option>
          <option value="zaplacena" ${z.stav==='zaplacena'?'selected':''}>💚 Zaplacena</option>
          <option value="stornována" ${z.stav==='stornována'?'selected':''}>🚫 Stornována</option>
        </select>
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="openAssignModal('${id}')">Přiřadit →</button>
      </div>
    </div>

    ${(z.zakaznik||z.adresa||z.ico)?`
    <div class="dsec">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>🏢 Zákazník</span>
        ${z.adresa?`<a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" target="_blank" rel="noopener"
          style="font-size:11px;color:#1d4ed8;text-decoration:none;font-weight:600;display:flex;align-items:center;gap:4px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Navigovat
        </a>`:''}
      </div>
      <div class="dsec-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px 16px">
        ${z.zakaznik?`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Název</div><div style="font-size:13px;font-weight:600">${esc(z.zakaznik)}</div></div>`:''}
        ${z.adresa?`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Adresa</div><div style="font-size:13px">${esc(z.adresa)}</div></div>`:''}
        ${z.ico?`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">IČO</div><div style="font-size:13px;font-family:'DM Mono',monospace">${esc(z.ico)}</div></div>`:''}
        ${z.dic?`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">DIČ</div><div style="font-size:13px;font-family:'DM Mono',monospace">${esc(z.dic)}</div></div>`:''}
        ${z.adresa?`<div style="grid-column:1/-1"><a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" target="_blank" rel="noopener"
          style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:5px 10px;text-decoration:none;font-weight:600">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Otevřít v Google Mapách
        </a></div>`:''}
      </div>
    </div>`:''}

    <!-- WORKFLOW PANEL -->
    <div class="dsec" style="border:1.5px solid #e0e7ff;margin-bottom:0">
      <div class="dsec-hdr" style="background:rgba(99,102,241,.06);justify-content:space-between">
        <span>🔄 Průběh zakázky</span>
        <span id="workflow-role-badge-${id}" style="font-size:10px;padding:2px 8px;border-radius:10px;background:#e0e7ff;color:#4338ca;font-weight:700"></span>
      </div>
      <div class="dsec-body" style="padding:12px 14px">
        <div id="workflow-steps-${id}" style="display:flex;align-items:center;gap:0;overflow-x:auto;padding:4px 0;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button onclick="workflowNext('${id}')" id="wf-next-${id}"
            style="font-size:12px;padding:6px 14px;background:var(--green);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px">
            ✅ Předat dál
          </button>
          <button onclick="workflowBack('${id}')" id="wf-back-${id}"
            style="font-size:12px;padding:6px 14px;background:#fff;border:1.5px solid var(--warn);color:#92400e;border-radius:7px;cursor:pointer;font-weight:600">
            ↩ Vrátit zpět
          </button>
          <input id="wf-note-${id}" placeholder="Poznámka k předání…"
            style="flex:1;min-width:160px;font-size:11px;padding:6px 10px;border:1px solid var(--border);border-radius:7px;font-family:inherit">
        </div>
      </div>
    </div>

    ${z.zadani?`
    <div class="dsec" style="border:1.5px solid #bfdbfe">
      <div class="dsec-hdr" style="background:rgba(59,130,246,.07);justify-content:space-between">
        <span>📋 Zadání od kanceláře</span>
        <button onclick="openAssignModal('${id}')" style="padding:3px 10px;font-size:11px;font-weight:600;background:#fff;border:1.5px solid #93c5fd;border-radius:6px;cursor:pointer;color:#1d4ed8">✏ Upravit</button>
      </div>
      <div class="dsec-body">
        <div class="prace-text" style="color:#1e40af;white-space:pre-wrap">${esc(z.zadani)}</div>
        ${z.termin?`<div style="margin-top:8px;font-size:11px;color:var(--muted)">📅 Termín: <strong style="color:var(--text)">${fmtD(z.termin)}</strong></div>`:''}
      </div>
    </div>`:''}

    ${z.termin?`<div class="dsec" id="weather-dsec-${id}" style="border:1px dashed var(--border)">
      <div class="dsec-hdr" style="background:transparent;justify-content:space-between">
        <span>🌤 Počasí v den termínu</span>
        <span style="font-size:10px;color:var(--muted)">${fmtD(z.termin)}</span>
      </div>
      <div class="dsec-body" id="weather-body-${id}" style="font-size:12px;color:var(--muted);font-style:italic">Načítám předpověď…</div>
    </div>`:''}

    <div class="dsec">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>🔧 Provedené servisní práce</span>
        <div id="timer-display-${id}" style="display:flex;align-items:center;gap:8px;font-size:11px">
          <span id="timer-val-${id}" style="font-family:'DM Mono',monospace;font-weight:700;color:var(--navy);min-width:48px">
            ${z.casNaZakazce?formatDuration(z.casNaZakazce):'00:00:00'}
          </span>
          <button id="timer-btn-${id}" onclick="toggleTimer('${id}')"
            style="padding:3px 10px;border-radius:6px;border:1.5px solid var(--border);background:#fff;font-size:11px;font-weight:700;cursor:pointer;color:var(--text)">
            ${z.timerRunning?'⏸ Pauza':'▶ Spustit čas'}
          </button>
        </div>
      </div>
      <div class="dsec-body"><div class="prace-text">${esc(z.prace||'—')}</div></div>
    </div>

    <div class="dsec" id="dsec-ceny">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>💰 Položky a ceny</span>
        ${(!z.pricesSkipped&&z.cena)
          ?`<span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:20px;background:#fef3c7;color:#b45309;display:flex;align-items:center;gap:4px">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Uzamčeno
            </span>`
          :`<span style="font-size:10px;opacity:.55;font-weight:400">✎ editovatelné</span>`
        }
      </div>
      ${(!z.pricesSkipped&&z.cena)?`
      <div id="ceny-locked-bar" style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:#fffbf0;border-bottom:1px solid #fde68a">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style="font-size:12px;color:#92400e;flex:1">Ceny jsou uloženy. Pro editaci klikněte na <strong>Odemknout</strong>.</span>
        <button onclick="unlockPrices('${id}')" style="padding:5px 13px;background:#fff;color:#b45309;border:1.5px solid #fcd34d;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          Odemknout
        </button>
      </div>`:``}
      <div class="dsec-body" style="padding:0">
        <div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin:14px">
          <table class="ceny-tbl" id="ceny-tbl">
            <thead><tr>
              <th style="text-align:left;width:44%;padding:7px 9px">Položka</th>
              <th style="width:13%">Počet ks</th>
              <th style="width:18%;color:#6abf3e">Cena Kč/ks</th>
              <th style="width:18%">Celkem Kč</th>
            </tr></thead>
            <tbody id="ceny-tbody">${tblRows}</tbody>
          </table>
          <div class="total-bar"><span>Cena bez DPH</span><strong id="d-total">—</strong></div>
        </div>
        <div style="padding:0 14px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div class="duzp-row">
            <label>DUZP:</label>
            <input type="date" id="d-duzp" value="${z.duzp||''}" oninput="markDirty()">
          </div>
          <div class="duzp-row" style="gap:6px">
            <label>Hodiny:</label>
            <input type="number" id="d-hodiny" min="0" step="0.5" value="${z.hodiny||''}" 
              oninput="markDirty()" style="width:70px" placeholder="0">
            <label style="margin-left:8px">Km:</label>
            <input type="number" id="d-km" min="0" step="1" value="${z.km||''}" 
              oninput="markDirty()" style="width:70px" placeholder="0">
            <label style="margin-left:8px">Sazba km:</label>
            <input type="number" id="d-km-sazba" min="0" step="0.5" value="${z.kmSazba||window._kmSazba||5.60}" 
              oninput="markDirty()" style="width:65px" placeholder="5.60">
          </div>
          <div style="margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <button class="btn btn-green" id="btn-save" onclick="saveDetail('${id}')">
              ✓ Uložit ceny
            </button>
            <div class="save-status" id="save-status"></div>
          </div>
        </div>
      </div>
    </div>

    ${z.pozn?`<div class="dsec"><div class="dsec-hdr">📝 Poznámky</div><div class="dsec-body"><div class="prace-text">${esc(z.pozn)}</div></div></div>`:''}

    ${z.komentar?`<div class="dsec" style="border:1.5px solid #d0c0f0"><div class="dsec-hdr" style="background:rgba(124,58,237,.08)">💬 Interní komentář <span style="font-size:10px;font-weight:400;color:#7c3aed;margin-left:6px">pouze pro kancelář</span></div><div class="dsec-body"><div class="prace-text" style="color:#5b21b6">${esc(z.komentar)}</div></div></div>`:''}

    <div class="dsec" style="border:1.5px solid #bfdbfe">
      <div class="dsec-hdr" style="background:rgba(59,130,246,.06);justify-content:space-between">
        <span>💬 Komentáře a komunikace</span>
        <span style="font-size:10px;font-weight:400;color:var(--muted)">viditelné technikovi i kanceláři</span>
      </div>
      <div class="dsec-body" style="padding:0">
        <div id="chat-messages-${id}" style="max-height:240px;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:8px"></div>
        <div style="padding:10px 14px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end">
          <textarea id="chat-inp-${id}" rows="2" placeholder="Napište zprávu…"
            style="flex:1;resize:none;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit;outline:none"
            onkeydown="if(event.ctrlKey&&event.key==='Enter')sendChatMsg('${id}')"></textarea>
          <button onclick="sendChatMsg('${id}')" class="btn btn-primary" style="padding:8px 14px;height:fit-content">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div class="dsec">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>📷 Fotodokumentace</span>
        <label style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--navy);cursor:pointer;background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:4px 10px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Přidat foto
          <input type="file" accept="image/*" multiple capture="environment" style="display:none"
            onchange="addKancelPhoto(this,'${activeId}')">
        </label>
      </div>
      <div class="dsec-body">${photosHtml}</div>
      <div id="kphoto-prog-${activeId}" style="display:none;padding:6px 14px;font-size:11px;color:var(--muted)">⏳ Nahrávám...</div>
    </div>

    <div class="dsec">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>🖨️ Export a tisk</span>
        <button onclick="openZakazkaSouhrn('${id}')" style="font-size:11px;padding:3px 10px;background:#fff;border:1.5px solid var(--navy);border-radius:6px;cursor:pointer;color:var(--navy);font-weight:600">
          👁 Souhrn zakázky
        </button>
      </div>
      <div class="dsec-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text);cursor:pointer;padding:6px 10px;background:#f8fafc;border:1px solid var(--border);border-radius:7px">
          <input type="checkbox" id="print-photos-cb" style="width:14px;height:14px;accent-color:var(--blue)">
          Zahrnout fotodokumentaci
        </label>
        <button class="btn btn-green" onclick="openServiceListModal('${id}')" style="display:flex;align-items:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Vytvořit servisní list
        </button>
        <button class="btn btn-primary" onclick="printDetail('${id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Tisk s cenami
        </button>
        <button class="btn btn-ghost" onclick="exportHTML('${id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Stáhnout HTML
        </button>
        <button class="btn btn-ghost" onclick="exportCSV('${id}')" style="font-size:11px">CSV</button>
        <button class="btn btn-ghost" onclick="exportXLSX('${id}')" style="font-size:11px;display:flex;align-items:center;gap:4px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          XLSX
        </button>
        <button class="btn btn-ghost" onclick="showQR('${id}')" style="font-size:11px;display:flex;align-items:center;gap:4px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>
          QR
        </button>
        <button class="btn btn-ghost" onclick="exportFaktura('${id}')" style="font-size:11px;display:flex;align-items:center;gap:4px">
          🧾 Fakturační podklad
        </button>
        <button class="btn btn-ghost" onclick="showAuditLog('${id}')" style="font-size:11px">📋 Log změn</button>
        <button onclick="generatePortalLink('${id}')" class="btn btn-ghost" style="font-size:11px;background:#f0fdf4;border-color:#86efac;color:#15803d">🔗 Sdílet</button>
        <button onclick="openMistaPanel('${id}')" class="btn" style="background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;font-size:11px;font-weight:700">🏢 Místa & Klimatizace</button>
        <button onclick="openProtocolWizard('${id}')" class="btn" style="background:#f0fdf4;color:#15803d;border:1px solid #86efac;font-size:11px;font-weight:700">📋 Protokol</button>
        <button class="btn" style="background:#fef2f2;color:var(--err);border:1px solid #fecaca;font-size:11px" onclick="deleteZakazka('${id}')">🗑 Smazat</button>
      </div>
    </div>`;

  // Apply lock if prices already saved
  const _locked = !z.pricesSkipped && !!z.cena;
  applyPriceLock(_locked);
  _calcTotals(); // silent calc on load — no dirty flag
}

function applyPriceLock(lock) {
  // Lock/unlock all editable cells in price table
  const sel = lock
    ? '#ceny-tbody input:not([readonly]), #d-duzp'
    : '#ceny-tbody input:not([readonly]), #d-duzp';

  // All inputs in ceny-tbody + duzp
  document.querySelectorAll('#ceny-tbody input, #d-duzp').forEach(inp => {
    if (inp.id && inp.id.startsWith('dcel')) return; // always readonly
    inp.readOnly = lock;
    inp.style.cursor = lock ? 'not-allowed' : '';
    inp.style.background = lock ? 'rgba(250,250,252,.7)' : '';
    inp.style.color = lock ? '#9aaac4' : '';
    inp.oninput = lock ? null : inp.oninput || null;
    // Remove/restore event listeners via class
    inp.classList.toggle('price-locked', lock);
  });

  // Save button
  const btn = document.getElementById('btn-save');
  if (btn) {
    btn.style.display = lock ? 'none' : '';
  }

  // DUZP
  const duzp = document.getElementById('d-duzp');
  if (duzp) {
    duzp.readOnly = lock;
    duzp.style.cursor = lock ? 'not-allowed' : '';
    duzp.style.background = lock ? 'rgba(250,250,252,.7)' : '';
  }

  // Locked bar visibility
  const bar = document.getElementById('ceny-locked-bar');
  if (bar) bar.style.display = lock ? 'flex' : 'none';

  if (!lock) {
    // Re-attach focus highlight for unlocked inputs
    document.querySelectorAll('.ceny-tbl input:not([readonly]):not(.price-locked)').forEach(inp => {
      inp.addEventListener('focus', () => { inp.style.background = 'var(--blue2)'; inp.style.borderLeftColor = 'var(--blue)'; });
      inp.addEventListener('blur', () => { inp.style.background = ''; inp.style.borderLeftColor = ''; });
    });
  }
}

function unlockPrices(id) {
  applyPriceLock(false);
  // Show unlock warning
  const bar = document.getElementById('ceny-locked-bar');
  if (bar) {
    bar.style.background = '#fff7ed';
    bar.style.borderColor = '#fed7aa';
    bar.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span style="font-size:12px;color:#c2410c;flex:1"><strong>Editace odemčena.</strong> Po dokončení klikněte na <strong>Uložit ceny</strong>.</span>
      <button onclick="document.getElementById('ceny-locked-bar').style.display='none'"
        style="padding:4px 10px;background:none;border:none;font-size:18px;cursor:pointer;color:#c2410c;line-height:1">×</button>
    `;
    bar.style.display = 'flex';
  }
}

// ── DETAIL CALC ───────────────────────────────────────
function _calcTotals(){
  // Calc only — no side effects, safe to call on load
  let total=0;
  for(let i=1;i<=8;i++){const p=parseFloat(document.getElementById('dq'+i)?.value)||0,c=parseFloat(document.getElementById('dc'+i)?.value)||0;const cel=p*c?fmt(p*c):'';const el=document.getElementById('dcel'+i);if(el)el.value=cel;total+=p*c;}
  for(let i=1;i<=3;i++){const p=parseFloat(document.getElementById('deq'+i)?.value)||0,c=parseFloat(document.getElementById('dec'+i)?.value)||0;const cel=p*c?fmt(p*c):'';const el=document.getElementById('decel'+i);if(el)el.value=cel;total+=p*c;}
  const el=document.getElementById('d-total');if(el)el.textContent=fmt(total)+' Kč';
}
function dCalc(){
  // Called from user input — calc + mark dirty
  _calcTotals();
  markDirty();
}
function markDirty(){
  const s=document.getElementById('save-status');
  if(s){s.textContent='● Neuložené změny';s.style.color='var(--warn,#b45309)';}
  // Auto-transition to rozpracovaná when anything changes
  if(activeId){
    const z=(window._zakazky||[]).find(x=>x.id===activeId);
    if(z&&['nová','ke zpracování'].includes(z.stav||'nová')){
      z.stav='rozpracovaná';
      window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',activeId),
        {stav:'rozpracovaná',updatedAt:window._fb.serverTimestamp()}).catch(()=>{});
      const sel=document.getElementById('stav-sel');
      if(sel)sel.value='rozpracovaná';
    }
  }
}

// ── SAVE DETAIL ───────────────────────────────────────
async function saveDetail(id){
  const btn=document.getElementById('btn-save');
  const status=document.getElementById('save-status');
  if(btn)btn.disabled=true;
  const rows=[];for(let i=1;i<=8;i++)rows.push({pol:document.getElementById('dp'+i)?.value||'',poc:document.getElementById('dq'+i)?.value||'',cen:document.getElementById('dc'+i)?.value||'',cel:document.getElementById('dcel'+i)?.value||''});
  const exts=[];for(let i=1;i<=3;i++)exts.push({label:document.getElementById('den'+i)?.value||EXT_LABELS[i-1],poc:document.getElementById('deq'+i)?.value||'',cen:document.getElementById('dec'+i)?.value||'',cel:document.getElementById('decel'+i)?.value||''});
  const total=document.getElementById('d-total')?.textContent||'';
  // Auto-transition to rozpracovaná when prices are saved
  const z=(window._zakazky||[]).find(x=>x.id===id);
  const currentStav=z?.stav||'nová';
  const newStav=['nová','ke zpracování'].includes(currentStav)?'rozpracovaná':currentStav;
  try{
    await window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id),{
      rows,exts,cena:total,duzp:document.getElementById('d-duzp')?.value||'',
      hodiny:parseFloat(document.getElementById('d-hodiny')?.value)||0,
      km:parseInt(document.getElementById('d-km')?.value)||0,
      kmSazba:parseFloat(document.getElementById('d-km-sazba')?.value)||5.60,
      pricesSkipped:false,stav:newStav,updatedAt:window._fb.serverTimestamp()
    });
    if(status){status.textContent='✓ Uloženo';status.style.color='var(--green)';}
    if(btn){btn.disabled=false;}
    // Lock prices after save
    applyPriceLock(true);
    // Show locked bar
    const lockedBar = document.getElementById('ceny-locked-bar');
    if(lockedBar){
      lockedBar.style.background='#fffbf0';
      lockedBar.style.borderColor='#fde68a';
      lockedBar.innerHTML=`
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span style="font-size:12px;color:#92400e;flex:1">Ceny jsou uloženy. Pro editaci klikněte na <strong>Odemknout</strong>.</span>
        <button onclick="unlockPrices('${id}')" style="padding:5px 13px;background:#fff;color:#b45309;border:1.5px solid #fcd34d;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          Odemknout
        </button>
      `;
      lockedBar.style.display='flex';
    }
    // Update stav select if state changed
    if(newStav!==currentStav){
      const sel=document.getElementById('stav-sel');
      if(sel)sel.value=newStav;
      const badge=document.querySelector('.detail-hdr-right .stav-badge');
      if(badge)badge.outerHTML=stavBadge(newStav);
    }
  }catch(e){if(status){status.textContent='Chyba: '+e.message;status.style.color='var(--err)';}if(btn)btn.disabled=false;}
}

// ── CHANGE STAV ───────────────────────────────────────
async function changeStav(id,stav){
  try{
    await window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id),{stav,updatedAt:window._fb.serverTimestamp()});
    saveAuditLog(id,'stav_zmena',stav);
  }
  catch(e){alert('Chyba: '+e.message);}
}

// ── DELETE ────────────────────────────────────────────
async function deleteZakazka(id){
  const z=(window._zakazky||[]).find(x=>x.id===id);
  if(!confirm('Smazat zakázku "'+((z&&z.nazev)||id)+'"? Tato akce je nevratná.'))return;
  try{
    await window._fb.deleteDoc(window._fb.doc(window._fb.db,'zakazky',id));
    document.getElementById('detail-empty').style.display='flex';
    document.getElementById('detail-inner').style.display='none';
    activeId=null;
  }catch(e){alert('Chyba mazání: '+e.message);}
}

// ── ASSIGN MODAL ──────────────────────────────────────
let _assignId=null;
async function openAssignModal(id){
  _assignId=id;
  // Load users with role technik/admin from Firestore
  const sel=document.getElementById('assign-sel');
  sel.innerHTML='<option value="">Načítám...</option>';
  try{
    const snap=await window._fb.getDocs(window._fb.collection(window._fb.db,'users'));
    const users=[];
    snap.forEach(d=>{const u={id:d.id,...d.data()};if(u.role==='technik'||u.role==='admin')users.push(u);});
    users.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    // Also add any technik names from zakazky not in users
    const fromZak=[...new Set((window._zakazky||[]).map(z=>z.technik||'').filter(Boolean))];
    const userNames=users.map(u=>u.name||u.email);
    const extra=fromZak.filter(n=>!userNames.includes(n));
    sel.innerHTML=
      users.map(u=>`<option value="${esc(u.name||u.email)}">${esc(u.name||u.email)}</option>`).join('')+
      (extra.length?'<optgroup label="— ostatní —">'+extra.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')+'</optgroup>':'');
  }catch(e){
    // Fallback: names from existing zakazky
    const techs=[...new Set((window._zakazky||[]).map(z=>z.technik||'').filter(Boolean))].sort();
    sel.innerHTML=techs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
  }
  // Pre-fill from existing zakazka
  const z=(window._zakazky||[]).find(x=>x.id===id);
  if(z){
    if(z.technik)sel.value=z.technik;
    document.getElementById('assign-termin').value=z.termin||'';
    document.getElementById('assign-zadani').value=z.zadani||'';
  }else{
    document.getElementById('assign-termin').value='';
    document.getElementById('assign-zadani').value='';
  }
  document.getElementById('assign-modal').classList.add('open');
}
async function doAssign(){
  const tech=document.getElementById('assign-sel').value;
  const termin=document.getElementById('assign-termin').value;
  const zadani=document.getElementById('assign-zadani').value.trim();
  if(!tech||!_assignId)return;
  try{
    await window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',_assignId),{
      assignedTo:tech,
      termin:termin||'',
      zadani:zadani||'',
      updatedAt:window._fb.serverTimestamp()
    });
    // Update local cache
    const z=(window._zakazky||[]).find(x=>x.id===_assignId);
    if(z){z.assignedTo=tech;z.termin=termin;z.zadani=zadani;}
    closeModal('assign-modal');
    // Show confirmation in the detail view if open
    const badge=document.getElementById('assign-badge');
    if(badge)badge.textContent='✓ Přiřazeno: '+tech;
  }catch(e){alert('Chyba: '+e.message);}
}
function closeModal(id){document.getElementById(id).classList.remove('open');}

// ── LIGHTBOX ──────────────────────────────────────────
let _lightboxPhotos = [];
let _lightboxIdx = 0;

function openLightbox(src, caption, allPhotos, idx){
  _lightboxPhotos = allPhotos || [{dataUrl:src, cloudUrl:src, caption:caption||''}];
  _lightboxIdx = idx !== undefined ? idx : 0;
  _showLightboxAt(_lightboxIdx);
  document.getElementById('lightbox').classList.add('open');
}

function _showLightboxAt(i){
  const ph = _lightboxPhotos[i];
  if(!ph) return;
  const src = ph.cloudUrl || ph.dataUrl || ph;
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-img').dataset.src = src;
  document.getElementById('lightbox-img').dataset.name = (ph.caption || ph.name || ('foto-'+(i+1)));
  const cap = ph.caption || (ph.name ? ph.name.replace(/\.[^.]+$/,'') : '');
  const capEl = document.getElementById('lightbox-caption');
  if(cap){ capEl.textContent = cap; capEl.style.display='block'; }
  else { capEl.style.display='none'; }
  // Navigační tlačítka
  const prev = document.getElementById('lightbox-prev');
  const next = document.getElementById('lightbox-next');
  if(prev) prev.style.display = _lightboxPhotos.length > 1 ? '' : 'none';
  if(next) next.style.display = _lightboxPhotos.length > 1 ? '' : 'none';
}

function lightboxNav(dir){
  _lightboxIdx = (_lightboxIdx + dir + _lightboxPhotos.length) % _lightboxPhotos.length;
  _showLightboxAt(_lightboxIdx);
}

function downloadLightboxPhoto(){
  const img = document.getElementById('lightbox-img');
  const src = img.dataset.src || img.src;
  const name = (img.dataset.name || 'foto').replace(/[^a-zA-Z0-9áčďéěíňóřšťůúýžÁČĎÉĚÍŇÓŘŠŤŮÚÝŽ _-]/g,'_') + '.jpg';
  const a = document.createElement('a');
  a.href = src;
  a.download = name;
  a.click();
}

async function downloadAllPhotos(){
  if(!photos || !photos.length){ alert('Žádné fotografie k stažení.'); return; }
  for(let i=0; i<photos.length; i++){
    const ph = photos[i];
    const src = ph.cloudUrl || ph.dataUrl || ph;
    const cap = ph.caption || ph.name || ('foto-'+(i+1));
    const name = cap.replace(/[^a-zA-Z0-9áčďéěíňóřšťůúýžÁČĎÉĚÍŇÓŘŠŤŮÚÝŽ _-]/g,'_') + '.jpg';
    const a = document.createElement('a');
    a.href = src;
    a.download = name;
    a.click();
    await new Promise(r => setTimeout(r, 300));
  }
}

function closeLightbox(){document.getElementById('lightbox').classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLightbox();closeModal('assign-modal');}});

// ── EXPORT ────────────────────────────────────────────
function getDetailData(id){
  const z=(window._zakazky||[]).find(x=>x.id===id);if(!z)return null;
  const rows=[];for(let i=1;i<=8;i++)rows.push({pol:document.getElementById('dp'+i)?.value||'',poc:document.getElementById('dq'+i)?.value||'',cen:document.getElementById('dc'+i)?.value||'',cel:document.getElementById('dcel'+i)?.value||''});
  const exts=[];for(let i=1;i<=3;i++)exts.push({label:document.getElementById('den'+i)?.value||EXT_LABELS[i-1],poc:document.getElementById('deq'+i)?.value||'',cen:document.getElementById('dec'+i)?.value||'',cel:document.getElementById('decel'+i)?.value||''});
  return{...z,rows,exts,cena:document.getElementById('d-total')?.textContent||z.cena||'',duzp:document.getElementById('d-duzp')?.value||z.duzp||''};
}

function printDetail(id){
  const d=getDetailData(id);if(!d)return;
  const inclPhotos=document.getElementById('print-photos-cb')?.checked||false;
  const pv=buildPrintView({...d,sd1:fmtD(d.sd1),sd2:fmtD(d.sd2),termin:d.termin,showPrices:true,includePhotos:inclPhotos});
  const pc=document.getElementById('print-container');pc.innerHTML='';pc.appendChild(pv);
  generatePDF({ filename: 'servisni-list.pdf' });
}

function exportHTML(id){
  const d=getDetailData(id);if(!d)return;
  const pv=buildPrintView({...d,sd1:fmtD(d.sd1),sd2:fmtD(d.sd2),termin:d.termin,showPrices:true,includePhotos:document.getElementById('print-photos-cb')?.checked||false});
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Servisní list ${esc(d.cislo)}</title><style>@page{size:A4;margin:0}body{margin:0;background:#fff}</style></head><body>${pv.outerHTML}</body></html>`;
  const blob=new Blob([html],{type:'text/html'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='servisni-list-'+esc(d.cislo||'export')+'.html';a.click();URL.revokeObjectURL(a.href);
}

function exportCSV(id){
  const d=getDetailData(id);if(!d)return;
  const rows=[['Položka','Počet ks','Cena Kč/ks','Celkem Kč']];
  (d.rows||[]).forEach(r=>{if(r.pol||r.poc)rows.push([r.pol,r.poc,r.cen,r.cel]);});
  rows.push(['--- Cestovní náklady ---','','','']);
  (d.exts||[]).forEach(e=>{if(e.poc)rows.push([e.label,e.poc,e.cen,e.cel]);});
  rows.push(['','','Celkem bez DPH:',d.cena||'']);
  const csv=rows.map(r=>r.map(v=>'"'+(v||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='Cenik_'+((d.cislo||'export').replace(/[^a-z0-9_-]/gi,'_'))+'.csv';
  a.click();URL.revokeObjectURL(a.href);
}

// ── DASHBOARD ─────────────────────────────────────────
function renderDashboard(){
  const all=window._zakazky||[];
  const now=new Date();
  const thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const lastMonth=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lm=lastMonth.getFullYear()+'-'+String(lastMonth.getMonth()+1).padStart(2,'0');

  const total=all.length;
  const nova=all.filter(z=>(z.stav||'nová')==='nová').length;
  const thisMonthZ=all.filter(z=>z.termin&&z.termin.startsWith(thisMonth));
  const lastMonthZ=all.filter(z=>z.termin&&z.termin.startsWith(lm));

  // Revenue
  function parseCena(c){return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;}
  const revThis=thisMonthZ.reduce((s,z)=>s+parseCena(z.cena),0);
  const revLast=lastMonthZ.reduce((s,z)=>s+parseCena(z.cena),0);
  const revDiff=revLast?Math.round((revThis-revLast)/revLast*100):0;

  document.getElementById('stats-grid').innerHTML=`
    <div class="stat-card"><div class="val">${total}</div><div class="lbl">Celkem zakázek</div></div>
    <div class="stat-card warn"><div class="val">${nova}</div><div class="lbl">Ke zpracování</div></div>
    <div class="stat-card blue"><div class="val">${thisMonthZ.length}</div><div class="lbl">Tento měsíc</div><div class="sub">Minulý: ${lastMonthZ.length}</div></div>
    <div class="stat-card green"><div class="val">${fmt(revThis)} Kč</div><div class="lbl">Obrat tento měsíc</div><div class="sub">${revDiff>=0?'+':''}${revDiff}% vs. minulý</div></div>
  `;

  // By technik
  const byTech={};
  all.forEach(z=>{
    // Count each technik individually for multi-technik zakázky
    const techList=z.technici&&z.technici.length
      ? z.technici
      : [{name:z.technik||'Neznámý'}];
    techList.forEach(u=>{const t=u.name||'Neznámý';byTech[t]=(byTech[t]||0)+1;});
  });
  const techEntries=Object.entries(byTech).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxT=techEntries[0]?techEntries[0][1]:1;
  document.getElementById('chart-technici').innerHTML=techEntries.map(([t,c])=>`
    <div class="cbl-row">
      <div class="cbl-lbl">${esc(t)}</div>
      <div class="cbl-bar-wrap"><div class="cbl-bar" style="width:${Math.round(c/maxT*100)}%"></div></div>
      <div class="cbl-val">${c} zakázek</div>
    </div>`).join('');

  // By stav (this month)
  const byStav={nová:0,zpracovaná:0,fakturovaná:0};
  thisMonthZ.forEach(z=>{const s=z.stav||'nová';if(byStav[s]!==undefined)byStav[s]++;});
  const maxS=Math.max(...Object.values(byStav))||1;
  const stavColors={'nová':'#f0a500','zpracovaná':'#6abf3e','fakturovaná':'#2d5fa6'};
  document.getElementById('chart-stavy').innerHTML=Object.entries(byStav).map(([s,c])=>`
    <div class="cbl-row">
      <div class="cbl-lbl" style="text-transform:capitalize">${s}</div>
      <div class="cbl-bar-wrap"><div class="cbl-bar" style="width:${Math.round(c/maxS*100)}%;background:${stavColors[s]}"></div></div>
      <div class="cbl-val">${c}</div>
    </div>`).join('');

  // 30-day trend (simple canvas bar chart)
  const days=[];
  for(let i=29;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const counts={};days.forEach(d=>counts[d]=0);
  all.forEach(z=>{if(z.termin&&counts[z.termin]!==undefined)counts[z.termin]++;});
  drawTrendChart(days,days.map(d=>counts[d]));

  // Recent table
  document.getElementById('recent-tbody').innerHTML=all.slice(0,10).map(z=>`
    <tr onclick="switchTab('orders');setTimeout(()=>openDetail('${z.id}'),50)">
      <td><strong>${esc(z.nazev||'—')}</strong><br><span style="font-size:10px;color:var(--muted)">${esc(z.cislo||'')}</span></td>
      <td>${esc(z.technik||'—')}</td>
      <td>${stavBadge(z.stav||'nová')}</td>
      <td>${fmtD(z.termin)||'—'}</td>
      <td style="font-family:'DM Mono',monospace;white-space:nowrap">${z.cena||'—'}</td>
    </tr>`).join('');
}

function drawTrendChart(labels,data){
  const canvas=document.getElementById('trend-chart');
  if(!canvas)return;
  const dpr=window.devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth-36;
  const H=80;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const max=Math.max(...data)||1;
  const bw=(W-20)/data.length;
  data.forEach((v,i)=>{
    const bh=Math.max(2,Math.round(v/max*(H-20)));
    const x=10+i*bw+1;const y=H-10-bh;
    ctx.fillStyle=v?'#2d5fa6':'#d0d8e8';
    ctx.fillRect(x,y,bw-2,bh);
  });
  ctx.fillStyle='#6b7a99';ctx.font='9px DM Sans,sans-serif';
  [labels[0],labels[7],labels[14],labels[21],labels[29]].forEach((d,i)=>{
    const idx=[0,7,14,21,29][i];
    const x=10+idx*bw;
    ctx.fillText(d.slice(5),x,H-1);
  });
}

// ── USERS (add new technician) ────────────────────────
function renderUsers(){
  const all=window._zakazky||[];
  const byTech={};
  all.forEach(z=>{
    const techList=z.technici&&z.technici.length
      ? z.technici
      : [{name:z.technik||'',email:z.technikEmail||z.technik||'?',uid:''}];
    techList.forEach(u=>{
      const t=u.email||u.name||u.uid||'?';
      if(!byTech[t])byTech[t]={name:u.name||z.technik||'',email:t,count:0,lastZ:''};
      byTech[t].count++;
      if(!byTech[t].lastZ||z.termin>byTech[t].lastZ)byTech[t].lastZ=z.termin;
    });
  });
  const entries=Object.values(byTech).sort((a,b)=>b.count-a.count);
  document.getElementById('user-list').innerHTML=entries.length
    ?entries.map(u=>`
      <div class="user-row">
        <div class="user-av">${(u.name||u.email||'?')[0].toUpperCase()}</div>
        <div class="user-info-cell">
          <div class="nm">${esc(u.name||u.email)}</div>
          <div class="em">${esc(u.email)}</div>
        </div>
        <div class="user-stats">
          <div style="font-size:13px;font-weight:700;color:var(--navy)">${u.count} zakázek</div>
          ${u.lastZ?`<div style="font-size:10px;color:var(--muted)">Naposledy: ${fmtD(u.lastZ)}</div>`:''}
        </div>
      </div>`).join('')
    :'<div style="font-size:12px;color:var(--muted)">Zatím žádné zakázky.</div>';
}

async function addUser(){
  const name=document.getElementById('nu-name').value.trim();
  const email=document.getElementById('nu-email').value.trim();
  const pass=document.getElementById('nu-pass').value;
  const pass2=document.getElementById('nu-pass2').value;
  const role=document.getElementById('nu-role')?.value||'technik';
  const firma=document.getElementById('nu-firma')?.value||'ac';
  const status=document.getElementById('add-status');
  status.style.color='var(--muted)';status.textContent='';
  if(!name||!email||!pass){status.textContent='Vyplňte jméno, e-mail a heslo.';status.style.color='var(--err)';return;}
  if(pass!==pass2){status.textContent='Hesla se neshodují.';status.style.color='var(--err)';return;}
  if(pass.length<6){status.textContent='Heslo musí mít alespoň 6 znaků.';status.style.color='var(--err)';return;}
  try{
    status.textContent='Přidávám uživatele...';
    const res = await fetch('/api/auth/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',
      body:JSON.stringify({email,password:pass,displayName:name,firma})
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error||'Chyba');
    // Nastav roli a schválení
    if(data.uid){
      await fetch('/api/users/'+data.uid,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({role,firma,approved:true,displayName:name})
      });
    }
    status.textContent='✓ Uživatel '+email+' byl přidán.';
    status.style.color='var(--green)';
    document.getElementById('nu-name').value='';
    document.getElementById('nu-email').value='';
    document.getElementById('nu-pass').value='';
    if(document.getElementById('nu-pass2'))document.getElementById('nu-pass2').value='';
    loadUsers && loadUsers();
  }catch(e){
    const msgs={'Duplicate entry':'E-mail je již registrován.','Email je již registrován':'E-mail je již registrován.'};
    status.textContent=msgs[e.message]||'Chyba: '+e.message;
    status.style.color='var(--err)';
  }
}

// ── BUILD PRINT VIEW ─────────────────────────────────



// ══════════════════════════════════════════════════════════════════════
//  PŘIDAT ZAKÁZKU — modal
// ══════════════════════════════════════════════════════════════════════

function openAddZakazkaModal() {
  const m = document.getElementById('modal-add-zakaz');
  if (!m) return;
  // Reset form
  ['az-nazev','az-cislo','az-zakaznik'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cb = document.getElementById('az-save-template');
  if (cb) cb.checked = true;
  const err = document.getElementById('az-err');
  if (err) err.style.display = 'none';
  const btn = document.getElementById('az-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Vytvořit zakázku'; }
  m.style.display = 'flex';
  setTimeout(() => document.getElementById('az-nazev')?.focus(), 80);
}

function closeAddZakazkaModal() {
  const m = document.getElementById('modal-add-zakaz');
  if (m) m.style.display = 'none';
}

// Close on backdrop click
document.addEventListener('click', e => {
  const m = document.getElementById('modal-add-zakaz');
  if (m && e.target === m) closeAddZakazkaModal();
});

async function submitAddZakazka() {
  const nazev = document.getElementById('az-nazev')?.value.trim();
  const cislo = document.getElementById('az-cislo')?.value.trim() || '';
  const zakaznik = document.getElementById('az-zakaznik')?.value.trim() || '';
  const saveTemplate = document.getElementById('az-save-template')?.checked;
  const err = document.getElementById('az-err');
  const btn = document.getElementById('az-btn');

  if (!nazev) {
    err.textContent = 'Zadejte název zakázky.';
    err.style.display = 'block';
    document.getElementById('az-nazev')?.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Ukládám…';
  err.style.display = 'none';

  try {
    // Create actual zakázka document
    const me = window._me;
    const adresa = document.getElementById('az-adresa')?.value.trim() || '';
    const ico = document.getElementById('az-ico')?.value.trim() || '';
    const dic = document.getElementById('az-dic')?.value.trim() || '';
    const firma = window._kCurrentFirma || 'aceuro';
    const data = {
      nazev, cislo, zakaznik, adresa, ico, dic, firma,
      technik: me?.displayName || me?.email || '—',
      technikUid: me?.uid || '',
      technikEmail: me?.email || '',
      termin: '', prace: '', pozn: '', komentar: '',
      duzp: '', pricesSkipped: true,
      rows: Array.from({length:8}, () => ({pol:'',poc:'',cen:'',cel:''})),
      exts: [
        {label:'Cestovní čas',poc:'',cen:'',cel:''},
        {label:'Celkem ujeté km',poc:'',cen:'',cel:''},
        {label:'Paušál cestovného',poc:'',cen:'',cel:''},
      ],
      cena: '',
      sig1: '', sig2: '', sd1: '', sd2: '',
      photos: [],
      stav: 'nová',
      createdAt: window._fb.serverTimestamp(),
      updatedAt: window._fb.serverTimestamp(),
      source: 'kancelar',
    };

    await window._fb.addDoc(
      window._fb.collection(window._fb.db, 'zakazky'), data
    );

    // Optionally also save to zakazky_typy (for technik dropdown)
    if (saveTemplate) {
      await window._fb.setDoc(
        window._fb.doc(window._fb.db, 'zakazky_typy',
          nazev.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,40) + '_' + Date.now()),
        { nazev, cislo, zakaznik, createdAt: window._fb.serverTimestamp() }
      );
    }

    closeAddZakazkaModal();
  } catch(e) {
    err.textContent = 'Chyba: ' + e.message;
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Vytvořit zakázku';
  }
}



// ══════════════════════════════════════════════════════════════════════
//  TYPY ZAKÁZEK — správa seznamu pro techniky
// ══════════════════════════════════════════════════════════════════════

let _zakazkyTypy = [];

async function loadZakazkyTypy() {
  const list = document.getElementById('zt-list');
  const count = document.getElementById('zt-count');
  if (!list) return;
  list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:12px;text-align:center">Načítám…</div>';
  try {
    const snap = await window._fb.getDocs(
      window._fb.query(
        window._fb.collection(window._fb.db, 'zakazky_typy'),
        window._fb.orderBy('nazev', 'asc')
      )
    );
    _zakazkyTypy = snap.docs.map(d => ({id: d.id, ...d.data()}));
    if (count) count.textContent = '(' + _zakazkyTypy.length + ')';
    renderZakazkyTypyList();
  } catch(e) {
    list.innerHTML = '<div style="color:#b91c1c;font-size:12px;padding:12px">Chyba: ' + e.message + '</div>';
  }
}

function renderZakazkyTypyList() {
  const list = document.getElementById('zt-list');
  if (!list) return;
  if (!_zakazkyTypy.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:20px;text-align:center">Žádné typy zakázek. Přidejte první.</div>';
    return;
  }
  list.innerHTML = _zakazkyTypy.map(z => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid var(--border);border-radius:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--n1)">${esc(z.nazev||'—')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">
          ${z.cislo?`<span>č. ${esc(z.cislo)}</span> · `:''}
          ${z.zakaznik?`<span>${esc(z.zakaznik)}</span>`:'<em>bez zákazníka</em>'}
        </div>
      </div>
      <button onclick="deleteZakazkaTyp('${z.id}')"
        style="padding:5px 10px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:6px;font-size:11px;cursor:pointer;flex-shrink:0">
        🗑 Smazat
      </button>
    </div>
  `).join('');
}

async function addZakazkaTyp() {
  const nazev = document.getElementById('zt-nazev')?.value.trim();
  const cislo = document.getElementById('zt-cislo')?.value.trim() || '';
  const zakaznik = document.getElementById('zt-zakaznik')?.value.trim() || '';
  const btn = document.getElementById('zt-add-btn');
  const status = document.getElementById('zt-status');

  if (!nazev) {
    status.textContent = '⚠ Zadejte název';
    status.style.color = '#b91c1c';
    document.getElementById('zt-nazev')?.focus();
    return;
  }

  btn.disabled = true; btn.textContent = 'Přidávám…';
  status.textContent = '';

  try {
    const docId = nazev.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,40) + '-' + Date.now();
    await window._fb.setDoc(
      window._fb.doc(window._fb.db, 'zakazky_typy', docId),
      { nazev, cislo, zakaznik, createdAt: window._fb.serverTimestamp() }
    );
    ['zt-nazev','zt-cislo','zt-zakaznik'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    status.textContent = '✓ Přidáno';
    status.style.color = 'var(--green)';
    setTimeout(() => { status.textContent = ''; }, 2500);
    await loadZakazkyTypy();
  } catch(e) {
    status.textContent = 'Chyba: ' + e.message;
    status.style.color = '#b91c1c';
  } finally {
    btn.disabled = false; btn.textContent = 'Přidat';
  }
}

async function deleteZakazkaTyp(id) {
  if (!confirm('Smazat tento typ zakázky ze seznamu?')) return;
  try {
    await window._fb.deleteDoc(window._fb.doc(window._fb.db, 'zakazky_typy', id));
    await loadZakazkyTypy();
  } catch(e) {
    alert('Chyba: ' + e.message);
  }
}



// ══ TECHNIK HISTORY ═════════════════════════════════════════════════
// ══ KANCELÁŘ FIRMA + ARES ═══════════════════════════════════════════
let _kCurrentFirma = 'aceuro';

function kSetFirma(firma) {
  _kCurrentFirma = firma;
  const btnAC = document.getElementById('kaz-btn-aceuro');
  const btnPR = document.getElementById('kaz-btn-progres');
  if(btnAC){
    const isAC = firma === 'aceuro';
    btnAC.style.border = isAC ? '2px solid #6abf3e' : '2px solid #d0d8e8';
    btnAC.style.background = isAC ? '#f0fff4' : '#fff';
    btnAC.style.color = isAC ? '#0f1f3d' : '#6b7a99';
    btnPR.style.border = !isAC ? '2px solid #1e90ff' : '2px solid #d0d8e8';
    btnPR.style.background = !isAC ? '#eff6ff' : '#fff';
    btnPR.style.color = !isAC ? '#0a3d8f' : '#6b7a99';
  }
}

let _kAresTimer = null;
function kAresDebounce(val) {
  clearTimeout(_kAresTimer);
  const dd = document.getElementById('az-ares-dropdown');
  const ld = document.getElementById('az-ares-loading');
  if (!val || val.length < 2) { if(dd)dd.style.display='none'; return; }
  if(ld)ld.style.display='block';
  _kAresTimer = setTimeout(() => kAresSearch(val,'az'), 500);
}

async function kAresSearch(query, prefix) {
  const dropdown = document.getElementById(prefix+'-ares-dropdown');
  const loading = document.getElementById(prefix+'-ares-loading');
  if(!dropdown) return;
  try {
    const isICO = /^\d{6,8}$/.test(query.trim());
    const url = isICO
      ? `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${query.trim()}`
      : `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr?nazev=${encodeURIComponent(query)}&pocet=8&razeni=NAZEV`;
    const res = await fetch(url);
    if(!res.ok) throw new Error();
    const data = await res.json();
    let items = isICO && data.ico ? [data] : (data.ekonomickeSubjekty || []);
    if(!items.length){
      dropdown.innerHTML='<div style="padding:10px 12px;font-size:12px;color:#6b7a99">Nic nenalezeno</div>';
    } else {
      dropdown.innerHTML = items.map(s => {
        const ico=s.ico||'',nazev=s.obchodniJmeno||s.nazev||'';
        const adresa=kFormatAresAddr(s);
        return `<div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7;font-family:inherit"
          onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
          onclick='kAresSelect(${JSON.stringify({ico,nazev,adresa,dic:s.dic||""})}, "${prefix}")'>
          <div style="font-size:13px;font-weight:600;color:#1a2540">${esc(nazev)}</div>
          <div style="font-size:11px;color:#6b7a99">IČO: ${ico}${adresa?' · '+adresa:''}</div>
        </div>`;
      }).join('');
    }
    dropdown.style.display='block';
  } catch(e) {
    dropdown.innerHTML='<div style="padding:10px 12px;font-size:12px;color:#6b7a99">ARES nedostupný</div>';
    dropdown.style.display='block';
  }
  if(loading)loading.style.display='none';
}

function kFormatAresAddr(s) {
  if(!s.sidlo) return '';
  const sid=s.sidlo;
  return [
    sid.nazevUlice?(sid.nazevUlice+(sid.cisloDomovni?' '+sid.cisloDomovni:'')+(sid.cisloOrientacni?'/'+sid.cisloOrientacni:'')):'',
    sid.nazevObce||'',
    sid.psc?String(sid.psc).replace(/(\d{3})(\d{2})/,'$1 $2'):''
  ].filter(Boolean).join(', ');
}

function kAresSelect(s, prefix) {
  const setV=(id,v)=>{const el=document.getElementById(prefix+'-'+id);if(el)el.value=v;};
  setV('zakaznik',s.nazev);
  setV('adresa',s.adresa);
  setV('ico',s.ico);
  setV('dic',s.dic);
  const dd=document.getElementById(prefix+'-ares-dropdown');
  if(dd)dd.style.display='none';
}

document.addEventListener('click', e => {
  if(!e.target.closest('#az-ares-dropdown')&&!e.target.matches('#az-zakaznik')){
    const d=document.getElementById('az-ares-dropdown');
    if(d)d.style.display='none';
  }
});

function loadHistorie(){
  const zakazky = window._zakazky || [];
  // Build technik list
  const techSet = new Set();
  zakazky.forEach(z => {
    if(z.technik) techSet.add(z.technik);
    if(z.assignedTo) techSet.add(z.assignedTo);
  });
  const sel = document.getElementById('hist-technik-sel');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Všichni technici —</option>' +
    [...techSet].sort().map(t => `<option value="${esc(t)}"${cur===t?' selected':''}>${esc(t)}</option>`).join('');
  renderHistorie();
}

function renderHistorie(){
  const zakazky = window._zakazky || [];
  const techFilter = document.getElementById('hist-technik-sel')?.value || '';
  const days = parseInt(document.getElementById('hist-period-sel')?.value || '0');
  const now = Date.now();
  const cutoff = days > 0 ? now - days * 86400000 : 0;

  // Filter
  let filtered = zakazky.filter(z => {
    const matchTech = !techFilter || z.technik === techFilter || z.assignedTo === techFilter;
    const ts = z.createdAt?.toDate ? z.createdAt.toDate().getTime() :
                z.createdAt ? new Date(z.createdAt).getTime() : 0;
    const matchTime = cutoff === 0 || ts >= cutoff;
    return matchTech && matchTime;
  });

  // Sort newest first
  filtered.sort((a,b) => {
    const ta = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt||0);
    const tb = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt||0);
    return tb - ta;
  });

  // ── Stats cards ───────────────────────────────────────────────────
  const stavCounts = {};
  filtered.forEach(z => { const s = z.stav||'nová'; stavCounts[s] = (stavCounts[s]||0)+1; });
  const totalCena = filtered.reduce((sum,z) => {
    const v = parseFloat((z.cena||'').replace(/[^\d,.]/g,'').replace(',','.')) || 0;
    return sum + v;
  }, 0);

  const stavColors = {
    'nová':'#f0a500','ke zpracování':'#2d5fa6','rozpracovaná':'#d97706',
    'zpracovaná':'#16a34a','fakturovaná':'#7c3aed'
  };
  const cards = [
    {label:'Celkem zakázek', value:filtered.length, icon:'📋', color:'#2d5fa6'},
    {label:'Zpracovaných', value:(stavCounts['zpracovaná']||0)+(stavCounts['fakturovaná']||0), icon:'✅', color:'#16a34a'},
    {label:'Rozpracovaných', value:stavCounts['rozpracovaná']||0, icon:'🔧', color:'#d97706'},
    {label:'Fakturováno', value:stavCounts['fakturovaná']||0, icon:'🧾', color:'#7c3aed'},
    {label:'Tržby (bez DPH)', value:totalCena>0?fmt(totalCena)+' Kč':'—', icon:'💰', color:'#16a34a', wide:true},
  ];

  document.getElementById('hist-stats').innerHTML = cards.map(c => `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:14px 16px;${c.wide?'grid-column:span 2;':''}">
      <div style="font-size:18px;margin-bottom:4px">${c.icon}</div>
      <div style="font-size:22px;font-weight:700;color:${c.color}">${c.value}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.label}</div>
    </div>`).join('');

  // ── Timeline ──────────────────────────────────────────────────────
  if(!filtered.length){
    document.getElementById('hist-timeline').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">Žádné zakázky v tomto období</div>';
    return;
  }

  // Group by month
  const byMonth = {};
  filtered.forEach(z => {
    const d = z.createdAt?.toDate ? z.createdAt.toDate() : new Date(z.createdAt||Date.now());
    const key = d.getFullYear()+'-'+(d.getMonth()+1).toString().padStart(2,'0');
    const label = d.toLocaleDateString('cs-CZ',{month:'long',year:'numeric'});
    if(!byMonth[key]) byMonth[key] = {label, items:[]};
    byMonth[key].items.push({...z, _date:d});
  });

  const stavIcon = {'nová':'🆕','ke zpracování':'👁','rozpracovaná':'🔧','zpracovaná':'✅','fakturovaná':'🧾'};

  let html = '';
  Object.keys(byMonth).sort().reverse().forEach(key => {
    const {label, items} = byMonth[key];
    html += `<div style="margin-bottom:24px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);letter-spacing:.05em;text-transform:uppercase;padding:6px 0;border-bottom:2px solid var(--border);margin-bottom:10px">${label} <span style="font-weight:400;color:var(--muted)">(${items.length})</span></div>
      ${items.map(z => {
        const stav = z.stav||'nová';
        const col = stavColors[stav] || '#6b7a99';
        const dateStr = z._date.toLocaleDateString('cs-CZ',{day:'2-digit',month:'2-digit',year:'numeric'});
        return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;transition:box-shadow .15s"
          onclick="openDetail('${z.id}')"
          onmouseenter="this.style.boxShadow='0 2px 8px rgba(15,31,61,.1)'"
          onmouseleave="this.style.boxShadow=''">
          <div style="width:34px;height:34px;border-radius:8px;background:${col}20;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${stavIcon[stav]||'📋'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(z.nazev||'—')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">
              ${esc(z.cislo||'')}${z.cislo&&z.zakaznik?' · ':''}${esc(z.zakaznik||'')}
            </div>
            ${z.zadani?`<div style="font-size:11px;color:#1d4ed8;margin-top:3px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📋 ${esc(z.zadani.substring(0,60))}${z.zadani.length>60?'…':''}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:11px;font-weight:600;color:${col};background:${col}15;padding:2px 8px;border-radius:20px;white-space:nowrap">${stav}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:4px">${dateStr}</div>
            ${z.cena?`<div style="font-size:11px;font-weight:600;color:var(--navy);margin-top:2px">${esc(z.cena)}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  });

  document.getElementById('hist-timeline').innerHTML = html;
}

// ══ PHOTO CAPTION SAVE ══════════════════════════════════════════════
async function savePhotoCaption(zakazkaId, photoIndex, caption) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if (!z || !z.photos) return;
  // Update local cache
  z.photos[photoIndex].caption = caption;
  // Save to Firestore
  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
      { photos: z.photos, updatedAt: window._fb.serverTimestamp() }
    );
  } catch(e) {
    console.warn('Caption save failed:', e.message);
  }
}



// ── Registrace ARES outside-click ──────────────────────────────
document.addEventListener('click', e => {
  if(!e.target.closest('#az-ares-dropdown')&&!e.target.matches('#az-zakaznik')){
    const dd=document.getElementById('az-ares-dropdown');
    if(dd)dd.style.display='none';
  }
});
