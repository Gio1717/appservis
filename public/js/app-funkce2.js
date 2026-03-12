// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 2 — switchTab, QR, XLSX, faktura, audit log,
//  časovač, hromadné akce, záloha dat
// ════════════════════════════════════════════════════════════════

// ══ SWITCHTAB ════════════════════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  if(panel) panel.classList.add('active');
  // Aktivuj odpovídající tab-btn
  document.querySelectorAll('.tab-btn').forEach(b => {
    if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + tab + "'")) {
      b.classList.add('active');
    }
  });
  // Lazy load
  if(tab === 'sklad')    loadSklad    && loadSklad();
  if(tab === 'sablony')  loadSablony  && loadSablony();
  if(tab === 'dash')     { renderDashboard && renderDashboard(); }
  if(tab === 'historie') loadHistorie && loadHistorie();
}

// ══ QR KÓD ═══════════════════════════════════════════════════════
// Jednoduchý QR generátor bez externích knihoven (micro-QR algoritmus pro URL)
// Použijeme qrious nebo vlastní canvas drawing

let _qrCurrentId = null;

function showQR(id) {
  const z = (window._zakazky||[]).find(x=>x.id===id);
  if(!z) return;
  _qrCurrentId = id;

  // URL zakázky — v produkci by to byl reálný link
  const url = `${location.origin}${location.pathname}#zakazka=${id}`;
  const title = document.getElementById('qr-modal-title');
  const info  = document.getElementById('qr-info');
  if(title) title.textContent = `QR — ${z.cislo||z.nazev||'Zakázka'}`;
  if(info)  info.innerHTML = `<strong>${esc(z.nazev||'—')}</strong><br>${esc(z.zakaznik||'')}`;

  document.getElementById('qr-modal').classList.add('open');

  // Generuj QR kód pomocí jednoduchého canvas drawing
  setTimeout(() => drawQRCanvas(url), 50);
}

