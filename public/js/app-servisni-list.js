// ════════════════════════════════════════════════════════════════
//  SERVISNÍ LIST Z KANCELÁŘE  — kompletní logika
// ════════════════════════════════════════════════════════════════

// --- stav modalu ---
window._slStep    = 0;
window._slId      = null;   // id zakázky, ze které vycházíme (může být null)
window._slFirma   = 'aceuro';
window._slPhotos  = [];     // [{dataUrl, name, caption, printInclude}]
window._slSigData = {1: null, 2: null};
let _slCtx = null, _slDrawing = false, _slLx = 0, _slLy = 0, _slActiveSig = null;
let _slAresTimer = null;

// --- pomocné ---
function slGv(id){ return document.getElementById(id)?.value || ''; }
function slSv(id, v){ const el = document.getElementById(id); if(el) el.value = v; }

// ── Otevřít modal ──────────────────────────────────────────────
function openServiceListModal(id) {
  window._slId = id || null;
  window._slPhotos  = [];
  window._slSigData = {1: null, 2: null};

  // Předvyplň z existující zakázky
  if(id) {
    const z = (window._zakazky || []).find(x => x.id === id);
    if(z) {
      slSv('sl-nazev-inp', z.nazev || '');
      slSv('sl-cislo',     z.cislo || '');
      slSv('sl-zakaznik',  z.zakaznik || '');
      slSv('sl-adresa',    z.adresa || '');
      slSv('sl-ico',       z.ico || '');
      slSv('sl-dic',       z.dic || '');
      slSv('sl-technik',   z.technik || (window._currentUser?.displayName || window._currentUser?.email || ''));
      slSv('sl-termin',    z.termin || '');
      slSv('sl-sd1',       z.sd1 || '');
      slSv('sl-sd2',       z.sd2 || '');
      slSv('sl-prace',     z.prace || '');
      slSv('sl-pozn',      z.pozn || '');
      slSv('sl-komentar',  z.komentar || '');
      slSv('sl-duzp',      z.duzp || '');

      // Položky (rows)
      const rows = z.rows || [];
      for(let i = 1; i <= 8; i++) {
        const r = rows[i-1] || {};
        slSv('sl-pol'+i, r.pol || '');
        slSv('sl-poc'+i, r.poc || '');
        slSv('sl-cen'+i, r.cen || '');
        slSv('sl-cel'+i, r.cel || '');
      }
      // Ext (cestovné)
      const exts = z.exts || [];
      for(let i = 1; i <= 3; i++) {
        const e = exts[i-1] || {};
        slSv('sl-elab'+i, e.label || EXT_LABELS[i-1]);
        slSv('sl-epoc'+i, e.poc || '');
        slSv('sl-ecen'+i, e.cen || '');
        slSv('sl-ecel'+i, e.cel || '');
      }
      slCalcFromZ(z);

      // Fotky z zakázky
      if(z.photos && z.photos.length) {
        window._slPhotos = z.photos.map(p => ({
          dataUrl: p.cloudUrl || p.dataUrl || '',
          name:    p.name || '',
          caption: p.caption || '',
          printInclude: p.printInclude !== false
        }));
        slRenderPhotos();
      }

      // Firma
      slSetFirma(z.firma || 'aceuro');
    }
  } else {
    // Nový list — reset polí
    ['sl-nazev-inp','sl-cislo','sl-zakaznik','sl-adresa','sl-ico','sl-dic',
     'sl-termin','sl-sd1','sl-sd2','sl-prace','sl-pozn','sl-komentar','sl-duzp'].forEach(id => slSv(id,''));
    for(let i=1;i<=8;i++){slSv('sl-pol'+i,'');slSv('sl-poc'+i,'');slSv('sl-cen'+i,'');slSv('sl-cel'+i,'');}
    for(let i=1;i<=3;i++){slSv('sl-elab'+i,EXT_LABELS[i-1]);slSv('sl-epoc'+i,'');slSv('sl-ecen'+i,'');slSv('sl-ecel'+i,'');}
    slSv('sl-technik', window._currentUser?.displayName || window._currentUser?.email || '');
    slSetFirma('aceuro');
    document.getElementById('sl-total').textContent = '—';
    slRenderPhotos();
  }

  document.getElementById('sl-modal').classList.add('open');
  slGoTo(0);
  slSetupCanvases();
}

