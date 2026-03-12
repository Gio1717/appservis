// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 4 — výkaz práce, ceník, galerie fotek,
//  mapa techniků, SMS notifikace, km náhrady, schválení výkazu
// ════════════════════════════════════════════════════════════════

// ══ VÝKAZ PRÁCE ══════════════════════════════════════════════════
window._kmSazba = parseFloat(localStorage.getItem('km-sazba') || '5.60');

function getVykazRange() {
  const period = document.getElementById('vykaz-period')?.value || 'this-month';
  const now = new Date();
  let od, doo;

  if(period === 'this-month') {
    od  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    doo = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
  } else if(period === 'last-month') {
    od  = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,10);
    doo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10);
  } else if(period === 'this-week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    od = mon.toISOString().slice(0,10); doo = sun.toISOString().slice(0,10);
  } else if(period === 'last-week') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day - 6);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    od = mon.toISOString().slice(0,10); doo = sun.toISOString().slice(0,10);
  } else {
    od  = document.getElementById('vykaz-od')?.value || '';
    doo = document.getElementById('vykaz-do')?.value || '';
  }
  return {od, doo};
}

function renderVykaz() {
  const {od, doo} = getVykazRange();
  const period = document.getElementById('vykaz-period')?.value;
  const customDiv = document.getElementById('vykaz-custom-range');
  if(customDiv) customDiv.style.display = period === 'custom' ? 'flex' : 'none';

  const techFilter = document.getElementById('vykaz-technik')?.value || '';
  const all = (window._zakazky || []).filter(z => {
    if(!z.termin) return false;
    if(od && z.termin < od) return false;
    if(doo && z.termin > doo) return false;
    if(techFilter && z.technik !== techFilter && !(z.technici||[]).some(u=>u.name===techFilter)) return false;
    return true;
  }).sort((a,b) => (a.termin||'').localeCompare(b.termin||''));

  // Aktualizuj technik select
  const techSel = document.getElementById('vykaz-technik');
  if(techSel) {
    const techs = [...new Set((window._zakazky||[]).map(z=>z.technik||'').filter(Boolean))].sort();
    const cur = techSel.value;
    techSel.innerHTML = '<option value="">Všichni technici</option>' + techs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    techSel.value = cur;
  }

  function parseCena(c){ return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }

  // Summary stats
  const totalHodiny = all.reduce((s,z) => s + (z.hodiny||0), 0);
  const totalKm     = all.reduce((s,z) => s + (z.km||0), 0);
  const totalRev    = all.reduce((s,z) => s + parseCena(z.cena), 0);
  const kmNahrady   = all.reduce((s,z) => s + (z.km||0) * (z.kmSazba||window._kmSazba), 0);

  const sumEl = document.getElementById('vykaz-summary');
  if(sumEl) {
    sumEl.innerHTML = [
      {val: all.length, lbl: 'Zakázek', cls: 'blue'},
      {val: totalHodiny.toFixed(1) + ' h', lbl: 'Odpracováno', cls: 'green'},
      {val: totalKm + ' km', lbl: 'Najeto km', cls: ''},
      {val: kmNahrady.toLocaleString('cs-CZ',{maximumFractionDigits:0}) + ' Kč', lbl: 'Km náhrady', cls: 'warn'},
      {val: totalRev.toLocaleString('cs-CZ',{maximumFractionDigits:0}) + ' Kč', lbl: 'Obrat', cls: 'green'},
    ].map(s => `<div class="stat-card ${s.cls||''}"><div class="val" style="font-size:18px">${s.val}</div><div class="lbl">${s.lbl}</div></div>`).join('');
  }

  const tbody = document.getElementById('vykaz-tbody');
  const thead = document.getElementById('vykaz-thead');
  const empty = document.getElementById('vykaz-empty');

  if(!all.length) {
    if(tbody) tbody.innerHTML = '';
    if(thead) thead.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  if(thead) thead.innerHTML = `<tr style="background:#f8fafc;border-bottom:2px solid var(--border)">
    <th style="padding:9px 12px;text-align:left;font-weight:700;color:var(--navy)">Datum</th>
    <th style="padding:9px 12px;text-align:left;font-weight:700;color:var(--navy)">Zakázka</th>
    <th style="padding:9px 12px;text-align:left;font-weight:700;color:var(--navy)">Zákazník</th>
    <th style="padding:9px 12px;text-align:left;font-weight:700;color:var(--navy)">Technik</th>
    <th style="padding:9px 12px;text-align:center;font-weight:700;color:var(--navy)">Hodiny</th>
    <th style="padding:9px 12px;text-align:center;font-weight:700;color:var(--navy)">Km</th>
    <th style="padding:9px 12px;text-align:right;font-weight:700;color:var(--green)">Km náhrada</th>
    <th style="padding:9px 12px;text-align:right;font-weight:700;color:var(--green)">Cena</th>
    <th style="padding:9px 12px;text-align:center;font-weight:700;color:var(--navy)">Stav</th>
  </tr>`;

  if(tbody) tbody.innerHTML = all.map(z => {
    const kn = (z.km||0) * (z.kmSazba||window._kmSazba);
    return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="switchTab('orders');setTimeout(()=>openDetail('${z.id}'),50)" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
      <td style="padding:9px 12px;font-size:12px;white-space:nowrap">${fmtD(z.termin)||'—'}</td>
      <td style="padding:9px 12px"><div style="font-weight:600;font-size:12px">${esc(z.nazev||'—')}</div><div style="font-size:10px;color:var(--muted)">${esc(z.cislo||'')}</div></td>
      <td style="padding:9px 12px;font-size:12px;color:var(--muted)">${esc(z.zakaznik||'—')}</td>
      <td style="padding:9px 12px;font-size:12px">${esc(z.technik||'—')}</td>
      <td style="padding:9px 12px;text-align:center;font-size:12px;font-weight:${z.hodiny?'700':'400'};color:${z.hodiny?'var(--navy)':'var(--muted)'}">${z.hodiny||'—'}</td>
      <td style="padding:9px 12px;text-align:center;font-size:12px">${z.km||'—'}</td>
      <td style="padding:9px 12px;text-align:right;font-size:12px;font-family:'DM Mono',monospace">${z.km?kn.toLocaleString('cs-CZ',{maximumFractionDigits:0})+' Kč':'—'}</td>
      <td style="padding:9px 12px;text-align:right;font-size:12px;font-weight:600;font-family:'DM Mono',monospace">${z.cena||'—'}</td>
      <td style="padding:9px 12px;text-align:center">${stavBadge(z.stav||'nová')}</td>
    </tr>`;
  }).join('') + `<tr style="border-top:2px solid var(--border);background:#f8fafc;font-weight:700">
    <td colspan="4" style="padding:9px 12px;font-size:12px">Celkem</td>
    <td style="padding:9px 12px;text-align:center;font-size:12px">${totalHodiny.toFixed(1)} h</td>
    <td style="padding:9px 12px;text-align:center;font-size:12px">${totalKm} km</td>
    <td style="padding:9px 12px;text-align:right;font-size:12px;color:var(--green)">${kmNahrady.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</td>
    <td style="padding:9px 12px;text-align:right;font-size:12px;color:var(--green)">${totalRev.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</td>
    <td></td>
  </tr>`;

  // Zobraz schválení panel
  const approvalDiv = document.getElementById('vykaz-approval');
  if(approvalDiv) approvalDiv.style.display = all.length ? 'block' : 'none';
  const approveBtn = document.getElementById('vykaz-approve-btn');
  if(approveBtn) approveBtn.style.display = window._currentRole === 'admin' ? '' : 'none';
}

function exportVykazCSV() {
  const {od, doo} = getVykazRange();
  const techFilter = document.getElementById('vykaz-technik')?.value || '';
  function parseCena(c){ return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }
  const all = (window._zakazky||[]).filter(z => {
    if(!z.termin) return false;
    if(od && z.termin < od) return false;
    if(doo && z.termin > doo) return false;
    if(techFilter && z.technik !== techFilter) return false;
    return true;
  });
  const rows = [['Datum','Zakázka','Číslo','Zákazník','Technik','Hodiny','Km','Sazba Kč/km','Km náhrada Kč','Cena bez DPH','Stav']];
  all.forEach(z => {
    const ks = z.kmSazba || window._kmSazba;
    rows.push([fmtD(z.termin),z.nazev||'',z.cislo||'',z.zakaznik||'',z.technik||'',z.hodiny||0,z.km||0,ks,(z.km||0)*ks,parseCena(z.cena),z.stav||'nová']);
  });
  const csv = rows.map(r=>r.map(v=>'"'+(v||'').toString().replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Vykaz_${od}_${doo}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function printVykaz() {
  const tbl = document.getElementById('vykaz-tbl');
  if(!tbl) return;
  const pc = document.getElementById('print-container');
  const {od, doo} = getVykazRange();
  const tech = document.getElementById('vykaz-technik')?.value || 'Všichni technici';
  pc.innerHTML = `<div style="padding:20px;font-family:Arial,sans-serif">
    <h2 style="color:#0f1f3d;margin-bottom:4px">Výkaz práce</h2>
    <div style="font-size:12px;color:#6b7a99;margin-bottom:16px">Období: ${fmtD(od)} — ${fmtD(doo)} | Technik: ${esc(tech)}</div>
    ${tbl.outerHTML}
  </div>`;
  generatePDF({ filename: 'vykaz-prace.pdf' });
}

function submitVykaz() {
  const {od, doo} = getVykazRange();
  const me = window._currentUser;
  window._fb.addDoc(window._fb.collection(window._fb.db,'vykazy'), {
    technik: me?.displayName || me?.email || '',
    uid: me?.uid || '',
    od, doo,
    stav: 'odeslan',
    createdAt: window._fb.serverTimestamp()
  }).then(() => {
    document.getElementById('vykaz-status').textContent = '✅ Výkaz odeslán ke schválení — ' + new Date().toLocaleString('cs-CZ');
  }).catch(e => alert('Chyba: '+e.message));
}

function approveVykaz() {
  if(!confirm('Schválit výkaz práce?')) return;
  document.getElementById('vykaz-status').textContent = '✅ Výkaz schválen adminem — ' + new Date().toLocaleString('cs-CZ');
}

// ══ CENÍK ════════════════════════════════════════════════════════
let _cenikItems = [];
let _cenikUnsub = null;

function loadCenik() {
  if(_cenikUnsub) return;
  _cenikUnsub = window._fb.onSnapshot(
    window._fb.query(window._fb.collection(window._fb.db,'cenik'), window._fb.orderBy('nazev','asc')),
    snap => {
      _cenikItems = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderCenik();
      updateCenikKatFilter();
      // Aktualizuj autocomplete v zakázkách
      updateSuggestionsFromCenik();
    }
  );
}

function updateSuggestionsFromCenik() {
  if(!_cenikItems.length) return;
  const cenikSuggestions = _cenikItems.map(i => ({
    label: i.nazev, cen: String(i.cena||''), unit: i.jednotka||'ks'
  }));
  // Přidej do _suggestions pokud existuje
  if(window._suggestions) {
    const existing = new Set(window._suggestions.map(s=>s.label));
    cenikSuggestions.forEach(s => { if(!existing.has(s.label)) window._suggestions.push(s); });
  }
}

function renderCenik() {
  const q   = (document.getElementById('cenik-search')?.value||'').toLowerCase();
  const cat = document.getElementById('cenik-kat')?.value||'';
  const tbody = document.getElementById('cenik-tbody');
  const empty = document.getElementById('cenik-empty');
  if(!tbody) return;

  const filtered = _cenikItems.filter(i => {
    if(cat && i.kategorie !== cat) return false;
    if(q && !(i.nazev||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if(!filtered.length) { tbody.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';

  tbody.innerHTML = filtered.map((item,idx) => `
    <tr style="border-bottom:1px solid var(--border);${idx%2?'background:var(--bg)':''}">
      <td style="padding:10px 12px">
        <div style="font-weight:600;font-size:13px">${esc(item.nazev||'—')}</div>
        ${item.pozn?`<div style="font-size:10px;color:var(--muted)">${esc(item.pozn)}</div>`:''}
      </td>
      <td style="padding:10px 12px;font-size:12px;color:var(--muted)">${esc(item.kategorie||'—')}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${item.cena?parseFloat(item.cena).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' Kč':'—'}</td>
      <td style="padding:10px 12px;font-size:12px;color:var(--muted)">${esc(item.jednotka||'ks')}</td>
      <td style="padding:8px 12px;text-align:right;white-space:nowrap">
        <button onclick="openCenikModal('${item.id}')" style="font-size:11px;padding:4px 9px;border:1px solid var(--border);border-radius:6px;background:#fff;cursor:pointer;margin-right:4px">✎</button>
        <button onclick="deleteCenikItem('${item.id}')" style="font-size:11px;padding:4px 9px;border:1px solid #fecaca;border-radius:6px;background:#fff5f5;color:#dc2626;cursor:pointer">🗑</button>
      </td>
    </tr>`).join('');
}

function updateCenikKatFilter() {
  const sel = document.getElementById('cenik-kat');
  const dl  = document.getElementById('cenik-kat-list');
  if(!sel) return;
  const cats = [...new Set(_cenikItems.map(i=>i.kategorie||'').filter(Boolean))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Všechny kategorie</option>' + cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  sel.value = cur;
  if(dl) dl.innerHTML = cats.map(c=>`<option value="${esc(c)}">`).join('');
}

function openCenikModal(id) {
  const item = id ? _cenikItems.find(i=>i.id===id) : null;
  document.getElementById('cenik-edit-id').value = id||'';
  document.getElementById('cenik-modal-title').textContent = id ? 'Upravit položku' : 'Přidat položku ceníku';
  document.getElementById('cenik-nazev').value    = item?.nazev||'';
  document.getElementById('cenik-kat-inp').value  = item?.kategorie||'';
  document.getElementById('cenik-jednotka').value = item?.jednotka||'ks';
  document.getElementById('cenik-cena').value     = item?.cena||'';
  document.getElementById('cenik-dph').value      = String(item?.dph??21);
  document.getElementById('cenik-pozn').value     = item?.pozn||'';
  document.getElementById('cenik-modal').classList.add('open');
}

async function saveCenikItem() {
  const id = document.getElementById('cenik-edit-id').value;
  const nazev = document.getElementById('cenik-nazev').value.trim();
  if(!nazev) { alert('Zadejte název položky'); return; }
  const data = {
    nazev,
    kategorie: document.getElementById('cenik-kat-inp').value.trim(),
    jednotka:  document.getElementById('cenik-jednotka').value.trim()||'ks',
    cena:      parseFloat(document.getElementById('cenik-cena').value)||0,
    dph:       parseInt(document.getElementById('cenik-dph').value)||21,
    pozn:      document.getElementById('cenik-pozn').value.trim(),
    updatedAt: window._fb.serverTimestamp()
  };
  try {
    if(id) { await window._fb.updateDoc(window._fb.doc(window._fb.db,'cenik',id), data); }
    else { data.createdAt=window._fb.serverTimestamp(); await window._fb.addDoc(window._fb.collection(window._fb.db,'cenik'), data); }
    closeModal('cenik-modal');
  } catch(e) { alert('Chyba: '+e.message); }
}

async function deleteCenikItem(id) {
  if(!confirm('Smazat tuto položku ceníku?')) return;
  window._fb.deleteDoc(window._fb.doc(window._fb.db,'cenik',id)).catch(e=>alert('Chyba: '+e.message));
}

// ══ GALERIE FOTEK ════════════════════════════════════════════════
function renderGalerie() {
  const grid  = document.getElementById('galerie-grid');
  const empty = document.getElementById('galerie-empty');
  const stats = document.getElementById('galerie-stats');
  if(!grid) return;

  const techFilter  = document.getElementById('galerie-technik')?.value||'';
  const monthFilter = document.getElementById('galerie-month')?.value||'';

  // Aktualizuj technik select
  const techSel = document.getElementById('galerie-technik');
  if(techSel) {
    const techs = [...new Set((window._zakazky||[]).map(z=>z.technik||'').filter(Boolean))].sort();
    const cur = techSel.value;
    techSel.innerHTML = '<option value="">Všichni technici</option>' + techs.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');
    techSel.value = cur;
  }

  // Nastav výchozí měsíc
  const monthEl = document.getElementById('galerie-month');
  if(monthEl && !monthEl.value) monthEl.value = new Date().toISOString().slice(0,7);

  const effectiveMonth = monthFilter || new Date().toISOString().slice(0,7);

  // Sbírej všechny fotky
  const allPhotos = [];
  (window._zakazky||[]).forEach(z => {
    if(techFilter && z.technik !== techFilter) return;
    if(effectiveMonth && !(z.termin||'').startsWith(effectiveMonth)) return;
    (z.photos||[]).forEach(p => {
      if(p.dataUrl) allPhotos.push({
        url: p.dataUrl, zakazkaId: z.id, zakazkaNazev: z.nazev||'—',
        zakazkaZakaznik: z.zakaznik||'', cislo: z.cislo||'',
        technik: z.technik||'', termin: z.termin||'', caption: p.caption||''
      });
    });
  });

  if(stats) stats.textContent = `${allPhotos.length} fotografií z ${(window._zakazky||[]).filter(z=>techFilter?z.technik===techFilter:true).filter(z=>!(effectiveMonth)||((z.termin||'').startsWith(effectiveMonth))).length} zakázek`;

  if(!allPhotos.length) {
    grid.innerHTML=''; if(empty) empty.style.display='block'; return;
  }
  if(empty) empty.style.display='none';

  grid.innerHTML = allPhotos.map(p => `
    <div style="border-radius:10px;overflow:hidden;border:1px solid var(--border);background:var(--card);cursor:pointer"
      onclick="openLightbox('${p.url}')">
      <div style="aspect-ratio:4/3;overflow:hidden;background:#f0f2f6">
        <img src="${p.url}" alt="${esc(p.caption)}" style="width:100%;height:100%;object-fit:cover;transition:transform .3s"
          onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform=''">
      </div>
      <div style="padding:8px 10px">
        <div style="font-size:11px;font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.zakazkaNazev)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${esc(p.zakazkaZakaznik)} · ${fmtD(p.termin)}</div>
        ${p.caption?`<div style="font-size:10px;color:var(--blue);margin-top:2px;font-style:italic">${esc(p.caption.substring(0,50))}</div>`:''}
      </div>
    </div>`).join('');
}

// ══ MAPA TECHNIKŮ ════════════════════════════════════════════════
function openMapaTechniku() {
  document.getElementById('mapa-modal').classList.add('open');
  setTimeout(() => renderMapaTechniku(), 200);
}

function renderMapaTechniku() {
  const content = document.getElementById('mapa-content');
  const legend  = document.getElementById('mapa-legend');
  if(!content) return;

  // Sbírej technici s polohou
  const techniciSPolohou = (window._zakazky||[])
    .filter(z => z.techLat && z.techLng)
    .map(z => ({
      lat: z.techLat, lng: z.techLng, name: z.technik||'—',
      nazev: z.nazev, stav: z.stav, ts: z.techPolohaTs
    }));

  // Zakázky s adresou (pro zobrazení jako body na mapě)
  const zakazkyBAdr = (window._zakazky||[])
    .filter(z => z.adresa && !['zpracovaná','zaplacena'].includes(z.stav||'nová'))
    .slice(0,20);

  // Použij Leaflet + OpenStreetMap (zdarma, bez API klíče)
  if(typeof L === 'undefined') {
    // Načti Leaflet dynamicky
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => initLeafletMap(content, techniciSPolohou, zakazkyBAdr);
    document.head.appendChild(script);
  } else {
    initLeafletMap(content, techniciSPolohou, zakazkyBAdr);
  }

  // Legend
  if(legend) {
    legend.innerHTML = `
      <span>🟢 Technik (GPS z "Na cestě")</span>
      <span>🔵 Zakázka s adresou</span>
      <span style="color:var(--muted)">Mapa: OpenStreetMap (zdarma)</span>
    `;
  }
}

function initLeafletMap(container, technici, zakazky) {
  container.style.height = '400px';

  // Zruš existující mapu
  if(container._leaflet_id) {
    try { container._leafletMap?.remove(); } catch(e) {}
  }

  const map = L.map(container).setView([49.8, 15.5], 7);
  container._leafletMap = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  // Technici
  technici.forEach(t => {
    const marker = L.circleMarker([t.lat, t.lng], {
      radius: 10, fillColor: '#6abf3e', color: '#fff',
      weight: 2, fillOpacity: 0.9
    }).addTo(map);
    marker.bindPopup(`<strong>🔧 ${esc(t.name)}</strong><br>${esc(t.nazev||'—')}<br><small>${t.ts ? new Date(t.ts).toLocaleString('cs-CZ') : ''}</small>`);
  });

  // Zakázky s adresou — geocoduj první 3
  zakazky.slice(0,3).forEach(z => {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(z.adresa)}&format=json&limit=1`, {
      headers: {'User-Agent':'AcEuro-Service/1.0'}
    }).then(r=>r.json()).then(data => {
      if(!data[0]) return;
      const m = L.marker([data[0].lat, data[0].lon]).addTo(map);
      m.bindPopup(`<strong>${esc(z.nazev||'—')}</strong><br>${esc(z.zakaznik||'')}<br>${esc(z.adresa)}`);
    }).catch(()=>{});
  });
}

// ══ SMS ZÁKAZNÍKOVI ═══════════════════════════════════════════════
function getSmsSettings() {
  try { return JSON.parse(localStorage.getItem('sms-cfg')||'{}'); } catch(e) { return {}; }
}

function saveSmsSettings() {
  const cfg = {
    provider: document.getElementById('sms-provider')?.value||'none',
    appId:    document.getElementById('sms-app-id')?.value.trim()||'',
    token:    document.getElementById('sms-token')?.value.trim()||'',
    text:     document.getElementById('sms-text')?.value||''
  };
  localStorage.setItem('sms-cfg', JSON.stringify(cfg));
  closeModal('sms-settings-modal');
  alert('✅ SMS nastavení uloženo');
}

function updateSmsProviderHelp() {
  const p = document.getElementById('sms-provider')?.value;
  const kl = document.getElementById('sms-key-label');
  const tl = document.getElementById('sms-token-label');
  if(kl) kl.textContent = p==='twilio' ? 'Account SID' : 'Application ID';
  if(tl) tl.textContent = p==='twilio' ? 'Auth Token' : 'Application Token';
}

async function sendSmsZakaznikovi(zakazka) {
  const cfg = getSmsSettings();
  if(!cfg.provider || cfg.provider === 'none') return;
  if(!zakazka?.telZakaznik && !zakazka?.tel) return; // Nemáme telefon zákazníka

  const tel = zakazka.telZakaznik || zakazka.tel || '';
  const me  = window._currentUser;
  let text  = (cfg.text || 'Váš technik {technik} je na cestě. Zakázka: {nazev}')
    .replace('{technik}', me?.displayName || me?.email || 'technik')
    .replace('{nazev}',   zakazka.nazev||'—')
    .replace('{cislo}',   zakazka.cislo||'—')
    .replace('{termin}',  fmtD(zakazka.termin)||'—');

  // BulkGate API
  if(cfg.provider === 'bulkgate') {
    try {
      const res = await fetch('https://portal.bulkgate.com/api/1.0/simple/transactional', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          application_id: cfg.appId,
          application_token: cfg.token,
          number: tel.replace(/\s/g,''),
          text, unicode: false, flash: false, sender_id: 'gSystem'
        })
      });
      console.log('SMS odeslaná:', await res.json());
    } catch(e) { console.warn('SMS error:', e); }
  }
}

