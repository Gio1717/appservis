// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 5 — mazání fotek, grafická anotace, modul zákazníků
// ════════════════════════════════════════════════════════════════

// ══ MAZÁNÍ FOTEK V KANCELÁŘI ══════════════════════════════════════
async function deleteKancelPhoto(zakazkaId, photoIndex) {
  if(!confirm('Smazat tuto fotografii?')) return;
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z || !z.photos) return;

  const photo = z.photos[photoIndex];

  // Pokus o smazání z Firebase Storage
  if(photo?.cloudUrl && window._fb?.storage) {
    try {
      // Extrahuj cestu ze URL
      const url = new URL(photo.cloudUrl);
      const path = decodeURIComponent(url.pathname.split('/o/')[1]?.split('?')[0]||'');
      if(path) {
        const storageRef = window._fb.ref(window._fb.storage, path);
        await window._fb.deleteObject(storageRef).catch(()=>{}); // ignoruj chybu pokud soubor neexistuje
      }
    } catch(e) { console.warn('Storage delete:', e); }
  }

  // Odeber z pole
  z.photos.splice(photoIndex, 1);

  // Ulož do Firestore
  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
      { photos: z.photos, updatedAt: window._fb.serverTimestamp() }
    );
    // Překresli detail
    openDetail && openDetail(zakazkaId);
  } catch(e) {
    alert('Chyba při mazání: ' + e.message);
    z.photos.splice(photoIndex, 0, photo); // vrať zpět při chybě
  }
}

// ══ GRAFICKÁ ANOTACE FOTEK ════════════════════════════════════════
let _annotCtx = null;
let _annotCanvas = null;
let _annotImg = new Image();
let _annotDrawing = false;
let _annotTool = 'pen';
let _annotColor = '#ff0000';
let _annotSize = 4;
let _annotStartX = 0;
let _annotStartY = 0;
let _annotHistory = []; // stack ImageData pro undo
let _annotZakazkaId = null;
let _annotPhotoIndex = -1;

function openPhotoAnnot(zakazkaId, photoIndex) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z?.photos?.[photoIndex]) return;

  _annotZakazkaId = zakazkaId;
  _annotPhotoIndex = photoIndex;
  _annotHistory = [];

  const photo = z.photos[photoIndex];
  const src = photo.cloudUrl || photo.dataUrl;

  document.getElementById('annot-modal').classList.add('open');

  _annotImg = new Image();
  _annotImg.crossOrigin = 'anonymous';
  _annotImg.onload = () => {
    _annotCanvas = document.getElementById('annot-canvas');
    if(!_annotCanvas) return;

    // Nastav rozměry
    const maxW = Math.min(_annotImg.width, window.innerWidth * 0.9);
    const maxH = Math.min(_annotImg.height, window.innerHeight * 0.7);
    const scale = Math.min(maxW/_annotImg.width, maxH/_annotImg.height, 1);
    _annotCanvas.width  = Math.round(_annotImg.width * scale);
    _annotCanvas.height = Math.round(_annotImg.height * scale);

    _annotCtx = _annotCanvas.getContext('2d');
    _annotCtx.drawImage(_annotImg, 0, 0, _annotCanvas.width, _annotCanvas.height);

    // Uložit první stav do undo history
    _annotHistory = [_annotCtx.getImageData(0, 0, _annotCanvas.width, _annotCanvas.height)];

    initAnnotEvents();
  };
  _annotImg.onerror = () => {
    // Pokud CORS selže, zkusíme dataUrl
    if(src !== photo.dataUrl && photo.dataUrl) {
      _annotImg.src = photo.dataUrl;
    } else {
      alert('Fotografii nelze otevřít pro anotaci (CORS omezení).');
      closeModal('annot-modal');
    }
  };
  _annotImg.src = src;
}

function getAnnotPos(e) {
  const rect = _annotCanvas.getBoundingClientRect();
  const scaleX = _annotCanvas.width / rect.width;
  const scaleY = _annotCanvas.height / rect.height;
  const touch = e.touches?.[0] || e;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top)  * scaleY
  };
}