function closeServiceListModal() {
  document.getElementById('sl-modal').classList.remove('open');
  window._slStep = 0;
}

// ── Navigace ──────────────────────────────────────────────────
function slGoTo(n) {
  const MAX = 6;
  n = Math.max(0, Math.min(MAX, n));
  window._slStep = n;

  document.querySelectorAll('.sl-panel').forEach((p, i) => {
    p.classList.toggle('sl-active', i === n);
  });
  document.querySelectorAll('.sl-dot').forEach((dot, i) => {
    dot.classList.toggle('sl-dot-active', i === n);
    dot.classList.toggle('sl-dot-done', i < n);
  });

  const prev = document.getElementById('sl-btn-prev');
  const next = document.getElementById('sl-btn-next');
  const label = document.getElementById('sl-step-label');

  if(prev) prev.style.visibility = n === 0 ? 'hidden' : 'visible';
  if(label) label.textContent = `Krok ${n+1} z ${MAX+1}`;
  if(next) {
    if(n === MAX) {
      next.textContent = '✓ Hotovo';
      next.onclick = () => closeServiceListModal();
    } else {
      next.textContent = 'Pokračovat →';
      next.onclick = () => slGoTo(window._slStep + 1);
    }
  }

  // Při přechodu na krok 6 připrav souhrn
  if(n === MAX) slBuildSummary();

  // Přejdi nahoru
  const body = document.getElementById('sl-modal');
  if(body) body.scrollTop = 0;
}

// ── Volba firmy ───────────────────────────────────────────────
function slSetFirma(firma) {
  window._slFirma = firma;
  const btnA = document.getElementById('sl-btn-aceuro');
  const btnP = document.getElementById('sl-btn-progres');
  const dot  = document.getElementById('sl-brand-dot');
  if(btnA) {
    btnA.style.borderColor  = firma === 'aceuro' ? '#6abf3e' : '#d0d8e8';
    btnA.style.background   = firma === 'aceuro' ? '#f0fff4' : '#fff';
    btnA.style.color        = firma === 'aceuro' ? '#0f1f3d' : '#6b7a99';
  }
  if(btnP) {
    btnP.style.borderColor  = firma === 'progres' ? '#1e90ff' : '#d0d8e8';
    btnP.style.background   = firma === 'progres' ? '#eff6ff' : '#fff';
    btnP.style.color        = firma === 'progres' ? '#0a3d8f' : '#6b7a99';
  }
  if(dot) dot.style.background = firma === 'progres' ? '#1e90ff' : '#6abf3e';
}

// ── ARES (pro sl-zakaznik) ───────────────────────────────────
function slAresDebounce(val) {
  clearTimeout(_slAresTimer);
  if(val.length < 2) { const dd=document.getElementById('sl-ares-dd'); if(dd)dd.style.display='none'; return; }
  _slAresTimer = setTimeout(() => slAresSearch(val), 400);
}

async function slAresSearch(query) {
  const dd = document.getElementById('sl-ares-dd');
  if(!dd) return;
  dd.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#6b7a99">🔍 Hledám…</div>';
  dd.style.display = 'block';
  try {
    const isICO = /^\d{6,8}$/.test(query.trim());
    const url = isICO
      ? `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${query.trim()}`
      : `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr?nazev=${encodeURIComponent(query)}&pocet=8`;
    const res = await fetch(url);
    if(!res.ok) throw new Error();
    const data = await res.json();
    const items = isICO && data.ico ? [data] : (data.ekonomickeSubjekty || []);
    if(!items.length) {
      dd.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#6b7a99">Nic nenalezeno</div>';
    } else {
      dd.innerHTML = items.map(s => {
        const ico = s.ico || '', nazev = s.obchodniJmeno || s.nazev || '';
        const adr = slFmtAresAddr(s);
        const dic = s.dic || '';
        return `<div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7"
          onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
          onclick='slAresSelect(${JSON.stringify({ico,nazev,adresa:adr,dic})})'>
          <div style="font-size:13px;font-weight:600;color:#1a2540">${esc(nazev)}</div>
          <div style="font-size:11px;color:#6b7a99">IČO: ${ico}${adr?' · '+adr:''}</div>
        </div>`;
      }).join('');
    }
  } catch(e) {
    dd.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#6b7a99">ARES nedostupný</div>';
  }
}

