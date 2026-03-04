// ════════════════════════════════════════════════════════════════
//  SOUHRN PRO TECHNIKA — stažení jako HTML soubor
// ════════════════════════════════════════════════════════════════

async function downloadZakazkaSouhrn(zakazkaId) {
  if(!zakazkaId) return;

  // Najdi zakázku — funguje jak v kanceláři tak u technika
  const z = (window._zakazky || window._assignedZakazky || []).find(x => x.id === zakazkaId)
         || (_assignedZakazky||[]).find(x => x.id === zakazkaId);
  if(!z) { alert('Zakázka nenalezena'); return; }

  // Načti audit log pro historii (neblokující)
  let auditItems = [];
  try {
    const snap = await window._fb.getDocs(
      window._fb.query(
        window._fb.collection(window._fb.db, 'zakazky', zakazkaId, 'audit'),
        window._fb.orderBy('createdAt', 'asc')
      )
    );
    auditItems = snap.docs.map(d => {
      const data = d.data();
      const ts = data.createdAt?.toDate?.() || new Date();
      return { ...data, tsStr: ts.toLocaleString('cs-CZ') };
    });
  } catch(e) { /* audit nemusí existovat */ }

  const firma = window._currentFirma === 'progres' ? 'PROGRESKLIMA CZ s.r.o.' : 'AC EURO s.r.o.';
  const dnes  = new Date().toLocaleDateString('cs-CZ');
  const kmNahrada = z.km ? `${z.km} km × ${z.kmSazba||5.60} Kč = ${((z.km||0)*(z.kmSazba||5.60)).toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč` : '—';

  // Fotky — max 6 pro přehlednost, jako base64 inline
  const fotoHtml = (z.photos||[]).slice(0,6).map(p => {
    const src = p.cloudUrl || p.dataUrl || '';
    if(!src) return '';
    return `<div style="break-inside:avoid">
      <img src="${src}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;display:block">
      ${p.caption ? `<div style="font-size:10px;color:#64748b;margin-top:3px;text-align:center">${p.caption}</div>` : ''}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Souhrn zakázky — ${z.cislo||z.nazev||'—'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1e293b; background: #f8fafc; padding: 16px; }
  .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,.1); }

  /* Header */
  .hdr { background: #0f1f3d; color: #fff; padding: 20px 24px; }
  .hdr-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
  .hdr-firma { font-size: 11px; color: rgba(255,255,255,.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .hdr-nazev { font-size: 20px; font-weight: 800; line-height: 1.2; }
  .hdr-meta { font-size: 12px; color: rgba(255,255,255,.7); margin-top: 6px; }
  .stav-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.3); white-space: nowrap; }

  /* Sekce */
  .body { padding: 20px 24px; }
  .sec { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .sec-hdr { background: #f8fafc; padding: 8px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #475569; border-bottom: 1px solid #e2e8f0; }
  .sec-body { padding: 12px 14px; }

  /* Grid pro info */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-item label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px; }
  .info-item span { font-size: 13px; color: #1e293b; font-weight: 500; }

  /* Zadání */
  .zadani-box { background: #eff6ff; border: 1.5px solid #93c5fd; border-radius: 8px; padding: 14px; white-space: pre-wrap; line-height: 1.6; color: #1e3a5f; font-size: 13px; }

  /* Fotky */
  .foto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

  /* Audit */
  .audit-row { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .audit-row:last-child { border-bottom: none; }
  .audit-icon { font-size: 16px; flex-shrink: 0; width: 24px; text-align: center; }
  .audit-text { flex: 1; }
  .audit-val { font-size: 12px; font-weight: 600; }
  .audit-note { font-size: 11px; color: #64748b; }
  .audit-meta { font-size: 10px; color: #94a3b8; }

  /* Podpisy */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sig-box { border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; }
  .sig-box img { max-height: 80px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
  .sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }

  /* Cena */
  .cena-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .cena-row:last-child { border-bottom: none; padding-top: 10px; font-weight: 800; font-size: 16px; color: #16a34a; }

  /* Footer */
  .foot { padding: 14px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }

  /* Tisk */
  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; border-radius: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-top">
      <div>
        <div class="hdr-firma">${firma}</div>
        <div class="hdr-nazev">${z.nazev||'Servisní zakázka'}</div>
        <div class="hdr-meta">
          Číslo: <strong style="color:#fff">${z.cislo||'—'}</strong>
          &nbsp;·&nbsp; Termín: <strong style="color:#fff">${z.termin ? new Date(z.termin+'T12:00').toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '—'}</strong>
        </div>
      </div>
      <div>
        <span class="stav-badge">${z.stav||'nová'}</span>
        <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:6px;text-align:right">Vytištěno: ${dnes}</div>
      </div>
    </div>
  </div>

  <div class="body">

    <!-- Tlačítka (skryjí se při tisku) -->
    <div class="no-print" style="display:flex;gap:8px;margin-bottom:16px">
      <button onclick="window.print()" style="background:#0f1f3d;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
        🖨 Tisknout
      </button>
      <button onclick="window.close()" style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px">
        Zavřít
      </button>
    </div>

    <!-- Zákazník + Technik -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="sec">
        <div class="sec-hdr">🏢 Zákazník</div>
        <div class="sec-body">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${z.zakaznik||'—'}</div>
          ${z.ico ? `<div style="font-size:11px;color:#64748b">IČO: ${z.ico}${z.dic?' · DIČ: '+z.dic:''}</div>` : ''}
          ${z.adresa ? `<div style="font-size:11px;color:#475569;margin-top:4px">${z.adresa}</div>
          <a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" style="font-size:11px;color:#1d4ed8;display:inline-block;margin-top:4px">📍 Otevřít v mapách</a>` : ''}
        </div>
      </div>
      <div class="sec">
        <div class="sec-hdr">🔧 Přiřazený technik</div>
        <div class="sec-body">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${z.technik||'—'}</div>
          ${z.hodiny ? `<div style="font-size:11px;color:#64748b">⏱ Odpracováno: ${z.hodiny} h</div>` : ''}
          ${z.km ? `<div style="font-size:11px;color:#64748b">🚗 Km: ${kmNahrada}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Zadání od kanceláře -->
    ${z.zadani ? `<div class="sec" style="margin-bottom:16px;border-color:#93c5fd">
      <div class="sec-hdr" style="background:#eff6ff;color:#1d4ed8">📋 Zadání od kanceláře</div>
      <div class="sec-body">
        <div class="zadani-box">${z.zadani}</div>
      </div>
    </div>` : ''}

    <!-- Provedené práce -->
    ${z.prace ? `<div class="sec" style="margin-bottom:16px">
      <div class="sec-hdr">🔧 Provedené práce (technik)</div>
      <div class="sec-body" style="white-space:pre-wrap;line-height:1.6">${z.prace}</div>
    </div>` : ''}

    <!-- Použité díly / cena -->
    ${z.cena ? `<div class="sec" style="margin-bottom:16px;border-color:#86efac">
      <div class="sec-hdr" style="background:#f0fdf4;color:#15803d">💰 Fakturační souhrn</div>
      <div class="sec-body">
        ${z.rows ? z.rows.filter(r=>r.pol).map(r=>`
          <div class="cena-row">
            <span>${r.pol}${r.poc?` (${r.poc} ks)`:''}</span>
            <span style="font-family:monospace">${r.cel||r.cen||'—'} Kč</span>
          </div>`).join('') : ''}
        <div class="cena-row">
          <span>CELKEM BEZ DPH</span>
          <span style="font-family:monospace">${z.cena}</span>
        </div>
        ${z.duzp ? `<div style="font-size:11px;color:#64748b;margin-top:6px">DUZP: ${z.duzp}</div>` : ''}
      </div>
    </div>` : ''}

    <!-- Fotodokumentace -->
    ${fotoHtml ? `<div class="sec" style="margin-bottom:16px">
      <div class="sec-hdr">📷 Fotodokumentace (${(z.photos||[]).length} ks${(z.photos||[]).length>6?' · zobrazeno 6':''})</div>
      <div class="sec-body">
        <div class="foto-grid">${fotoHtml}</div>
      </div>
    </div>` : ''}

    <!-- Průběh zakázky -->
    ${auditItems.length ? `<div class="sec" style="margin-bottom:16px">
      <div class="sec-hdr">📅 Průběh zakázky</div>
      <div class="sec-body">
        ${auditItems.map(a => {
          const icon = {stav_zmena:'🔄','předáno_dál':'➡',vráceno:'↩',vytvoreno:'🆕',import:'📥'}[a.action]||'📋';
          return `<div class="audit-row">
            <div class="audit-icon">${icon}</div>
            <div class="audit-text">
              <div class="audit-val">${a.value||a.action||'—'}</div>
              ${a.note?`<div class="audit-note">${a.note}</div>`:''}
              <div class="audit-meta">${a.author||''} · ${a.tsStr||''}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Podpisy -->
    ${(z.sig1||z.sig2) ? `<div class="sec" style="margin-bottom:0">
      <div class="sec-hdr">✍️ Podpisy</div>
      <div class="sec-body">
        <div class="sig-grid">
          <div class="sig-box">
            <div class="sig-label">Za zhotovitele</div>
            ${z.sig1 ? `<img src="${z.sig1}">` : '<div style="height:60px;border:1px dashed #cbd5e1;border-radius:4px"></div>'}
            <div style="font-size:10px;color:#94a3b8;margin-top:6px">${z.sigDate1||''}</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Za objednatele (zákazník)</div>
            ${z.sig2 ? `<img src="${z.sig2}">` : '<div style="height:60px;border:1px dashed #cbd5e1;border-radius:4px"></div>'}
            <div style="font-size:10px;color:#94a3b8;margin-top:6px">${z.sigDate2||''}</div>
          </div>
        </div>
      </div>
    </div>` : ''}

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="foot">
    <span>${firma}</span>
    <span>Zakázka č. ${z.cislo||'—'} · Vygenerováno ${dnes}</span>
  </div>

</div><!-- /page -->
\u003cscript>
// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 7 — rychlá zakázka, opakující se zakázky,
//  hodnocení zákazníkem, auto-check šablon
// ════════════════════════════════════════════════════════════════

// ══ RYCHLÁ ZAKÁZKA (technik) ══════════════════════════════════════
function openQuickZakazka() {
  const overlay = document.getElementById('quick-zakaz-overlay');
  if(!overlay) return;

  // Nastav dnešní datum
  const termin = document.getElementById('qz-termin');
  if(termin && !termin.value) termin.value = new Date().toISOString().slice(0,10);

  // Naplň autocomplete zákazníků
  const dl = document.getElementById('qz-zak-list');
  if(dl && window._zakaznici?.length) {
    dl.innerHTML = window._zakaznici.map(z=>`<option value="${z.nazev}">`).join('');
  } else if(dl && window._zakazky?.length) {
    const names = [...new Set(window._zakazky.map(z=>z.zakaznik||'').filter(Boolean))];
    dl.innerHTML = names.map(n=>`<option value="${n}">`).join('');
  }

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('qz-nazev')?.focus(), 100);
}

function closeQuickZakazka() {
  const overlay = document.getElementById('quick-zakaz-overlay');
  if(overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

async function saveQuickZakazka() {
  const nazev = document.getElementById('qz-nazev')?.value.trim();
  if(!nazev) {
    document.getElementById('qz-nazev').style.borderColor = '#ef4444';
    return;
  }

  const btn = document.querySelector('#quick-zakaz-overlay button[onclick="saveQuickZakazka()"]');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Ukládám…'; }

  const me = window._currentUser;
  const data = {
    nazev,
    zakaznik: document.getElementById('qz-zakaznik')?.value.trim() || '',
    adresa:   document.getElementById('qz-adresa')?.value.trim() || '',
    termin:   document.getElementById('qz-termin')?.value || '',
    prace:    document.getElementById('qz-popis')?.value.trim() || '',
    zadani:   document.getElementById('qz-popis')?.value.trim() || '',
    stav:     'nová',
    firma:    window._currentFirma || 'aceuro',
    technik:  me?.displayName || me?.email || '',
    technikUid: me?.uid || '',
    createdBy: me?.uid || '',
    quickCreate: true,
    createdAt: window._fb.serverTimestamp(),
    updatedAt: window._fb.serverTimestamp(),
  };

  // Generuj číslo
  const year = new Date().getFullYear();
  const count = (window._zakazky||[]).filter(z=>z.cislo?.startsWith(String(year))).length + 1;
  data.cislo = `${year}-${String(count).padStart(4,'0')}`;

  try {
    await window._fb.addDoc(window._fb.collection(window._fb.db,'zakazky'), data);
    closeQuickZakazka();
    // Vymaž formulář
    ['qz-nazev','qz-zakaznik','qz-adresa','qz-popis'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    showToast && showToast('✅ Zakázka vytvořena');
    // Načti přiřazené zakázky
    loadAssignedZakazky && loadAssignedZakazky(window._currentUser);
  } catch(e) {
    alert('Chyba: ' + e.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '✓ Vytvořit zakázku'; }
  }
}

// Zavři na klik mimo
document.getElementById('quick-zakaz-overlay')?.addEventListener('click', e => {
  if(e.target.id === 'quick-zakaz-overlay') closeQuickZakazka();
});

// ══ OPAKUJÍCÍ SE ZAKÁZKY (automatické vytváření ze šablon) ════════
async function checkAndCreateRepeatZakazky() {
  if(!window._sablony?.length) return;
  const dnes = new Date().toISOString().slice(0,10);
  const me = window._currentUser;
  let created = 0;

  for(const s of window._sablony) {
    if(!s.interval || !s.autoCreate) continue; // jen šablony s autoCreate=true

    // Najdi poslední zakázku z této šablony
    const fromSablona = (window._zakazky||[])
      .filter(z => z.sablonaId === s.id)
      .sort((a,b) => (b.termin||'').localeCompare(a.termin||''));

    const lastZ = fromSablona[0];
    let nextTermin;

    if(lastZ?.termin) {
      const last = new Date(lastZ.termin);
      last.setDate(last.getDate() + parseInt(s.interval));
      nextTermin = last.toISOString().slice(0,10);
    } else {
      // Žádná předchozí — naplánuj na dnes + interval
      const next = new Date();
      next.setDate(next.getDate() + parseInt(s.interval));
      nextTermin = next.toISOString().slice(0,10);
    }

    // Vytvoř jen pokud termín je do 7 dní od teď a zakázka ještě neexistuje
    const diffDays = Math.ceil((new Date(nextTermin) - new Date(dnes)) / 86400000);
    if(diffDays > 7 || diffDays < 0) continue;

    // Zkontroluj zda už taková zakázka v tomto termínu existuje
    const alreadyExists = (window._zakazky||[]).some(z =>
      z.sablonaId === s.id && z.termin === nextTermin
    );
    if(alreadyExists) continue;

    // Vytvoř zakázku
    try {
      await window._fb.addDoc(window._fb.collection(window._fb.db,'zakazky'), {
        nazev:    s.nazev,
        typ:      s.typ||'',
        firma:    s.firma||window._currentFirma||'aceuro',
        prace:    s.prace||'',
        zadani:   s.zadani||s.prace||'',
        rows:     s.rows||[],
        zakaznik: s.zakaznik||'',
        adresa:   s.adresa||'',
        termin:   nextTermin,
        stav:     'nová',
        sablonaId: s.id,
        sablonaAutoCreate: true,
        createdBy: me?.uid||'system',
        createdAt: window._fb.serverTimestamp(),
        updatedAt: window._fb.serverTimestamp(),
      });
      created++;
    } catch(e) { console.warn('Auto-create failed:', e); }
  }

  if(created > 0) {
    showToast && showToast(`🔄 Automaticky vytvořeno ${created} opakujících se zakázek`);
    showInAppNotif && showInAppNotif(`🔄 Automaticky vytvořeno ${created} zakázek ze šablon`, null);
  }
}

// Spusť kontrolu po načtení šablon
(function scheduleRepeatCheck() {
  let checked = false;
  const iv = setInterval(() => {
    if(window._sablony && window._zakazky && !checked) {
      checked = true;
      clearInterval(iv);
      checkAndCreateRepeatZakazky();
    }
  }, 2000);
})();

// ══ HODNOCENÍ ZÁKAZNÍKEM ══════════════════════════════════════════
let _hodnoceniValue = 0;

function setHvezda(n) {
  _hodnoceniValue = n;
  for(let i=1;i<=5;i++) {
    const el = document.getElementById('hv'+i);
    if(el) {
      el.textContent = i <= n ? '★' : '☆';
      el.style.color = i <= n ? '#f59e0b' : '#9ca3af';
      el.style.transform = i === n ? 'scale(1.3)' : 'scale(1)';
    }
  }
  setTimeout(() => {
    for(let i=1;i<=5;i++) {
      const el = document.getElementById('hv'+i);
      if(el) el.style.transform = '';
    }
  }, 200);
}

function hoverHvezda(n) {
  for(let i=1;i<=5;i++) {
    const el = document.getElementById('hv'+i);
    if(!el) continue;
    if(n === 0) {
      // Vrať na aktuální hodnocení
      el.textContent = i <= _hodnoceniValue ? '★' : '☆';
      el.style.color = i <= _hodnoceniValue ? '#f59e0b' : '#9ca3af';
    } else {
      el.textContent = i <= n ? '★' : '☆';
      el.style.color = i <= n ? '#f59e0b' : '#d1d5db';
    }
  }
}

function openHodnoceniModal(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  document.getElementById('hodnoceni-id').value = zakazkaId;
  document.getElementById('hodnoceni-nazev').textContent =
    z ? `Hodnocení: ${z.nazev||'Zakázka'}` : 'Hodnocení zakázky';
  document.getElementById('hodnoceni-sub').textContent =
    z?.zakaznik ? `Zákazník: ${z.zakaznik}` : 'Jak jste spokojeni se servisním zásahem?';
  document.getElementById('hodnoceni-text').value = '';
  document.getElementById('hodnoceni-jmeno').value = z?.zakaznik||'';
  _hodnoceniValue = 0;
  setHvezda(0);
  document.getElementById('hodnoceni-modal').classList.add('open');
}

async function saveHodnoceni() {
  const id = document.getElementById('hodnoceni-id').value;
  if(!_hodnoceniValue) {
    // Vizuální feedback — musí vybrat hvězdičky
    document.getElementById('hvezdicky').style.animation = 'shake .3s';
    setTimeout(() => document.getElementById('hvezdicky').style.animation = '', 400);
    return;
  }
  const text  = document.getElementById('hodnoceni-text')?.value.trim() || '';
  const jmeno = document.getElementById('hodnoceni-jmeno')?.value.trim() || '';
  try {
    // Ulož hodnocení do Firestore
    await window._fb.addDoc(
      window._fb.collection(window._fb.db,'hodnoceni'),
      {
        zakazkaId: id,
        hvezdicky: _hodnoceniValue,
        text, jmeno,
        createdAt: window._fb.serverTimestamp()
      }
    );
    // Ulož průměr na zakázku
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db,'zakazky',id),
      { hodnoceni: _hodnoceniValue, hodnoceniText: text, updatedAt: window._fb.serverTimestamp() }
    );
    closeModal('hodnoceni-modal');
    showToast && showToast('⭐ Hodnocení odesláno, děkujeme!');
    // Notifikace kanceláři
    const z = (window._zakazky||[]).find(x=>x.id===id);
    showInAppNotif && showInAppNotif(
      `⭐ Nové hodnocení (${_hodnoceniValue}/5): ${z?.nazev||'—'}${text?' · '+text.substring(0,40):''}`,
      id
    );
  } catch(e) { alert('Chyba: '+e.message); }
}

// Odkaz na hodnocení pro zákazníka (otevře modal přímo)
function openHodnoceniLink(zakazkaId) {
  // Generuj sdílitelný odkaz — zakázka ID jako hash parametr
  const url = location.origin + location.pathname + '#hodnoceni=' + zakazkaId;

  // Zobraz dialog s možností kopírovat nebo odeslat SMS
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  const smsText = `Dobrý den, ${z?.zakaznik?z.zakaznik+', ':''
    }rádi bychom znali Váš názor na náš servisní zásah. Ohodnoťte nás: ${url}`;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `<div style="background:#fff;border-radius:14px;padding:24px;max-width:460px;width:100%">
    <h3 style="margin-bottom:4px;color:var(--navy)">⭐ Odkaz na hodnocení</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:14px">Zákazník klikne na odkaz a ohodnotí zakázku bez nutnosti přihlášení.</p>
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px;word-break:break-all;margin-bottom:12px;font-family:monospace">${url}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="navigator.clipboard.writeText('${url}');showToast&&showToast('✓ Odkaz zkopírován')"
        class="btn btn-primary" style="font-size:12px">📋 Kopírovat odkaz</button>
      <button onclick="navigator.clipboard.writeText('${smsText.replace(/'/g,'&apos;')}');showToast&&showToast('✓ SMS text zkopírován')"
        class="btn btn-ghost" style="font-size:12px">📱 Kopírovat SMS text</button>
      <button onclick="this.closest('.hodnoceni-link-modal').remove()"
        class="btn btn-ghost" style="font-size:12px;margin-left:auto">Zavřít</button>
    </div>
  </div>`;
  modal.className = 'hodnoceni-link-modal';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  document.body.appendChild(modal);
}

// Zkontroluj hash při načtení — otevři hodnocení pokud je v URL
(function checkHodnoceniHash() {
  const hash = location.hash;
  if(hash.startsWith('#hodnoceni=')) {
    const id = hash.replace('#hodnoceni=','');
    if(id) {
      // Počkej na načtení dat
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if(window._zakazky || tries > 20) {
          clearInterval(iv);
          openHodnoceniModal(id);
          history.replaceState(null,'',location.pathname); // odstraň hash
        }
      }, 500);
    }
  }
})();

// ══ HODNOCENÍ V KANCELÁŘ DETAILU ══════════════════════════════════
// Zobraz hvězdičky v detailu zakázky pokud existuje hodnocení
(function hookHodnoceniOnDetail() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof openDetail !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof openDetail === 'undefined') return;
      const prev = openDetail;
      openDetail = function(id) {
        prev(id);
        setTimeout(() => {
          const z = (window._zakazky||[]).find(x=>x.id===id);
          if(!z?.hodnoceni) return;
          // Najdi header detailu a přidej hvězdičky
          const hdr = document.querySelector('.detail-hdr-left');
          if(hdr && !hdr.querySelector('.hodnoceni-stars')) {
            const stars = document.createElement('div');
            stars.className = 'hodnoceni-stars';
            stars.style.cssText = 'font-size:13px;margin-top:4px';
            stars.innerHTML = '★'.repeat(z.hodnoceni) + '☆'.repeat(5-z.hodnoceni) +
              `<span style="font-size:11px;color:rgba(255,255,255,.7);margin-left:6px">${z.hodnoceni}/5</span>` +
              (z.hodnoceniText ? `<span style="font-size:11px;color:rgba(255,255,255,.6);margin-left:8px;font-style:italic">"${z.hodnoceniText.substring(0,40)}"</span>` : '');
            stars.style.color = '#fbbf24';
            hdr.appendChild(stars);
          }
        }, 400);
      };
    }
  }, 200);
})();

// ══ AUTO-CREATE šablony — přidej pole autoCreate do šablona modalu ══
(function patchSablonaModal() {
  setTimeout(() => {
    // Najdi sablona modal form a přidej checkbox autoCreate pokud neexistuje
    const form = document.getElementById('sablona-form') || document.querySelector('[id*="sablona"]');
    // Přidáme přes interval field description
    const intervalInp = document.querySelector('input[id*="interval"]') || document.getElementById('s-interval');
    if(intervalInp && !intervalInp._patched) {
      intervalInp._patched = true;
      const wrapper = intervalInp.closest('.fg2') || intervalInp.parentElement;
      if(wrapper) {
        const autoDiv = document.createElement('div');
        autoDiv.style.cssText = 'margin-top:8px;display:flex;align-items:center;gap:8px';
        autoDiv.innerHTML = `<input type="checkbox" id="s-auto-create" style="width:16px;height:16px">
          <label for="s-auto-create" style="font-size:12px;cursor:pointer;user-select:none">
            Automaticky vytvořit zakázku ${intervalInp.value||'N'} dní před termínem
          </label>`;
        wrapper.appendChild(autoDiv);
      }
    }
  }, 2000);
})();

// ══ CSS pro shake animaci hvězdiček ══════════════════════════════
(function addShakeCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }
  `;
  document.head.appendChild(style);
})();

\u003c/script>
\u003cscript>
// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 8 — rozšířený dashboard KPI, API bridge
// ════════════════════════════════════════════════════════════════

// ══ ROZŠÍŘENÝ renderDashboard — patch stávající funkce ═══════════
(function patchRenderDashboard() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof renderDashboard !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof renderDashboard === 'undefined') return;
      const prev = renderDashboard;
      renderDashboard = function() {
        prev(); // původní render
        renderKpiExtended(); // nové KPI sekce
      };
    }
  }, 200);
})();

