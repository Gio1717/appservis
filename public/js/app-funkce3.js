// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 3 — dark mode, připomínky, počasí, drag&drop,
//  klávesové zkratky, SMS/email notif, import CSV, sortování
// ════════════════════════════════════════════════════════════════

// ══ DARK MODE ════════════════════════════════════════════════════
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  const btn = document.getElementById('dark-toggle');
  if(btn) btn.textContent = isDark ? '☀️' : '🌙';
}

(function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if(saved === '1' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
    const btn = document.getElementById('dark-toggle');
    if(btn) btn.textContent = '☀️';
  }
})();

// ══ PŘIPOMÍNKY / REMINDERS ═══════════════════════════════════════
function renderReminders() {
  const panel = document.getElementById('reminders-panel');
  const list  = document.getElementById('reminders-list');
  const cnt   = document.getElementById('reminders-count');
  if(!panel || !list) return;

  const now   = new Date();
  const today = now.toISOString().slice(0,10);
  const in7   = new Date(now.getTime() + 7*864e5).toISOString().slice(0,10);
  const in14  = new Date(now.getTime() + 14*864e5).toISOString().slice(0,10);
  const in30  = new Date(now.getTime() + 30*864e5).toISOString().slice(0,10);

  const reminders = [];
  const all = window._zakazky || [];

  // Blížící se termíny (7 dní)
  all.filter(z => {
    const t = z.termin||'';
    return t >= today && t <= in7 && !['zpracovaná','fakturovaná','zaplacena'].includes(z.stav||'nová');
  }).forEach(z => reminders.push({
    type: 'termin', zakazkaId: z.id,
    text: `Termín <strong>${esc(z.nazev||'—')}</strong> — ${fmtD(z.termin)}`,
    sub:  z.zakaznik ? `Zákazník: ${esc(z.zakaznik)}` : '',
    color: z.termin === today ? '#dc2626' : '#d97706',
    icon: z.termin === today ? '🔴' : '🟡',
    priority: z.termin === today ? 0 : 1
  }));

  // Nové nezpracované zakázky starší než 2 dny
  all.filter(z => {
    if((z.stav||'nová') !== 'nová') return false;
    const ts = z.createdAt?.toDate?.() || (z.createdAt ? new Date(z.createdAt) : null);
    if(!ts) return false;
    return (now - ts) > 2*864e5;
  }).forEach(z => reminders.push({
    type: 'nova', zakazkaId: z.id,
    text: `Nová zakázka čeká na zpracování: <strong>${esc(z.nazev||'—')}</strong>`,
    sub: `Vytvořeno: ${fmtTS(z.createdAt)}`,
    color: '#7c3aed', icon: '⚠️', priority: 2
  }));

  // Šablony s intervalem — zkontroluj jestli je čas na nový servis
  (_sablony||[]).filter(s => s.interval > 0).forEach(s => {
    // Najdi poslední zakázku z této šablony dle názvu
    const lastZ = all.filter(z => z.nazev === s.nazev)
      .sort((a,b) => (b.termin||'').localeCompare(a.termin||''))[0];
    if(lastZ && lastZ.termin) {
      const lastDate = new Date(lastZ.termin);
      const nextDate = new Date(lastDate.getTime() + s.interval*864e5);
      const nextStr  = nextDate.toISOString().slice(0,10);
      if(nextStr <= in30) {
        reminders.push({
          type: 'sablona',
          text: `Plánovaný servis: <strong>${esc(s.nazev)}</strong>`,
          sub:  `Naposledy: ${fmtD(lastZ.termin)} · Doporučeno: ${fmtD(nextStr)}`,
          color: '#0369a1', icon: '🔄', priority: 3,
          sablonaId: s.id
        });
      }
    }
  });

  reminders.sort((a,b) => a.priority - b.priority);

  if(!reminders.length) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  if(cnt) cnt.textContent = `${reminders.length} položek`;

  list.innerHTML = reminders.slice(0,8).map(r => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#fff;border:1px solid #fde68a;border-radius:8px;cursor:pointer"
      onclick="${r.zakazkaId ? `switchTab('orders');setTimeout(()=>openDetail('${r.zakazkaId}'),50)` : r.sablonaId ? `switchTab('sablony')` : ''}">
      <span style="font-size:16px;flex-shrink:0">${r.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;color:#1a2540">${r.text}</div>
        ${r.sub ? `<div style="font-size:11px;color:#6b7a99">${r.sub}</div>` : ''}
      </div>
      ${r.type==='sablona' ? `<button onclick="event.stopPropagation();createFromSablona('${r.sablonaId}')"
        style="font-size:10px;padding:3px 8px;background:#0369a1;color:#fff;border:none;border-radius:5px;cursor:pointer;flex-shrink:0;white-space:nowrap">Vytvořit</button>` : ''}
    </div>`).join('');
}

// Napoji na renderDashboard
const _rdOrig3 = typeof renderDashboard !== 'undefined' ? renderDashboard : null;
if(_rdOrig3) {
  renderDashboard = function() {
    _rdOrig3();
    renderReminders();
  };
}

// ══ POČASÍ (OpenWeatherMap — free tier) ═══════════════════════════
const WEATHER_CACHE = {};

async function loadWeather(zakazkaId, termin, adresa) {
  const el = document.getElementById('weather-body-'+zakazkaId);
  if(!el) return;

  // Zkontroluj jestli je datum v rozumném rozsahu (do 16 dní)
  const termDate = new Date(termin);
  const now = new Date();
  const diffDays = Math.round((termDate - now) / 864e5);
  if(diffDays < -1 || diffDays > 15) {
    el.innerHTML = `<span style="color:var(--muted)">Předpověď dostupná pouze pro termíny do 15 dní dopředu.</span>`;
    return;
  }

  const cacheKey = termin + '|' + (adresa||'Praha');
  if(WEATHER_CACHE[cacheKey]) {
    renderWeather(el, WEATHER_CACHE[cacheKey], diffDays);
    return;
  }

  // Použij Open-Meteo API — zdarma, bez klíče, spolehlivé
  try {
    // Geocoding přes nominatim
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresa||'Praha, CZ')}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {headers: {'User-Agent':'AcEuro-Service/1.0'}});
    const geoData = await geoRes.json();
    const lat = geoData[0]?.lat || '50.0755';
    const lon = geoData[0]?.lon || '14.4378';

    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=16&timezone=Europe%2FPrague`;
    const wRes = await fetch(wUrl);
    const wData = await wRes.json();

    // Najdi odpovídající den
    const dayIdx = (wData.daily?.time||[]).indexOf(termin);
    if(dayIdx < 0) {
      el.innerHTML = `<span>Data pro tento den nejsou dostupná.</span>`;
      return;
    }

    const result = {
      tMax:  wData.daily.temperature_2m_max[dayIdx],
      tMin:  wData.daily.temperature_2m_min[dayIdx],
      rain:  wData.daily.precipitation_sum[dayIdx],
      code:  wData.daily.weathercode[dayIdx],
      lat, lon
    };
    WEATHER_CACHE[cacheKey] = result;
    renderWeather(el, result, diffDays);
  } catch(e) {
    el.innerHTML = `<span style="color:var(--muted)">Předpověď není dostupná (offline nebo chyba sítě).</span>`;
  }
}

function renderWeather(el, data, diffDays) {
  const codes = {
    0:'☀️ Jasno',1:'🌤 Převážně jasno',2:'⛅ Polojasno',3:'☁️ Zataženo',
    45:'🌫 Mlha',48:'🌫 Námrazová mlha',
    51:'🌦 Slabé mrholení',53:'🌦 Mrholení',55:'🌧 Silné mrholení',
    61:'🌧 Slabý déšť',63:'🌧 Déšť',65:'🌧 Silný déšť',
    71:'🌨 Slabý sníh',73:'🌨 Sníh',75:'❄️ Silný sníh',
    80:'🌦 Přeháňky',81:'🌧 Silné přeháňky',82:'⛈ Bouřkové přeháňky',
    95:'⛈ Bouřka',96:'⛈ Bouřka s krupobitím',99:'⛈ Silná bouřka'
  };
  const desc = codes[data.code] || `Kód počasí: ${data.code}`;
  const rainWarn = data.rain > 5 ? `<span style="color:#dc2626;font-weight:600">⚠️ Déšť ${data.rain?.toFixed(1)} mm</span>` : '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <div style="font-size:24px">${desc.split(' ')[0]}</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${desc.replace(/^[^ ]+ /,'')}</div>
        <div style="font-size:12px;color:var(--muted)">Max <strong>${data.tMax}°C</strong> · Min <strong>${data.tMin}°C</strong>${data.rain>0?' · Srážky: '+(data.rain?.toFixed(1))+'mm':''}</div>
        ${rainWarn}
      </div>
      ${diffDays >= 0 ? '' : '<div style="font-size:10px;color:var(--muted);font-style:italic">Historické data</div>'}
    </div>`;
}

// Napoji na openDetail
const _odOrig3 = typeof openDetail !== 'undefined' ? openDetail : null;
if(_odOrig3) {
  const prev = openDetail;
  openDetail = function(id) {
    prev(id);
    setTimeout(() => {
      const z = (window._zakazky||[]).find(x=>x.id===id);
      if(z?.termin) loadWeather(id, z.termin, z.adresa||'Praha, CZ');
    }, 400);
  };
}

// ══ KLÁVESOVÉ ZKRATKY ════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Ignoruj pokud jsme v input/textarea
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  // Ignoruj pokud je otevřený modal
  if(document.querySelector('.modal-overlay.open')) {
    if(e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
    return;
  }

  const appK = document.getElementById('app-kancelar');
  if(!appK || appK.style.display === 'none') return;

  switch(e.key) {
    case 'n': case 'N':
      if(!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelector('.btn-pridat')?.click() || document.querySelector('[onclick*="openNewZakazka"]')?.click();
        // Fallback — hledej tlačítko Přidat
        document.querySelectorAll('button').forEach(b => {
          if(b.textContent.trim() === 'Přidat') b.click();
        });
      }
      break;
    case 'f': case 'F':
      if(!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const si = document.getElementById('search-inp');
        if(si) { si.focus(); si.select(); }
      }
      break;
    case 'Escape':
      const di = document.getElementById('detail-inner');
      if(di && di.style.display !== 'none') {
        di.style.display = 'none';
        const de = document.getElementById('detail-empty');
        if(de) de.style.display = 'flex';
      }
      break;
    case '1': switchTab && switchTab('orders'); break;
    case '2': switchTab && switchTab('dash'); break;
    case '3': switchTab && switchTab('sklad'); break;
    case '4': switchTab && switchTab('sablony'); break;
    case 'd': case 'D':
      if(!e.ctrlKey && !e.metaKey) toggleDarkMode();
      break;
  }
});

// Zobraz klávesové zkratky hint
(function addShortcutsHint() {
  const hint = document.createElement('div');
  hint.id = 'shortcuts-hint';
  hint.style.cssText = 'position:fixed;bottom:14px;right:14px;background:rgba(15,31,61,.85);color:#fff;font-size:10px;padding:8px 12px;border-radius:8px;backdrop-filter:blur(8px);z-index:800;display:none;line-height:1.8;pointer-events:none';
  hint.innerHTML = '<strong>Klávesové zkratky</strong><br>N = Nová zakázka<br>F = Hledat<br>D = Dark mode<br>Esc = Zavřít detail<br>1-4 = Přepnout záložku';
  document.body.appendChild(hint);
  document.addEventListener('keydown', e => {
    if(e.key === '?') {
      const h = document.getElementById('shortcuts-hint');
      if(h) h.style.display = h.style.display === 'none' ? 'block' : 'none';
    }
  });
})();

// ══ DRAG & DROP POŘADÍ ZAKÁZEK ════════════════════════════════════
let _dragId = null;
let _dragOrder = {}; // {id: order}

function initDragDrop() {
  const scroll = document.getElementById('list-scroll');
  if(!scroll || scroll._ddInit) return;
  scroll._ddInit = true;

  scroll.addEventListener('dragstart', e => {
    const card = e.target.closest('.zcard');
    if(!card) return;
    _dragId = card.dataset.id;
    card.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
  });

  scroll.addEventListener('dragend', e => {
    const card = e.target.closest('.zcard');
    if(card) card.style.opacity = '';
    _dragId = null;
  });

  scroll.addEventListener('dragover', e => {
    e.preventDefault();
    const card = e.target.closest('.zcard');
    if(!card || card.dataset.id === _dragId) return;
    const rect = card.getBoundingClientRect();
    const mid  = rect.top + rect.height/2;
    card.style.borderTop    = e.clientY < mid ? '2px solid var(--green)' : '';
    card.style.borderBottom = e.clientY >= mid ? '2px solid var(--green)' : '';
  });

  scroll.addEventListener('dragleave', e => {
    const card = e.target.closest('.zcard');
    if(card) { card.style.borderTop = ''; card.style.borderBottom = ''; }
  });

  scroll.addEventListener('drop', e => {
    e.preventDefault();
    const targetCard = e.target.closest('.zcard');
    if(!targetCard || !_dragId) return;
    targetCard.style.borderTop = ''; targetCard.style.borderBottom = '';

    const cards = [...scroll.querySelectorAll('.zcard[data-id]')];
    const fromIdx = cards.findIndex(c => c.dataset.id === _dragId);
    const toIdx   = cards.findIndex(c => c === targetCard);
    if(fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    // Přesun v DOM
    const moving = cards[fromIdx];
    if(fromIdx < toIdx) targetCard.after(moving);
    else targetCard.before(moving);

    // Ulož pořadí do localStorage
    const newOrder = {};
    [...scroll.querySelectorAll('.zcard[data-id]')].forEach((c,i) => newOrder[c.dataset.id] = i);
    _dragOrder = newOrder;
    localStorage.setItem('zakazky-order', JSON.stringify(newOrder));
  });
}

// Přidej draggable attr do renderList + data-id
const _rlOrig3 = typeof renderList !== 'undefined' ? renderList : null;
if(_rlOrig3) {
  const prevRl = renderList;
  renderList = function() {
    prevRl();
    // Přidej draggable a data-id
    document.querySelectorAll('.zcard').forEach(c => {
      const onclick = c.getAttribute('onclick')||'';
      const m = onclick.match(/openDetail\('([^']+)'\)/);
      if(m) {
        c.setAttribute('draggable','true');
        c.dataset.id = m[1];
      }
    });
    setTimeout(initDragDrop, 50);
  };
}

// ══ E-MAIL NOTIFIKACE (EmailJS) ═══════════════════════════════════
let _emailjsReady = false;

function loadEmailJS() {
  if(_emailjsReady || typeof emailjs !== 'undefined') { _emailjsReady = true; return Promise.resolve(); }
  return new Promise((res,rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => {
      const cfg = getNotifSettings();
      if(cfg.pubkey) emailjs.init({publicKey: cfg.pubkey});
      _emailjsReady = true;
      res();
    };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function getNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem('emailjs-cfg')||'{}');
  } catch(e) { return {}; }
}

function saveNotifSettings() {
  const cfg = {
    serviceId:  document.getElementById('emailjs-service')?.value.trim(),
    templateId: document.getElementById('emailjs-template')?.value.trim(),
    pubkey:     document.getElementById('emailjs-pubkey')?.value.trim()
  };
  localStorage.setItem('emailjs-cfg', JSON.stringify(cfg));
  closeModal('notif-settings-modal');
  alert('✅ Nastavení uloženo');
}

async function sendEmailNotif(techEmail, techName, zakazka) {
  const cfg = getNotifSettings();
  if(!cfg.serviceId || !cfg.templateId || !cfg.pubkey) return; // Není nakonfigurováno

  try {
    await loadEmailJS();
    await emailjs.send(cfg.serviceId, cfg.templateId, {
      to_email:   techEmail,
      to_name:    techName,
      zakazka_name:   zakazka.nazev||'—',
      zakazka_cislo:  zakazka.cislo||'—',
      zakazka_termin: fmtD(zakazka.termin)||'—',
      zakazka_zadani: zakazka.zadani||'—',
      zakazka_adresa: zakazka.adresa||'—',
    });
    console.log('📧 Email notifikace odeslána:', techEmail);
  } catch(e) {
    console.warn('EmailJS error:', e);
  }
}

async function testEmailNotif() {
  const addr = document.getElementById('emailjs-test-addr')?.value.trim();
  if(!addr) { alert('Zadejte testovací e-mail'); return; }
  await sendEmailNotif(addr, 'Technik', {nazev:'Testovací zakázka', cislo:'TEST-001', termin: new Date().toISOString().slice(0,10)});
  alert('Test e-mail odeslán (zkontrolujte emailjs dashboard pro potvrzení)');
}

// Napoji na saveAssignment (přiřazení technika)
const _saveAssignOrig = typeof saveAssignment !== 'undefined' ? saveAssignment : null;
// Funkce saveAssignment je async — napojíme přes Firestore listener pro nové přiřazení
// Při změně zakazky.assignedTo pošleme e-mail
if(typeof window._fb !== 'undefined') {
  // Sleduj změny přiřazení
  let _prevAssignments = {};
  const _checkAssignments = (zakazky) => {
    zakazky.forEach(z => {
      const prev = _prevAssignments[z.id];
      if(prev !== undefined && prev !== z.assignedTo && z.assignedTo) {
        // Nové přiřazení — najdi e-mail technika
        const tech = (_techList||[]).find(t => t.name === z.assignedTo || t.email === z.assignedTo);
        if(tech?.email) sendEmailNotif(tech.email, tech.name||z.assignedTo, z);
      }
      _prevAssignments[z.id] = z.assignedTo;
    });
  };

  // Napoji na realtime listener
  const _sskOrig = typeof startKancelarLive !== 'undefined' ? startKancelarLive : null;
}

// ══ IMPORT CSV/EXCEL ══════════════════════════════════════════════
let _importRows = [];

function handleImportDrop(e) {
  const file = e.dataTransfer?.files?.[0];
  if(file) processImportFile(file);
}

function handleImportFile(input) {
  const file = input?.files?.[0];
  if(file) processImportFile(file);
}

function processImportFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    let rows = [];
    const name = file.name.toLowerCase();

    if(name.endsWith('.csv')) {
      // Parse CSV
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if(lines.length < 2) { alert('CSV soubor je prázdný nebo neobsahuje data.'); return; }

      const sep = lines[0].includes(';') ? ';' : ',';
      const parseRow = line => {
        const cols = [];
        let cur = '', inQ = false;
        for(let i = 0; i < line.length; i++) {
          const ch = line[i];
          if(ch === '"') { inQ = !inQ; }
          else if(ch === sep && !inQ) { cols.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        cols.push(cur.trim());
        return cols;
      };

      const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/['"]/g,''));
      rows = lines.slice(1).map(l => {
        const vals = parseRow(l);
        const obj = {};
        headers.forEach((h,i) => obj[h] = vals[i]||'');
        return obj;
      });

    } else if(name.endsWith('.xlsx') || name.endsWith('.xls')) {
      alert('XLSX import — načtěte soubor přes SheetJS. Zatím podporujeme CSV. Uložte jako .csv z Excelu (Soubor → Uložit jako → CSV).');
      return;
    }

    // Mapování sloupců
    const colMap = {
      nazev:    ['název','nazev','name','zakázka','zakazka','title'],
      zakaznik: ['zákazník','zakaznik','customer','firma','klient'],
      technik:  ['technik','technician','pracovnik','pracovník'],
      termin:   ['termín','termin','datum','date','deadline'],
      cena:     ['cena','price','částka','castka','hodnota'],
      stav:     ['stav','status','state'],
      ico:      ['ičo','ico','ic'],
      adresa:   ['adresa','address','místo','misto'],
      prace:    ['prace','práce','popis','description','poznamky','poznámky'],
      cislo:    ['číslo','cislo','number','č.'],
    };

    _importRows = rows.map(r => {
      const z = {};
      Object.entries(colMap).forEach(([field, aliases]) => {
        for(const alias of aliases) {
          const key = Object.keys(r).find(k => k.replace(/[^a-záčďéěíňóřšťúůýž0-9]/gi,'').toLowerCase() === alias.replace(/[^a-záčďéěíňóřšťúůýž0-9]/gi,'').toLowerCase());
          if(key && r[key]) { z[field] = r[key]; break; }
        }
      });
      return z;
    }).filter(z => z.nazev); // Musí mít název

    showImportPreview(_importRows);
  };

  if(file.name.toLowerCase().endsWith('.csv')) {
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.readAsArrayBuffer(file);
  }
}

function showImportPreview(rows) {
  const preview = document.getElementById('import-preview');
  const cnt     = document.getElementById('import-preview-count');
  const tbl     = document.getElementById('import-preview-tbl');
  const btn     = document.getElementById('import-confirm-btn');
  if(!preview || !tbl) return;

  preview.style.display = 'block';
  if(cnt) cnt.textContent = `${rows.length} zakázek`;
  if(btn) btn.style.display = '';

  const fields = ['nazev','zakaznik','technik','termin','cena','stav'];
  const labels = {nazev:'Název',zakaznik:'Zákazník',technik:'Technik',termin:'Termín',cena:'Cena',stav:'Stav'};

  tbl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:var(--bg)">
      ${fields.map(f => `<th style="padding:6px 8px;text-align:left;font-weight:700;color:var(--navy);border-bottom:2px solid var(--border)">${labels[f]}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${rows.slice(0,10).map((r,i) => `<tr style="border-bottom:1px solid var(--border);${i%2?'background:var(--bg)':''}">
        ${fields.map(f => `<td style="padding:5px 8px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r[f]||'—')}</td>`).join('')}
      </tr>`).join('')}
      ${rows.length > 10 ? `<tr><td colspan="${fields.length}" style="padding:6px 8px;color:var(--muted);font-style:italic">… a dalších ${rows.length-10} zakázek</td></tr>` : ''}
    </tbody>
  </table>`;
}

async function confirmImport() {
  if(!_importRows.length) return;
  const btn = document.getElementById('import-confirm-btn');
  if(btn) { btn.disabled = true; btn.textContent = `⏳ Importuji ${_importRows.length} zakázek…`; }

  let done = 0, errors = 0;
  const me = window._currentUser;

  for(const row of _importRows) {
    try {
      const newZ = {
        nazev:    row.nazev||'',
        zakaznik: row.zakaznik||'',
        technik:  row.technik||'',
        termin:   row.termin||'',
        cena:     row.cena||'',
        stav:     row.stav||'nová',
        ico:      row.ico||'',
        adresa:   row.adresa||'',
        prace:    row.prace||'',
        cislo:    row.cislo||'',
        firma:    'aceuro',
        rows:     [], exts:[],
        createdBy: me?.uid||'',
        createdAt: window._fb.serverTimestamp(),
        _importedAt: new Date().toISOString()
      };
      await window._fb.addDoc(window._fb.collection(window._fb.db,'zakazky'), newZ);
      saveAuditLog('', 'import', row.nazev);
      done++;
    } catch(e) { errors++; }
  }

  if(btn) { btn.disabled = false; btn.textContent = '📥 Importovat zakázky'; }
  closeModal('import-modal');
  _importRows = [];
  alert(`✅ Import dokončen\n${done} zakázek importováno${errors?'\n⚠️ '+errors+' chyb':''}`)
}

// Načti nastavení emailjs do formuláře při otevření modalu
document.addEventListener('click', e => {
  if(e.target.closest('[onclick*="notif-settings-modal"]')) {
    setTimeout(() => {
      const cfg = getNotifSettings();
      document.getElementById('emailjs-service')?.setAttribute('value', cfg.serviceId||'');
      document.getElementById('emailjs-template')?.setAttribute('value', cfg.templateId||'');
      document.getElementById('emailjs-pubkey')?.setAttribute('value', cfg.pubkey||'');
      if(cfg.serviceId) document.getElementById('emailjs-service').value = cfg.serviceId;
      if(cfg.templateId) document.getElementById('emailjs-template').value = cfg.templateId;
      if(cfg.pubkey) document.getElementById('emailjs-pubkey').value = cfg.pubkey;
    }, 100);
  }
});

// ══ FIREBASE STORAGE PRO FOTKY (migrační helper) ══════════════════
// Upozornění při velkém počtu fotek v zakázce
function checkPhotoStorage(zakazka) {
  const photos = zakazka.photos || [];
  const base64Count = photos.filter(p => p.dataUrl && p.dataUrl.startsWith('data:')).length;
  if(base64Count > 5) {
    console.warn(`Zakázka ${zakazka.id} má ${base64Count} base64 fotek — zvažte migraci do Firebase Storage`);
  }
}

// ══ INIT NA DASHBOARD ════════════════════════════════════════════
// Spusť připomínky kdykoli se načtou zakázky
const _sklOrig = typeof startKancelarLive !== 'undefined';
// Zachyť nové zakazky a checkni připomínky
if(typeof window._fb !== 'undefined') {
  setTimeout(() => {
    if(window._zakazky && renderReminders) renderReminders();
    if(document.getElementById('tab-orders')?.classList.contains('active')) {
      renderList && renderList();
    }
  }, 2000);
}