function slFmtAresAddr(s) {
  const a = s.sidlo || {};
  return [a.nazevUlice||'', a.cisloDomovni||'', (a.psc||'').replace(/(\d{3})(\d{2})/,'$1 $2'), a.nazevObce||''].filter(Boolean).join(' ');
}

function slAresSelect(obj) {
  slSv('sl-zakaznik', obj.nazev);
  slSv('sl-adresa', obj.adresa);
  slSv('sl-ico', obj.ico);
  slSv('sl-dic', obj.dic);
  const dd = document.getElementById('sl-ares-dd');
  if(dd) dd.style.display = 'none';
}

// Zavři ARES dropdown při kliku mimo
document.addEventListener('click', e => {
  if(!e.target.closest('#sl-ares-dd') && !e.target.matches('#sl-zakaznik')) {
    const dd = document.getElementById('sl-ares-dd');
    if(dd) dd.style.display = 'none';
  }
});

// ── Kalkulace cen ─────────────────────────────────────────────
function slCalc() {
  let total = 0;
  for(let i=1;i<=8;i++){
    const poc = parseFloat(document.getElementById('sl-poc'+i)?.value||0)||0;
    const cen = parseFloat(document.getElementById('sl-cen'+i)?.value||0)||0;
    const cel = poc && cen ? +(poc*cen).toFixed(2) : 0;
    const el = document.getElementById('sl-cel'+i);
    if(el) el.value = cel || '';
    total += cel;
  }
  for(let i=1;i<=3;i++){
    const poc = parseFloat(document.getElementById('sl-epoc'+i)?.value||0)||0;
    const cen = parseFloat(document.getElementById('sl-ecen'+i)?.value||0)||0;
    const cel = poc && cen ? +(poc*cen).toFixed(2) : 0;
    const el = document.getElementById('sl-ecel'+i);
    if(el) el.value = cel || '';
    total += cel;
  }
  const el = document.getElementById('sl-total');
  if(el) el.textContent = total ? total.toFixed(2) + ' Kč' : '—';
}

function slCalcFromZ(z) {
  // Přepočítej ze zakázky (pro případ že nemáme DOM ještě)
  let total = 0;
  (z.rows||[]).forEach(r => { const c = parseFloat(r.cel)||0; total += c; });
  (z.exts||[]).forEach(e => { const c = parseFloat(e.cel)||0; total += c; });
  const el = document.getElementById('sl-total');
  if(el) el.textContent = z.cena || (total ? total.toFixed(2)+' Kč' : '—');
}

// ── Fotky ─────────────────────────────────────────────────────
function slAddPhotos(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      window._slPhotos.push({dataUrl: e.target.result, name: file.name, caption: '', printInclude: true});
      slRenderPhotos();
    };
    reader.readAsDataURL(file);
  });
}

function slHandleDrop(e) {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files||[])].filter(f => f.type.startsWith('image/'));
  slAddPhotos(files);
}