function parseCenaVal(c) {
  return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;
}

function renderKpiExtended() {
  const all = window._zakazky || [];
  const now  = new Date();

  // Určení období
  const period = document.getElementById('dash-tech-period')?.value || 'month';
  let periodStart;
  if(period === 'month') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if(period === 'quarter') {
    const q = Math.floor(now.getMonth()/3);
    periodStart = new Date(now.getFullYear(), q*3, 1);
  } else {
    periodStart = new Date(now.getFullYear(), 0, 1);
  }
  const periodStr = periodStart.toISOString().slice(0,10);

  const periodZ = all.filter(z => (z.termin||z.createdAt?.toDate?.().toISOString().slice(0,10)||'') >= periodStr);

  // ── KPI ALERTS ─────────────────────────────────────────────
  const alertsEl = document.getElementById('kpi-alerts');
  const alertsInner = document.getElementById('kpi-alerts-inner');
  if(alertsEl && alertsInner) {
    const alerts = [];

    // Zakázky po termínu
    const overdue = all.filter(z => {
      if(!z.termin || ['zaplacena','fakturovaná'].includes(z.stav)) return false;
      return z.termin < now.toISOString().slice(0,10);
    });
    if(overdue.length) {
      alerts.push({
        color: '#dc2626', bg: '#fef2f2', icon: '🔴',
        msg: `${overdue.length} zakázek po termínu`,
        action: `onclick="filterOverdue()"`,
        detail: overdue.slice(0,3).map(z=>z.nazev||'—').join(', ') + (overdue.length>3?'…':'')
      });
    }

    // Nezaplacené faktury starší 30 dní
    const oldUnpaid = all.filter(z => {
      if(z.stav !== 'fakturovaná') return false;
      const termin = new Date(z.termin||'2000-01-01');
      return (now - termin) > 30*86400000;
    });
    if(oldUnpaid.length) {
      const suma = oldUnpaid.reduce((s,z)=>s+parseCenaVal(z.cena),0);
      alerts.push({
        color: '#d97706', bg: '#fffbeb', icon: '🟡',
        msg: `${oldUnpaid.length} neuhrazených faktur > 30 dní`,
        detail: `Celkem: ${suma.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč`
      });
    }

    // Zakázky bez technika
    const unassigned = all.filter(z =>
      !z.technik && !['zaplacena','fakturovaná','zpracovaná'].includes(z.stav)
    );
    if(unassigned.length) {
      alerts.push({
        color: '#6d28d9', bg: '#f5f3ff', icon: '🔵',
        msg: `${unassigned.length} zakázek bez přiřazeného technika`,
        detail: ''
      });
    }

    if(alerts.length) {
      alertsEl.style.display = 'block';
      alertsInner.innerHTML = alerts.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${a.bg};border:1.5px solid ${a.color}30;border-radius:8px;cursor:pointer" ${a.action||''}>
          <span style="font-size:18px">${a.icon}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700;color:${a.color}">${a.msg}</div>
            ${a.detail?`<div style="font-size:11px;color:#6b7280;margin-top:1px">${a.detail}</div>`:''}
          </div>
        </div>`).join('');
    } else {
      alertsEl.style.display = 'none';
    }
  }

  // ── VÝKONNOST TECHNIKŮ ──────────────────────────────────────
  const techGrid = document.getElementById('tech-performance-grid');
  if(techGrid) {
    const byTech = {};
    periodZ.forEach(z => {
      const t = z.technik || 'Nepřiřazeno';
      if(!byTech[t]) byTech[t] = { name:t, count:0, rev:0, hours:0, done:0, rated:0, ratingSum:0 };
      byTech[t].count++;
      byTech[t].rev += parseCenaVal(z.cena);
      byTech[t].hours += parseFloat(z.hodiny||0);
      if(['zpracovaná','fakturovaná','zaplacena'].includes(z.stav)) byTech[t].done++;
      if(z.hodnoceni) { byTech[t].rated++; byTech[t].ratingSum += z.hodnoceni; }
    });

    const entries = Object.values(byTech)
      .filter(t => t.name !== 'Nepřiřazeno')
      .sort((a,b) => b.count - a.count)
      .slice(0, 8);

    if(!entries.length) {
      techGrid.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic">Žádná data pro zvolené období</div>';
    } else {
      const maxCount = Math.max(...entries.map(t=>t.count), 1);
      techGrid.innerHTML = entries.map(t => {
        const doneRate = t.count ? Math.round(t.done/t.count*100) : 0;
        const avgRating = t.rated ? (t.ratingSum/t.rated).toFixed(1) : null;
        const avatar = t.name[0].toUpperCase();
        return `<div style="background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${avatar}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:12px;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div>
              <div style="font-size:10px;color:var(--muted)">${t.count} zakázek · ${doneRate}% hotovo</div>
            </div>
          </div>
          <!-- Progress bar -->
          <div style="background:var(--bg);border-radius:4px;height:5px;margin-bottom:8px;overflow:hidden">
            <div style="width:${Math.round(t.count/maxCount*100)}%;height:100%;background:var(--navy);border-radius:4px;transition:width .5s"></div>
          </div>
          <!-- Metriky -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
            <div style="color:var(--muted)">💰 Obrat</div>
            <div style="font-weight:600;text-align:right;font-family:monospace">${t.rev.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</div>
            ${t.hours ? `<div style="color:var(--muted)">⏱ Hodiny</div><div style="font-weight:600;text-align:right">${t.hours.toFixed(1)} h</div>` : ''}
            ${avgRating ? `<div style="color:var(--muted)">⭐ Hodnocení</div><div style="font-weight:600;text-align:right;color:#f59e0b">${avgRating}/5</div>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  }

  // ── PRŮMĚRNÁ DOBA ZPRACOVÁNÍ ────────────────────────────────
  const avgTimeEl = document.getElementById('avg-time-stats');
  if(avgTimeEl) {
    const completed = all.filter(z => z.stav === 'zpracovaná' || z.stav === 'zaplacena');
    const withDates = completed.filter(z => z.termin && z.createdAt?.toDate);

    let avgDays = null;
    if(withDates.length) {
      const totalDays = withDates.reduce((s,z) => {
        const created = z.createdAt.toDate();
        const termin  = new Date(z.termin);
        return s + Math.max(0, Math.ceil((termin - created) / 86400000));
      }, 0);
      avgDays = (totalDays / withDates.length).toFixed(1);
    }

    // Průměrné hodiny
    const withHours = all.filter(z => z.hodiny > 0);
    const avgHours = withHours.length
      ? (withHours.reduce((s,z)=>s+parseFloat(z.hodiny||0),0) / withHours.length).toFixed(1)
      : null;

    avgTimeEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:8px">
          <div style="font-size:28px;font-weight:800;color:var(--navy)">${avgDays||'—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">průměr dní na zakázku</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg);border-radius:8px">
          <div style="font-size:28px;font-weight:800;color:var(--green)">${avgHours||'—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">průměr hodin práce</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted);text-align:center;margin-top:6px">
        Z ${completed.length} dokončených zakázek · ${withHours.length} se zápisem hodin
      </div>`;
  }

  // ── PRŮMĚRNÉ HODNOCENÍ ──────────────────────────────────────
  const avgHodEl = document.getElementById('avg-hodnoceni-stats');
  if(avgHodEl) {
    const rated = all.filter(z => z.hodnoceni);
    if(!rated.length) {
      avgHodEl.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic">Zatím žádná hodnocení</div>';
    } else {
      const avg = rated.reduce((s,z)=>s+z.hodnoceni,0) / rated.length;
      const byStars = {1:0,2:0,3:0,4:0,5:0};
      rated.forEach(z => byStars[z.hodnoceni] = (byStars[z.hodnoceni]||0) + 1);

      avgHodEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-size:40px;font-weight:800;color:var(--navy);line-height:1">${avg.toFixed(1)}</div>
          <div>
            <div style="color:#f59e0b;font-size:20px">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</div>
            <div style="font-size:11px;color:var(--muted)">${rated.length} hodnocení</div>
          </div>
        </div>
        ${[5,4,3,2,1].map(n => {
          const count = byStars[n]||0;
          const pct = Math.round(count/rated.length*100);
          return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px">
            <span style="width:20px;text-align:right;color:var(--muted)">${n}★</span>
            <div style="flex:1;background:var(--bg);border-radius:3px;height:8px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:#f59e0b;border-radius:3px;transition:width .5s"></div>
            </div>
            <span style="width:28px;color:var(--muted)">${count}</span>
          </div>`;
        }).join('')}`;
    }
  }

  // ── ROZŠÍŘENÉ STATS KARTY ───────────────────────────────────
  // Přidej do stats-grid další info — zakázky po termínu count
  const sg = document.getElementById('stats-grid');
  if(sg && !sg._extended) {
    sg._extended = true;
    // Přidej extra karty za existující
    const overdue2 = all.filter(z =>
      z.termin < now.toISOString().slice(0,10) &&
      !['zaplacena','fakturovaná','zpracovaná'].includes(z.stav||'nová')
    ).length;
    const avgRatingAll = all.filter(z=>z.hodnoceni).length
      ? (all.filter(z=>z.hodnoceni).reduce((s,z)=>s+z.hodnoceni,0) /
         all.filter(z=>z.hodnoceni).length).toFixed(1) : '—';

    const extra = document.createElement('div');
    extra.id = 'stats-extra';
    extra.style.cssText = 'display:contents';
    extra.innerHTML = `
      <div class="stat-card ${overdue2>0?'warn':'green'}">
        <div class="val">${overdue2}</div>
        <div class="lbl">Po termínu</div>
      </div>
      <div class="stat-card blue">
        <div class="val">${avgRatingAll}</div>
        <div class="lbl">Avg. hodnocení ⭐</div>
      </div>`;
    sg.appendChild(extra);
  }
}

// Filtr zakázek po termínu
function filterOverdue() {
  switchTab('orders');
  setTimeout(() => {
    const sf = document.getElementById('stav-filter');
    if(sf) { sf.value = ''; sf.dispatchEvent(new Event('change')); }
    // Filtry nastaví list na "po termínu"
    window._filterOverdue = true;
    renderList && renderList();
  }, 100);
}

// ══ API BRIDGE — propojení s plánovací aplikací ══════════════════
//
// REST-like rozhraní pro externí aplikace přes PostMessage nebo URL hash
// Umožňuje plánovací aplikaci:
//  1. Číst seznam zakázek a techniků
//  2. Vytvořit/aktualizovat zakázku
//  3. Přiřadit technika
//  4. Číst stav v reálném čase

// Webhook URL pro odchozí události (nastavitelné)
let _webhookUrl = localStorage.getItem('webhook-url') || '';
let _apiKey      = localStorage.getItem('api-key') || '';

// Odchozí události → plánovací aplikace
async function sendWebhook(event, data) {
  if(!_webhookUrl) return;
  try {
    await fetch(_webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': _apiKey,
        'X-Source': 'ac-euro-servis',
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data,
      })
    });
  } catch(e) {
    console.warn('Webhook failed:', e.message);
  }
}

// PostMessage API — pro embed nebo iframe integrace
window.addEventListener('message', async e => {
  if(!e.data?.type?.startsWith('SERVIS_')) return;
  const { type, payload, requestId } = e.data;

  const reply = (data, error) => {
    e.source?.postMessage({ requestId, data, error }, e.origin);
  };

  try {
    switch(type) {

      case 'SERVIS_GET_ZAKAZKY':
        // Vrátí seznam zakázek (filtrované)
        const zakazky = (window._zakazky || []).map(z => ({
          id:       z.id,
          cislo:    z.cislo,
          nazev:    z.nazev,
          zakaznik: z.zakaznik,
          technik:  z.technik,
          termin:   z.termin,
          stav:     z.stav,
          adresa:   z.adresa,
          cena:     z.cena,
        }));
        reply({ zakazky });
        break;

      case 'SERVIS_GET_TECHNICI':
        // Vrátí seznam techniků
        const technici = [...new Set(
          (window._zakazky||[]).map(z=>z.technik||'').filter(Boolean)
        )].map(name => ({ name }));
        reply({ technici });
        break;

      case 'SERVIS_CREATE_ZAKAZKA':
        // Vytvoří novou zakázku z plánovací aplikace
        if(!payload?.nazev) { reply(null, 'Chybí nazev'); break; }
        const ref = await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'zakazky'),
          {
            ...payload,
            stav: payload.stav || 'ke zpracování',
            source: 'planning-app',
            createdAt: window._fb.serverTimestamp(),
            updatedAt: window._fb.serverTimestamp(),
          }
        );
        reply({ id: ref.id });
        break;

      case 'SERVIS_UPDATE_ZAKAZKA':
        // Aktualizuje existující zakázku
        if(!payload?.id) { reply(null, 'Chybí id'); break; }
        const { id: updateId, ...updateData } = payload;
        await window._fb.updateDoc(
          window._fb.doc(window._fb.db, 'zakazky', updateId),
          { ...updateData, updatedAt: window._fb.serverTimestamp() }
        );
        reply({ ok: true });
        break;

      case 'SERVIS_ASSIGN_TECHNIK':
        // Přiřadí technika k zakázce
        if(!payload?.zakazkaId || !payload?.technik) { reply(null, 'Chybí zakazkaId nebo technik'); break; }
        await window._fb.updateDoc(
          window._fb.doc(window._fb.db, 'zakazky', payload.zakazkaId),
          {
            technik:  payload.technik,
            termin:   payload.termin || '',
            zadani:   payload.zadani || '',
            stav:     'ke zpracování',
            updatedAt: window._fb.serverTimestamp(),
          }
        );
        reply({ ok: true });
        break;

      default:
        reply(null, `Neznámý typ: ${type}`);
    }
  } catch(err) {
    reply(null, err.message);
  }
});

// Webhook při změně stavu zakázky — napoj na changeStav
(function hookWebhookOnChangeStav() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof changeStav !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof changeStav === 'undefined') return;
      const prev = changeStav;
      changeStav = async function(id, stav) {
        await prev(id, stav);
        const z = (window._zakazky||[]).find(x=>x.id===id);
        sendWebhook('zakazka.stav_changed', {
          id, stav,
          nazev:    z?.nazev,
          technik:  z?.technik,
          zakaznik: z?.zakaznik,
          termin:   z?.termin,
        });
      };
    }
  }, 300);
})();