function initAnnotEvents() {
  const c = _annotCanvas;
  if(c._annotReady) {
    c.onmousedown = c.ontouchstart = handleAnnotStart;
    c.onmousemove = c.ontouchmove  = handleAnnotMove;
    c.onmouseup   = c.ontouchend   =
    c.onmouseleave                 = handleAnnotEnd;
    return;
  }
  c._annotReady = true;
  c.onmousedown = c.ontouchstart = handleAnnotStart;
  c.onmousemove = c.ontouchmove  = handleAnnotMove;
  c.onmouseup   = c.ontouchend   =
  c.onmouseleave                 = handleAnnotEnd;

  // Ctrl+Z
  document.addEventListener('keydown', e => {
    if(e.ctrlKey && e.key === 'z' && document.getElementById('annot-modal')?.classList.contains('open')) {
      e.preventDefault();
      annotUndo();
    }
    if(e.key === 'Escape') closeModal('annot-modal');
  });
}

function handleAnnotStart(e) {
  e.preventDefault();
  _annotDrawing = true;
  _annotTool  = document.getElementById('annot-tool')?.value || 'pen';
  _annotColor = document.getElementById('annot-color')?.value || '#ff0000';
  _annotSize  = parseInt(document.getElementById('annot-size')?.value) || 4;

  const pos = getAnnotPos(e);
  _annotStartX = pos.x;
  _annotStartY = pos.y;

  // Ulož stav před kreslením
  _annotHistory.push(_annotCtx.getImageData(0, 0, _annotCanvas.width, _annotCanvas.height));
  if(_annotHistory.length > 30) _annotHistory.shift();

  if(_annotTool === 'pen' || _annotTool === 'eraser') {
    _annotCtx.beginPath();
    _annotCtx.moveTo(pos.x, pos.y);
  }

  if(_annotTool === 'text') {
    const txt = prompt('Zadejte text pro anotaci:');
    if(txt) {
      _annotCtx.font = `bold ${_annotSize * 5}px Arial`;
      _annotCtx.fillStyle = _annotColor;
      _annotCtx.strokeStyle = '#000';
      _annotCtx.lineWidth = 1;
      _annotCtx.strokeText(txt, pos.x, pos.y);
      _annotCtx.fillText(txt, pos.x, pos.y);
    }
    _annotDrawing = false;
    return;
  }
}

function handleAnnotMove(e) {
  if(!_annotDrawing) return;
  e.preventDefault();
  const pos = getAnnotPos(e);

  if(_annotTool === 'pen') {
    _annotCtx.lineTo(pos.x, pos.y);
    _annotCtx.strokeStyle = _annotColor;
    _annotCtx.lineWidth   = _annotSize;
    _annotCtx.lineCap     = 'round';
    _annotCtx.lineJoin    = 'round';
    _annotCtx.stroke();
  } else if(_annotTool === 'eraser') {
    _annotCtx.lineTo(pos.x, pos.y);
    _annotCtx.strokeStyle = 'rgba(0,0,0,1)';
    _annotCtx.globalCompositeOperation = 'destination-out';
    _annotCtx.lineWidth = _annotSize * 4;
    _annotCtx.lineCap   = 'round';
    _annotCtx.stroke();
    _annotCtx.globalCompositeOperation = 'source-over';
  } else {
    // Pro shapes — překresli z posledního history stavu
    if(_annotHistory.length) {
      _annotCtx.putImageData(_annotHistory[_annotHistory.length-1], 0, 0);
    }
    _annotCtx.strokeStyle = _annotColor;
    _annotCtx.lineWidth   = _annotSize;
    _annotCtx.fillStyle   = 'transparent';

    if(_annotTool === 'rect') {
      _annotCtx.strokeRect(_annotStartX, _annotStartY, pos.x-_annotStartX, pos.y-_annotStartY);
    } else if(_annotTool === 'circle') {
      const rx = Math.abs(pos.x - _annotStartX) / 2;
      const ry = Math.abs(pos.y - _annotStartY) / 2;
      const cx = (_annotStartX + pos.x) / 2;
      const cy = (_annotStartY + pos.y) / 2;
      _annotCtx.beginPath();
      _annotCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
      _annotCtx.stroke();
    } else if(_annotTool === 'arrow') {
      drawArrow(_annotCtx, _annotStartX, _annotStartY, pos.x, pos.y, _annotColor, _annotSize);
    }
  }
}