function slRenderPhotos() {
  const grid = document.getElementById('sl-photos-grid');
  if(!grid) return;
  if(!window._slPhotos.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = window._slPhotos.map((p,i) => `
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#fff">
      <div style="position:relative;aspect-ratio:4/3;overflow:hidden">
        <img src="${p.dataUrl}" style="width:100%;height:100%;object-fit:cover;display:block">
        <button onclick="slRemovePhoto(${i})"
          style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);border:none;color:#fff;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
      </div>
      <div style="padding:5px 8px;background:#fafbfc;border-top:1px solid #f0f2f6">
        <input value="${esc(p.caption)}" placeholder="Popis…"
          style="width:100%;border:none;outline:none;font-size:10.5px;font-family:inherit;background:transparent"
          onchange="slPhotoCaption(${i},this.value)">
        <label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);margin-top:2px;cursor:pointer">
          <input type="checkbox" ${p.printInclude?'checked':''} onchange="slPhotoToggle(${i},this.checked)" style="width:11px;height:11px">
          Tisknout
        </label>
      </div>
    </div>`).join('');
}

function slRemovePhoto(i)  { window._slPhotos.splice(i,1); slRenderPhotos(); }
function slPhotoCaption(i,v){ window._slPhotos[i].caption = v; }
function slPhotoToggle(i,v) { window._slPhotos[i].printInclude = v; }

// ── Podpisy ───────────────────────────────────────────────────
function slSetupCanvases() {
  [1,2].forEach(idx => {
    const canvas = document.getElementById('sl-sig'+idx);
    if(!canvas) return;
    // Nastav rozměry na skutečnou velikost
    setTimeout(() => {
      canvas.width  = canvas.offsetWidth  || 300;
      canvas.height = canvas.offsetHeight || 150;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Překresli existující podpis
      if(window._slSigData[idx]) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = window._slSigData[idx];
      }
      slBindCanvas(canvas, idx);
    }, 100);
  });
}

function slBindCanvas(canvas, idx) {
  let drawing = false, lx = 0, ly = 0;
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width/r.width, sy = canvas.height/r.height;
    if(e.touches) return {x:(e.touches[0].clientX-r.left)*sx, y:(e.touches[0].clientY-r.top)*sy};
    return {x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy};
  }
  canvas.onmousedown = canvas.ontouchstart = e => {
    e.preventDefault(); drawing = true;
    const p = pos(e); lx = p.x; ly = p.y;
  };
  canvas.onmousemove = canvas.ontouchmove = e => {
    if(!drawing) return; e.preventDefault();
    const ctx = canvas.getContext('2d');
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(p.x,p.y);
    ctx.strokeStyle='#0f1f3d'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke();
    lx = p.x; ly = p.y;
  };
  canvas.onmouseup = canvas.ontouchend = canvas.onmouseleave = () => {
    if(drawing) {
      drawing = false;
      window._slSigData[idx] = canvas.toDataURL();
    }
  };
}