// ── API nastavení UI ──────────────────────────────────────────────
function openApiSettings() {
  let modal = document.getElementById('api-settings-modal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'api-settings-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-box" style="max-width:500px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3>🔌 Propojení s plánovací aplikací</h3>
        <button onclick="this.closest('.modal-overlay').classList.remove('open')" style="background:none;border:none;font-size:20px;cursor:pointer">×</button>
      </div>

      <div style="background:#eff6ff;border:1.5px solid #93c5fd;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#1e3a5f">
        <strong>Jak propojit plánovací aplikaci:</strong><br>
        Vaše plánovací aplikace může posílat zakázky do tohoto systému přes:<br>
        <strong>1. Webhook (doporučeno)</strong> — zadejte URL endpointu vaší aplikace níže<br>
        <strong>2. PostMessage API</strong> — pro iframe/embed integrace<br>
        <strong>3. Přímý Firestore přístup</strong> — pomocí Firebase Admin SDK
      </div>

      <div class="fg2" style="margin-bottom:10px">
        <label>Webhook URL (plánovací aplikace → sem pošleme události)</label>
        <input id="api-webhook-url" value="${_webhookUrl}" placeholder="https://vase-planovaci-app.cz/webhook/servis">
      </div>
      <div class="fg2" style="margin-bottom:16px">
        <label>API klíč (volitelné — pro ověření)</label>
        <input id="api-key-inp" value="${_apiKey}" placeholder="váš-tajný-klíč" type="password">
      </div>

      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px">
        <strong>PostMessage API příklady (pro vaši plánovací aplikaci):</strong>
        <pre style="margin-top:6px;font-size:10px;overflow-x:auto;color:#166534">// Načíst zakázky
window.postMessage({type:'SERVIS_GET_ZAKAZKY'}, '*')

// Vytvořit zakázku
window.postMessage({
  type: 'SERVIS_CREATE_ZAKAZKA',
  payload: { nazev:'Klimatizace', technik:'Jan Novák', termin:'2025-09-01' }
}, '*')

// Přiřadit technika
window.postMessage({
  type: 'SERVIS_ASSIGN_TECHNIK',
  payload: { zakazkaId:'abc123', technik:'Jan Novák', termin:'2025-09-01' }
}, '*')</pre>
      </div>

      <div style="background:#fafbfc;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:16px;font-size:11px;color:var(--muted)">
        <strong>Firebase přístup (pro vlastní integrace):</strong><br>
        Project ID: <code>servis-3213b</code><br>
        Kolekce: <code>zakazky</code>, <code>users</code>, <code>zakaznici</code><br>
        Vyžaduje Firebase Admin SDK s service account klíčem.
      </div>

      <div class="modal-foot">
        <button onclick="this.closest('.modal-overlay').classList.remove('open')" class="btn btn-ghost">Zavřít</button>
        <button onclick="saveApiSettings()" class="btn btn-green">Uložit nastavení</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.add('open');
}

function saveApiSettings() {
  _webhookUrl = document.getElementById('api-webhook-url')?.value.trim() || '';
  _apiKey     = document.getElementById('api-key-inp')?.value.trim() || '';
  localStorage.setItem('webhook-url', _webhookUrl);
  localStorage.setItem('api-key', _apiKey);
  document.getElementById('api-settings-modal')?.classList.remove('open');
  showToast && showToast('✓ API nastavení uloženo');
}

// Přidej 🔌 tlačítko do kancelář topbaru
(function addApiButton() {
  setTimeout(() => {
    const darkBtn = document.getElementById('dark-toggle');
    if(!darkBtn || darkBtn._apiAdded) return;
    darkBtn._apiAdded = true;
    const btn = document.createElement('button');
    btn.title = 'Propojení s plánovací aplikací';
    btn.style.cssText = 'background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.85);border-radius:7px;padding:5px 10px;cursor:pointer;font-size:13px';
    btn.textContent = '🔌';
    btn.onclick = openApiSettings;
    darkBtn.before(btn);
  }, 900);
})();

// ══ SERVICE WORKER REGISTRACE ═════════════════════════════════════
(function registerServiceWorker() {
  if(!('serviceWorker' in navigator)) return;

  // Service Worker kód jako Blob (inline — nepotřebujeme externý soubor)
  const swCode = `
const CACHE = 'servis-v1';
const CORE = [location.pathname];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Jen GET requesty
  if(e.request.method !== 'GET') return;
  // Jen same-origin nebo CDN resources
  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === location.origin;
  const isCDN = url.hostname.includes('gstatic') ||
                url.hostname.includes('googleapis') ||
                url.hostname.includes('cloudflare') ||
                url.hostname.includes('unpkg');

  if(!isSameOrigin && !isCDN) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if(resp.ok && (isSameOrigin || isCDN)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached); // offline fallback
      return cached || fetchPromise;
    })
  );
});

// Background sync pro offline akce
self.addEventListener('sync', e => {
  if(e.tag === 'sync-zakazky') {
    e.waitUntil(self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({type:'SW_SYNC_REQUEST'}));
    }));
  }
});

// Push notifikace
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(data.title || 'AC EURO Servis', {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window'}).then(clients => {
    const client = clients.find(c => c.url.includes(location.origin));
    if(client) { client.focus(); }
    else { self.clients.openWindow('/'); }
  }));
});
`;

  // Registruj SW přes Blob URL
  const blob = new Blob([swCode], {type:'application/javascript'});
  const swUrl = URL.createObjectURL(blob);

  navigator.serviceWorker.register(swUrl, {scope: '/'})
    .then(reg => {
      console.log('✓ Service Worker registrován:', reg.scope);
      window._swRegistration = reg;

      // Poslouchej zprávy ze SW
      navigator.serviceWorker.addEventListener('message', e => {
        if(e.data?.type === 'SW_SYNC_REQUEST') {
          // SW žádá o sync — zkontroluj offline frontu
          processOfflineQueue();
        }
      });
    })
    .catch(err => {
      console.warn('SW registrace selhala (Blob URL):', err.message);
      // Fallback — offline podpora nebude dostupná
    });
})();

// Offline fronta — operace provedené offline
let _offlineQueue = JSON.parse(localStorage.getItem('offline-queue')||'[]');

function queueOfflineAction(action, data) {
  _offlineQueue.push({ action, data, ts: Date.now(), id: Math.random().toString(36).slice(2) });
  localStorage.setItem('offline-queue', JSON.stringify(_offlineQueue));
}

async function processOfflineQueue() {
  if(!_offlineQueue.length || !navigator.onLine) return;
  const queue = [..._offlineQueue];
  _offlineQueue = [];
  localStorage.removeItem('offline-queue');

  let processed = 0;
  for(const item of queue) {
    try {
      if(item.action === 'updateStav') {
        await window._fb.updateDoc(
          window._fb.doc(window._fb.db,'zakazky',item.data.id),
          { stav: item.data.stav, updatedAt: window._fb.serverTimestamp() }
        );
        processed++;
      }
    } catch(e) {
      _offlineQueue.push(item); // vrátíme zpět při chybě
    }
  }
  if(processed) {
    showToast && showToast(`✓ Synchronizováno ${processed} offline akcí`);
    localStorage.setItem('offline-queue', JSON.stringify(_offlineQueue));
  }
}

// Online/offline indikátor
window.addEventListener('online',  () => {
  showToast && showToast('🟢 Jste online — synchronizuji…');
  processOfflineQueue();
});
window.addEventListener('offline', () => {
  showToast && showToast('🔴 Offline režim — akce se uloží lokálně');
});

// Přidej offline status do UI
(function addOfflineIndicator() {
  setTimeout(() => {
    const darkBtn = document.getElementById('dark-toggle');
    if(!darkBtn || darkBtn._offlineAdded) return;
    darkBtn._offlineAdded = true;
    const ind = document.createElement('div');
    ind.id = 'online-indicator';
    ind.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;color:rgba(255,255,255,.6);padding:4px 8px;border-radius:6px';
    ind.innerHTML = `<span id="online-dot" style="width:6px;height:6px;border-radius:50%;background:#4ade80;flex-shrink:0"></span>
      <span id="online-txt">Online</span>`;
    darkBtn.before(ind);

    const update = () => {
      const dot = document.getElementById('online-dot');
      const txt = document.getElementById('online-txt');
      if(dot) dot.style.background = navigator.onLine ? '#4ade80' : '#f87171';
      if(txt) txt.textContent = navigator.onLine ? 'Online' : 'Offline';
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  }, 1000);
})();

\u003c/script>
\u003cscript>
// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 9 — měsíční PDF report, výkon (lazy init),
//                  vylepšené dashboard CSS sekce
// ════════════════════════════════════════════════════════════════

// ══ MĚSÍČNÍ PDF REPORT ═══════════════════════════════════════════

// Přidej tlačítko do dashboardu
(function addReportButton() {
  setTimeout(() => {
    const statsGrid = document.getElementById('stats-grid');
    if(!statsGrid || statsGrid._reportBtnAdded) return;
    statsGrid._reportBtnAdded = true;

    const wrap = statsGrid.closest('div[style*="padding"]') ||
                 statsGrid.parentElement;
    if(!wrap) return;

    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px';
    toolbar.innerHTML = `
      <h2 style="font-size:16px;font-weight:800;color:var(--navy);margin:0">
        📊 Dashboard
      </h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="report-period-sel" style="font-size:11px;padding:5px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-family:inherit">
          <option value="this">Tento měsíc</option>
          <option value="last">Minulý měsíc</option>
          <option value="q1">Q1</option>
          <option value="q2">Q2</option>
          <option value="q3">Q3</option>
          <option value="q4">Q4</option>
          <option value="year">Celý rok</option>
        </select>
        <button onclick="generatePdfReport()" style="display:flex;align-items:center;gap:6px;padding:5px 14px;background:var(--navy);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          PDF report
        </button>
        <button onclick="sendMonthlyReportEmail()" style="display:flex;align-items:center;gap:6px;padding:5px 14px;background:var(--card);color:var(--navy);border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">
          ✉️ Odeslat e-mailem
        </button>
      </div>`;

    wrap.insertBefore(toolbar, wrap.firstChild);
  }, 600);
})();

// Pomocné funkce pro report
function getPeriodZakazky() {
  const all = window._zakazky || [];
  const sel = document.getElementById('report-period-sel')?.value || 'this';
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let from, to, label;

  switch(sel) {
    case 'this':
      from = new Date(y, m, 1); to = new Date(y, m+1, 0);
      label = `${now.toLocaleString('cs-CZ',{month:'long'})} ${y}`;
      break;
    case 'last':
      from = new Date(y, m-1, 1); to = new Date(y, m, 0);
      label = `${new Date(y,m-1).toLocaleString('cs-CZ',{month:'long'})} ${y}`;
      break;
    case 'q1': from=new Date(y,0,1); to=new Date(y,3,0); label=`Q1 ${y}`; break;
    case 'q2': from=new Date(y,3,1); to=new Date(y,6,0); label=`Q2 ${y}`; break;
    case 'q3': from=new Date(y,6,1); to=new Date(y,9,0); label=`Q3 ${y}`; break;
    case 'q4': from=new Date(y,9,1); to=new Date(y,12,0); label=`Q4 ${y}`; break;
    case 'year': from=new Date(y,0,1); to=new Date(y,12,0); label=`Rok ${y}`; break;
    default:    from=new Date(y,m,1); to=new Date(y,m+1,0); label=`${m+1}/${y}`;
  }

  const fromStr = from.toISOString().slice(0,10);
  const toStr   = to.toISOString().slice(0,10);

  const filtered = all.filter(z =>
    z.termin && z.termin >= fromStr && z.termin <= toStr
  );

  return { zakazky: filtered, label, from: fromStr, to: toStr };
}

function buildReportData() {
  const { zakazky, label, from, to } = getPeriodZakazky();
  const all = window._zakazky || [];

  function parseCena(c) {
    return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;
  }

  const totalCount   = zakazky.length;
  const totalRevenue = zakazky.reduce((s,z) => s+parseCena(z.cena), 0);
  const paid         = zakazky.filter(z => z.stav === 'zaplacena');
  const invoiced     = zakazky.filter(z => ['fakturovaná','zaplacena'].includes(z.stav));
  const paidRevenue  = paid.reduce((s,z) => s+parseCena(z.cena), 0);
  const done         = zakazky.filter(z => ['zpracovaná','fakturovaná','zaplacena'].includes(z.stav));

  // Podle technika
  const byTech = {};
  zakazky.forEach(z => {
    const t = z.technik || 'Nepřiřazeno';
    if(!byTech[t]) byTech[t] = { name:t, count:0, rev:0, hours:0, rated:0, ratingSum:0 };
    byTech[t].count++;
    byTech[t].rev += parseCena(z.cena);
    byTech[t].hours += parseFloat(z.hodiny||0);
    if(z.hodnoceni) { byTech[t].rated++; byTech[t].ratingSum += z.hodnoceni; }
  });

  // Podle zákazníka (top 5)
  const byZak = {};
  zakazky.forEach(z => {
    const k = z.zakaznik || 'Neznámý';
    if(!byZak[k]) byZak[k] = { name:k, count:0, rev:0 };
    byZak[k].count++;
    byZak[k].rev += parseCena(z.cena);
  });

  // Průměrné hodnocení
  const rated = zakazky.filter(z => z.hodnoceni);
  const avgRating = rated.length
    ? (rated.reduce((s,z)=>s+z.hodnoceni,0) / rated.length).toFixed(1) : null;

  // Průměrné hodiny
  const withHours = zakazky.filter(z => z.hodiny > 0);
  const avgHours = withHours.length
    ? (withHours.reduce((s,z)=>s+parseFloat(z.hodiny||0),0) / withHours.length).toFixed(1) : null;

  // Celkové km
  const totalKm = zakazky.reduce((s,z) => s+parseFloat(z.km||0), 0);

  return {
    label, from, to,
    totalCount, totalRevenue, paidRevenue,
    doneCount: done.length, invoicedCount: invoiced.length,
    completionRate: totalCount ? Math.round(done.length/totalCount*100) : 0,
    byTech: Object.values(byTech).sort((a,b) => b.count-a.count),
    topZakaznici: Object.values(byZak).sort((a,b) => b.rev-a.rev).slice(0,5),
    avgRating, avgHours, totalKm,
    firma: window._currentFirma === 'progres' ? 'PROGRESKLIMA CZ s.r.o.' : 'AC EURO s.r.o.',
    dnes: new Date().toLocaleDateString('cs-CZ'),
    recentZakazky: zakazky.slice(0,20),
  };
}

async function generatePdfReport() {
  const btn = document.querySelector('button[onclick="generatePdfReport()"]');
  if(btn) { btn.disabled=true; btn.textContent='⏳ Generuji…'; }

  try {
    const data = buildReportData();
    const html = buildReportHtml(data);

    // Otevři přes souhrn viewer (stejný iframe modal)
    const fakeZ = { nazev: `Report ${data.label}`, cislo: '', id: '' };
    showSouhrn(html, { nazev: `Měsíční report — ${data.label}`, id:'' });
  } finally {
    if(btn) { btn.disabled=false; btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> PDF report'; }
  }
}

function buildReportHtml(d) {
  const fmtCzk = n => n.toLocaleString('cs-CZ', {maximumFractionDigits:0}) + ' Kč';
  const stars = n => n ? ('★'.repeat(Math.round(n)) + '☆'.repeat(5-Math.round(n))) : '—';

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>Report ${d.label} — ${d.firma}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#1e293b; background:#f8fafc; padding:20px; }
  .page { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 20px rgba(0,0,0,.1); }
  .hdr { background:#0f1f3d; color:#fff; padding:24px 28px; }
  .hdr-firma { font-size:11px; color:rgba(255,255,255,.6); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px; }
  .hdr-title { font-size:22px; font-weight:800; margin-bottom:4px; }
  .hdr-sub { font-size:12px; color:rgba(255,255,255,.65); }
  .body { padding:24px 28px; }

  /* KPI grid */
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .kpi { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px; text-align:center; }
  .kpi-val { font-size:22px; font-weight:800; color:#0f1f3d; }
  .kpi-lbl { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; margin-top:3px; }
  .kpi.green .kpi-val { color:#16a34a; }
  .kpi.blue .kpi-val  { color:#1d4ed8; }
  .kpi.warn .kpi-val  { color:#d97706; }

  /* Sekce */
  .sec { margin-bottom:18px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .sec-hdr { background:#f8fafc; padding:8px 14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#475569; border-bottom:1px solid #e2e8f0; }
  .sec-body { padding:14px; }

  /* Technici tabulka */
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { text-align:left; font-size:10px; font-weight:700; text-transform:uppercase; color:#94a3b8; padding:6px 8px; border-bottom:2px solid #e2e8f0; }
  td { padding:7px 8px; border-bottom:1px solid #f1f5f9; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#f8fafc; }

  /* Progress bar */
  .bar-wrap { background:#f1f5f9; border-radius:4px; height:6px; width:100px; display:inline-block; vertical-align:middle; }
  .bar-fill { height:100%; border-radius:4px; background:#0f1f3d; }

  /* Hodnocení hvězdičky */
  .stars { color:#f59e0b; font-size:13px; }

  /* Footer */
  .foot { padding:14px 28px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; }

  /* Tisk */
  @media print {
    body { background:#fff; padding:0; }
    .page { box-shadow:none; border-radius:0; }
    .no-print { display:none !important; }
    .kpi-grid { grid-template-columns:repeat(4,1fr); }
  }

  .no-print { margin-bottom:16px; display:flex; gap:8px; }
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-firma">${d.firma}</div>
  <div class="hdr-title">📊 Výkonnostní report</div>
  <div class="hdr-sub">Období: <strong style="color:#fff">${d.label}</strong> &nbsp;·&nbsp; ${d.from} – ${d.to} &nbsp;·&nbsp; Vygenerováno: ${d.dnes}</div>
</div>

<div class="body">

  <div class="no-print">
    <button onclick="window.print()" style="background:#0f1f3d;color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600">🖨 Tisknout / Uložit jako PDF</button>
  </div>

  <!-- KPI KARTY -->
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-val">${d.totalCount}</div>
      <div class="kpi-lbl">Zakázek celkem</div>
    </div>
    <div class="kpi green">
      <div class="kpi-val">${fmtCzk(d.totalRevenue)}</div>
      <div class="kpi-lbl">Celkový obrat</div>
    </div>
    <div class="kpi blue">
      <div class="kpi-val">${fmtCzk(d.paidRevenue)}</div>
      <div class="kpi-lbl">Zaplaceno</div>
    </div>
    <div class="kpi warn">
      <div class="kpi-val">${d.completionRate}%</div>
      <div class="kpi-lbl">Dokončenost</div>
    </div>
  </div>

  <!-- DOPLŇKOVÉ METRIKY -->
  <div class="kpi-grid" style="margin-bottom:20px">
    <div class="kpi">
      <div class="kpi-val">${d.doneCount}</div>
      <div class="kpi-lbl">Dokončených</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${d.invoicedCount}</div>
      <div class="kpi-lbl">Fakturovaných</div>
    </div>
    <div class="kpi ${d.avgRating>=4?'green':d.avgRating>=3?'':'warn'}">
      <div class="kpi-val" style="color:#f59e0b">${d.avgRating||'—'}</div>
      <div class="kpi-lbl">Avg. hodnocení</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${d.totalKm>0 ? Math.round(d.totalKm)+' km' : '—'}</div>
      <div class="kpi-lbl">Celkem km</div>
    </div>
  </div>

  <!-- VÝKONNOST TECHNIKŮ -->
  <div class="sec">
    <div class="sec-hdr">👥 Výkonnost techniků</div>
    <div class="sec-body" style="padding:0">
      <table>
        <thead>
          <tr>
            <th>Technik</th>
            <th>Zakázek</th>
            <th>Podíl</th>
            <th>Obrat</th>
            <th>Hodiny</th>
            <th>Hodnocení</th>
          </tr>
        </thead>
        <tbody>
          ${d.byTech.map(t => {
            const pct = d.totalCount ? Math.round(t.count/d.totalCount*100) : 0;
            const avgR = t.rated ? (t.ratingSum/t.rated).toFixed(1) : null;
            return `<tr>
              <td><strong>${t.name}</strong></td>
              <td>${t.count}</td>
              <td>
                <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div>
                <span style="margin-left:6px;color:#64748b">${pct}%</span>
              </td>
              <td style="font-family:monospace;white-space:nowrap">${fmtCzk(t.rev)}</td>
              <td>${t.hours>0 ? t.hours.toFixed(1)+' h' : '—'}</td>
              <td class="stars">${avgR ? avgR+'/5 '+'★'.repeat(Math.round(avgR)) : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TOP ZÁKAZNÍCI -->
  ${d.topZakaznici.length ? `<div class="sec">
    <div class="sec-hdr">🏢 Top zákazníci</div>
    <div class="sec-body" style="padding:0">
      <table>
        <thead><tr><th>Zákazník</th><th>Zakázek</th><th>Obrat</th></tr></thead>
        <tbody>
          ${d.topZakaznici.map(z => `<tr>
            <td><strong>${z.name}</strong></td>
            <td>${z.count}</td>
            <td style="font-family:monospace">${fmtCzk(z.rev)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- PŘEHLED ZAKÁZEK -->
  ${d.recentZakazky.length ? `<div class="sec">
    <div class="sec-hdr">📋 Zakázky v období (${d.recentZakazky.length}${d.totalCount>20?' z '+d.totalCount:''})</div>
    <div class="sec-body" style="padding:0">
      <table>
        <thead><tr><th>Číslo</th><th>Název</th><th>Zákazník</th><th>Technik</th><th>Termín</th><th>Stav</th><th>Cena</th></tr></thead>
        <tbody>
          ${d.recentZakazky.map(z => `<tr>
            <td style="font-family:monospace;font-size:10px;color:#64748b">${z.cislo||'—'}</td>
            <td><strong>${(z.nazev||'—').substring(0,30)}</strong></td>
            <td style="font-size:11px">${(z.zakaznik||'—').substring(0,20)}</td>
            <td style="font-size:11px">${z.technik||'—'}</td>
            <td style="font-size:11px;white-space:nowrap">${z.termin ? z.termin.split('-').reverse().join('.') : '—'}</td>
            <td style="font-size:11px">${z.stav||'—'}</td>
            <td style="font-family:monospace;white-space:nowrap;font-size:11px">${z.cena||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

</div><!-- /body -->

<div class="foot">
  <span>${d.firma}</span>
  <span>Report: ${d.label} · Vygenerováno ${d.dnes}</span>
</div>

</div><!-- /page -->
</body></html>`;
}

// E-mail report — otevře dialog s textem pro kopírování
function sendMonthlyReportEmail() {
  const data = buildReportData();
  const fmtCzk = n => n.toLocaleString('cs-CZ', {maximumFractionDigits:0}) + ' Kč';

  const subject = `Výkonnostní report — ${data.label} — ${data.firma}`;
  const body = `Dobrý den,

zasílám výkonnostní report za období: ${data.label}

PŘEHLED:
• Zakázek celkem: ${data.totalCount}
• Celkový obrat: ${fmtCzk(data.totalRevenue)}
• Zaplaceno: ${fmtCzk(data.paidRevenue)}
• Dokončenost: ${data.completionRate}%
${data.avgRating ? `• Průměrné hodnocení: ${data.avgRating}/5` : ''}
${data.totalKm > 0 ? `• Celkem km: ${Math.round(data.totalKm)} km` : ''}

TECHNICI:
${data.byTech.map(t => `• ${t.name}: ${t.count} zakázek, ${fmtCzk(t.rev)}${t.hours>0?' ('+t.hours.toFixed(1)+' h)':''}`).join('\n')}

Pro detailní PDF report otevřete aplikaci a použijte Dashboard → PDF report.

S pozdravem,
${data.firma}`;

  // Otevři mailto nebo zkopíruj
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const win = window.open(mailto, '_blank');
  if(!win) {
    navigator.clipboard.writeText(body)
      .then(() => showToast && showToast('✓ Text reportu zkopírován do schránky'))
      .catch(() => alert(body));
  } else {
    showToast && showToast('✓ E-mailový klient otevřen');
  }
}

// ══ VÝKON — lazy inicializace tabů ═══════════════════════════════
// Odloží načítání heavy tabů dokud nejsou potřeba
(function lazyTabInit() {
  // Přidej třídu pro animaci přepnutí
  const style = document.createElement('style');
  style.textContent = `
    .tab-panel { opacity:1; transition:opacity .15s; }
    .tab-panel.loading { opacity:.5; }

    /* Kompaktnější detail panel na mobile */
    @media (max-width:768px) {
      .detail-inner { padding:10px !important; }
      .dsec { margin-bottom:10px !important; }
      .dsec-hdr { font-size:11px !important; }
    }

    /* Dashboard KPI */
    .kpi-spark { display:inline-block; width:40px; height:16px; vertical-align:middle; }

    /* Tech performance cards hover */
    #tech-performance-grid > div {
      transition: box-shadow .15s, transform .15s;
    }
    #tech-performance-grid > div:hover {
      box-shadow: 0 4px 16px rgba(15,31,61,.12);
      transform: translateY(-1px);
    }

    /* Alert animace */
    #kpi-alerts-inner > div {
      transition: opacity .2s;
    }
    #kpi-alerts-inner > div:hover {
      opacity: .85;
    }

    /* Nezaplacene highlight */
    .nezap-row { cursor:pointer; transition:background .1s; }
    .nezap-row:hover { background:var(--bg); }
  `;
  document.head.appendChild(style);

  // Cache výsledků dashboardu — přepočítávej max 1x za 30s
  let _dashLastRender = 0;
  if(typeof renderDashboard !== 'undefined') {
    const prevDash = renderDashboard;
    renderDashboard = function() {
      const now = Date.now();
      if(now - _dashLastRender < 30000) return; // debounce 30s
      _dashLastRender = now;
      prevDash();
    };
  }
})();

// ══ VYLEPŠENÍ NEZAPLACENÉ FAKTURY V DASHBOARDU ════════════════════
// Přepiš unpaid-list na klikací tabulku
(function enhanceUnpaidList() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const el = document.getElementById('unpaid-list');
    if(el || tries > 40) {
      clearInterval(iv);
      if(!el) return;
      // Nahraď basic unpaid-list s rozšířenou verzí
      el._enhanced = true;
    }
  }, 500);
})();

// Přidej render unpaid do renderDashboard
(function hookUnpaidRender() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof renderDashboard !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof renderDashboard === 'undefined') return;
      const prev = renderDashboard;
      renderDashboard = function() {
        prev();
        setTimeout(renderUnpaidTable, 100);
      };
    }
  }, 400);
})();

function renderUnpaidTable() {
  const listEl = document.getElementById('unpaid-list');
  const totalEl = document.getElementById('nezaplacene-total') ||
                  document.getElementById('unpaid-count');
  if(!listEl) return;

  function parseCena(c) {
    return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0;
  }

  const unpaid = (window._zakazky||[])
    .filter(z => z.stav === 'fakturovaná' && z.cena)
    .sort((a,b) => (a.termin||'').localeCompare(b.termin||''));

  const totalUnpaid = unpaid.reduce((s,z) => s+parseCena(z.cena), 0);

  if(totalEl) {
    totalEl.textContent = unpaid.length
      ? `${unpaid.length} faktur · ${totalUnpaid.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč`
      : 'Vše zaplaceno ✓';
    totalEl.style.color = unpaid.length ? '#dc2626' : '#16a34a';
  }

  if(!unpaid.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic;padding:10px 0">Všechny faktury jsou zaplaceny ✓</div>';
    return;
  }

  const now = new Date();
  listEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead>
      <tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:6px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">Zakázka</th>
        <th style="text-align:left;padding:6px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">Zákazník</th>
        <th style="text-align:left;padding:6px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">Termín</th>
        <th style="text-align:left;padding:6px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">Po splatnosti</th>
        <th style="text-align:right;padding:6px 8px;font-size:10px;color:var(--muted);text-transform:uppercase">Částka</th>
      </tr>
    </thead>
    <tbody>
      ${unpaid.map(z => {
        const days = z.termin
          ? Math.floor((now - new Date(z.termin)) / 86400000)
          : null;
        const daysColor = days > 60 ? '#dc2626' : days > 30 ? '#d97706' : 'var(--text)';
        return `<tr class="nezap-row" onclick="switchTab('orders');setTimeout(()=>openDetail('${z.id}'),50)">
          <td style="padding:7px 8px;border-bottom:1px solid var(--border)">
            <strong style="font-size:12px">${(z.nazev||'—').substring(0,25)}</strong>
            <br><span style="font-size:10px;color:var(--muted)">${z.cislo||''}</span>
          </td>
          <td style="padding:7px 8px;border-bottom:1px solid var(--border);font-size:11px">${(z.zakaznik||'—').substring(0,20)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid var(--border);font-size:11px;white-space:nowrap">${z.termin ? z.termin.split('-').reverse().join('.') : '—'}</td>
          <td style="padding:7px 8px;border-bottom:1px solid var(--border);font-size:11px;font-weight:600;color:${daysColor}">
            ${days !== null ? (days > 0 ? `+${days} dní` : days===0 ? 'Dnes' : `za ${-days} dní`) : '—'}
          </td>
          <td style="padding:7px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:monospace;font-weight:700;color:var(--navy)">
            ${parseCena(z.cena).toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč
          </td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="background:var(--bg)">
        <td colspan="4" style="padding:8px;font-weight:700;font-size:12px">CELKEM</td>
        <td style="padding:8px;text-align:right;font-family:monospace;font-weight:800;font-size:14px;color:#dc2626">
          ${totalUnpaid.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč
        </td>
      </tr>
    </tfoot>
  </table>`;
}

\u003c/script>
\u003cscript>
// ════════════════════════════════════════════════════════════════
//  MODUL: MÍSTA & KLIMATIZACE
//  Hierarchie: Zakázka → Místa (150) → Klimatizace (~800)
// ════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────
let _activeMistaZakazkaId = null;
let _mista = [];           // [{id, nazev, adresa, poznamka}]
let _klimatizace = {};     // {mistaId: [{id, model, sn, stav, ...}]}
let _selectedMistaId = null;
let _mistaUnsub = null;
let _klimUnsubMap = {};    // {mistaId: unsubscribe}
let _csvImportData = null; // parsed CSV ready to import
let _klimFotoFiles = [];   // soubory fotek pro aktuální klimatizaci

// ── Stav labels ───────────────────────────────────────────────────
const KLIM_STAV = {
  ok:       { label:'✅ OK',        color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
  zavada:   { label:'⚠️ Závada',    color:'#d97706', bg:'#fffbeb', border:'#fcd34d' },
  opraveno: { label:'🔧 Opraveno',  color:'#2563eb', bg:'#eff6ff', border:'#93c5fd' },
  vyrazeno: { label:'❌ Vyřazeno',  color:'#dc2626', bg:'#fef2f2', border:'#fca5a5' },
  nova:     { label:'🆕 Nová',      color:'#6b7280', bg:'#f9fafb', border:'#d1d5db' },
};

function klimStavBadge(stav) {
  const s = KLIM_STAV[stav] || KLIM_STAV.nova;
  return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${s.bg};color:${s.color};border:1px solid ${s.border};white-space:nowrap">${s.label}</span>`;
}

// ── Otevřít panel ─────────────────────────────────────────────────
async function openMistaPanel(zakazkaId) {
  _activeMistaZakazkaId = zakazkaId;
  _selectedMistaId = null;

  const overlay = document.getElementById('mista-overlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const z = (window._zakazky||[]).find(x => x.id === zakazkaId);
  document.getElementById('mista-zakaz-nazev').textContent =
    `🏢 ${z?.nazev || 'Zakázka'} — Místa & Klimatizace`;
  document.getElementById('mista-zakaz-sub').textContent =
    `${z?.zakaznik||''} ${z?.cislo ? '· '+z.cislo : ''}`;

  // Vymaž pravý panel
  document.getElementById('klim-empty').style.display = 'flex';
  document.getElementById('klim-content').style.display = 'none';

  await loadMista(zakazkaId);
}

function closeMistaPanel() {
  document.getElementById('mista-overlay').style.display = 'none';
  document.body.style.overflow = '';
  // Odhlásit listenery
  if(_mistaUnsub) { _mistaUnsub(); _mistaUnsub = null; }
  Object.values(_klimUnsubMap).forEach(u => u());
  _klimUnsubMap = {};
  _klimatizace = {};
  _mista = [];
}

// ── Načtení dat ───────────────────────────────────────────────────
async function loadMista(zakazkaId) {
  if(_mistaUnsub) _mistaUnsub();

  const col = window._fb.collection(
    window._fb.db, 'zakazky', zakazkaId, 'mista'
  );
  const q = window._fb.query(col, window._fb.orderBy('nazev'));

  _mistaUnsub = window._fb.onSnapshot(q, snap => {
    _mista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMistaList();
    updateMistaProgress();

    // Načti klimatizace pro všechna místa
    _mista.forEach(m => {
      if(!_klimUnsubMap[m.id]) loadKlimatizaceForMisto(zakazkaId, m.id);
    });
  });
}

function loadKlimatizaceForMisto(zakazkaId, mistaId) {
  if(_klimUnsubMap[mistaId]) return;

  const col = window._fb.collection(
    window._fb.db, 'zakazky', zakazkaId, 'mista', mistaId, 'klimatizace'
  );
  const q = window._fb.query(col, window._fb.orderBy('model'));

  _klimUnsubMap[mistaId] = window._fb.onSnapshot(q, snap => {
    _klimatizace[mistaId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMistaList(); // aktualizuj progress na místu
    updateMistaProgress();
    if(_selectedMistaId === mistaId) renderKlimList(mistaId);
  });
}

// ── Render: seznam míst ───────────────────────────────────────────
function renderMistaList() {
  const inner = document.getElementById('mista-list-inner');
  if(!inner) return;

  const q = (document.getElementById('mista-search')?.value || '').toLowerCase();
  const filter = document.getElementById('mista-filter-stav')?.value || '';

  let list = _mista;
  if(q) list = list.filter(m => (m.nazev||'').toLowerCase().includes(q) || (m.adresa||'').toLowerCase().includes(q));

  if(filter) {
    list = list.filter(m => {
      const klims = _klimatizace[m.id] || [];
      const done = klims.filter(k => k.stav && k.stav !== 'nova').length;
      if(filter === 'done')    return done === klims.length && klims.length > 0;
      if(filter === 'partial') return done > 0 && done < klims.length;
      if(filter === 'new')     return done === 0;
      return true;
    });
  }

  if(!list.length) {
    inner.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">
      ${_mista.length ? 'Žádná místa nevyhovují filtru' : 'Zatím žádná místa.<br>Přidejte místo nebo importujte CSV.'}
    </div>`;
    return;
  }

  inner.innerHTML = list.map(m => {
    const klims = _klimatizace[m.id] || [];
    const total = klims.length;
    const done  = klims.filter(k => k.stav && k.stav !== 'nova').length;
    const hasZavada = klims.some(k => k.stav === 'zavada');
    const pct   = total ? Math.round(done/total*100) : 0;
    const isSelected = m.id === _selectedMistaId;

    let statusColor = '#94a3b8';
    if(total > 0 && done === total) statusColor = '#16a34a';
    else if(done > 0) statusColor = hasZavada ? '#d97706' : '#2563eb';

    return `<div onclick="selectMisto('${m.id}')"
      style="padding:10px 12px;border-radius:8px;cursor:pointer;border:2px solid ${isSelected?'var(--navy)':'transparent'};background:${isSelected?'var(--bg)':'transparent'};margin-bottom:4px;transition:all .1s">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.nazev)}</div>
          ${m.adresa ? `<div style="font-size:10px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.adresa)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
          <button onclick="event.stopPropagation();editMisto('${m.id}')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted);padding:2px 4px" title="Upravit místo">✎</button>
          <button onclick="event.stopPropagation();openAddKlimModal('${m.id}')" style="background:var(--green);border:none;cursor:pointer;font-size:11px;color:#fff;border-radius:4px;padding:2px 8px;font-weight:700" title="Přidat klimatizaci">+</button>
        </div>
      </div>
      <!-- Progress bar místa -->
      <div style="margin-top:7px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:10px;color:var(--muted)">${total} klimatizací</span>
          <span style="font-size:10px;font-weight:700;color:${statusColor}">${done}/${total} (${pct}%)</span>
        </div>
        <div style="background:var(--border);border-radius:3px;height:4px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${statusColor};border-radius:3px;transition:width .3s"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Vybrat místo ─────────────────────────────────────────────────
function selectMisto(mistaId) {
  _selectedMistaId = mistaId;
  renderMistaList(); // aktualizuj selected highlight

  document.getElementById('klim-empty').style.display = 'none';
  document.getElementById('klim-content').style.display = 'block';

  const m = _mista.find(x => x.id === mistaId);
  const hdr = document.getElementById('klim-header');
  if(hdr && m) {
    hdr.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="font-size:16px;font-weight:800;color:var(--navy);margin-bottom:2px">${esc(m.nazev)}</h3>
          ${m.adresa ? `<div style="font-size:12px;color:var(--muted)">${esc(m.adresa)}</div>` : ''}
          ${m.poznamka ? `<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:2px">${esc(m.poznamka)}</div>` : ''}
        </div>
        <button onclick="openAddKlimModal('${mistaId}')" class="btn btn-green" style="font-size:12px">+ Přidat klimatizaci</button>
      </div>`;
  }

  renderKlimList(mistaId);
}

// ── Render: seznam klimatizací ────────────────────────────────────
function renderKlimList(mistaId) {
  const listEl = document.getElementById('klim-list');
  if(!listEl) return;

  const klims = _klimatizace[mistaId] || [];

  if(!klims.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">
      <div style="font-size:32px;margin-bottom:8px">🌡</div>
      Zatím žádné klimatizace na tomto místě.<br>
      <button onclick="openAddKlimModal('${mistaId}')" class="btn btn-green" style="margin-top:12px;font-size:12px">+ Přidat klimatizaci</button>
    </div>`;
    return;
  }

  listEl.innerHTML = klims.map(k => {
    const s = KLIM_STAV[k.stav || 'nova'];
    const hasPhotos = (k.photos||[]).length > 0;
    return `<div style="background:var(--card);border:1.5px solid ${s.border};border-radius:10px;padding:14px">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
            <span style="font-weight:800;font-size:14px;color:var(--navy)">${esc(k.model||'—')}</span>
            ${klimStavBadge(k.stav||'nova')}
            ${hasPhotos ? `<span style="font-size:10px;color:var(--muted)">📷 ${k.photos.length}</span>` : ''}
          </div>
          ${k.seriove_cislo ? `<div style="font-size:11px;color:var(--muted);margin-bottom:3px">SN: <code>${esc(k.seriove_cislo)}</code></div>` : ''}
          ${k.umisteni ? `<div style="font-size:11px;color:var(--muted);margin-bottom:3px">📍 ${esc(k.umisteni)}</div>` : ''}
          ${k.poznamka ? `<div style="font-size:12px;color:var(--text);margin-top:6px;padding:8px;background:${s.bg};border-radius:6px">${esc(k.poznamka)}</div>` : ''}
          ${k.prace ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">🔧 ${esc(k.prace)}</div>` : ''}
          ${k.zkontrolovano ? `<div style="font-size:10px;color:var(--muted);margin-top:4px">Zkontrolováno: ${k.datum_kontroly||'—'}</div>` : ''}
          <!-- Miniatury fotek -->
          ${hasPhotos ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
            ${k.photos.slice(0,4).map(p => `<img src="${p}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer" onclick="showFullPhoto('${p}')">`).join('')}
            ${k.photos.length>4 ? `<div style="width:48px;height:48px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);font-weight:700">+${k.photos.length-4}</div>` : ''}
          </div>` : ''}
        </div>
        <!-- Akce -->
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          ${['ok','zavada','opraveno','vyrazeno'].map(stav => {
            const ss = KLIM_STAV[stav];
            const active = k.stav === stav;
            return `<button onclick="quickSetKlimStav('${mistaId}','${k.id}','${stav}')"
              title="${ss.label}"
              style="padding:4px 8px;border-radius:6px;border:1.5px solid ${active ? ss.color : ss.border};background:${active ? ss.bg : 'transparent'};cursor:pointer;font-size:11px;font-weight:${active?'800':'400'};color:${active ? ss.color : '#9ca3af'};transition:all .1s">
              ${ss.label.split(' ')[0]}
            </button>`;
          }).join('')}
          <button onclick="editKlimatizace('${mistaId}','${k.id}')"
            style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--card);cursor:pointer;font-size:11px;color:var(--muted)">
            ✎ Edit
          </button>
          <button onclick="deleteKlimatizace('${mistaId}','${k.id}')"
            style="padding:4px 8px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;cursor:pointer;font-size:10px;color:#dc2626">
            🗑
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Progress bar celkový ──────────────────────────────────────────
function updateMistaProgress() {
  let total = 0, done = 0;
  Object.values(_klimatizace).forEach(klims => {
    total += klims.length;
    done  += klims.filter(k => k.stav && k.stav !== 'nova').length;
  });
  const pct = total ? Math.round(done/total*100) : 0;
  const lbl = document.getElementById('mista-progress-label');
  const pctEl = document.getElementById('mista-progress-pct');
  const bar   = document.getElementById('mista-progress-bar');
  if(lbl) lbl.textContent = `${done} / ${total} klimatizací zkontrolováno`;
  if(pctEl) pctEl.textContent = `${pct}%`;
  if(bar) bar.style.width = pct + '%';
}

// ── CRUD: Místa ───────────────────────────────────────────────────
function openAddMistoModal() {
  document.getElementById('edit-misto-id').value = '';
  document.getElementById('misto-nazev-inp').value = '';
  document.getElementById('misto-adresa-inp').value = '';
  document.getElementById('misto-pozn-inp').value = '';
  document.getElementById('add-misto-modal').classList.add('open');
  setTimeout(() => document.getElementById('misto-nazev-inp').focus(), 100);
}

function editMisto(mistaId) {
  const m = _mista.find(x => x.id === mistaId);
  if(!m) return;
  document.getElementById('edit-misto-id').value = mistaId;
  document.getElementById('misto-nazev-inp').value = m.nazev || '';
  document.getElementById('misto-adresa-inp').value = m.adresa || '';
  document.getElementById('misto-pozn-inp').value = m.poznamka || '';
  document.getElementById('add-misto-modal').classList.add('open');
}

async function saveMisto() {
  const nazev = document.getElementById('misto-nazev-inp').value.trim();
  if(!nazev) {
    document.getElementById('misto-nazev-inp').style.borderColor = '#ef4444';
    return;
  }
  const editId = document.getElementById('edit-misto-id').value;
  const data = {
    nazev,
    adresa:   document.getElementById('misto-adresa-inp').value.trim(),
    poznamka: document.getElementById('misto-pozn-inp').value.trim(),
    updatedAt: window._fb.serverTimestamp(),
  };
  try {
    const col = window._fb.collection(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista');
    if(editId) {
      await window._fb.updateDoc(window._fb.doc(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', editId), data);
    } else {
      data.createdAt = window._fb.serverTimestamp();
      await window._fb.addDoc(col, data);
    }
    closeModal('add-misto-modal');
    showToast && showToast('✓ Místo uloženo');
  } catch(e) { alert('Chyba: ' + e.message); }
}

// ── CRUD: Klimatizace ─────────────────────────────────────────────
function openAddKlimModal(mistaId) {
  _klimFotoFiles = [];
  document.getElementById('edit-klim-id').value = '';
  document.getElementById('edit-klim-misto-id').value = mistaId;
  document.getElementById('klim-modal-title').textContent = '🌡 Přidat klimatizaci';
  document.getElementById('klim-model-inp').value = '';
  document.getElementById('klim-sn-inp').value = '';
  document.getElementById('klim-umisteni-inp').value = '';
  document.getElementById('klim-pozn-inp').value = '';
  document.getElementById('klim-prace-inp').value = '';
  document.getElementById('klim-foto-inp').value = '';
  document.getElementById('klim-foto-preview').innerHTML = '';
  setKlimStav('');
  document.getElementById('add-klim-modal').classList.add('open');
  setTimeout(() => document.getElementById('klim-model-inp').focus(), 100);
}

function editKlimatizace(mistaId, klimId) {
  const k = (_klimatizace[mistaId]||[]).find(x => x.id === klimId);
  if(!k) return;
  _klimFotoFiles = [];
  document.getElementById('edit-klim-id').value = klimId;
  document.getElementById('edit-klim-misto-id').value = mistaId;
  document.getElementById('klim-modal-title').textContent = '🌡 Upravit klimatizaci';
  document.getElementById('klim-model-inp').value = k.model || '';
  document.getElementById('klim-sn-inp').value = k.seriove_cislo || '';
  document.getElementById('klim-umisteni-inp').value = k.umisteni || '';
  document.getElementById('klim-pozn-inp').value = k.poznamka || '';
  document.getElementById('klim-prace-inp').value = k.prace || '';
  document.getElementById('klim-foto-inp').value = '';
  // Zobraz existující fotky
  const prev = document.getElementById('klim-foto-preview');
  if(prev && k.photos?.length) {
    prev.innerHTML = k.photos.map(p => `<img src="${p}" style="width:48px;height:48px;object-fit:cover;border-radius:4px">`).join('');
  } else if(prev) { prev.innerHTML = ''; }
  setKlimStav(k.stav || '');
  document.getElementById('add-klim-modal').classList.add('open');
}

function setKlimStav(stav) {
  document.getElementById('klim-stav-val').value = stav;
  document.querySelectorAll('.klim-stav-btn').forEach(btn => {
    const active = btn.dataset.stav === stav;
    const s = KLIM_STAV[btn.dataset.stav] || {};
    btn.style.borderWidth = active ? '2.5px' : '2px';
    btn.style.fontWeight  = active ? '800' : '600';
    btn.style.opacity     = active ? '1' : '0.6';
    btn.style.transform   = active ? 'scale(1.05)' : '';
  });
}

async function saveKlimatizace() {
  const model = document.getElementById('klim-model-inp').value.trim();
  if(!model) {
    document.getElementById('klim-model-inp').style.borderColor = '#ef4444';
    return;
  }
  const btn = document.getElementById('save-klim-btn');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Ukládám…'; }

  const mistaId = document.getElementById('edit-klim-misto-id').value;
  const editId  = document.getElementById('edit-klim-id').value;
  const stav    = document.getElementById('klim-stav-val').value;

  // Nahraj fotky
  const fileInput = document.getElementById('klim-foto-inp');
  const newPhotos = [];
  if(fileInput?.files?.length) {
    for(const file of Array.from(fileInput.files).slice(0,5)) {
      try {
        const compressed = typeof compressPhoto === 'function'
          ? await compressPhoto(file, 1200, 900, 0.8)
          : await new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(file); });
        // Nahrát do Storage pokud online
        if(navigator.onLine && window._fb.storage) {
          const path = `klim/${_activeMistaZakazkaId}/${mistaId}/${Date.now()}_${file.name}`;
          const ref = window._fb.ref(window._fb.storage, path);
          await window._fb.uploadString(ref, compressed, 'data_url');
          const url = await window._fb.getDownloadURL(ref);
          newPhotos.push(url);
        } else {
          newPhotos.push(compressed); // offline — uloží base64
        }
      } catch(e) { console.warn('Photo upload failed:', e); }
    }
  }

  // Existující fotky
  const editedKlim = editId ? (_klimatizace[mistaId]||[]).find(x=>x.id===editId) : null;
  const existingPhotos = editedKlim?.photos || [];
  const allPhotos = [...existingPhotos, ...newPhotos];

  const data = {
    model,
    seriove_cislo: document.getElementById('klim-sn-inp').value.trim(),
    umisteni:      document.getElementById('klim-umisteni-inp').value.trim(),
    poznamka:      document.getElementById('klim-pozn-inp').value.trim(),
    prace:         document.getElementById('klim-prace-inp').value.trim(),
    stav:          stav || 'nova',
    photos:        allPhotos,
    zkontrolovano: !!stav,
    datum_kontroly: stav ? new Date().toLocaleDateString('cs-CZ') : (editedKlim?.datum_kontroly||''),
    updatedAt: window._fb.serverTimestamp(),
  };

  try {
    const col = window._fb.collection(
      window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', mistaId, 'klimatizace'
    );
    if(editId) {
      await window._fb.updateDoc(
        window._fb.doc(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', mistaId, 'klimatizace', editId),
        data
      );
    } else {
      data.createdAt = window._fb.serverTimestamp();
      await window._fb.addDoc(col, data);
    }
    closeModal('add-klim-modal');
    showToast && showToast('✓ Klimatizace uložena');
  } catch(e) { alert('Chyba: ' + e.message); }
  finally { if(btn) { btn.disabled=false; btn.textContent='Uložit'; } }
}

// Rychlé nastavení stavu přímo z kartičky
async function quickSetKlimStav(mistaId, klimId, stav) {
  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', mistaId, 'klimatizace', klimId),
      {
        stav,
        zkontrolovano: true,
        datum_kontroly: new Date().toLocaleDateString('cs-CZ'),
        updatedAt: window._fb.serverTimestamp(),
      }
    );
    // Optimistická aktualizace
    const k = (_klimatizace[mistaId]||[]).find(x=>x.id===klimId);
    if(k) { k.stav = stav; k.zkontrolovano = true; }
    renderKlimList(mistaId);
    updateMistaProgress();
  } catch(e) { showToast && showToast('Chyba: '+e.message); }
}

async function deleteKlimatizace(mistaId, klimId) {
  if(!confirm('Smazat tuto klimatizaci?')) return;
  try {
    await window._fb.deleteDoc(
      window._fb.doc(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', mistaId, 'klimatizace', klimId)
    );
    showToast && showToast('🗑 Klimatizace smazána');
  } catch(e) { alert('Chyba: '+e.message); }
}

// ── Import CSV ────────────────────────────────────────────────────
function openMistaImport() {
  document.getElementById('mista-csv-file').value = '';
  document.getElementById('mista-csv-text').value = '';
  document.getElementById('mista-csv-preview').innerHTML = '';
  document.getElementById('mista-import-btn').style.display = 'none';
  _csvImportData = null;
  document.getElementById('mista-import-modal').classList.add('open');
}

// Načíst soubor do textarea
document.getElementById('mista-csv-file')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('mista-csv-text').value = ev.target.result;
    parseMistaCsv();
  };
  reader.readAsText(file, 'UTF-8');
});

function parseMistaCsv() {
  const raw = document.getElementById('mista-csv-text').value.trim();
  if(!raw) return;

  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if(lines.length < 2) {
    document.getElementById('mista-csv-preview').innerHTML =
      '<div style="color:#dc2626;font-size:12px">CSV musí mít záhlaví a alespoň jeden řádek dat.</div>';
    return;
  }

  // Parse záhlaví
  const header = lines[0].split(',').map(h => h.trim().toLowerCase()
    .replace('místo','misto').replace('místa','misto')
    .replace('sériové číslo','seriove_cislo').replace('sériové_číslo','seriove_cislo')
    .replace('umístění','umisteni').replace('poznámka','poznamka'));

  const getCol = name => {
    const idx = header.findIndex(h => h === name || h.includes(name.split('_')[0]));
    return idx;
  };
  const iMisto   = getCol('misto');
  const iModel   = getCol('model');
  const iSn      = getCol('seriove');
  const iUmist   = getCol('umist');
  const iPozn    = getCol('pozn');

  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g,''));
    return {
      misto:     iMisto>=0  ? cols[iMisto]  : '',
      model:     iModel>=0  ? cols[iModel]  : '',
      sn:        iSn>=0     ? cols[iSn]     : '',
      umisteni:  iUmist>=0  ? cols[iUmist]  : '',
      poznamka:  iPozn>=0   ? cols[iPozn]   : '',
    };
  }).filter(r => r.misto || r.model);

  // Seskup podle míst
  const byMisto = {};
  rows.forEach(r => {
    if(!byMisto[r.misto]) byMisto[r.misto] = [];
    if(r.model) byMisto[r.misto].push(r);
  });

  const mistaCount = Object.keys(byMisto).length;
  const klimCount  = rows.filter(r=>r.model).length;

  _csvImportData = byMisto;

  const prevEl = document.getElementById('mista-csv-preview');
  prevEl.innerHTML = `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px;font-size:12px;margin-bottom:8px">
      ✅ Načteno: <strong>${mistaCount} míst</strong>, <strong>${klimCount} klimatizací</strong>
    </div>
    <div style="max-height:200px;overflow-y:auto;font-size:11px">
      ${Object.entries(byMisto).slice(0,10).map(([misto, klims]) =>
        `<div style="padding:4px 8px;border-bottom:1px solid var(--border)">
          <strong>${esc(misto)}</strong> — ${klims.length} klimatizací
          ${klims.slice(0,3).map(k=>`<span style="color:var(--muted)"> · ${esc(k.model)}</span>`).join('')}
          ${klims.length>3?`<span style="color:var(--muted)"> +${klims.length-3}</span>`:''}
        </div>`
      ).join('')}
      ${mistaCount>10 ? `<div style="padding:4px 8px;color:var(--muted)">… a ${mistaCount-10} dalších míst</div>` : ''}
    </div>`;

  document.getElementById('mista-import-btn').style.display = 'inline-flex';
}

async function importMistaCsv() {
  if(!_csvImportData || !_activeMistaZakazkaId) return;
  const btn = document.getElementById('mista-import-btn');
  if(btn) { btn.disabled=true; btn.textContent='⏳ Importuji…'; }

  let mistaCreated = 0, klimCreated = 0;

  try {
    for(const [mistoNazev, klims] of Object.entries(_csvImportData)) {
      // Vytvoř nebo najdi místo
      let mistaId = (_mista.find(m => m.nazev === mistoNazev))?.id;
      if(!mistaId) {
        const ref = await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista'),
          { nazev: mistoNazev, adresa:'', poznamka:'',
            createdAt: window._fb.serverTimestamp(), updatedAt: window._fb.serverTimestamp() }
        );
        mistaId = ref.id;
        mistaCreated++;
      }

      // Přidej klimatizace
      for(const k of klims) {
        if(!k.model) continue;
        await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', mistaId, 'klimatizace'),
          { model: k.model, seriove_cislo: k.sn, umisteni: k.umisteni,
            poznamka: k.poznamka, prace:'', stav:'nova', photos:[],
            zkontrolovano: false, datum_kontroly:'',
            createdAt: window._fb.serverTimestamp(), updatedAt: window._fb.serverTimestamp() }
        );
        klimCreated++;
      }
    }

    closeModal('mista-import-modal');
    showToast && showToast(`✅ Importováno ${mistaCreated} míst, ${klimCreated} klimatizací`);
    _csvImportData = null;
  } catch(e) {
    alert('Chyba při importu: ' + e.message);
  } finally {
    if(btn) { btn.disabled=false; btn.textContent='✓ Importovat'; }
  }
}

// ── Kopírovat strukturu z jiné zakázky ───────────────────────────
async function copyMistaFromSablona() {
  const all = window._zakazky || [];
  if(!all.length) { alert('Žádné zakázky k dispozici'); return; }

  // Vytvoř dialog pro výběr
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `<div style="background:var(--card);border-radius:14px;padding:20px;max-width:480px;width:100%;max-height:80vh;display:flex;flex-direction:column">
    <h3 style="margin-bottom:12px;color:var(--navy)">📋 Kopírovat strukturu míst</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Zkopíruje místa a klimatizace z vybrané zakázky (bez výsledků kontrol).</p>
    <select id="copy-zakaz-sel" style="padding:8px;border:1px solid var(--border);border-radius:8px;font-size:13px;margin-bottom:12px">
      <option value="">— Vyberte zakázku —</option>
      ${all.filter(z=>z.id!==_activeMistaZakazkaId).map(z=>
        `<option value="${z.id}">${esc(z.nazev||'—')} ${z.cislo?'('+z.cislo+')':''}</option>`
      ).join('')}
    </select>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="this.closest('.mista-copy-modal').remove()" class="btn btn-ghost">Zrušit</button>
      <button onclick="executeCopyMista(document.getElementById('copy-zakaz-sel').value)" class="btn btn-green">Kopírovat</button>
    </div>
  </div>`;
  modal.className = 'mista-copy-modal';
  modal.querySelector('button.btn-ghost').onclick = () => modal.remove();
  document.body.appendChild(modal);
}

async function executeCopyMista(sourceZakazkaId) {
  if(!sourceZakazkaId) { alert('Vyberte zakázku'); return; }
  document.querySelector('.mista-copy-modal')?.remove();

  showToast && showToast('⏳ Kopíruji strukturu míst…');

  try {
    // Načti místa ze zdrojové zakázky
    const mistaSnap = await window._fb.getDocs(
      window._fb.collection(window._fb.db, 'zakazky', sourceZakazkaId, 'mista')
    );

    let mc = 0, kc = 0;
    for(const mistaDoc of mistaSnap.docs) {
      const m = mistaDoc.data();
      const newMistaRef = await window._fb.addDoc(
        window._fb.collection(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista'),
        { nazev: m.nazev, adresa: m.adresa||'', poznamka: m.poznamka||'',
          createdAt: window._fb.serverTimestamp(), updatedAt: window._fb.serverTimestamp() }
      );
      mc++;

      // Načti klimatizace z tohoto místa
      const klimSnap = await window._fb.getDocs(
        window._fb.collection(window._fb.db, 'zakazky', sourceZakazkaId, 'mista', mistaDoc.id, 'klimatizace')
      );
      for(const klimDoc of klimSnap.docs) {
        const k = klimDoc.data();
        await window._fb.addDoc(
          window._fb.collection(window._fb.db, 'zakazky', _activeMistaZakazkaId, 'mista', newMistaRef.id, 'klimatizace'),
          { model: k.model, seriove_cislo: k.seriove_cislo||'',
            umisteni: k.umisteni||'', poznamka:'', prace:'',
            stav:'nova', photos:[], zkontrolovano:false, datum_kontroly:'',
            createdAt: window._fb.serverTimestamp(), updatedAt: window._fb.serverTimestamp() }
        );
        kc++;
      }
    }

    showToast && showToast(`✅ Zkopírováno ${mc} míst, ${kc} klimatizací`);
  } catch(e) {
    alert('Chyba: ' + e.message);
  }
}

// ── Zobraz foto ve fullscreen ─────────────────────────────────────
function showFullPhoto(url) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:pointer';
  div.innerHTML = `<img src="${url}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px">`;
  div.onclick = () => div.remove();
  document.body.appendChild(div);
}

// ── Preview fotek při výběru ──────────────────────────────────────
document.getElementById('klim-foto-inp')?.addEventListener('change', e => {
  const prev = document.getElementById('klim-foto-preview');
  if(!prev) return;
  const files = Array.from(e.target.files||[]).slice(0,5);
  prev.innerHTML = '';
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:4px';
      prev.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

// ── Keyboard shortcut pro zavření panelu ──────────────────────────
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') {
    const overlay = document.getElementById('mista-overlay');
    if(overlay?.style.display === 'flex') closeMistaPanel();
  }
});

\u003c/script>
<!-- ══ PROTOKOL WIZARD ═══════════════════════════════════════════ -->
<div class="modal-overlay" id="protocol-wizard-modal">
  <div class="modal-box" style="max-width:600px;max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 id="pw-title">📋 Generovat protokol</h3>
      <button onclick="closeModal('protocol-wizard-modal')" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">×</button>
    </div>
    <input type="hidden" id="pw-zakaz-id">

    <!-- Info o přiřazeném protokolu -->
    <div id="pw-info" style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:14px;color:#1e3a5f"></div>

    <!-- Výběr protokolu (přepíše zákazníkův default) -->
    <div class="fg2" style="margin-bottom:12px">
      <label>Typ protokolu</label>
      <select id="pw-typ" onchange="pwOnTypChange()" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:var(--card)">
        <option value="kaufland_rocni">Kaufland — Roční revize (05A)</option>
        <option value="kaufland_pulrocni">Kaufland — Půlroční revize (05B)</option>
        <option value="minobr">Ministerstvo obrany — Zápis o údržbě KJ</option>
      </select>
    </div>

    <!-- Sdílená pole -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="fg2">
        <label>Datum</label>
        <input type="date" id="pw-datum">
      </div>
      <div class="fg2" id="pw-smlouva-row">
        <label id="pw-smlouva-label">Číslo smlouvy</label>
        <input id="pw-smlouva" placeholder="">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="fg2">
        <label>Zahájení [hod]</label>
        <input type="time" id="pw-zahajeni">
      </div>
      <div class="fg2">
        <label>Ukončení [hod]</label>
        <input type="time" id="pw-ukonceni">
      </div>
    </div>

    <!-- Kaufland pole -->
    <div id="pw-kaufland-fields">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="fg2">
          <label>Objekt (filiálka)</label>
          <input id="pw-objekt" placeholder="Kaufland Praha Letňany">
        </div>
        <div class="fg2">
          <label>Domovní technik</label>
          <input id="pw-domovni-tech" placeholder="Jméno DT zákazníka">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="fg2">
          <label>Typ zařízení</label>
          <input id="pw-typ-zarizeni" placeholder="Chiller Carrier 30RB">
        </div>
        <div class="fg2">
          <label>Výrobní číslo</label>
          <input id="pw-vyrobni-cislo" placeholder="SN123456">
        </div>
      </div>
      <div class="fg2" style="margin-bottom:12px">
        <label>Rok výroby</label>
        <input id="pw-rok-vyroby" placeholder="2018" style="max-width:120px">
      </div>

      <!-- Sekce A — Provozní připravenost -->
      <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--navy)">A — Provozní připravenost</div>
        <div style="display:flex;gap:16px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-provoz" value="funkční"> Funkční</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-provoz" value="nefunkční"> Nefunkční</label>
        </div>
      </div>

      <!-- Sekce B — Revizní kniha -->
      <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--navy)">B — Revizní kniha</div>
        <div style="display:flex;gap:16px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-revkniha" value="k dispozici"> K dispozici</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-revkniha" value="není k dispozici"> Není k dispozici</label>
        </div>
      </div>

      <!-- Dynamické sekce dle typu -->
      <div id="pw-dynamic-sections"></div>

      <!-- Stav zařízení -->
      <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--navy)" id="pw-stav-label">D — Stav zařízení</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-stav" value="zelena"> 🟢 Zelená — zařízení je plně funkční</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-stav" value="zluta"> 🟡 Žlutá — vyhovující s nedostatky, následuje nabídka</label>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="radio" name="pw-stav" value="cervena"> 🔴 Červená — zařízení nevyhovující dle Vyhl.246/2001 Sb.</label>
        </div>
      </div>
    </div>

    <!-- Ministerstvo obrany specifická pole -->
    <div id="pw-minobr-fields" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="fg2">
          <label>Evidenční číslo</label>
          <input id="pw-ev-cislo" placeholder="POZ-913401-2026">
        </div>
        <div class="fg2">
          <label>Vojenský útvar</label>
          <input id="pw-voj-utvar" placeholder="VÚ 3255">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="fg2">
          <label>Místo provedení</label>
          <input id="pw-misto-proven" placeholder="Praha / Olomouc">
        </div>
        <div class="fg2">
          <label>Budova / místnost</label>
          <input id="pw-budova" placeholder="B004/1NP/139">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="fg2">
          <label>Typ klimatizační jednotky</label>
          <input id="pw-typ-kj" placeholder="ATREA DUPLEX">
        </div>
        <div class="fg2">
          <label>Výr. číslo vnitřní / vnější</label>
          <input id="pw-sn-kj" placeholder="227387 / 227387">
        </div>
      </div>
      <div class="fg2" style="margin-bottom:12px">
        <label>Chladivo</label>
        <input id="pw-chladivo" placeholder="R410A">
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px;font-size:12px">
        <div style="font-weight:700;margin-bottom:8px;color:var(--navy)">Provedené práce — zaškrtněte provedené:</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px" id="pw-minobr-checks"></div>
      </div>
    </div>

    <!-- Společná závěrečná pole -->
    <div class="fg2" style="margin-bottom:14px">
      <label>Závěr / Popis zjištěných skutečností a závad</label>
      <textarea id="pw-zaver" rows="4" style="resize:vertical" placeholder="Popis provedené práce, zjištěné závady, doporučení…"></textarea>
    </div>

    <div class="modal-foot">
      <button onclick="closeModal('protocol-wizard-modal')" class="btn btn-ghost">Zrušit</button>
      <button onclick="generateProtocol()" class="btn btn-green" style="font-size:13px;font-weight:700">📄 Generovat protokol</button>
    </div>
  </div>
</div>

\u003cscript>
// ════════════════════════════════════════════════════════════════
//  MODUL: ZÁKAZNICKÉ PROTOKOLY
//  Kaufland 05A (roční), Kaufland 05B (půlroční), Min. obrany
// ════════════════════════════════════════════════════════════════

// ── Kaufland sekce pro 05A (roční revize) ────────────────────────
const KL_SEKCE_ROCNI = [
  { id: 'C', label: 'Kontrola zařízení (celek)', polozky: [
    'Vizuální kontrola jednotky',
    'Ověření neporušené tepelné izolace',
    'Čištění a oprava laku dle potřeby',
  ]},
  { id: 'D', label: 'Elektroinstalace', polozky: [
    'Kontrola řídících prvků - aktualizace software',
    'Kontrola opotřebených stykačů – dle potřeby výměna',
    'Kontrola dotažení všech elektrických spojů – dle potřeby dotažení',
    'Vizuální kontrola součástí',
    'Ověření chodu kompresorů',
    'Měření izolačního odporu elektromotoru kompresoru',
  ]},
  { id: 'E', label: 'Okruh chlazení', polozky: [
    'Kontrola průtoku chladiva v kontrolním průhledítku (musí být plný kapaliny)',
    'Kontrola tlakové ztráty dehydrátoru',
    'Kontrola tlakové ztráty olejového filtru',
    'Kontrola vibrací kompresoru',
    'Analýza kyselosti oleje v kompresoru',
    'Kontrola pojistných ventilů – případná výměna',
  ]},
  { id: 'F', label: 'Kondenzátor', polozky: [
    'Chemické čištění kondenzátoru',
    'Kontrola chodu ventilátoru',
    'Kontrola žeber kondenzátoru – dle potřeby vykartáčování',
  ]},
  { id: 'G', label: 'Testy - sestavy', polozky: [
    'max. výkon při režimu chlazení',
    'Kontrola tlaků – chlazení',
    'Kontrola – proměření odběru kompresorů - ventilátorů',
    'Kontrola funkce přetlakového jističe',
  ]},
  { id: 'H', label: 'Revize okruhu chlazení', polozky: [
    'Kontrola tlaku v potrubním systému a revize úniku fluorovaných skleníkových plynů dle zákona o ochraně ovzduší (kontrola dle čl. 2 odst. 5 Nařízení EP a Rady EU č. 517/2014)',
  ]},
];

// Ministerstvo obrany — seznam prací
const MINOBR_PRACE = [
  'Kontrola funkcí',
  'Vyčištění vnitřní jednotky',
  'Vyčištění vnější jednotky',
  'Kontrola funkčnosti zimní výbavy',
  'Kontrola těsnosti okruh, doplnění chladiva',
  'Kontrola výrobních čísel jednotek',
  'Kontrola baterií v dálkovém ovládání',
  'Výměna baterií v dálkovém ovládání',
  'Kontrola kondenzačních tlaků kompresoru',
  'Seřízení kondenzačních tlaků kompresoru',
  'Kontrola elektrické části kompresoru',
  'Kontrola chodu a uložení kompresoru',
  'Kontrola motoru, ložisek a vyváženosti venkovního ventilátoru',
  'Kontrola značení a evidence v souladu s vyhláškou 201/2012 Sb. a ES 517/2014',
  'Ostatní dle specifikace údržby výrobce KJ',
];

// ── Otevřít wizard ────────────────────────────────────────────────
function openProtocolWizard(zakazkaId) {
  const z = (window._zakazky||[]).find(x => x.id === zakazkaId);
  if(!z) return;

  document.getElementById('pw-zakaz-id').value = zakazkaId;

  // Předvyplň z dat zakázky
  const dnes = new Date().toISOString().slice(0,10);
  document.getElementById('pw-datum').value = z.termin || dnes;
  document.getElementById('pw-zaver').value = z.prace || '';

  // Kaufland pole
  document.getElementById('pw-objekt').value = z.adresa || '';
  document.getElementById('pw-domovni-tech').value = '';

  // Zjisti protokol zákazníka
  const zakaznik = (window._zakaznici||[]).find(k =>
    k.nazev === z.zakaznik || k.id === z.zakaznikId
  );
  const protokolTyp = zakaznik?.protokol || 'kaufland_rocni';
  const smlouva     = zakaznik?.smlouva  || '';

  // Info řádek
  const infoEl = document.getElementById('pw-info');
  if(zakaznik?.protokol) {
    const labels = {
      kaufland_rocni:   'Kaufland — Roční revize (05A)',
      kaufland_pulrocni:'Kaufland — Půlroční revize (05B)',
      minobr:           'Ministerstvo obrany — Zápis o údržbě KJ',
    };
    infoEl.innerHTML = `<strong>Zákazník ${esc(zakaznik.nazev)}</strong> má přiřazen protokol: <strong>${labels[zakaznik.protokol]||zakaznik.protokol}</strong>`;
    infoEl.style.display = 'block';
  } else {
    infoEl.style.display = 'none';
  }

  // Nastav select
  const sel = document.getElementById('pw-typ');
  if(sel) sel.value = protokolTyp;

  // Smlouva
  document.getElementById('pw-smlouva').value = smlouva;

  // Technik
  const techJmeno = z.technik || (window._currentUser?.displayName) || '';
  // Uložíme pro použití v generování

  // Ministr. obrany specifika
  document.getElementById('pw-ev-cislo').value = '';
  document.getElementById('pw-voj-utvar').value = zakaznik?.voj_utvar || '';
  document.getElementById('pw-misto-proven').value = z.adresa || '';

  // Renderuj dynamické části
  pwOnTypChange();

  document.getElementById('protocol-wizard-modal').classList.add('open');
}

function pwOnTypChange() {
  const typ = document.getElementById('pw-typ')?.value;
  const isKaufland = typ === 'kaufland_rocni' || typ === 'kaufland_pulrocni';
  const isMinobr   = typ === 'minobr';

  document.getElementById('pw-kaufland-fields').style.display = isKaufland ? 'block' : 'none';
  document.getElementById('pw-minobr-fields').style.display   = isMinobr   ? 'block' : 'none';

  // Smlouva label
  const lbl = document.getElementById('pw-smlouva-label');
  if(lbl) lbl.textContent = isMinobr ? 'Číslo rámcové dohody' : 'Číslo rámcové smlouvy';
  const sRow = document.getElementById('pw-smlouva-row') || document.getElementById('zak-smlouva-row');

  // Stav label (I pro roční, D pro půlroční)
  const stavLbl = document.getElementById('pw-stav-label');
  if(stavLbl) {
    if(typ === 'kaufland_rocni')    stavLbl.textContent = 'I — Stav zařízení';
    else if(typ === 'kaufland_pulrocni') stavLbl.textContent = 'D — Stav zařízení';
  }

  // Dynamické sekce
  const dynEl = document.getElementById('pw-dynamic-sections');
  if(!dynEl) return;

  if(typ === 'kaufland_rocni') {
    dynEl.innerHTML = KL_SEKCE_ROCNI.map(s => renderKlSekce(s)).join('');
  } else if(typ === 'kaufland_pulrocni') {
    // 05B má jen sekci C — Revize okruhu chlazení
    dynEl.innerHTML = renderKlSekce({
      id: 'C', label: 'Revize okruhu chlazení',
      polozky: ['Kontrola tlaku v potrubním systému a revize úniku fluorovaných skleníkových plynů dle zákona o ochraně ovzduší (kontrola dle čl. 2 odst. 5 Nařízení EP a Rady EU č. 517/2014)'],
    });
  } else {
    dynEl.innerHTML = '';
  }

  // Min. obrany — checklist prací
  if(isMinobr) {
    const checksEl = document.getElementById('pw-minobr-checks');
    if(checksEl) {
      checksEl.innerHTML = MINOBR_PRACE.map((p, i) =>
        `<label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;cursor:pointer;line-height:1.3">
          <input type="checkbox" id="pw-prace-${i}" value="${p}" style="margin-top:2px;flex-shrink:0"> ${p}
        </label>`
      ).join('');
    }
  }
}

function renderKlSekce(s) {
  return `<div style="background:var(--bg);border-radius:8px;padding:12px;margin-bottom:10px">
    <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--navy)">${s.id} — ${s.label}</div>
    <div style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:4px 8px;align-items:center;font-size:11px">
      <div></div><div style="color:var(--muted);font-size:10px">Položka</div>
      <div style="color:var(--muted);font-size:10px;text-align:center">OK</div>
      <div style="color:var(--muted);font-size:10px;text-align:center">Ne OK</div>
      <div style="color:var(--muted);font-size:10px;text-align:center">Napr.</div>
      <div style="color:var(--muted);font-size:10px;text-align:center">Nabíd.</div>
      ${s.polozky.map((p, i) => {
        const key = `${s.id}_${i}`;
        return `<div style="font-size:10px;color:var(--muted)">${i+1}.</div>
          <div style="font-size:11px">${p}</div>
          <div style="text-align:center"><input type="radio" name="pw-${key}" value="ok"></div>
          <div style="text-align:center"><input type="radio" name="pw-${key}" value="neok"></div>
          <div style="text-align:center"><input type="radio" name="pw-${key}" value="napraveno"></div>
          <div style="text-align:center"><input type="radio" name="pw-${key}" value="nabidka"></div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── Pomocná: získej hodnotu radio group ───────────────────────────
function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

// ── Shromaždi výsledky checklist sekcí ───────────────────────────
function collectKlSekce(sekce) {
  return sekce.map(s => ({
    ...s,
    vysledky: s.polozky.map((p, i) => ({
      polozka: p,
      stav: getRadio(`pw-${s.id}_${i}`) || '',
    })),
  }));
}

// ── Generovat a zobrazit protokol ────────────────────────────────
function generateProtocol() {
  const zakazkaId = document.getElementById('pw-zakaz-id').value;
  const z = (window._zakazky||[]).find(x => x.id === zakazkaId);
  const typ = document.getElementById('pw-typ')?.value;

  const firma = window._currentFirma === 'progres'
    ? 'Progresklima CZ s.r.o.' : 'AC EURO s.r.o.';

  const common = {
    datum:    document.getElementById('pw-datum')?.value || '',
    zahajeni: document.getElementById('pw-zahajeni')?.value || '',
    ukonceni: document.getElementById('pw-ukonceni')?.value || '',
    smlouva:  document.getElementById('pw-smlouva')?.value || '',
    zaver:    document.getElementById('pw-zaver')?.value || '',
    technik:  z?.technik || (window._currentUser?.displayName) || '',
    pracovnici: z?.technik || '',
    firma,
  };

  let html;
  if(typ === 'kaufland_rocni') {
    html = genKauflandRocni(z, common);
  } else if(typ === 'kaufland_pulrocni') {
    html = genKauflandPulrocni(z, common);
  } else if(typ === 'minobr') {
    html = genMinObrany(z, common);
  } else {
    showToast && showToast('Neznámý typ protokolu');
    return;
  }

  closeModal('protocol-wizard-modal');

  // Zobraz v iframe (stejný systém jako souhrn zakázky)
  const modal = document.getElementById('souhrn-modal') ||
    (() => { const m = document.createElement('div'); m.id='souhrn-modal'; m.className='modal-overlay'; document.body.appendChild(m); return m; })();

  modal.innerHTML = `<div style="background:var(--card);border-radius:14px;width:min(900px,95vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-weight:700;font-size:14px">📋 Protokol — ${esc(z?.nazev||'')}</span>
      <div style="display:flex;gap:8px">
        <button onclick="document.getElementById('proto-iframe').contentWindow.print()" class="btn btn-green" style="font-size:12px">🖨 Tisk / PDF</button>
        <button onclick="this.closest('.modal-overlay').classList.remove('open')" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">×</button>
      </div>
    </div>
    <iframe id="proto-iframe" style="flex:1;border:none;min-height:600px"></iframe>
  </div>`;
  modal.classList.add('open');

  setTimeout(() => {
    const iframe = document.getElementById('proto-iframe');
    if(iframe) {
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    }
  }, 100);
}

// ── Helpers pro generování HTML ───────────────────────────────────
function checkBox(val, target) {
  return `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #333;text-align:center;line-height:12px;font-size:10px;margin:0 2px">${val===target?'✓':''}</span>`;
}

function klRow(polozka, stav) {
  return `<tr>
    <td style="padding:3px 6px;font-size:11px">${polozka}</td>
    <td style="text-align:center;width:40px">${checkBox(stav,'ok')}</td>
    <td style="text-align:center;width:40px">${checkBox(stav,'neok')}</td>
    <td style="text-align:center;width:40px">${checkBox(stav,'napraveno')}</td>
    <td style="text-align:center;width:40px">${checkBox(stav,'nabidka')}</td>
  </tr>`;
}

function klSekceHtml(sekce_data) {
  return sekce_data.map(s => `
    <tr><td colspan="5" style="padding:6px 6px 2px;background:#f5f5f5">
      <strong style="font-size:11px">${s.id} &nbsp; ${s.label}</strong>
      <span style="float:right;font-size:10px;color:#666">OK &nbsp;&nbsp; Ne OK &nbsp;&nbsp; Napr. &nbsp;&nbsp; Nabíd.</span>
    </td></tr>
    ${s.vysledky.map(v => klRow(v.polozka, v.stav)).join('')}
  `).join('');
}

function pdfStyles() {
  return `<style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:16px;background:#fff}
    table{width:100%;border-collapse:collapse}
    td,th{font-size:11px;vertical-align:top}
    .hdr-table td{padding:2px 4px;font-size:11px}
    .checklist td{border:1px solid #ccc;padding:3px 5px}
    .checklist th{border:1px solid #ccc;padding:3px 5px;background:#f5f5f5;font-size:10px;text-align:center}
    .sig-table{border-collapse:collapse;width:100%}
    .sig-table td{border:1px solid #000;padding:30px 8px 6px;font-size:10px;font-weight:bold;width:33%}
    .footer{font-size:9px;color:#666;border-top:1px solid #ccc;padding-top:4px;margin-top:10px;display:flex;justify-content:space-between}
    @media print{body{padding:8px} .no-print{display:none!important}}
    .no-print{margin-bottom:12px}
    .kaufland-logo{color:#e2000f;font-size:22px;font-weight:900;font-family:Arial;border:3px solid #e2000f;padding:2px 6px;display:inline-block}
  </style>`;
}

// ── KAUFLAND 05A — Roční revize ───────────────────────────────────
function genKauflandRocni(z, c) {
  const sekce = collectKlSekce(KL_SEKCE_ROCNI);
  const provoz  = getRadio('pw-provoz');
  const revknih = getRadio('pw-revkniha');
  const stav    = getRadio('pw-stav');
  const objekt  = document.getElementById('pw-objekt')?.value || z?.adresa || '';
  const domTech = document.getElementById('pw-domovni-tech')?.value || '';
  const typZar  = document.getElementById('pw-typ-zarizeni')?.value || '';
  const vyrobCis= document.getElementById('pw-vyrobni-cislo')?.value || '';
  const rokVyr  = document.getElementById('pw-rok-vyroby')?.value || '';
  const smlouva = c.smlouva || 'R-878-2745-2023-C';

  const datumFmt = c.datum ? c.datum.split('-').reverse().join('.') : '';
  const odpr = (c.zahajeni && c.ukonceni)
    ? (() => {
        const [h1,m1]=c.zahajeni.split(':').map(Number);
        const [h2,m2]=c.ukonceni.split(':').map(Number);
        const mins=(h2*60+m2)-(h1*60+m1);
        return mins>0 ? `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')}` : '';
      })() : '';

  const stavColors = { zelena:'🟢', zluta:'🟡', cervena:'🔴' };

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Kaufland 05A</title>${pdfStyles()}</head><body>
<div class="no-print"><button onclick="window.print()" style="background:#0f1f3d;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">🖨 Tisk / Uložit PDF</button></div>

<!-- Hlavička -->
<table style="border:2px solid #000;border-bottom:none;margin-bottom:0">
  <tr>
    <td style="padding:8px 10px;width:80%">
      <div style="font-weight:900;font-size:13px">Příloha č. 05A k Rámcové smlouvě ${esc(smlouva)} / ${esc(c.firma)}</div>
      <div style="font-weight:700;font-size:12px">Protokol o údržbě – Zdroj chladu</div>
      <div style="font-weight:700;font-size:12px">Roční revize Zdroje chladu – březen / duben</div>
    </td>
    <td style="text-align:right;padding:8px;vertical-align:middle">
      <div class="kaufland-logo">K</div>
    </td>
  </tr>
</table>

<!-- Hlavní tabulka údajů -->
<table style="border:2px solid #000;width:100%;margin-bottom:6px" class="hdr-table">
  <tr>
    <td style="border-right:1px solid #ccc;width:20%;padding:5px 8px"><strong>Datum:</strong> ${datumFmt}</td>
    <td style="border-right:1px solid #ccc;width:40%;padding:5px 8px"><strong>Objekt:</strong> ${esc(objekt)}</td>
    <td style="padding:5px 8px"><strong>Domovní technik:</strong> ${esc(domTech)}</td>
  </tr>
  <tr>
    <td colspan="2" style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Firma:</strong> ${esc(c.firma)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Pracovníci:</strong> ${esc(c.pracovnici)}</td>
    <td style="border-top:1px solid #ccc;padding:5px 8px"></td>
  </tr>
  <tr>
    <td style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Zahájení:</strong> ${c.zahajeni} hod</td>
    <td style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Ukončení:</strong> ${c.ukonceni} hod &nbsp;&nbsp; <strong>Odpracováno:</strong> ${odpr} hod</td>
    <td style="border-top:1px solid #ccc;padding:5px 8px"></td>
  </tr>
  <tr>
    <td colspan="2" style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Typ zařízení:</strong> ${esc(typZar)}</td>
    <td style="border-top:1px solid #ccc;padding:5px 8px"><strong>Výrobní číslo:</strong> ${esc(vyrobCis)}</td>
  </tr>
  <tr>
    <td colspan="3" style="border-top:1px solid #ccc;padding:5px 8px"><strong>Rok výroby:</strong> ${esc(rokVyr)}</td>
  </tr>
</table>

<!-- Checklist -->
<table class="checklist" style="border:1px solid #000;margin-bottom:6px">
  <tr>
    <td colspan="5" style="padding:5px 6px;background:#f0f0f0;font-weight:bold;font-size:11px">
      A &nbsp;&nbsp; <strong>Provozní připravenost</strong> před provedením údržby
      <span style="float:right">Funkční ${checkBox(provoz,'funkční')} &nbsp; Nefunkční ${checkBox(provoz,'nefunkční')}</span>
    </td>
  </tr>
  <tr>
    <td colspan="5" style="padding:5px 6px;background:#f0f0f0;font-weight:bold;font-size:11px">
      B &nbsp;&nbsp; <strong>Revizní kniha</strong> kompletně vyplněna
      <span style="float:right">K dispozici ${checkBox(revknih,'k dispozici')} &nbsp; Není k dispozici ${checkBox(revknih,'není k dispozici')}</span>
    </td>
  </tr>
  <tr style="background:#e8e8e8">
    <th style="text-align:left;padding:4px 6px">Sekce</th>
    <th>OK</th><th>Ne OK</th><th>Napraveno</th><th>Nabídka</th>
  </tr>
  ${klSekceHtml(sekce)}
</table>

<!-- Stav zařízení -->
<table style="border:1px solid #000;margin-bottom:6px;width:100%">
  <tr>
    <td style="padding:8px;background:#f0f0f0;font-weight:bold;font-size:11px;width:180px">I &nbsp;&nbsp; <strong>Stav zařízení</strong></td>
    <td style="padding:8px">
      <div>${checkBox(stav,'zelena')} Zelená &nbsp; (zařízení je plně funkční)</div>
      <div style="margin-top:3px">${checkBox(stav,'zluta')} Žlutá &nbsp;&nbsp; (vyhovující s nedostatky, následuje nabídka)</div>
      <div style="margin-top:3px">${checkBox(stav,'cervena')} Červená (zařízení je nevyhovující dle Vyhl.246/2001 Sb.)</div>
    </td>
  </tr>
</table>

<!-- Závěr -->
<div style="border:1px solid #000;padding:8px;margin-bottom:6px;min-height:80px">
  <div style="font-weight:bold;font-size:11px;margin-bottom:6px">Závěr / Poznámky:</div>
  <div style="font-size:11px;white-space:pre-wrap">${esc(c.zaver)}</div>
  ${Array(6).fill('<div style="border-bottom:1px dotted #ccc;height:18px;margin-top:4px"></div>').join('')}
</div>

<!-- Podpisy -->
<table class="sig-table">
  <tr>
    <td>Razítko filiálky, Podpis VOD + DT</td>
    <td>Datum</td>
    <td>Podpis technika dodavatele</td>
  </tr>
</table>

<div class="footer">
  <span>© Kaufland Česká republika v.o.s., Praha 6, Bělohorská 203, PSČ 169 00, IČ: 25110161 &nbsp; ze dne 22.06.2023</span>
  <span>Strana 1 z 2</span>
</div>
</body></html>`;
}

// ── KAUFLAND 05B — Půlroční revize ────────────────────────────────
function genKauflandPulrocni(z, c) {
  const provoz  = getRadio('pw-provoz');
  const revknih = getRadio('pw-revkniha');
  const stav    = getRadio('pw-stav');
  const sekceC  = collectKlSekce([{
    id:'C', label:'Revize okruhu chlazení',
    polozky:['Kontrola tlaku v potrubním systému a revize úniku fluorovaných skleníkových plynů dle zákona o ochraně ovzduší (kontrola dle čl. 2 odst. 5 Nařízení EP a Rady EU č. 517/2014)'],
  }]);
  const objekt  = document.getElementById('pw-objekt')?.value || z?.adresa || '';
  const domTech = document.getElementById('pw-domovni-tech')?.value || '';
  const typZar  = document.getElementById('pw-typ-zarizeni')?.value || '';
  const vyrobCis= document.getElementById('pw-vyrobni-cislo')?.value || '';
  const rokVyr  = document.getElementById('pw-rok-vyroby')?.value || '';
  const smlouva = c.smlouva || 'R-878-2745-2023-C';
  const datumFmt = c.datum ? c.datum.split('-').reverse().join('.') : '';

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Kaufland 05B</title>${pdfStyles()}</head><body>
<div class="no-print"><button onclick="window.print()" style="background:#0f1f3d;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">🖨 Tisk / Uložit PDF</button></div>

<table style="border:2px solid #000;border-bottom:none">
  <tr>
    <td style="padding:8px 10px">
      <div style="font-weight:900;font-size:13px">Příloha č. 05B k Rámcové smlouvě ${esc(smlouva)} / ${esc(c.firma)}</div>
      <div style="font-weight:700;font-size:12px">Protokol o údržbě – Zdroj chladu</div>
      <div style="font-weight:700;font-size:12px">Půlroční revize okruhu chlazení (únik chladiva) – září / říjen</div>
    </td>
    <td style="text-align:right;padding:8px;vertical-align:middle"><div class="kaufland-logo">K</div></td>
  </tr>
</table>

<table style="border:2px solid #000;width:100%;margin-bottom:6px" class="hdr-table">
  <tr>
    <td style="border-right:1px solid #ccc;width:25%;padding:5px 8px"><strong>Datum:</strong> ${datumFmt}</td>
    <td style="border-right:1px solid #ccc;width:40%;padding:5px 8px"><strong>Objekt:</strong> ${esc(objekt)}</td>
    <td style="padding:5px 8px"><strong>Domovní technik:</strong> ${esc(domTech)}</td>
  </tr>
  <tr>
    <td colspan="2" style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Firma:</strong> ${esc(c.firma)} &nbsp;&nbsp;&nbsp; <strong>Pracovníci:</strong> ${esc(c.pracovnici)}</td>
    <td style="border-top:1px solid #ccc"></td>
  </tr>
  <tr>
    <td style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Zahájení:</strong> ${c.zahajeni} hod</td>
    <td style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Ukončení:</strong> ${c.ukonceni} hod</td>
    <td style="border-top:1px solid #ccc;padding:5px 8px"></td>
  </tr>
  <tr>
    <td colspan="2" style="border-right:1px solid #ccc;border-top:1px solid #ccc;padding:5px 8px"><strong>Typ zařízení:</strong> ${esc(typZar)}</td>
    <td style="border-top:1px solid #ccc;padding:5px 8px"><strong>Výrobní číslo:</strong> ${esc(vyrobCis)}</td>
  </tr>
  <tr><td colspan="3" style="border-top:1px solid #ccc;padding:5px 8px"><strong>Rok výroby:</strong> ${esc(rokVyr)}</td></tr>
</table>

<table class="checklist" style="border:1px solid #000;margin-bottom:6px">
  <tr>
    <td colspan="5" style="padding:5px 6px;background:#f0f0f0;font-weight:bold">
      A &nbsp;&nbsp; <strong>Provozní připravenost</strong> před provedením údržby
      <span style="float:right">Funkční ${checkBox(provoz,'funkční')} &nbsp; Nefunkční ${checkBox(provoz,'nefunkční')}</span>
    </td>
  </tr>
  <tr>
    <td colspan="5" style="padding:5px 6px;background:#f0f0f0;font-weight:bold">
      B &nbsp;&nbsp; <strong>Revizní kniha</strong>
      <span style="float:right">K dispozici ${checkBox(revknih,'k dispozici')} &nbsp; Není k dispozici ${checkBox(revknih,'není k dispozici')}</span>
    </td>
  </tr>
  <tr style="background:#e8e8e8">
    <th style="text-align:left;padding:4px 6px">Sekce</th>
    <th>OK</th><th>Ne OK</th><th>Napraveno</th><th>Nabídka</th>
  </tr>
  ${klSekceHtml(sekceC)}
  <tr><td colspan="5" style="padding:4px 8px;border-top:1px solid #ccc;font-size:10px;color:#666">……………………………………………………………………………………………………</td></tr>
</table>

<table style="border:1px solid #000;margin-bottom:6px;width:100%">
  <tr>
    <td style="padding:8px;background:#f0f0f0;font-weight:bold;width:160px">D &nbsp;&nbsp; <strong>Stav zařízení</strong></td>
    <td style="padding:8px">
      <div>${checkBox(stav,'zelena')} Zelená &nbsp; (zařízení je plně funkční)</div>
      <div style="margin-top:3px">${checkBox(stav,'zluta')} Žlutá &nbsp;&nbsp; (vyhovující s nedostatky, následuje nabídka)</div>
      <div style="margin-top:3px">${checkBox(stav,'cervena')} Červená (zařízení je nevyhovující dle Vyhl.246/2001 Sb.)</div>
    </td>
  </tr>
</table>

<div style="border:1px solid #000;padding:8px;margin-bottom:6px;min-height:100px">
  <div style="font-weight:bold;margin-bottom:6px">Závěr / Poznámky:</div>
  <div style="font-size:11px;white-space:pre-wrap">${esc(c.zaver)}</div>
  ${Array(6).fill('<div style="border-bottom:1px dotted #ccc;height:18px;margin-top:4px"></div>').join('')}
</div>

<table class="sig-table">
  <tr>
    <td>Razítko filiálky, Podpis VOD + DT</td>
    <td>Datum</td>
    <td>Podpis technika dodavatele</td>
  </tr>
</table>

<div class="footer">
  <span>© Kaufland Česká republika v.o.s., Praha 6, Bělohorská 203, PSČ 169 00, IČ: 25110161 &nbsp; ze dne 22.06.2023</span>
  <span>Strana 1 z 1</span>
</div>
</body></html>`;
}

// ── MINISTERSTVO OBRANY ───────────────────────────────────────────
function genMinObrany(z, c) {
  const evCislo  = document.getElementById('pw-ev-cislo')?.value  || '';
  const vojUtvar = document.getElementById('pw-voj-utvar')?.value || '';
  const misto    = document.getElementById('pw-misto-proven')?.value || z?.adresa || '';
  const budova   = document.getElementById('pw-budova')?.value    || '';
  const typKJ    = document.getElementById('pw-typ-kj')?.value    || '';
  const snKJ     = document.getElementById('pw-sn-kj')?.value     || '';
  const chladivo = document.getElementById('pw-chladivo')?.value  || '';
  const smlouva  = c.smlouva || '25106000371';
  const datumFmt = c.datum ? c.datum.split('-').reverse().join('.') : '';

  // Provedené práce — checked items
  const provedenePrace = MINOBR_PRACE.filter((p, i) => {
    const el = document.getElementById(`pw-prace-${i}`);
    return el?.checked;
  });

  // Rozdělení do dvou sloupců (8+7)
  const leva  = provedenePrace.slice(0, Math.ceil(provedenePrace.length/2));
  const prava = provedenePrace.slice(Math.ceil(provedenePrace.length/2));
  const maxR  = Math.max(leva.length, prava.length);

  const pracoRadky = [];
  for(let i=0; i<maxR; i++) {
    pracoRadky.push(`<tr>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px">✓ ${esc(leva[i]||'')}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;font-size:11px">✓ ${esc(prava[i]||'')}</td>
    </tr>`);
  }

  return `<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"><title>Min. obrany — Zápis o údržbě</title>${pdfStyles()}</head><body>
<div class="no-print"><button onclick="window.print()" style="background:#0f1f3d;color:#fff;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">🖨 Tisk / Uložit PDF</button></div>

<!-- Záhlaví -->
<div style="border:2px solid #000;padding:10px 14px;margin-bottom:8px">
  <div style="font-weight:900;font-size:14px;text-align:center;margin-bottom:4px">ZÁPIS O PROVEDENÉ ÚDRŽBĚ KLIMATIZAČNÍ JEDNOTKY</div>
  <div style="text-align:center;font-size:12px">dle Rámcové dohody č. ${esc(smlouva)}</div>
</div>

<!-- Smluvní strany -->
<table style="border:1px solid #000;width:100%;margin-bottom:6px" class="hdr-table">
  <tr>
    <td style="border-right:1px solid #000;width:50%;padding:5px 8px;vertical-align:top">
      <div><strong>${esc(vojUtvar||'Vojenský útvar')}</strong></div>
    </td>
    <td style="padding:5px 8px;vertical-align:top">
      <div><strong>Datum a čas:</strong> ${datumFmt} ${c.zahajeni}</div>
      <div><strong>Evidenční číslo:</strong> ${esc(evCislo)}</div>
    </td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #000;padding:5px 8px;font-weight:bold">Objednatel:</td>
    <td style="padding:5px 8px;font-weight:bold">Poskytovatel:</td>
  </tr>
  <tr>
    <td style="border-right:1px solid #000;padding:4px 8px;font-size:11px">
      Česká republika – Ministerstvo obrany<br>
      ${esc(misto||'Praha 6')}<br>
      zastoupena: Ředitelem vojenského útvaru
    </td>
    <td style="padding:4px 8px;font-size:11px">
      ${esc(c.firma)}<br>
      Sídlo: Houbalova 2553/4, 628 00 Brno<br>
      IČ: 60707780 &nbsp; DIČ: CZ60707780<br>
      zastoupen: Ing. Jiřím Čtvrtníčkem, jednatel
    </td>
  </tr>
</table>

<!-- Detaily zakázky -->
<table style="border:1px solid #000;width:100%;margin-bottom:6px" class="hdr-table">
  <tr>
    <td style="border-right:1px solid #ccc;width:40%;padding:5px 8px"><strong>Datum a čas provedení:</strong></td>
    <td style="padding:5px 8px">${datumFmt} &nbsp; ${c.zahajeni}–${c.ukonceni}</td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #ccc;padding:5px 8px"><strong>Místo:</strong></td>
    <td style="padding:5px 8px">${esc(misto)}</td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #ccc;padding:5px 8px"><strong>Budova / místnost:</strong></td>
    <td style="padding:5px 8px">${esc(budova)}</td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #ccc;padding:5px 8px"><strong>Typ klimatizační jednotky:</strong></td>
    <td style="padding:5px 8px">${esc(typKJ)}</td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #ccc;padding:5px 8px"><strong>Výrobní číslo vnitřní / vnější:</strong></td>
    <td style="padding:5px 8px">${esc(snKJ)}</td>
  </tr>
  <tr style="border-top:1px solid #ccc">
    <td style="border-right:1px solid #ccc;padding:5px 8px"><strong>Chladivo:</strong></td>
    <td style="padding:5px 8px">${esc(chladivo)}</td>
  </tr>
</table>

<!-- Provedené práce -->
${provedenePrace.length ? `<div style="border:1px solid #000;margin-bottom:6px">
  <div style="background:#f0f0f0;font-weight:bold;font-size:11px;padding:5px 8px;border-bottom:1px solid #000">Provedené práce:</div>
  <table style="width:100%;border-collapse:collapse">${pracoRadky.join('')}</table>
</div>` : ''}

<!-- Závěr -->
<div style="border:1px solid #000;padding:8px;margin-bottom:8px;min-height:80px">
  <div style="font-weight:bold;font-size:11px;margin-bottom:6px">Popis zjištěných skutečností, závad a návrh jejich odstranění:</div>
  <div style="font-size:11px;white-space:pre-wrap">${esc(c.zaver)}</div>
  ${Array(5).fill('<div style="border-bottom:1px dotted #ccc;height:18px;margin-top:4px"></div>').join('')}
</div>

<!-- Podpisy Předal/Převzal -->
<table class="sig-table">
  <tr>
    <td style="padding:6px 8px 2px;font-weight:bold;width:120px"></td>
    <td style="padding:6px 8px 2px;font-weight:bold;width:200px">Za</td>
    <td style="padding:6px 8px 2px;font-weight:bold">Jméno a příjmení</td>
    <td style="padding:6px 8px 2px;font-weight:bold">Podpis</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;padding:24px 8px 6px;font-weight:bold">Předal</td>
    <td style="border:1px solid #000;padding:24px 8px 6px">${esc(c.firma)}</td>
    <td style="border:1px solid #000;padding:24px 8px 6px">${esc(c.technik)}</td>
    <td style="border:1px solid #000;padding:24px 8px 6px"></td>
  </tr>
  <tr>
    <td style="border:1px solid #000;padding:24px 8px 6px;font-weight:bold">Převzal</td>
    <td style="border:1px solid #000;padding:24px 8px 6px">${esc(vojUtvar)}</td>
    <td style="border:1px solid #000;padding:24px 8px 6px"></td>
    <td style="border:1px solid #000;padding:24px 8px 6px"></td>
  </tr>
</table>
</body></html>`;
}

// ── Patch saveZakaznik a openZakaznikModal pro nová pole ──────────
(function patchZakaznikForms() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if((typeof saveZakaznik !== 'undefined' && typeof openZakaznikModal !== 'undefined') || tries > 40) {
      clearInterval(iv);

      // Patch saveZakaznik — přidej protokol a smlouva
      if(typeof saveZakaznik !== 'undefined') {
        const prevSave = saveZakaznik;
        saveZakaznik = async function() {
          // Přidej nová pole do data před uložením
          const origDoc = window._fb.doc;
          const origUpdate = window._fb.updateDoc;
          const origAdd = window._fb.addDoc;

          // Hook: přidej pole do dalšího volání
          window._fb._protokolPatch = {
            protokol: document.getElementById('zak-protokol')?.value || '',
            smlouva:  document.getElementById('zak-smlouva')?.value.trim() || '',
          };
          await prevSave();
          window._fb._protokolPatch = null;
        };
      }

      // Patch openZakaznikModal — načti nová pole
      if(typeof openZakaznikModal !== 'undefined') {
        const prevOpen = openZakaznikModal;
        openZakaznikModal = function(id) {
          prevOpen(id);
          setTimeout(() => {
            const z = id ? (window._zakaznici||[]).find(x=>x.id===id) : null;
            const sel = document.getElementById('zak-protokol');
            const sInp= document.getElementById('zak-smlouva');
            if(sel)  sel.value  = z?.protokol || '';
            if(sInp) sInp.value = z?.smlouva  || '';
            // Ukaž smlouva pole
            const sRow = document.getElementById('zak-smlouva-row');
            if(sRow) sRow.style.display = (z?.protokol) ? 'block' : 'none';
          }, 50);
        };
      }

      // Show/hide smlouva row při změně protokolu
      const sel = document.getElementById('zak-protokol');
      if(sel) {
        sel.addEventListener('change', () => {
          const sRow = document.getElementById('zak-smlouva-row');
          if(sRow) sRow.style.display = sel.value ? 'block' : 'none';
        });
      }
    }
  }, 300);
})();

// Patch Firestore update/addDoc pro protokol pole
(function patchFirestoreForProtokol() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(window._fb?.updateDoc || tries > 40) {
      clearInterval(iv);
      if(!window._fb?.updateDoc) return;

      const origUpdate = window._fb.updateDoc;
      window._fb.updateDoc = async function(ref, data, ...args) {
        if(window._fb._protokolPatch && ref.path?.includes('zakaznici')) {
          data = { ...data, ...window._fb._protokolPatch };
        }
        return origUpdate(ref, data, ...args);
      };

      const origAdd = window._fb.addDoc;
      window._fb.addDoc = async function(col, data, ...args) {
        if(window._fb._protokolPatch && col.path?.includes('zakaznici')) {
          data = { ...data, ...window._fb._protokolPatch };
        }
        return origAdd(col, data, ...args);
      };
    }
  }, 500);
})();

\u003c/script>
</body>
</html>`;

  // Zobraz souhrn v inline modalu
  showSouhrn(html, z);
}

function showSouhrn(htmlContent, z) {
  // Vytvoř nebo najdi modal
  let modal = document.getElementById('souhrn-view-modal');
  if(!modal) {
    modal = document.createElement('div');
    modal.id = 'souhrn-view-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:16px';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;width:100%;max-width:740px;min-height:200px;display:flex;flex-direction:column;margin:auto;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div id="souhrn-view-topbar" style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#0f1f3d;flex-shrink:0">
          <span style="color:#fff;font-size:13px;font-weight:700" id="souhrn-view-title">Souhrn zakázky</span>
          <div style="display:flex;gap:8px">
            <button id="souhrn-print-btn" onclick="printSouhrnView()"
              style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:7px;padding:5px 12px;cursor:pointer;font-size:12px;font-family:inherit;display:flex;align-items:center;gap:5px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Tisknout / PDF
            </button>
            <button onclick="closeSouhrnView()"
              style="background:none;border:none;color:rgba(255,255,255,.7);font-size:22px;cursor:pointer;line-height:1;padding:0 4px">×</button>
          </div>
        </div>
        <iframe id="souhrn-view-iframe" style="flex:1;border:none;width:100%;min-height:75vh"></iframe>
      </div>`;
    modal.addEventListener('click', e => { if(e.target === modal) closeSouhrnView(); });
    document.body.appendChild(modal);
  }

  // Nastav obsah
  document.getElementById('souhrn-view-title').textContent =
    'Souhrn: ' + (z.cislo||'') + ' — ' + (z.nazev||'Zakázka');

  // Injektuj HTML do iframe (funguje offline, bez popup blokace)
  const iframe = document.getElementById('souhrn-view-iframe');
  // Odeber tlačítka Tisknout/Zavřít uvnitř iframe (máme je v topbaru)
  const cleanHtml = htmlContent.replace(
    /<div class="no-print"[\s\S]*?<\/div>\s*<\/div>/,
    ''
  );
  iframe.srcdoc = cleanHtml;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeSouhrnView() {
  const modal = document.getElementById('souhrn-view-modal');
  if(modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function printSouhrnView() {
  const iframe = document.getElementById('souhrn-view-iframe');
  if(iframe?.contentWindow) {
    iframe.contentWindow.print();
  }
}