function handleAnnotEnd(e) {
  if(!_annotDrawing) return;
  _annotDrawing = false;
  _annotCtx.beginPath(); // reset path
}

function drawArrow(ctx, x1, y1, x2, y2, color, size) {
  const angle = Math.atan2(y2-y1, x2-x1);
  const headLen = size * 5;
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = size;
  ctx.lineCap = 'round';
  // Tělo šipky
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Hlavička
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen*Math.cos(angle-Math.PI/6), y2 - headLen*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2 - headLen*Math.cos(angle+Math.PI/6), y2 - headLen*Math.sin(angle+Math.PI/6));
  ctx.closePath();
  ctx.fill();
}

function annotUndo() {
  if(_annotHistory.length <= 1) return; // zachovej původní obrázek
  _annotHistory.pop();
  _annotCtx.putImageData(_annotHistory[_annotHistory.length-1], 0, 0);
}

function annotClear() {
  if(!confirm('Smazat všechny anotace?')) return;
  // Vrať na původní obrázek (první history stav)
  if(_annotHistory.length) {
    _annotCtx.putImageData(_annotHistory[0], 0, 0);
    _annotHistory = [_annotHistory[0]];
  }
}

async function saveAnnotation() {
  if(!_annotCanvas || !_annotZakazkaId || _annotPhotoIndex < 0) return;

  const btn = document.querySelector('#annot-modal .btn-green');
  if(btn) { btn.disabled = true; btn.textContent = '⏳ Ukládám…'; }

  try {
    const annotatedDataUrl = _annotCanvas.toDataURL('image/jpeg', 0.88);
    const z = (window._zakazky||[]).find(x=>x.id===_annotZakazkaId);
    if(!z?.photos?.[_annotPhotoIndex]) throw new Error('Zakázka nebo foto nenalezena');

    // Ulož anotovanou verzi
    z.photos[_annotPhotoIndex].dataUrl = annotatedDataUrl;
    // Cloud URL zrušit — je to nový obrázek
    z.photos[_annotPhotoIndex].cloudUrl = '';
    z.photos[_annotPhotoIndex].annotated = true;

    // Upload do Storage pokud online
    if(navigator.onLine) {
      try {
        const url = await uploadPhotoToServer(annotatedDataUrl, 'annotated_'+Date.now()+'.jpg');
        z.photos[_annotPhotoIndex].cloudUrl = url;
        z.photos[_annotPhotoIndex].dataUrl = '';
      } catch(e) { console.warn('Upload annotated:', e); }
    }

    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', _annotZakazkaId),
      { photos: z.photos, updatedAt: window._fb.serverTimestamp() }
    );

    closeModal('annot-modal');
    openDetail && openDetail(_annotZakazkaId);
  } catch(e) {
    alert('Chyba při ukládání: ' + e.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '💾 Uložit anotaci'; }
  }
}

// ══ MODUL ZÁKAZNÍKŮ ══════════════════════════════════════════════
let _zakaznici = [];
let _zakazniciUnsub = null;
let _activeZakId = null;

function loadZakaznici() {
  if(_zakazniciUnsub) return;
  _zakazniciUnsub = window._fb.onSnapshot(
    window._fb.query(
      window._fb.collection(window._fb.db, 'zakaznici'),
      window._fb.orderBy('nazev', 'asc')
    ),
    snap => {
      _zakaznici = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderZakaznici();
    }
  );
}