function slClearSig(idx) {
  window._slSigData[idx] = null;
  const canvas = document.getElementById('sl-sig'+idx);
  if(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ── Vstup na krok 5 — inicializuj canvasy ──────────────────
// (přepíšeme slGoTo aby zavolal setup při kroku 5)
const _slGoToOrig = slGoTo;
// (setup se volá přes setTimeout v slSetupCanvases, voláme při openModal)

// ── Souhrn (krok 6) ────────────────────────────────────────
function slBuildSummary() {
  const el = document.getElementById('sl-summary');
  if(!el) return;
  const firma = (FIRMA_DATA || {})[window._slFirma] || {};
  const rows = [];
  for(let i=1;i<=8;i++){
    const pol=slGv('sl-pol'+i);
    if(pol) rows.push({pol,poc:slGv('sl-poc'+i),cel:slGv('sl-cel'+i)});
  }
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12px">
      <div><span style="color:var(--muted)">Firma:</span> <strong>${esc(firma.name||'—')}</strong></div>
      <div><span style="color:var(--muted)">Zákazník:</span> <strong>${esc(slGv('sl-zakaznik')||'—')}</strong></div>
      <div><span style="color:var(--muted)">Zakázka:</span> <strong>${esc(slGv('sl-nazev-inp')||'—')}</strong></div>
      <div><span style="color:var(--muted)">Technik:</span> <strong>${esc(slGv('sl-technik')||'—')}</strong></div>
      <div><span style="color:var(--muted)">Datum zahájení:</span> <strong>${fmtD(slGv('sl-sd1'))||'—'}</strong></div>
      <div><span style="color:var(--muted)">Datum ukončení:</span> <strong>${fmtD(slGv('sl-sd2'))||'—'}</strong></div>
      <div><span style="color:var(--muted)">Celkem bez DPH:</span> <strong style="color:#6abf3e">${document.getElementById('sl-total')?.textContent||'—'}</strong></div>
      <div><span style="color:var(--muted)">Fotografie:</span> <strong>${window._slPhotos.length} ks</strong></div>
      <div><span style="color:var(--muted)">Podpis technika:</span> <strong>${window._slSigData[1]?'✓ Podepsáno':'—'}</strong></div>
      <div><span style="color:var(--muted)">Podpis zákazníka:</span> <strong>${window._slSigData[2]?'✓ Podepsáno':'—'}</strong></div>
    </div>
    ${rows.length ? `<div style="margin-top:10px;font-size:11px;color:var(--muted)">${rows.length} položek</div>` : ''}
  `;
}

// ── Sestavení dat pro buildPrintView ──────────────────────────
function slGetData() {
  const rows = [];
  for(let i=1;i<=8;i++) rows.push({
    pol: slGv('sl-pol'+i), poc: slGv('sl-poc'+i),
    cen: slGv('sl-cen'+i), cel: slGv('sl-cel'+i)
  });
  const exts = [];
  for(let i=1;i<=3;i++) exts.push({
    label: slGv('sl-elab'+i)||EXT_LABELS[i-1],
    poc: slGv('sl-epoc'+i), cen: slGv('sl-ecen'+i), cel: slGv('sl-ecel'+i)
  });
  const inclPhotos = document.getElementById('sl-print-photos')?.checked || false;
  return {
    nazev:    slGv('sl-nazev-inp'),
    cislo:    slGv('sl-cislo'),
    zakaznik: slGv('sl-zakaznik'),
    adresa:   slGv('sl-adresa'),
    ico:      slGv('sl-ico'),
    dic:      slGv('sl-dic'),
    technik:  slGv('sl-technik'),
    termin:   slGv('sl-termin'),
    sd1:      fmtD(slGv('sl-sd1')),
    sd2:      fmtD(slGv('sl-sd2')),
    prace:    slGv('sl-prace'),
    pozn:     slGv('sl-pozn'),
    duzp:     slGv('sl-duzp'),
    firma:    window._slFirma,
    rows, exts,
    cena:     document.getElementById('sl-total')?.textContent || '',
    sig1:     window._slSigData[1] || '',
    sig2:     window._slSigData[2] || '',
    photos:   window._slPhotos,
    showPrices:   true,
    includePhotos: inclPhotos
  };
}

// ── Tisk ──────────────────────────────────────────────────────
function slPrint() {
  const data = slGetData();
  const pv = buildPrintView(data);
  const pc = document.getElementById('print-container');
  pc.innerHTML = ''; pc.appendChild(pv);
  generatePDF({ filename: 'servisni-list.pdf' });
}

// ── Uložit do zakázky a tisknout ─────────────────────────────
async function slSaveAndPrint() {
  const data = slGetData();
  const statusEl = document.getElementById('sl-save-status');
  if(statusEl) statusEl.textContent = '⏳ Ukládám…';

  if(window._slId) {
    // Aktualizuj existující zakázku
    try {
      const patch = {
        prace:    data.prace,
        pozn:     data.pozn,
        rows:     data.rows,
        exts:     data.exts,
        cena:     data.cena,
        duzp:     data.duzp,
        sd1:      slGv('sl-sd1'),
        sd2:      slGv('sl-sd2'),
        sig1:     data.sig1,
        sig2:     data.sig2,
        updatedAt: window._fb.serverTimestamp()
      };
      // Přidej fotky pouze pokud jsou nové (lokální dataUrl)
      const newPhotos = window._slPhotos.filter(p => p.dataUrl.startsWith('data:'));
      if(newPhotos.length) patch.photos = window._slPhotos;

      await window._fb.updateDoc(
        window._fb.doc(window._fb.db, 'zakazky', window._slId), patch
      );
      if(statusEl) statusEl.textContent = '✓ Uloženo';
    } catch(e) {
      if(statusEl) statusEl.textContent = '⚠ Chyba uložení: ' + e.message;
    }
  }

  slPrint();
}

// ════════════════════════════════════════════════════════════════
//  SERVISNÍ LIST — autocomplete pro Zákazník a Technik
// ════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────
function slShowDd(ddId, items, onSelect) {
  const dd = document.getElementById(ddId);
  if(!dd) return;
  if(!items.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = items.map(item => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7;font-size:13px"
      onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
      onclick="(${onSelect.toString()})(${JSON.stringify(item)})">
      ${item.html || esc(item.label)}
    </div>`).join('');
  dd.style.display = 'block';
}

function slHideDd(ddId) {
  const dd = document.getElementById(ddId);
  if(dd) dd.style.display = 'none';
}

// Zavři dropdowny při kliku mimo
document.addEventListener('click', e => {
  if(!e.target.closest('#sl-technik-dd') && !e.target.matches('#sl-technik'))
    slHideDd('sl-technik-dd');
  if(!e.target.closest('#sl-ares-dd') && !e.target.matches('#sl-zakaznik'))
    slHideDd('sl-ares-dd');
});

// ── TECHNIK autocomplete ──────────────────────────────────────
// Čerpá z window._techList (Firestore users) + unikátní jména z zakázek

function slGetTechnikList() {
  // Z Firestore users list (načteno v loadTechList)
  const fromUsers = (window._techList || []).map(u => ({
    label: u.name || u.email || u.uid,
    sub:   u.email || '',
    uid:   u.uid
  }));
  // Záloha z existujících zakázek (pokud _techList prázdný)
  const fromZak = [...new Set(
    (window._zakazky || []).map(z => z.technik || '').filter(Boolean)
  )].map(n => ({ label: n, sub: '' }));
  // Sloučit — preferovat Firestore
  const names = new Set(fromUsers.map(u => u.label));
  const extra = fromZak.filter(u => !names.has(u.label));
  return [...fromUsers, ...extra];
}

function slTechnikInput(val) {
  const list = slGetTechnikList();
  const q = (val || '').toLowerCase().trim();
  const filtered = q
    ? list.filter(u => u.label.toLowerCase().includes(q) || u.sub.toLowerCase().includes(q))
    : list;
  if(!filtered.length) { slHideDd('sl-technik-dd'); return; }
  const items = filtered.slice(0, 10).map(u => ({
    label: u.label,
    html: `<span style="font-weight:600;color:#1a2540">${esc(u.label)}</span>` +
          (u.sub ? `<br><span style="font-size:11px;color:#6b7a99">${esc(u.sub)}</span>` : '')
  }));
  // Při kliku vyplníme pole a zavřeme dropdown
  const dd = document.getElementById('sl-technik-dd');
  if(!dd) return;
  dd.innerHTML = filtered.slice(0, 10).map(u => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7"
      onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
      onclick="slTechnikSelect(${JSON.stringify(u.label)})">
      <span style="font-weight:600;color:#1a2540">${esc(u.label)}</span>
      ${u.sub ? `<br><span style="font-size:11px;color:#6b7a99">${esc(u.sub)}</span>` : ''}
    </div>`).join('');
  dd.style.display = 'block';
}

function slTechnikSelect(name) {
  document.getElementById('sl-technik').value = name;
  slHideDd('sl-technik-dd');
}

// ── ZÁKAZNÍK autocomplete (history + ARES) ────────────────────

let _slZakTimer = null;

function slZakaznikInput(val) {
  clearTimeout(_slZakTimer);
  const q = (val || '').trim();

  // Okamžitě ukáž historické návrhy
  slShowZakHistory(q);

  // Po 500ms spusť ARES pokud zadáno dost znaků
  if(q.length >= 2) {
    _slZakTimer = setTimeout(() => slAresSearch(q), 500);
  }
}

function slShowZakHistory(q) {
  const dd = document.getElementById('sl-ares-dd');
  if(!dd) return;

  // Unikátní zákazníci ze zakázek
  const all = [...new Map(
    (window._zakazky || [])
      .filter(z => z.zakaznik)
      .map(z => [z.zakaznik, {
        nazev:  z.zakaznik,
        adresa: z.adresa || '',
        ico:    z.ico    || '',
        dic:    z.dic    || ''
      }])
  ).values()];

  const ql = q.toLowerCase();
  const filtered = q
    ? all.filter(z => z.nazev.toLowerCase().includes(ql) || z.ico.includes(ql))
    : all;

  if(!filtered.length) {
    // Nic v historii — počkáme na ARES nebo skryjeme
    if(!q) { dd.style.display = 'none'; }
    return;
  }

  dd.innerHTML =
    `<div style="padding:5px 12px 3px;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;background:#f8fafc;border-bottom:1px solid #f0f2f7">
       📋 Dříve použití zákazníci
     </div>` +
    filtered.slice(0, 8).map(z => `
      <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7"
        onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
        onclick='slZakSelect(${JSON.stringify(z)})'>
        <span style="font-weight:600;color:#1a2540">${esc(z.nazev)}</span>
        ${z.ico ? `<br><span style="font-size:11px;color:#6b7a99">IČO: ${esc(z.ico)}${z.adresa?' · '+esc(z.adresa):''}</span>` : ''}
      </div>`).join('');

  dd.style.display = 'block';
}

function slZakSelect(obj) {
  document.getElementById('sl-zakaznik').value = obj.nazev || '';
  if(obj.adresa) document.getElementById('sl-adresa').value  = obj.adresa;
  if(obj.ico)    document.getElementById('sl-ico').value     = obj.ico;
  if(obj.dic)    document.getElementById('sl-dic').value     = obj.dic;
  slHideDd('sl-ares-dd');
}

// Přepíšeme slAresSelect aby taky plnila adresu
function slAresSelect(obj) {
  document.getElementById('sl-zakaznik').value = obj.nazev || '';
  document.getElementById('sl-adresa').value   = obj.adresa || '';
  document.getElementById('sl-ico').value      = obj.ico   || '';
  document.getElementById('sl-dic').value      = obj.dic   || '';
  slHideDd('sl-ares-dd');
}

// Přepíšeme slAresSearch aby zobrazil nadpis sekce pro ARES výsledky
const _slAresSearchOrig = slAresSearch;
slAresSearch = async function(query) {
  const dd = document.getElementById('sl-ares-dd');
  if(!dd) return;

  // Zachovej historické návrhy + přidej loading pro ARES
  const histHtml = dd.innerHTML;
  const aresHeader = `<div style="padding:5px 12px 3px;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;background:#f8fafc;border-bottom:1px solid #f0f2f7;margin-top:2px">
    🔍 Vyhledávání ARES…
  </div>`;
  dd.innerHTML = histHtml + aresHeader;
  dd.style.display = 'block';

  try {
    const isICO = /^\d{6,8}$/.test(query.trim());
    const url = isICO
      ? `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${query.trim()}`
      : `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr?nazev=${encodeURIComponent(query)}&pocet=6`;
    const res = await fetch(url);
    if(!res.ok) throw new Error();
    const data = await res.json();
    const items = isICO && data.ico ? [data] : (data.ekonomickeSubjekty || []);

    if(!items.length) {
      dd.innerHTML = histHtml; // zpět jen historické
      return;
    }

    const aresHtml =
      `<div style="padding:5px 12px 3px;font-size:10px;font-weight:700;color:#6b7a99;text-transform:uppercase;letter-spacing:.07em;background:#f8fafc;border-bottom:1px solid #f0f2f7;margin-top:2px">
         📡 ARES
       </div>` +
      items.map(s => {
        const ico = s.ico || '', nazev = s.obchodniJmeno || s.nazev || '';
        const adr = slFmtAresAddr(s);
        const dic = s.dic || '';
        return `<div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7"
          onmouseenter="this.style.background='#eff6ff'" onmouseleave="this.style.background=''"
          onclick='slAresSelect(${JSON.stringify({ico,nazev,adresa:adr,dic})})'>
          <span style="font-weight:600;color:#1a2540">${esc(nazev)}</span>
          <br><span style="font-size:11px;color:#6b7a99">IČO: ${ico}${adr?' · '+adr:''}</span>
        </div>`;
      }).join('');

    dd.innerHTML = histHtml + aresHtml;
    dd.style.display = 'block';
  } catch(e) {
    // ARES selhal — ponech historické návrhy
    dd.innerHTML = histHtml;
  }
};
