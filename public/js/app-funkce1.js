// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE — měsíční přehled, sklad, šablony, chat, 
//  neuhrazené, na cestě, FCM, background sync, history API
// ════════════════════════════════════════════════════════════════

// ══ MĚSÍČNÍ FINANČNÍ PŘEHLED ════════════════════════════════════
let _monthlyFirma = 'all';
let _monthlyChart = null;

function setMonthlyFirma(f) {
  _monthlyFirma = f;
  ['all','aceuro','progres'].forEach(id => {
    const btn = document.getElementById('mf-'+id);
    if(!btn) return;
    const active = id === f;
    btn.style.background  = active ? 'var(--green)' : '#fff';
    btn.style.color       = active ? '#fff' : 'var(--text)';
    btn.style.borderColor = active ? 'var(--green)' : 'var(--border)';
    btn.style.fontWeight  = active ? '700' : '600';
  });
  renderMonthlyChart();
}

function renderMonthlyChart() {
  const canvas = document.getElementById('monthly-chart');
  if(!canvas) return;

  const all = (window._zakazky || []).filter(z => {
    if(_monthlyFirma === 'all') return true;
    return (z.firma || 'aceuro') === _monthlyFirma;
  });

  function parseCena(c){ return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }

  // Posledních 12 měsíců
  const now = new Date();
  const months = [];
  for(let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  }

  const revenueByMonth = {};
  const countByMonth = {};
  months.forEach(m => { revenueByMonth[m] = 0; countByMonth[m] = 0; });

  all.forEach(z => {
    const m = (z.termin||'').substring(0,7);
    if(revenueByMonth[m] !== undefined) {
      revenueByMonth[m] += parseCena(z.cena);
      countByMonth[m]++;
    }
  });

  const labels = months.map(m => {
    const [y,mo] = m.split('-');
    const names = ['Led','Úno','Bře','Dub','Kvě','Čvn','Čvc','Srp','Zář','Říj','Lis','Pro'];
    return names[parseInt(mo)-1] + ' ' + y.slice(2);
  });
  const data = months.map(m => revenueByMonth[m]);

  if(_monthlyChart) { _monthlyChart.destroy(); _monthlyChart = null; }

  const ctx = canvas.getContext('2d');
  if(typeof Chart !== 'undefined') {
    _monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Obrat (Kč)',
          data,
          backgroundColor: months.map((m,i) => i === months.length-1 ? '#6abf3e' : 'rgba(106,191,62,0.45)'),
          borderRadius: 5,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ctx.parsed.y.toLocaleString('cs-CZ',{minimumFractionDigits:0}) + ' Kč' }
        }},
        scales: {
          y: { ticks: { callback: v => v >= 1000 ? Math.round(v/1000)+'k' : v }, grid: { color: '#f0f2f6' } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // Tabulka pod grafem
  const table = document.getElementById('monthly-table');
  if(table) {
    const totalRev = data.reduce((a,b) => a+b, 0);
    const totalCnt = months.reduce((s,m) => s+countByMonth[m], 0);
    table.innerHTML = `<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:4px">
      <span>Celkem <strong style="color:var(--text)">${totalCnt} zakázek</strong></span>
      <span>Obrat celkem <strong style="color:var(--green)">${totalRev.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</strong></span>
      <span>Průměr/měsíc <strong style="color:var(--text)">${Math.round(totalRev/12).toLocaleString('cs-CZ')} Kč</strong></span>
    </div>`;
  }
}

// ══ NEUHRAZENÉ ZAKÁZKY ══════════════════════════════════════════
function renderUnpaid() {
  const list = document.getElementById('unpaid-list');
  const cnt  = document.getElementById('unpaid-count');
  if(!list) return;

  function parseCena(c){ return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }

  const unpaid = (window._zakazky || []).filter(z => {
    const stav = z.stav || 'nová';
    return stav === 'fakturovaná' && stav !== 'zaplacena';
  }).sort((a,b) => (a.termin||'').localeCompare(b.termin||''));

  if(cnt) cnt.textContent = unpaid.length ? `${unpaid.length} zakázek · ${unpaid.reduce((s,z)=>s+parseCena(z.cena),0).toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč` : 'vše zaplaceno';

  if(!unpaid.length) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">✅ Všechny fakturované zakázky jsou zaplaceny</div>';
    return;
  }
  list.innerHTML = unpaid.map(z => {
    const dueDate = z.duzp || z.termin || '';
    const isOverdue = dueDate && dueDate < new Date().toISOString().slice(0,10);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ${isOverdue?'#fca5a5':'var(--border)'};border-radius:8px;margin-bottom:8px;background:${isOverdue?'#fff5f5':'#fff'};cursor:pointer"
      onclick="switchTab('orders');setTimeout(()=>openDetail('${z.id}'),50)">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--navy)">${esc(z.nazev||'—')}</div>
        <div style="font-size:11px;color:var(--muted)">${esc(z.zakaznik||'—')} · ${fmtD(dueDate)||'bez data'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;font-size:13px;color:${isOverdue?'#dc2626':'var(--text)'};font-family:'DM Mono',monospace">${z.cena||'—'}</div>
        ${isOverdue?'<div style="font-size:10px;color:#dc2626;font-weight:700">PO SPLATNOSTI</div>':''}
      </div>
      <button onclick="event.stopPropagation();markZaplacena('${z.id}')" 
        style="flex-shrink:0;padding:5px 10px;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
        💰 Zaplacena
      </button>
    </div>`;
  }).join('');
}

function markZaplacena(id) {
  if(!confirm('Označit zakázku jako zaplacenou?')) return;
  window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id),
    {stav:'zaplacena', zaplacenoDne: new Date().toISOString().slice(0,10), updatedAt: window._fb.serverTimestamp()}
  ).catch(e => alert('Chyba: '+e.message));
}

// Napojení na renderDashboard
const _renderDashboardOrig = renderDashboard;
renderDashboard = function() {
  _renderDashboardOrig();
  renderMonthlyChart();
  renderUnpaid();
};

// ══ TECHNIK — Na cestě, techUpdateStav ═══════════════════════
function techUpdateStav(id, currentStav) {
  const newStav = currentStav === 'na cestě' ? 'zpracovaná' : 'na cestě';
  const updates = {stav: newStav, updatedAt: window._fb.serverTimestamp()};
  // Pokud technik odjíždí, zaznamenej polohu
  if(newStav === 'na cestě' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      updates.techLat = pos.coords.latitude;
      updates.techLng = pos.coords.longitude;
      updates.techPolohaTs = new Date().toISOString();
    }, ()=>{});
  }
  window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',id), updates)
  .then(() => {
    const z = (_assignedZakazky||[]).find(x=>x.id===id);
    if(z) z.stav = newStav;
    renderAssignedPanel && renderAssignedPanel();
    // SMS zákazníkovi při "Na cestě"
    if(newStav === 'na cestě') sendSmsZakaznikovi(z||{id});
  }).catch(e => alert('Chyba: '+e.message));
}

// ══ CHAT / KOMENTÁŘE ════════════════════════════════════════════
// Realtime listener pro komentáře
const _chatUnsubs = {};

function loadChatMessages(zakazkaId) {
  const container = document.getElementById('chat-messages-'+zakazkaId);
  if(!container) return;

  // Unsubscribe předchozí
  if(_chatUnsubs[zakazkaId]) { _chatUnsubs[zakazkaId](); delete _chatUnsubs[zakazkaId]; }

  _chatUnsubs[zakazkaId] = window._fb.onSnapshot(
    window._fb.query(
      window._fb.collection(window._fb.db, 'zakazky/'+zakazkaId+'/chat'),
      window._fb.orderBy('createdAt','asc')
    ),
    snap => renderChatMessages(zakazkaId, snap.docs.map(d=>({id:d.id,...d.data()})))
  );
}

function renderChatMessages(zakazkaId, msgs) {
  const container = document.getElementById('chat-messages-'+zakazkaId);
  if(!container) return;
  const me = window._currentUser;

  if(!msgs.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic;text-align:center;padding:8px">Zatím žádné zprávy</div>';
    return;
  }

  container.innerHTML = msgs.map(m => {
    const isMine = m.uid === me?.uid;
    const time = m.createdAt ? fmtTS(m.createdAt) : '';
    return `<div style="display:flex;flex-direction:column;align-items:${isMine?'flex-end':'flex-start'}">
      <div style="max-width:75%;background:${isMine?'#1d4ed8':'#f1f5f9'};color:${isMine?'#fff':'var(--text)'};padding:8px 11px;border-radius:${isMine?'12px 4px 12px 12px':'4px 12px 12px 12px'};font-size:12px;line-height:1.5;word-break:break-word">
        ${esc(m.text)}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${esc(m.author||'')} · ${time}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendChatMsg(zakazkaId) {
  const inp = document.getElementById('chat-inp-'+zakazkaId);
  if(!inp) return;
  const text = inp.value.trim();
  if(!text) return;
  const me = window._currentUser;
  inp.value = '';
  try {
    await window._fb.addDoc(
      window._fb.collection(window._fb.db, 'zakazky/'+zakazkaId+'/chat'),
      {
        text, uid: me.uid,
        author: me.displayName || me.email || 'Uživatel',
        role: window._currentRole || 'kancelar',
        createdAt: window._fb.serverTimestamp()
      }
    );
  } catch(e) { inp.value = text; alert('Nepodařilo se odeslat: '+e.message); }
}

// Napojení na openDetail — spusť chat listener
const _openDetailOrig = openDetail;
openDetail = function(id) {
  _openDetailOrig(id);
  // Po vyrenderování detailu spusť chat
  setTimeout(() => loadChatMessages(id), 200);
};

// ══ SKLAD ════════════════════════════════════════════════════════
let _skladItems = [];
let _skladUnsub = null;

function loadSklad() {
  if(_skladUnsub) return;
  _skladUnsub = window._fb.onSnapshot(
    window._fb.query(window._fb.collection(window._fb.db,'sklad'), window._fb.orderBy('nazev','asc')),
    snap => {
      _skladItems = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderSklad();
      updateSkladKatFilter();
    }
  );
}

function renderSklad() {
  const q = (document.getElementById('sklad-search')?.value||'').toLowerCase();
  const cat = document.getElementById('sklad-filter-cat')?.value||'';
  const tbody = document.getElementById('sklad-tbody');
  const empty = document.getElementById('sklad-empty');
  if(!tbody) return;

  const filtered = _skladItems.filter(i => {
    if(cat && i.kategorie !== cat) return false;
    if(q && !(i.nazev||'').toLowerCase().includes(q) && !(i.kod||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if(!filtered.length) {
    tbody.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  tbody.innerHTML = filtered.map(item => {
    const low = item.qty <= (item.minQty||0);
    return `<tr style="border-bottom:1px solid var(--border);${low?'background:#fff9f0':''}">
      <td style="padding:10px 12px">
        <div style="font-weight:600;font-size:13px;color:var(--navy)">${esc(item.nazev||'—')}</div>
        ${item.kod?`<div style="font-size:10px;color:var(--muted)">${esc(item.kod)}</div>`:''}
      </td>
      <td style="padding:10px 12px;font-size:12px;color:var(--muted)">${esc(item.kategorie||'—')}</td>
      <td style="text-align:center;padding:10px 12px">
        <span style="font-weight:700;font-size:14px;color:${low?'#dc2626':'var(--text)'}">${item.qty||0}</span>
        ${low?'<div style="font-size:10px;color:#dc2626;font-weight:600">↓ MIN</div>':''}
      </td>
      <td style="text-align:center;padding:10px 12px;font-size:12px;color:var(--muted)">${item.minQty||0}</td>
      <td style="text-align:right;padding:10px 12px;font-weight:600;font-family:\'DM Mono\',monospace;font-size:12px;color:var(--green)">${item.cenaks?item.cenaks.toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč':'-'}</td>
      <td style="padding:8px 12px;text-align:right">
        <button onclick="openSkladModal('${item.id}')" style="font-size:11px;padding:4px 9px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;margin-right:4px">✎</button>
        <button onclick="adjustQty('${item.id}',${item.qty||0})" style="font-size:11px;padding:4px 9px;border:1px solid #93c5fd;border-radius:6px;background:#eff6ff;cursor:pointer;color:#1d4ed8">+/−</button>
      </td>
    </tr>`;
  }).join('');
}

function updateSkladKatFilter() {
  const sel = document.getElementById('sklad-filter-cat');
  if(!sel) return;
  const cats = [...new Set(_skladItems.map(i=>i.kategorie||'').filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Všechny kategorie</option>' + cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = cur;
  // Aktualizuj datalist v modalu
  const dl = document.getElementById('sklad-kat-list');
  if(dl) dl.innerHTML = cats.map(c=>`<option value="${esc(c)}">`).join('');
}

function openSkladModal(id) {
  const el = id ? _skladItems.find(i=>i.id===id) : null;
  document.getElementById('sklad-edit-id').value = id||'';
  document.getElementById('sklad-modal-title').textContent = id ? 'Upravit položku' : 'Přidat položku skladu';
  document.getElementById('sklad-nazev').value = el?.nazev||'';
  document.getElementById('sklad-kat').value   = el?.kategorie||'';
  document.getElementById('sklad-kod').value   = el?.kod||'';
  document.getElementById('sklad-qty').value   = el?.qty||0;
  document.getElementById('sklad-min').value   = el?.minQty||0;
  document.getElementById('sklad-cena').value  = el?.cenaks||'';
  document.getElementById('sklad-pozn').value  = el?.pozn||'';
  document.getElementById('sklad-modal').classList.add('open');
}

async function saveSkladItem() {
  const id   = document.getElementById('sklad-edit-id').value;
  const nazev = document.getElementById('sklad-nazev').value.trim();
  if(!nazev) { alert('Zadejte název položky'); return; }
  const data = {
    nazev,
    kategorie: document.getElementById('sklad-kat').value.trim(),
    kod:       document.getElementById('sklad-kod').value.trim(),
    qty:       parseInt(document.getElementById('sklad-qty').value)||0,
    minQty:    parseInt(document.getElementById('sklad-min').value)||0,
    cenaks:    parseFloat(document.getElementById('sklad-cena').value)||0,
    pozn:      document.getElementById('sklad-pozn').value.trim(),
    updatedAt: window._fb.serverTimestamp()
  };
  try {
    if(id) {
      await window._fb.updateDoc(window._fb.doc(window._fb.db,'sklad',id), data);
    } else {
      data.createdAt = window._fb.serverTimestamp();
      await window._fb.addDoc(window._fb.collection(window._fb.db,'sklad'), data);
    }
    closeModal('sklad-modal');
  } catch(e) { alert('Chyba: '+e.message); }
}

function adjustQty(id, current) {
  const delta = parseInt(prompt(`Upravit množství (aktuálně: ${current})\nZadejte změnu (kladné = přidat, záporné = odebrat):`));
  if(isNaN(delta)) return;
  const newQty = Math.max(0, current + delta);
  window._fb.updateDoc(window._fb.doc(window._fb.db,'sklad',id),
    {qty: newQty, updatedAt: window._fb.serverTimestamp()}
  ).catch(e => alert('Chyba: '+e.message));
}

// Spusť sklad při přepnutí na tab
const _switchTabOrig = typeof switchTab !== 'undefined' ? switchTab : null;

// ══ ŠABLONY ══════════════════════════════════════════════════════
let _sablony = [];
let _sablonyUnsub = null;

function loadSablony() {
  if(_sablonyUnsub) return;
  _sablonyUnsub = window._fb.onSnapshot(
    window._fb.query(window._fb.collection(window._fb.db,'sablony'), window._fb.orderBy('nazev','asc')),
    snap => {
      _sablony = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderSablony();
    }
  );
}

function renderSablony() {
  const grid = document.getElementById('sablony-grid');
  const empty = document.getElementById('sablony-empty');
  if(!grid) return;
  if(!_sablony.length) {
    grid.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';
  const firmaNames = {aceuro:'AC EURO',progres:'Progresklima'};
  grid.innerHTML = _sablony.map(s => `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div>
          <div style="font-weight:700;font-size:14px;color:var(--navy)">${esc(s.nazev||'—')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${esc(firmaNames[s.firma]||'AC EURO')}${s.typ?' · '+esc(s.typ):''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="openSablonaModal('${s.id}')" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:11px;cursor:pointer;background:#fff">✎</button>
          <button onclick="deleteSablona('${s.id}')" style="padding:4px 8px;border:1px solid #fecaca;border-radius:6px;font-size:11px;cursor:pointer;background:#fff5f5;color:#dc2626">🗑</button>
        </div>
      </div>
      ${s.prace?`<div style="font-size:12px;color:var(--muted);line-height:1.4;max-height:48px;overflow:hidden;text-overflow:ellipsis">${esc(s.prace.substring(0,120))}${s.prace.length>120?'…':''}</div>`:''}
      ${s.interval?`<div style="font-size:11px;color:var(--blue);font-weight:600">🔄 Každých ${s.interval} dní</div>`:''}
      <button onclick="createFromSablona('${s.id}')" class="btn btn-green" style="margin-top:4px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Vytvořit zakázku z šablony
      </button>
    </div>`).join('');
}

function openSablonaModal(id) {
  const s = id ? _sablony.find(x=>x.id===id) : null;
  document.getElementById('sablona-edit-id').value = id||'';
  document.getElementById('sablona-modal-title').textContent = id ? 'Upravit šablonu' : 'Nová šablona zakázky';
  document.getElementById('sab-nazev').value    = s?.nazev||'';
  document.getElementById('sab-typ').value      = s?.typ||'';
  document.getElementById('sab-firma').value    = s?.firma||'aceuro';
  document.getElementById('sab-prace').value    = s?.prace||'';
  document.getElementById('sab-zadani').value   = s?.zadani||'';
  document.getElementById('sab-interval').value = s?.interval||'';
  const rows = s?.rows||[];
  for(let i=1;i<=4;i++){
    const r = rows[i-1]||{};
    document.getElementById('sab-pol'+i).value = r.pol||'';
    document.getElementById('sab-poc'+i).value = r.poc||'';
    document.getElementById('sab-cen'+i).value = r.cen||'';
    document.getElementById('sab-cel'+i).value = r.cel||'';
  }
  document.getElementById('sablona-modal').classList.add('open');
}

function sabCalc() {
  for(let i=1;i<=4;i++){
    const poc = parseFloat(document.getElementById('sab-poc'+i)?.value||0)||0;
    const cen = parseFloat(document.getElementById('sab-cen'+i)?.value||0)||0;
    const el = document.getElementById('sab-cel'+i);
    if(el) el.value = poc&&cen ? (poc*cen).toFixed(2) : '';
  }
}

async function saveSablona() {
  const id = document.getElementById('sablona-edit-id').value;
  const nazev = document.getElementById('sab-nazev').value.trim();
  if(!nazev) { alert('Zadejte název šablony'); return; }
  const rows = [];
  for(let i=1;i<=4;i++) rows.push({
    pol: document.getElementById('sab-pol'+i).value,
    poc: document.getElementById('sab-poc'+i).value,
    cen: document.getElementById('sab-cen'+i).value,
    cel: document.getElementById('sab-cel'+i).value
  });
  const data = {
    nazev, typ: document.getElementById('sab-typ').value,
    firma:    document.getElementById('sab-firma').value,
    prace:    document.getElementById('sab-prace').value,
    zadani:   document.getElementById('sab-zadani').value,
    interval: parseInt(document.getElementById('sab-interval').value)||0,
    rows, updatedAt: window._fb.serverTimestamp()
  };
  try {
    if(id) { await window._fb.updateDoc(window._fb.doc(window._fb.db,'sablony',id), data); }
    else { data.createdAt=window._fb.serverTimestamp(); await window._fb.addDoc(window._fb.collection(window._fb.db,'sablony'), data); }
    closeModal('sablona-modal');
  } catch(e) { alert('Chyba: '+e.message); }
}

async function deleteSablona(id) {
  if(!confirm('Smazat tuto šablonu?')) return;
  window._fb.deleteDoc(window._fb.doc(window._fb.db,'sablony',id)).catch(e=>alert('Chyba: '+e.message));
}

async function createFromSablona(id) {
  const s = _sablony.find(x=>x.id===id);
  if(!s) return;
  const termin = prompt('Termín zakázky (RRRR-MM-DD):', new Date().toISOString().slice(0,10));
  if(!termin) return;
  const zakaznik = prompt('Zákazník:', '');
  try {
    const newZ = {
      nazev:    s.nazev, typ: s.typ||'', firma: s.firma||'aceuro',
      prace:    s.prace||'', zadani: s.zadani||'',
      rows:     s.rows||[], exts: [],
      zakaznik: zakaznik||'',
      termin, stav: 'nová',
      createdBy: window._currentUser?.uid||'',
      technik:   window._currentUser?.displayName||window._currentUser?.email||'',
      createdAt: window._fb.serverTimestamp()
    };
    await window._fb.addDoc(window._fb.collection(window._fb.db,'zakazky'), newZ);
    alert('✅ Zakázka vytvořena ze šablony!');
    switchTab('orders');
  } catch(e) { alert('Chyba: '+e.message); }
}

// ══ HISTORY API — záložka prohlížeče ════════════════════════════
// Zabraňuje zavření celé záložky při "Zpět"
(function initHistoryAPI() {
  window.addEventListener('popstate', e => {
    if(e.state && e.state.screen) {
      // Pokud jsme v detailu, zavřeme detail
      const appK = document.getElementById('app-kancelar');
      if(appK && appK.style.display !== 'none') {
        const di = document.getElementById('detail-inner');
        if(di && di.style.display !== 'none') {
          di.style.display = 'none';
          document.getElementById('detail-empty').style.display = 'flex';
          return;
        }
      }
    }
  });
  // Push initial state
  if(history.state === null) {
    history.replaceState({screen:'main'}, '', location.href);
  }
})();

// ══ BACKGROUND SYNC (offline zakázky) ═══════════════════════════
// Registrace sync queue přes service worker
async function registerBackgroundSync() {
  if('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-zakazky');
    } catch(e) { /* SW not available in this context */ }
  }
}

// Poslouchej zprávy od SW
if('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if(e.data && e.data.type === 'SYNC_COMPLETE') {
      // Reload zakázky po úspěšné sync
      loadAssignedZakazky && window._currentUser && loadAssignedZakazky(window._currentUser);
    }
  });
}

// ══ FCM PUSH NOTIFIKACE ══════════════════════════════════════════
// Inicializace FCM - technik dostane notifikaci při přiřazení zakázky
async function initFCM(user) {
  // FCM vyžaduje firebase/messaging compat script a VAPID key
  // Implementujeme přes fallback - browser Notification API
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if(perm !== 'granted') return;
  }
  if(Notification.permission !== 'granted') return;

  // Ulož FCM token (nebo jen příznak souhlasu) do Firestore
  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db,'users',user.uid),
      {notifEnabled: true, notifUpdated: window._fb.serverTimestamp()}
    );
  } catch(e) {}

  // Sleduj zakázky přiřazené tomuto technikovi - realtime notifikace
  const name = user.displayName || '';
  const email = user.email || '';
  let _prevAssigned = new Set();

  window._fb.onSnapshot(
    window._fb.query(window._fb.collection(window._fb.db,'zakazky'), window._fb.orderBy('createdAt','desc'), window._fb.limit(30)),
    snap => {
      snap.docs.forEach(d => {
        const z = {id:d.id,...d.data()};
        const isMe = z.assignedTo===name||z.assignedTo===email||z.technik===name||z.technik===email;
        if(isMe && !_prevAssigned.has(z.id) && _prevAssigned.size > 0) {
          // Nová přiřazená zakázka
          new Notification('🔧 Nová přiřazená zakázka', {
            body: `${z.nazev||'Zakázka'} · ${fmtD(z.termin)||'bez termínu'}`,
            icon: typeof LOGO_DATA !== 'undefined' ? LOGO_DATA : '/logo.jpg',
            tag: 'assigned-'+z.id
          });
        }
        if(isMe) _prevAssigned.add(z.id);
      });
      // Po prvním snapshotu inicializuj sadu
      if(_prevAssigned.size === 0) {
        snap.docs.forEach(d => {
          const z = {id:d.id,...d.data()};
          const isMe = z.assignedTo===name||z.assignedTo===email||z.technik===name||z.technik===email;
          if(isMe) _prevAssigned.add(z.id);
        });
      }
    }
  );
}

// ══ NAPOJENÍ NA INIT ═════════════════════════════════════════════
// Přidej FCM init do technik inicializace
const _initTechnikOrig = initTechnik;
initTechnik = function(user) {
  _initTechnikOrig(user);
  initFCM(user).catch(()=>{});
  registerBackgroundSync();
};

// Přidej sklad+šablony načtení do kancelář inicializace
const _initKancelarOrig = initKancelar;
initKancelar = function(user, role) {
  _initKancelarOrig(user, role);
  loadSklad();
  loadSablony();
  registerBackgroundSync();
};

// Přidej switchTab override pro lazy loading
(function() {
  let _switchTabAttempts = 0;
  const _tryOverrideSwitchTab = setInterval(() => {
    _switchTabAttempts++;
    if(typeof switchTab !== 'undefined' || _switchTabAttempts > 20) {
      clearInterval(_tryOverrideSwitchTab);
      if(typeof switchTab === 'undefined') return;
      const orig = switchTab;
      switchTab = function(tab) {
        orig(tab);
        if(tab === 'sklad') loadSklad();
        if(tab === 'sablony') loadSablony();
      };
    }
  }, 300);
})();