function renderZakaznici() {
  const list  = document.getElementById('zak-list');
  const cntEl = document.getElementById('zak-count');
  if(!list) return;

  const q   = (document.getElementById('zak-search')?.value||'').toLowerCase();
  const typ = document.getElementById('zak-filter-typ')?.value||'';

  const filtered = _zakaznici.filter(z => {
    if(typ && z.typ !== typ) return false;
    if(q && ![ z.nazev, z.ico, z.email, z.tel, z.adresa, z.kontakt ]
      .some(f => (f||'').toLowerCase().includes(q))) return false;
    return true;
  });

  if(cntEl) cntEl.textContent = `${filtered.length} zákazníků`;

  const typIcon = {firma:'🏢', fyzicka:'👤', vip:'⭐'};
  list.innerHTML = filtered.length ? filtered.map(z => {
    // Počet zakázek tohoto zákazníka
    const zakCount = (window._zakazky||[]).filter(zak =>
      zak.zakaznik === z.nazev || zak.ico === z.ico
    ).length;
    return `<div class="zcard${z.id===_activeZakId?' active':''}"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border)"
      onclick="openZakDetail('${z.id}')">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          ${typIcon[z.typ]||'👤'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(z.nazev||'—')}</div>
          <div style="font-size:11px;color:var(--muted)">${z.ico?'IČO: '+esc(z.ico)+' · ':''} ${esc(z.tel||z.email||'')}</div>
        </div>
        <div style="font-size:10px;color:var(--muted);flex-shrink:0;text-align:right">
          ${zakCount} zak.<br>
          ${z.adresa?`<span style="font-size:9px">${esc(z.adresa.substring(0,20))}</span>`:''}
        </div>
      </div>
    </div>`;
  }).join('') : '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Žádní zákazníci</div>';
}