function drawQRCanvas(text) {
  const canvas = document.getElementById('qr-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 220;
  canvas.width = size; canvas.height = size;

  // Použij vestavěný API pokud dostupný (moderní prohlížeče mají BarcodeDetector ale ne generator)
  // Fallback: nakresli QR s knihovnou qrcode.js přes CDN
  // Načti qrcode library dynamicky
  if(typeof QRCode === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => generateQRWithLib(text, canvas);
    script.onerror = () => drawQRFallback(ctx, text, size);
    document.head.appendChild(script);
  } else {
    generateQRWithLib(text, canvas);
  }
}

function generateQRWithLib(text, canvas) {
  // QRCode.js kreslí do div, ne canvas — použij temp div
  const tmp = document.createElement('div');
  tmp.style.display = 'none';
  document.body.appendChild(tmp);
  try {
    new QRCode(tmp, { text, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    setTimeout(() => {
      const img = tmp.querySelector('img') || tmp.querySelector('canvas');
      if(img) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        const tempImg = new Image();
        tempImg.onload = () => ctx.drawImage(tempImg, 10, 10, 200, 200);
        tempImg.src = img.tagName === 'CANVAS' ? img.toDataURL() : img.src;
      }
      tmp.remove();
    }, 200);
  } catch(e) {
    tmp.remove();
    drawQRFallback(canvas.getContext('2d'), text, 220);
  }
}

function drawQRFallback(ctx, text, size) {
  // Jednoduchý placeholder
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,size,size);
  ctx.strokeStyle = '#0f1f3d';
  ctx.lineWidth = 2;
  ctx.strokeRect(5,5,size-10,size-10);
  ctx.fillStyle = '#0f1f3d';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('QR kód', size/2, size/2 - 10);
  ctx.font = '8px sans-serif';
  ctx.fillText(text.slice(0,40), size/2, size/2 + 10);
  ctx.fillText(text.slice(40,80), size/2, size/2 + 24);
}

function downloadQR() {
  const canvas = document.getElementById('qr-canvas');
  if(!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `QR_zakazka_${_qrCurrentId||'export'}.png`;
  a.click();
}

// ══ XLSX EXPORT ═══════════════════════════════════════════════════
function exportXLSX(id) {
  const d = getDetailData(id);
  if(!d) return;

  // Sestavíme CSV kompatibilní s Excelem - jednoduchý přístup
  // Pro plný XLSX by bylo třeba SheetJS CDN
  const rows = [
    ['FAKTURAČNÍ PODKLAD', '', '', ''],
    ['Zakázka:', d.nazev||'', 'Číslo:', d.cislo||''],
    ['Zákazník:', d.zakaznik||'', 'Technik:', d.technik||''],
    ['Termín:', fmtD(d.termin)||'', 'DUZP:', fmtD(d.duzp)||''],
    ['', '', '', ''],
    ['Položka', 'Počet ks', 'Cena Kč/ks', 'Celkem Kč'],
  ];

  (d.rows||[]).forEach(r => {
    if(r.pol||r.poc) rows.push([r.pol||'', r.poc||'', r.cen||'', r.cel||'']);
  });

  rows.push(['--- Cestovní náklady ---','','','']);
  (d.exts||[]).forEach(e => {
    if(e.poc) rows.push([e.label||'', e.poc||'', e.cen||'', e.cel||'']);
  });

  rows.push(['', '', '', '']);
  rows.push(['', '', 'Celkem bez DPH:', d.cena||'']);

  const totalNum = parseFloat((d.cena||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;
  const dph21 = (totalNum * 0.21).toFixed(2);
  const total21 = (totalNum * 1.21).toFixed(2);
  rows.push(['', '', 'DPH 21 %:', dph21 + ' Kč']);
  rows.push(['', '', 'Celkem s DPH:', total21 + ' Kč']);
  rows.push(['', '', '', '']);
  rows.push(['Provedené práce:', (d.prace||'').replace(/\n/g,' '), '', '']);

  const csv = rows.map(r => r.map(v => '"' + (v||'').replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Fakturace_' + ((d.cislo||'export').replace(/[^a-z0-9_-]/gi,'_')) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ══ FAKTURAČNÍ PODKLAD ════════════════════════════════════════════
let _fakturaId = null;

function exportFaktura(id) {
  const d = getDetailData(id);
  if(!d) return;
  _fakturaId = id;

  const firma = (typeof FIRMA_DATA !== 'undefined' && FIRMA_DATA) ?
    FIRMA_DATA[d.firma||'aceuro'] : {name:'AC EURO a.s.', address:'', ic:'', phone:''};

  const totalNum = parseFloat((d.cena||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;
  const dph21 = totalNum * 0.21;
  const total21 = totalNum + dph21;

  const rowsHtml = (d.rows||[]).filter(r=>r.pol||r.poc).map(r => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6">${esc(r.pol||'')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:center">${r.poc||''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:right">${r.cen ? parseFloat(r.cen).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč' : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:right;font-weight:600">${r.cel ? parseFloat(r.cel).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč' : ''}</td>
    </tr>`).join('');

  const extsHtml = (d.exts||[]).filter(e=>e.poc).map(e => `
    <tr style="font-style:italic">
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;color:#6b7a99">${esc(e.label||'')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:center">${e.poc||''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:right">${e.cen ? parseFloat(e.cen).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč' : ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f2f6;text-align:right;font-weight:600">${e.cel ? parseFloat(e.cel).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč' : ''}</td>
    </tr>`).join('');

  document.getElementById('faktura-preview').innerHTML = `
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#1a2540">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0f1f3d">
        <div>
          <div style="font-size:18px;font-weight:900;color:#0f1f3d;margin-bottom:2px">${esc(firma.name||'')}</div>
          <div style="font-size:11px;color:#6b7a99">${esc(firma.address||'')} ${firma.ic?'IČ: '+firma.ic:''}</div>
          ${firma.phone?`<div style="font-size:11px;color:#6b7a99">${esc(firma.phone)}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:#0f1f3d">FAKTURAČNÍ PODKLAD</div>
          <div style="font-size:11px;color:#6b7a99;margin-top:4px">Číslo zakázky: <strong>${esc(d.cislo||'—')}</strong></div>
          <div style="font-size:11px;color:#6b7a99">DUZP: <strong>${fmtD(d.duzp)||'—'}</strong></div>
          <div style="font-size:11px;color:#6b7a99">Vystaveno: <strong>${new Date().toLocaleDateString('cs-CZ')}</strong></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7a99;margin-bottom:4px">Odběratel</div>
          <div style="font-weight:700">${esc(d.zakaznik||'—')}</div>
          ${d.adresa?`<div style="font-size:11px;color:#6b7a99">${esc(d.adresa)}</div>`:''}
          ${d.ico?`<div style="font-size:11px;color:#6b7a99">IČO: ${esc(d.ico)}${d.dic?' · DIČ: '+esc(d.dic):''}</div>`:''}
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7a99;margin-bottom:4px">Detail zakázky</div>
          <div style="font-weight:700">${esc(d.nazev||'—')}</div>
          <div style="font-size:11px;color:#6b7a99">Technik: ${esc(d.technik||'—')}</div>
          <div style="font-size:11px;color:#6b7a99">Provedeno: ${fmtD(d.sd1||'')||'—'}${d.sd2&&d.sd2!==d.sd1?' – '+fmtD(d.sd2):''}</div>
        </div>
      </div>

      ${d.prace?`<div style="margin-bottom:14px;padding:10px 12px;background:#f8fafc;border-left:3px solid #6abf3e;border-radius:0 6px 6px 0">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7a99;margin-bottom:4px">Provedené servisní práce</div>
        <div style="white-space:pre-wrap;font-size:11px;line-height:1.6">${esc(d.prace)}</div>
      </div>`:''}

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
        <thead><tr style="background:#0f1f3d;color:#fff">
          <th style="padding:8px;text-align:left;font-size:11px">Položka</th>
          <th style="padding:8px;text-align:center;font-size:11px;width:10%">Ks</th>
          <th style="padding:8px;text-align:right;font-size:11px;width:18%">Cena/ks</th>
          <th style="padding:8px;text-align:right;font-size:11px;width:18%">Celkem</th>
        </tr></thead>
        <tbody>
          ${rowsHtml}
          ${extsHtml}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end">
        <table style="border-collapse:collapse;font-size:12px;min-width:260px">
          <tr><td style="padding:5px 12px;color:#6b7a99">Základ DPH (bez DPH)</td><td style="padding:5px 12px;text-align:right;font-weight:600">${totalNum.toLocaleString('cs-CZ',{maximumFractionDigits:2})} Kč</td></tr>
          <tr><td style="padding:5px 12px;color:#6b7a99">DPH 21 %</td><td style="padding:5px 12px;text-align:right">${dph21.toLocaleString('cs-CZ',{maximumFractionDigits:2})} Kč</td></tr>
          <tr style="border-top:2px solid #0f1f3d;background:#f0f9ff">
            <td style="padding:8px 12px;font-weight:900;font-size:14px">Celkem k úhradě</td>
            <td style="padding:8px 12px;text-align:right;font-weight:900;font-size:14px;color:#0f1f3d">${total21.toLocaleString('cs-CZ',{maximumFractionDigits:2})} Kč</td>
          </tr>
        </table>
      </div>

      ${d.pozn?`<div style="margin-top:14px;padding:10px 12px;background:#fff9f0;border:1px solid #fde68a;border-radius:6px;font-size:11px">
        <strong>Poznámky:</strong> ${esc(d.pozn)}
      </div>`:''}
    </div>
  `;

  document.getElementById('faktura-modal').classList.add('open');
}

function printFaktura() {
  const content = document.getElementById('faktura-preview')?.innerHTML;
  if(!content) return;
  const pc = document.getElementById('print-container');
  pc.innerHTML = `<div style="padding:20px;font-family:Arial,sans-serif">${content}</div>`;
  generatePDF({ filename: 'faktura.pdf' });
}

// ══ AUDIT LOG ════════════════════════════════════════════════════
async function saveAuditLog(zakazkaId, action, value) {
  const me = window._currentUser;
  try {
    await window._fb.addDoc(
      window._fb.collection(window._fb.db, 'zakazky/' + zakazkaId + '/audit'),
      {
        action, value: String(value||''),
        uid:    me?.uid || '',
        author: me?.displayName || me?.email || 'Systém',
        role:   window._currentRole || 'kancelar',
        createdAt: window._fb.serverTimestamp()
      }
    );
  } catch(e) { /* audit není kritický */ }
}

async function showAuditLog(zakazkaId) {
  const list = document.getElementById('audit-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">⏳ Načítám...</div>';
  document.getElementById('audit-modal').classList.add('open');

  try {
    const snap = await window._fb.getDocs(
      window._fb.query(
        window._fb.collection(window._fb.db, 'zakazky/' + zakazkaId + '/audit'),
        window._fb.orderBy('createdAt', 'desc')
      )
    );
    const items = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(!items.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-style:italic">Žádné záznamy v logu</div>';
      return;
    }
    const actionLabels = {
      stav_zmena: 'Změna stavu',
      cena_ulozena: 'Uloženy ceny',
      prirazeno: 'Přiřazení technika',
      smazano: 'Smazání',
      vytvoreno: 'Vytvoření'
    };
    list.innerHTML = items.map(item => {
      const time = item.createdAt ? fmtTS(item.createdAt) : '—';
      const label = actionLabels[item.action] || item.action;
      const roleColors = {admin:'#7c3aed', kancelar:'#1d4ed8', technik:'#065f46'};
      const roleColor = roleColors[item.role] || '#6b7a99';
      return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:32px;height:32px;border-radius:50%;background:${roleColor}18;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          ${item.role==='technik'?'🔧':item.role==='admin'?'👑':'📋'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--navy)">${esc(label)}: <span style="color:${roleColor}">${esc(item.value||'')}</span></div>
          <div style="font-size:11px;color:var(--muted)">${esc(item.author||'—')} · ${time}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div style="color:var(--err);font-size:12px;padding:10px">Chyba načtení: ${esc(e.message)}</div>`;
  }
}

// ══ ČASOVAČ ══════════════════════════════════════════════════════
const _timers = {}; // {id: {intervalId, startedAt, accumulated}}

function formatDuration(seconds) {
  const s = Math.round(seconds||0);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function toggleTimer(id) {
  const z = (window._zakazky||[]).find(x=>x.id===id);
  if(!z) return;

  if(z.timerRunning) {
    // Zastav
    const elapsed = z.timerStartedAt ?
      Math.round((Date.now() - (z.timerStartedAt.toMillis?.() || new Date(z.timerStartedAt).getTime())) / 1000) : 0;
    const total = (z.casNaZakazce||0) + elapsed;
    window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id), {
      timerRunning: false, casNaZakazce: total,
      timerStartedAt: null, updatedAt: window._fb.serverTimestamp()
    }).then(() => {
      z.timerRunning = false; z.casNaZakazce = total; z.timerStartedAt = null;
      if(_timers[id]) { clearInterval(_timers[id]); delete _timers[id]; }
      updateTimerDisplay(id, total);
      const btn = document.getElementById('timer-btn-'+id);
      if(btn) btn.textContent = '▶ Spustit čas';
    });
  } else {
    // Spusť
    const now = new Date();
    window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id), {
      timerRunning: true, timerStartedAt: window._fb.serverTimestamp(),
      updatedAt: window._fb.serverTimestamp()
    }).then(() => {
      z.timerRunning = true; z.timerStartedAt = now;
      const base = z.casNaZakazce||0;
      const startMs = now.getTime();
      _timers[id] = setInterval(() => {
        const elapsed = Math.round((Date.now()-startMs)/1000);
        updateTimerDisplay(id, base+elapsed);
      }, 1000);
      const btn = document.getElementById('timer-btn-'+id);
      if(btn) btn.textContent = '⏸ Pauza';
    });
  }
}

function updateTimerDisplay(id, seconds) {
  const el = document.getElementById('timer-val-'+id);
  if(el) el.textContent = formatDuration(seconds);
}

// Obnov běžící timery při otevření detailu
const _openDetailOrig2 = typeof openDetail !== 'undefined' ? openDetail : null;
if(_openDetailOrig2) {
  openDetail = function(id) {
    _openDetailOrig2(id);
    setTimeout(() => {
      const z = (window._zakazky||[]).find(x=>x.id===id);
      if(z && z.timerRunning && z.timerStartedAt) {
        const startMs = z.timerStartedAt.toMillis?.() || new Date(z.timerStartedAt).getTime();
        const base = z.casNaZakazce||0;
        if(_timers[id]) clearInterval(_timers[id]);
        _timers[id] = setInterval(() => {
          const elapsed = Math.round((Date.now()-startMs)/1000);
          updateTimerDisplay(id, base+elapsed);
        }, 1000);
        const btn = document.getElementById('timer-btn-'+id);
        if(btn) btn.textContent = '⏸ Pauza';
      }
    }, 300);
  };
}

// ══ HROMADNÉ AKCE ════════════════════════════════════════════════
window._bulkSelected = new Set();

function toggleBulkSelect(id, checked) {
  if(checked) window._bulkSelected.add(id);
  else        window._bulkSelected.delete(id);
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const cnt = document.getElementById('bulk-count');
  const n = window._bulkSelected.size;
  if(bar) bar.style.display = n > 0 ? 'flex' : 'none';
  if(cnt) cnt.textContent = n + ' vybráno';
}

async function bulkChangeStav() {
  const stav = document.getElementById('bulk-stav-sel')?.value;
  if(!stav) { alert('Vyberte nový stav'); return; }
  if(!window._bulkSelected.size) return;
  if(!confirm(`Změnit stav ${window._bulkSelected.size} zakázek na "${stav}"?`)) return;

  const ids = [...window._bulkSelected];
  let done = 0;
  for(const id of ids) {
    try {
      await window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id),
        {stav, updatedAt:window._fb.serverTimestamp()});
      saveAuditLog(id, 'stav_zmena', stav + ' (hromadně)');
      done++;
    } catch(e) {}
  }
  alert(`✅ Hotovo — změněno ${done} z ${ids.length} zakázek`);
  bulkClear();
}

function bulkSelectAll() {
  const all = window._zakazky || [];
  const q   = (document.getElementById('search-inp')?.value||'').toLowerCase();
  const fs  = document.getElementById('filter-stav')?.value||'';
  const visible = all.filter(z => {
    if(fs && (z.stav||'nová') !== fs) return false;
    if(q && !(z.nazev||'').toLowerCase().includes(q) && !(z.zakaznik||'').toLowerCase().includes(q)) return false;
    return true;
  });
  visible.forEach(z => window._bulkSelected.add(z.id));
  updateBulkBar();
  renderList && renderList();
}

function bulkClear() {
  window._bulkSelected.clear();
  updateBulkBar();
  renderList && renderList();
}

// ══ ZÁLOHA DAT ════════════════════════════════════════════════════
async function backupAll() {
  const btn = event?.target;
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Exportuji...'; }

  try {
    const all = window._zakazky || [];
    const backup = {
      exportDate: new Date().toISOString(),
      count: all.length,
      zakazky: all.map(z => ({...z,
        createdAt: z.createdAt?.toDate?.().toISOString() || z.createdAt,
        updatedAt: z.updatedAt?.toDate?.().toISOString() || z.updatedAt
      }))
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AcEuro_Zaloha_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '💾 Záloha JSON'; }
  }
}

async function backupAllXLSX() {
  const all = window._zakazky || [];
  const rows = [
    ['ID','Číslo','Název','Zákazník','Technik','Stav','Termín','Firma','Cena bez DPH','DUZP','Vytvořeno','IČO','Adresa','Popis prací']
  ];
  all.forEach(z => {
    const ts = z.createdAt?.toDate?.() || (z.createdAt ? new Date(z.createdAt) : null);
    rows.push([
      z.id||'', z.cislo||'', z.nazev||'', z.zakaznik||'', z.technik||'',
      z.stav||'nová', fmtD(z.termin)||'', z.firma||'aceuro', z.cena||'',
      fmtD(z.duzp)||'', ts?ts.toLocaleDateString('cs-CZ'):'',
      z.ico||'', z.adresa||'', (z.prace||'').replace(/\n/g,' ')
    ]);
  });

  const csv = rows.map(r => r.map(v => '"' + String(v||'').replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `AcEuro_Vsechny_zakazky_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Přidej záloha tlačítka do dashboardu při jeho renderování
(function addBackupButtons() {
  const tryAdd = () => {
    const dash = document.getElementById('tab-dash');
    if(!dash || dash.querySelector('#backup-btns')) return;
    const div = document.createElement('div');
    div.id = 'backup-btns';
    div.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding:14px 16px;background:#f8fafc;border:1px solid var(--border);border-radius:10px;align-items:center';
    div.innerHTML = `
      <span style="font-size:12px;font-weight:700;color:var(--navy);margin-right:4px">💾 Záloha dat:</span>
      <button onclick="backupAll()" class="btn btn-ghost" style="font-size:11px">💾 Záloha JSON</button>
      <button onclick="backupAllXLSX()" class="btn btn-ghost" style="font-size:11px">📊 Export všech zakázek CSV</button>
      <span style="font-size:10px;color:var(--muted);margin-left:4px">Záloha je vhodná pro archivaci a případnou obnovu dat.</span>
    `;
    const content = dash.querySelector('[style*="padding:20px"]');
    if(content) content.appendChild(div);
  };
  // Zkus po načtení a po přepnutí tabulky
  setTimeout(tryAdd, 1000);
  const origSwitch = typeof switchTab !== 'undefined' ? switchTab : null;
  if(origSwitch) {
    const prevSwitch = switchTab;
    switchTab = function(tab) {
      prevSwitch(tab);
      if(tab === 'dash') setTimeout(tryAdd, 100);
    };
  }
})();