async function testSms() {
  const tel = document.getElementById('sms-test-tel')?.value.trim();
  if(!tel) { alert('Zadejte testovací telefonní číslo'); return; }
  await sendSmsZakaznikovi({tel, nazev:'Testovací zakázka', cislo:'TEST', termin: new Date().toISOString().slice(0,10)});
  alert('Test SMS odeslán (zkontrolujte BulkGate dashboard)');
}

// Přidej SMS nastavení odkaz do kanceláře (vedle notif tlačítka)
(function addSmsBtn() {
  setTimeout(() => {
    const notifBtn = document.querySelector('[onclick*="notif-settings-modal"]');
    if(!notifBtn || notifBtn._smsAdded) return;
    const smsBtn = document.createElement('button');
    smsBtn.className = 'btn btn-ghost';
    smsBtn.style.cssText = 'font-size:11px;padding:5px 10px';
    smsBtn.title = 'Nastavení SMS';
    smsBtn.textContent = '📱';
    smsBtn.onclick = () => document.getElementById('sms-settings-modal').classList.add('open');
    notifBtn.after(smsBtn);
    notifBtn._smsAdded = true;
  }, 1000);
})();

// ══ SWITCHAB OVERRIDE — načti nové taby ═══════════════════════════
(function overrideSwitchTabForNewTabs() {
  let attempts = 0;
  const iv = setInterval(() => {
    attempts++;
    if(typeof switchTab !== 'undefined' || attempts > 30) {
      clearInterval(iv);
      if(typeof switchTab === 'undefined') return;
      const prev = switchTab;
      switchTab = function(tab) {
        prev(tab);
        if(tab === 'vykaz')   { renderVykaz(); }
        if(tab === 'cenik')   { loadCenik(); }
        if(tab === 'galerie') { renderGalerie(); }
      };
    }
  }, 300);
})();

// ══ INIT ═════════════════════════════════════════════════════════
// Načti km sazbu
const kmSazbaInput = document.getElementById('d-km-sazba');
if(kmSazbaInput) {
  kmSazbaInput.addEventListener('change', () => {
    window._kmSazba = parseFloat(kmSazbaInput.value)||5.60;
    localStorage.setItem('km-sazba', String(window._kmSazba));
  });
}