function openZakDetail(id) {
  _activeZakId = id;
  renderZakaznici(); // aktualizuj active stav

  const z = _zakaznici.find(x=>x.id===id);
  if(!z) return;

  const detail = document.getElementById('zak-detail');
  const empty  = document.getElementById('zak-detail-empty');
  if(!detail) return;
  detail.style.display = 'block';
  if(empty) empty.style.display = 'none';

  // Historie zakázek tohoto zákazníka
  const zakHist = (window._zakazky||[])
    .filter(zak => zak.zakaznik === z.nazev || (z.ico && zak.ico === z.ico))
    .sort((a,b) => (b.termin||'').localeCompare(a.termin||''));

  const typIcon = {firma:'🏢', fyzicka:'👤', vip:'⭐'};
  const totalRev = zakHist.reduce((s,zak) => {
    return s + (parseFloat((zak.cena||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0);
  }, 0);

  detail.innerHTML = `
    <!-- Header zákazníka -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">
          ${typIcon[z.typ]||'👤'}
        </div>
        <div>
          <h2 style="font-size:18px;font-weight:800;color:var(--navy);margin:0 0 3px">${esc(z.nazev||'—')}</h2>
          ${z.ico?`<div style="font-size:12px;color:var(--muted)">IČO: <strong>${esc(z.ico)}</strong>${z.dic?' · DIČ: '+esc(z.dic):''}</div>`:''}
          ${z.adresa?`<div style="font-size:12px;color:var(--muted)">${esc(z.adresa)}</div>`:''}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${z.tel?`<a href="tel:${z.tel}" class="btn btn-ghost" style="font-size:11px;text-decoration:none">📞 ${esc(z.tel)}</a>`:''}
        ${z.email?`<a href="mailto:${z.email}" class="btn btn-ghost" style="font-size:11px;text-decoration:none">✉️ ${esc(z.email)}</a>`:''}
        ${z.adresa?`<a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" target="_blank" class="btn btn-ghost" style="font-size:11px;text-decoration:none">🗺 Mapa</a>`:''}
        <button onclick="openZakaznikModal('${z.id}')" class="btn btn-ghost" style="font-size:11px">✎ Upravit</button>
        <button onclick="openHodnoceniLink('${z.id}')" class="btn btn-ghost" style="font-size:11px" title="Odeslat zákazníkovi odkaz na hodnocení">⭐ Hodnocení</button>
        <button onclick="newZakazkaForZakaznik('${z.id}')" class="btn btn-green" style="font-size:11px">+ Nová zakázka</button>
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:20px">
      <div class="stat-card"><div class="val">${zakHist.length}</div><div class="lbl">Celkem zakázek</div></div>
      <div class="stat-card"><div class="val" style="font-size:14px">${totalRev.toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</div><div class="lbl">Celkový obrat</div></div>
      <div class="stat-card"><div class="val">${zakHist.filter(z=>z.stav==='zaplacena').length}</div><div class="lbl">Zaplacených</div></div>
      <div class="stat-card"><div class="val" style="color:var(--warn)">${zakHist.filter(z=>z.stav==='fakturovaná').length}</div><div class="lbl">Nezaplacených</div></div>
    </div>

    <!-- Kontaktní info -->
    ${z.kontakt||z.pozn?`<div class="dsec" style="margin-bottom:14px">
      <div class="dsec-hdr">📋 Kontakt a poznámky</div>
      <div class="dsec-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${z.kontakt?`<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Kontaktní osoba</div><div style="font-size:13px">${esc(z.kontakt)}</div></div>`:''}
        ${z.pozn?`<div style="grid-column:1/-1"><div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:2px">Poznámky</div><div style="font-size:12px;white-space:pre-wrap">${esc(z.pozn)}</div></div>`:''}
      </div>
    </div>`:''}

    <!-- Historie zakázek -->
    <div class="dsec">
      <div class="dsec-hdr" style="justify-content:space-between">
        <span>📦 Historie zakázek (${zakHist.length})</span>
      </div>
      <div class="dsec-body" style="padding:0">
        ${zakHist.length ? `<table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg)">
            <th style="padding:8px 12px;text-align:left;font-weight:700;color:var(--navy)">Datum</th>
            <th style="padding:8px 12px;text-align:left;font-weight:700;color:var(--navy)">Zakázka</th>
            <th style="padding:8px 12px;text-align:left;font-weight:700;color:var(--navy)">Technik</th>
            <th style="padding:8px 12px;text-align:right;font-weight:700;color:var(--green)">Cena</th>
            <th style="padding:8px 12px;text-align:center;font-weight:700;color:var(--navy)">Stav</th>
          </tr></thead>
          <tbody>${zakHist.map(zak=>`
            <tr style="border-bottom:1px solid var(--border);cursor:pointer"
              onclick="switchTab('orders');setTimeout(()=>openDetail('${zak.id}'),50)"
              onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
              <td style="padding:8px 12px;white-space:nowrap">${fmtD(zak.termin)||'—'}</td>
              <td style="padding:8px 12px"><div style="font-weight:600">${esc(zak.nazev||'—')}</div><div style="font-size:10px;color:var(--muted)">${esc(zak.cislo||'')}</div></td>
              <td style="padding:8px 12px;color:var(--muted)">${esc(zak.technik||'—')}</td>
              <td style="padding:8px 12px;text-align:right;font-family:'DM Mono',monospace;font-weight:600;color:var(--green)">${zak.cena||'—'}</td>
              <td style="padding:8px 12px;text-align:center">${stavBadge(zak.stav||'nová')}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div style="padding:16px;color:var(--muted);font-style:italic;font-size:12px">Žádné zakázky</div>'}
      </div>
    </div>
  `;
}

function openZakaznikModal(id) {
  const z = id ? _zakaznici.find(x=>x.id===id) : null;
  document.getElementById('zakaznik-edit-id').value = id||'';
  document.getElementById('zakaznik-modal-title').textContent = id ? 'Upravit zákazníka' : 'Přidat zákazníka';
  document.getElementById('zak-nazev').value   = z?.nazev||'';
  document.getElementById('zak-ico').value     = z?.ico||'';
  document.getElementById('zak-dic').value     = z?.dic||'';
  document.getElementById('zak-adresa').value  = z?.adresa||'';
  document.getElementById('zak-tel').value     = z?.tel||'';
  document.getElementById('zak-email').value   = z?.email||'';
  document.getElementById('zak-kontakt').value = z?.kontakt||'';
  document.getElementById('zak-typ').value     = z?.typ||'firma';
  document.getElementById('zak-pozn').value    = z?.pozn||'';
  document.getElementById('zakaznik-modal').classList.add('open');
}

async function aresLookupZak() {
  const ico = document.getElementById('zak-ico')?.value.trim();
  if(ico.length !== 8) return;
  try {
    const r = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
    if(!r.ok) return;
    const d = await r.json();
    if(d.obchodniJmeno) document.getElementById('zak-nazev').value = d.obchodniJmeno;
    if(d.sidlo?.textovaAdresa) document.getElementById('zak-adresa').value = d.sidlo.textovaAdresa;
    if(d.dic) document.getElementById('zak-dic').value = d.dic;
  } catch(e) { /* ARES nedostupný */ }
}

async function saveZakaznik() {
  const id    = document.getElementById('zakaznik-edit-id').value;
  const nazev = document.getElementById('zak-nazev')?.value.trim();
  if(!nazev) { alert('Zadejte název zákazníka'); return; }

  const data = {
    nazev,
    ico:     document.getElementById('zak-ico')?.value.trim()||'',
    dic:     document.getElementById('zak-dic')?.value.trim()||'',
    adresa:  document.getElementById('zak-adresa')?.value.trim()||'',
    tel:     document.getElementById('zak-tel')?.value.trim()||'',
    email:   document.getElementById('zak-email')?.value.trim()||'',
    kontakt: document.getElementById('zak-kontakt')?.value.trim()||'',
    typ:     document.getElementById('zak-typ')?.value||'firma',
    pozn:    document.getElementById('zak-pozn')?.value.trim()||'',
    updatedAt: window._fb.serverTimestamp()
  };

  try {
    if(id) {
      await window._fb.updateDoc(window._fb.doc(window._fb.db,'zakaznici',id), data);
    } else {
      data.createdAt = window._fb.serverTimestamp();
      const ref = await window._fb.addDoc(window._fb.collection(window._fb.db,'zakaznici'), data);
      _activeZakId = ref.id;
    }
    closeModal('zakaznik-modal');
  } catch(e) { alert('Chyba: '+e.message); }
}

async function deleteZakaznik(id) {
  if(!confirm('Smazat zákazníka? Zakázky zůstanou zachovány.')) return;
  window._fb.deleteDoc(window._fb.doc(window._fb.db,'zakaznici',id))
    .then(() => {
      if(_activeZakId === id) {
        _activeZakId = null;
        document.getElementById('zak-detail').style.display = 'none';
        document.getElementById('zak-detail-empty').style.display = 'flex';
      }
    })
    .catch(e => alert('Chyba: '+e.message));
}

function newZakazkaForZakaznik(zakaznikId) {
  const z = _zakaznici.find(x=>x.id===zakaznikId);
  if(!z) return;
  switchTab('orders');
  setTimeout(() => {
    openAddZakazkaModal && openAddZakazkaModal();
    setTimeout(() => {
      // Předvyplň zákazníka
      const inp = document.getElementById('nz-zakaznik') || document.getElementById('f_zakaznik');
      if(inp) { inp.value = z.nazev; inp.dispatchEvent(new Event('input')); }
      const adresa = document.getElementById('nz-adresa') || document.getElementById('f_adresa');
      if(adresa) { adresa.value = z.adresa||''; }
      const ico = document.getElementById('nz-ico') || document.getElementById('f_ico');
      if(ico) { ico.value = z.ico||''; }
    }, 200);
  }, 100);
}

// Importuj existující zákazníky ze zakázek (jednorázový helper)
async function importZakazniciFromZakazky() {
  const existing = new Set(_zakaznici.map(z=>z.nazev));
  const toImport = [];
  const seen = new Set();
  (window._zakazky||[]).forEach(zak => {
    const n = (zak.zakaznik||'').trim();
    if(!n || seen.has(n) || existing.has(n)) return;
    seen.add(n);
    toImport.push({ nazev: n, ico: zak.ico||'', dic: zak.dic||'', adresa: zak.adresa||'', typ: 'firma' });
  });
  if(!toImport.length) { alert('Žádní noví zákazníci k importu.'); return; }
  if(!confirm(`Importovat ${toImport.length} zákazníků ze stávajících zakázek?`)) return;

  let done = 0;
  for(const z of toImport) {
    await window._fb.addDoc(window._fb.collection(window._fb.db,'zakaznici'), {
      ...z, createdAt: window._fb.serverTimestamp(), updatedAt: window._fb.serverTimestamp()
    });
    done++;
  }
  alert(`✅ Importováno ${done} zákazníků`);
}

// ══ SWITCHAB OVERRIDE — zákazníci ═══════════════════════════════
(function overrideSwitchTabForZakaznici() {
  let attempts = 0;
  const iv = setInterval(() => {
    attempts++;
    if(typeof switchTab !== 'undefined' || attempts > 40) {
      clearInterval(iv);
      if(typeof switchTab === 'undefined') return;
      const prev = switchTab;
      switchTab = function(tab) {
        prev(tab);
        if(tab === 'zakaznici') loadZakaznici();
      };
    }
  }, 200);
})();

// ══ AUTO-DOPLNĚNÍ ZÁKAZNÍKA PŘI PSANÍ V ZAKÁZCE ══════════════════
// Při psaní zákazníka v nové zakázce nabídni data z modulu zákazníků
document.addEventListener('input', e => {
  const inp = e.target;
  if(!inp.id || !['f_zakaznik','nz-zakaznik'].includes(inp.id)) return;
  const q = inp.value.toLowerCase();
  if(q.length < 2) return;

  const matches = _zakaznici.filter(z => (z.nazev||'').toLowerCase().includes(q)).slice(0,5);
  if(!matches.length) return;

  // Jednoduchý dropdown
  let dd = document.getElementById('zak-autocomplete');
  if(!dd) {
    dd = document.createElement('ul');
    dd.id = 'zak-autocomplete';
    dd.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1.5px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);list-style:none;margin:0;padding:4px 0;font-size:12px;max-height:180px;overflow-y:auto;min-width:240px';
    document.body.appendChild(dd);
  }
  const rect = inp.getBoundingClientRect();
  dd.style.left = rect.left+'px';
  dd.style.top  = (rect.bottom+2)+'px';
  dd.style.width = Math.max(rect.width,240)+'px';
  dd.style.display = 'block';
  dd.innerHTML = matches.map(z=>`<li data-id="${z.id}" style="padding:8px 12px;cursor:pointer;display:flex;flex-direction:column">
    <span style="font-weight:600">${esc(z.nazev)}</span>
    <span style="font-size:10px;color:var(--muted)">${z.ico?'IČO: '+z.ico+' · ':''}${z.adresa||''}</span>
  </li>`).join('');
  dd.querySelectorAll('li').forEach(li=>{
    li.onmousedown = ev => {
      ev.preventDefault();
      const z = _zakaznici.find(x=>x.id===li.dataset.id);
      if(!z) return;
      inp.value = z.nazev;
      // Vyplň ostatní pole
      ['f_adresa','nz-adresa'].forEach(id=>{const el=document.getElementById(id);if(el&&z.adresa)el.value=z.adresa;});
      ['f_ico','nz-ico'].forEach(id=>{const el=document.getElementById(id);if(el&&z.ico)el.value=z.ico;});
      ['f_dic','nz-dic'].forEach(id=>{const el=document.getElementById(id);if(el&&z.dic)el.value=z.dic;});
      dd.style.display='none';
    };
  });
  // Skryj při kliknutí jinam
  const hide = () => { dd.style.display='none'; document.removeEventListener('mousedown',hide); };
  setTimeout(()=>document.addEventListener('mousedown',hide),100);
});

// ══ IMPORT BUTTON DO ZÁKAZNÍCI TABU ══════════════════════════════
(function addImportBtn() {
  setTimeout(() => {
    const zakList = document.getElementById('zak-list');
    if(!zakList || zakList._importBtnAdded) return;
    zakList._importBtnAdded = true;
    const wrap = zakList.parentElement;
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'padding:8px 14px;border-top:1px solid var(--border);flex-shrink:0';
    btnWrap.innerHTML = `<button onclick="importZakazniciFromZakazky()" class="btn btn-ghost" style="font-size:11px;width:100%">
      📥 Importovat zákazníky ze zakázek
    </button>`;
    wrap.appendChild(btnWrap);
  }, 1500);
})();
