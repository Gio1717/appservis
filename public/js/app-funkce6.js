// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 6: komprese fotek, notifikace kanceláře,
//  workflow role, portál zákazníka, user management
// ════════════════════════════════════════════════════════════════

// ══ KOMPRESE FOTEK ═══════════════════════════════════════════════
async function compressPhotoFromUrl(dataUrl, maxPx = 1400, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      // Zmenši pokud je větší než maxPx
      if(w > maxPx || h > maxPx) {
        if(w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // JPEG komprese
      const compressed = canvas.toDataURL('image/jpeg', quality);
      const origKB  = Math.round(dataUrl.length * 0.75 / 1024);
      const compKB  = Math.round(compressed.length * 0.75 / 1024);
      console.log(`📸 Foto zkomprimováno: ${origKB}KB → ${compKB}KB (${w}×${h}px)`);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl); // fallback bez komprese
    img.src = dataUrl;
  });
}

// Přidej kompresi i do kancelar foto uploadu
async function addKancelPhoto(input, zakazkaId) {
  const files = Array.from(input.files);
  if(!files.length) return;
  const progEl = document.getElementById('kphoto-prog-'+zakazkaId);
  if(progEl) progEl.style.display = 'block';

  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;
  if(!z.photos) z.photos = [];

  let done = 0;
  for(const file of files) {
    try {
      const dataUrl = await new Promise(res => {
        const r = new FileReader();
        r.onload = e => res(e.target.result);
        r.readAsDataURL(file);
      });
      // Komprimuj
      const compressed = await compressPhoto(dataUrl, 1400, 0.78);
      const photoObj = { dataUrl: compressed, cloudUrl: '', name: file.name, caption: '', addedBy: 'kancelar' };
      z.photos.push(photoObj);

      // Upload do Storage
      if(navigator.onLine) {
        try {
          const url = await uploadPhotoToServer(compressed, file.name);
          photoObj.cloudUrl = url;
          photoObj.dataUrl = '';
        } catch(e) { console.warn('Upload failed:', e); }
      }
      done++;
      if(progEl) progEl.textContent = `⏳ Nahráno ${done}/${files.length}…`;
    } catch(e) { console.warn('Photo error:', e); }
  }

  // Ulož do Firestore
  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
      { photos: z.photos, updatedAt: window._fb.serverTimestamp() }
    );
    openDetail && openDetail(zakazkaId);
  } catch(e) { alert('Chyba: '+e.message); }
  finally { if(progEl) progEl.style.display = 'none'; }
  input.value = '';
}

// ══ WORKFLOW & ROLE SYSTÉM ════════════════════════════════════════
// Definice workflow - pořadí stavů a kdo je zodpovědný
const WORKFLOW = [
  { stav: 'nová',           icon: '🆕', role: 'kancelar',    label: 'Nová zakázka',      color: '#6b7a99' },
  { stav: 'ke zpracování',  icon: '👁',  role: 'dispatcher',  label: 'Ke zpracování',     color: '#0369a1' },
  { stav: 'rozpracovaná',   icon: '🔧', role: 'technik',     label: 'V řešení',          color: '#7c3aed' },
  { stav: 'na cestě',       icon: '🚗', role: 'technik',     label: 'Na cestě',          color: '#0891b2' },
  { stav: 'čeká na díly',   icon: '🔩', role: 'technik',     label: 'Čeká na díly',      color: '#d97706' },
  { stav: 'zpracovaná',     icon: '✅', role: 'technik',     label: 'Dokončena',         color: '#16a34a' },
  { stav: 'ke kontrole',    icon: '🔍', role: 'dispatcher',  label: 'Ke kontrole',       color: '#9333ea' },
  { stav: 'ke fakturaci',   icon: '📤', role: 'kancelar',    label: 'Ke fakturaci',      color: '#ea580c' },
  { stav: 'fakturovaná',    icon: '🧾', role: 'kancelar',    label: 'Fakturováno',       color: '#0f766e' },
  { stav: 'zaplacena',      icon: '💚', role: 'kancelar',    label: 'Zaplaceno',         color: '#15803d' },
  { stav: 'stornována',     icon: '🚫', role: 'admin',       label: 'Stornováno',        color: '#dc2626' },
];

// Vrať workflow krok pro stav
function getWorkflowStep(stav) {
  return WORKFLOW.find(w => w.stav === stav) || WORKFLOW[0];
}

// Workflow progress bar v detailu
function renderWorkflowBar(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;

  const mainSteps = WORKFLOW.filter(w => !['stornována','čeká na díly'].includes(w.stav));
  const curIdx = mainSteps.findIndex(w => w.stav === (z.stav||'nová'));
  const role = window._currentRole;

  // Přidej workflow bar pod detail-hdr
  let wfBar = document.getElementById('workflow-bar-'+zakazkaId);
  if(!wfBar) {
    wfBar = document.createElement('div');
    wfBar.id = 'workflow-bar-'+zakazkaId;
    wfBar.style.cssText = 'margin:0 0 10px;padding:12px 14px;background:var(--card);border:1px solid var(--border);border-radius:10px';
    const di = document.getElementById('detail-inner');
    const firstDsec = di?.querySelector('.dsec');
    if(firstDsec) firstDsec.before(wfBar);
  }

  // Zjisti dostupné akce pro aktuálního uživatele
  const curStep = getWorkflowStep(z.stav||'nová');
  const nextStav = getNextStav(z.stav||'nová', role);
  const prevStav = getPrevStav(z.stav||'nová');

  wfBar.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--muted)">Průběh zakázky</div>
      <div style="display:flex;gap:6px">
        ${prevStav ? `<button onclick="workflowMove('${zakazkaId}','${prevStav}','back')"
          style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:#fff5f5;color:#dc2626;cursor:pointer">
          ← Vrátit zpět
        </button>` : ''}
        ${nextStav ? `<button onclick="workflowMove('${zakazkaId}','${nextStav}','next')"
          style="font-size:11px;padding:4px 12px;border:none;border-radius:6px;background:var(--green);color:#fff;cursor:pointer;font-weight:700">
          Předat dál →
        </button>` : ''}
      </div>
    </div>
    <div style="display:flex;gap:2px;align-items:center;overflow-x:auto;padding-bottom:4px">
      ${mainSteps.map((w,i) => {
        const done = curIdx > i;
        const active = curIdx === i;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">
          <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;
            background:${active ? w.color : done ? '#d1fae5' : '#f1f5f9'};
            border:2px solid ${active ? w.color : done ? '#6ee7b7' : '#e2e8f0'};
            color:${done ? '#059669' : '#64748b'}">${done ? '✓' : w.icon}</div>
          <div style="font-size:9px;color:${active?w.color:'var(--muted)'};font-weight:${active?'700':'400'};white-space:nowrap;max-width:52px;text-align:center;overflow:hidden;text-overflow:ellipsis">${w.label}</div>
          ${i < mainSteps.length-1 ? '' : ''}
        </div>
        ${i < mainSteps.length-1 ? `<div style="flex:1;height:2px;background:${done?'#6ee7b7':'#e2e8f0'};min-width:8px;margin-bottom:18px"></div>` : ''}`;
      }).join('')}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:6px">
      Zodpovědná role: <strong style="color:var(--navy)">${getRoleLabel(curStep.role)}</strong>
      ${z.stav === 'čeká na díly' ? ' · <span style="color:#d97706">⚠️ Blokováno — čeká na dodávku dílů</span>' : ''}
    </div>`;
}

function getNextStav(stav, role) {
  const idx = WORKFLOW.findIndex(w => w.stav === stav);
  if(idx < 0 || idx >= WORKFLOW.length-2) return null;
  const next = WORKFLOW[idx+1];
  // Admin může vždy, ostatní jen svůj krok
  if(role === 'admin') return next.stav;
  if(WORKFLOW[idx].role === role || WORKFLOW[idx].role === 'kancelar' && role === 'dispatcher') return next.stav;
  return null;
}

function getPrevStav(stav) {
  const idx = WORKFLOW.findIndex(w => w.stav === stav);
  if(idx <= 0) return null;
  return WORKFLOW[idx-1].stav;
}

function getRoleLabel(role) {
  const labels = {admin:'👑 Admin', kancelar:'🏢 Kancelář', dispatcher:'📋 Dispečer', technik:'🔧 Technik'};
  return labels[role] || role;
}

async function workflowMove(zakazkaId, newStav, direction) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;

  const step = getWorkflowStep(newStav);
  const msg = direction === 'back'
    ? `Vrátit zakázku zpět na stav "${step.label}"?`
    : `Předat zakázku na "${step.label}" (zodpovědnost: ${getRoleLabel(step.role)})?`;

  if(!confirm(msg)) return;

  try {
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
      { stav: newStav, updatedAt: window._fb.serverTimestamp() }
    );
    z.stav = newStav;
    saveAuditLog && saveAuditLog(zakazkaId, 'workflow_'+(direction==='back'?'return':'forward'), newStav);

    // Notifikace kanceláři/dispečerovi
    sendKancelarNotif({
      type: 'workflow', zakazkaId, zakazkaNazev: z.nazev,
      text: direction === 'back'
        ? `↩ Zakázka vrácena: ${z.nazev} → ${step.label}`
        : `➡ Zakázka předána: ${z.nazev} → ${step.label}`,
      stav: newStav, role: step.role
    });

    renderWorkflowBar(zakazkaId);
    const sel = document.getElementById('stav-sel');
    if(sel) sel.value = newStav;
  } catch(e) { alert('Chyba: '+e.message); }
}

// ══ SPRÁVA UŽIVATELŮ — rozšířené role ════════════════════════════
const ROLES_CONFIG = [
  { value: 'admin',      label: '👑 Admin',     desc: 'Plný přístup ke všemu' },
  { value: 'kancelar',   label: '🏢 Kancelář',  desc: 'Správa zakázek, fakturace' },
  { value: 'dispatcher', label: '📋 Dispečer',  desc: 'Přiřazování, kontrola kvality' },
  { value: 'technik',    label: '🔧 Technik',   desc: 'Terénní práce, zakázky' },
  { value: 'pending',    label: '⏳ Čekající',  desc: 'Čeká na schválení' },
];

function reloadUserList() {
  // Načti znovu s filtrem role
  const filter = document.getElementById('user-filter-role')?.value || '';
  const list = document.getElementById('user-list');
  if(!list) return;

  window._fb.getDocs(window._fb.collection(window._fb.db, 'users')).then(snap => {
    let users = snap.docs.map(d=>({id:d.id,...d.data()}));
    if(filter) users = users.filter(u => u.role === filter);
    users.sort((a,b) => (a.name||'').localeCompare(b.name||''));

    if(!users.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Žádní uživatelé</div>';
      return;
    }

    list.innerHTML = users.map(u => {
      const roleCfg = ROLES_CONFIG.find(r=>r.value===u.role) || {label:u.role,desc:''};
      return `<div class="user-row" style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px">
        <div class="user-av" style="width:36px;height:36px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">
          ${(u.name||u.email||'?')[0].toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--navy)">${esc(u.name||'—')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(u.email||'')}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <select onchange="changeUserRole('${u.id}',this.value)"
            style="font-size:11px;padding:5px 8px;border:1px solid var(--border);border-radius:7px;background:#fff;color:var(--navy)">
            ${ROLES_CONFIG.map(r=>`<option value="${r.value}" ${u.role===r.value?'selected':''}>${r.label}</option>`).join('')}
          </select>
          <button onclick="deleteUser('${u.id}','${esc(u.name||u.email)}')"
            style="font-size:11px;padding:4px 8px;border:1px solid #fecaca;border-radius:6px;background:#fff5f5;color:#dc2626;cursor:pointer">🗑</button>
        </div>
      </div>`;
    }).join('');
  }).catch(e => console.warn('loadUsers:', e));
}

async function changeUserRole(uid, newRole) {
  try {
    await window._fb.updateDoc(window._fb.doc(window._fb.db,'users',uid), {
      role: newRole, updatedAt: window._fb.serverTimestamp()
    });
    showToast && showToast(`✅ Role změněna na ${getRoleLabel(newRole)}`);
  } catch(e) { alert('Chyba: '+e.message); }
}

async function deleteUser(uid, name) {
  if(!confirm(`Smazat uživatele ${name}?`)) return;
  window._fb.deleteDoc(window._fb.doc(window._fb.db,'users',uid))
    .then(()=>{ showToast && showToast('Uživatel smazán'); reloadUserList(); })
    .catch(e=>alert('Chyba: '+e.message));
}

// Načti users při vstupu na tab
(function hookUsersTab() {
  let a = 0;
  const iv = setInterval(()=>{
    a++;
    if(typeof switchTab!=='undefined'||a>40){
      clearInterval(iv);
      if(typeof switchTab==='undefined') return;
      const prev = switchTab;
      switchTab = t => { prev(t); if(t==='users') setTimeout(reloadUserList,100); };
    }
  },200);
})();

// ══ NOTIFIKACE PRO KANCELÁŘ ════════════════════════════════════════
let _notifList = [];
let _notifUnsub = null;

function initKancelarNotif() {
  if(_notifUnsub) return;

  // Poslouchej real-time změny zakázek
  const firma = window._currentFirma || 'aceuro';
  _notifUnsub = window._fb.onSnapshot(
    window._fb.query(
      window._fb.collection(window._fb.db,'zakazky'),
      window._fb.where('firma','==',firma),
      window._fb.orderBy('updatedAt','desc'),
      window._fb.limit(50)
    ),
    snap => {
      snap.docChanges().forEach(change => {
        if(change.type !== 'modified') return;
        const z = {id:change.doc.id,...change.doc.data()};
        const prev = (window._zakazky||[]).find(x=>x.id===z.id);
        if(!prev) return;

        // Stav se změnil
        if(prev.stav !== z.stav) {
          const step = getWorkflowStep(z.stav);
          addNotif({
            id: Date.now()+'_stav',
            type: 'stav',
            icon: step.icon,
            title: `Zakázka: ${z.nazev||'—'}`,
            text: `Nový stav: ${step.label}`,
            zakazkaId: z.id,
            time: new Date(),
            color: step.color
          });
        }

        // Dokončena technikem
        if(z.stav === 'zpracovaná' && prev.stav !== 'zpracovaná') {
          addNotif({
            id: Date.now()+'_done',
            type: 'done',
            icon: '✅',
            title: `Technik dokončil: ${z.nazev||'—'}`,
            text: `${z.technik||'Technik'} uzavřel zakázku — potřebuje kontrolu`,
            zakazkaId: z.id,
            time: new Date(),
            color: '#16a34a',
            action: { label: 'Zkontrolovat', stav: 'ke kontrole' }
          });
        }

        // Ke fakturaci
        if(z.stav === 'ke fakturaci' && prev.stav !== 'ke fakturaci') {
          addNotif({
            id: Date.now()+'_fakt',
            type: 'faktura',
            icon: '📤',
            title: `K fakturaci: ${z.nazev||'—'}`,
            text: `Zákazník: ${z.zakaznik||'—'} · Cena: ${z.cena||'?'}`,
            zakazkaId: z.id,
            time: new Date(),
            color: '#ea580c'
          });
        }
      });
    }
  );

  // Také sleduj nové zakázky od technika
  window._fb.onSnapshot(
    window._fb.query(
      window._fb.collection(window._fb.db,'zakazky'),
      window._fb.where('firma','==',firma),
      window._fb.orderBy('createdAt','desc'),
      window._fb.limit(5)
    ),
    snap => {
      snap.docChanges().forEach(change => {
        if(change.type !== 'added') return;
        const z = {id:change.doc.id,...change.doc.data()};
        const ts = z.createdAt?.toDate?.() || new Date();
        if(Date.now() - ts.getTime() > 30000) return; // ignoruj staré

        if(z.source === 'technik') {
          addNotif({
            id: Date.now()+'_new',
            type: 'new',
            icon: '🆕',
            title: `Nová zakázka od technika`,
            text: `${z.nazev||'—'} · ${z.technik||'—'}`,
            zakazkaId: z.id,
            time: new Date(),
            color: '#7c3aed'
          });
        }
      });
    }
  );
}

function addNotif(notif) {
  _notifList.unshift(notif);
  if(_notifList.length > 50) _notifList.pop();
  renderNotifPanel();
  // Prohlížečová notifikace
  if(Notification.permission === 'granted') {
    new Notification(notif.title, { body: notif.text, icon: '/favicon.ico' });
  }
}

function sendKancelarNotif(data) {
  addNotif({
    id: Date.now()+'_k',
    type: data.type,
    icon: data.type==='workflow' ? '🔄' : '📋',
    title: data.text,
    text: `Stav: ${getWorkflowStep(data.stav).label}`,
    zakazkaId: data.zakazkaId,
    time: new Date(),
    color: '#0369a1'
  });
}

function renderNotifPanel() {
  const list  = document.getElementById('notif-list');
  const count = document.getElementById('notif-count');
  if(!list) return;

  const unread = _notifList.filter(n=>!n.read).length;
  if(count) {
    count.textContent = unread;
    count.style.display = unread > 0 ? 'block' : 'none';
  }

  if(!_notifList.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Žádné notifikace</div>';
    return;
  }

  list.innerHTML = _notifList.slice(0,20).map(n => `
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;gap:10px;align-items:flex-start;${n.read?'opacity:.6':''}"
      onclick="notifClick('${n.id}','${n.zakazkaId||''}')">
      <div style="width:28px;height:28px;border-radius:50%;background:${n.color||'var(--navy)'}22;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${n.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--navy)">${esc(n.title)}</div>
        <div style="font-size:11px;color:var(--muted)">${esc(n.text)}</div>
        <div style="font-size:10px;color:var(--lt);margin-top:2px">${n.time?.toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if(!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if(!visible) {
    // Označ jako přečtené
    _notifList.forEach(n=>n.read=true);
    const count = document.getElementById('notif-count');
    if(count) count.style.display = 'none';
  }
  // Zavři při kliknutí mimo
  if(!visible) {
    setTimeout(() => document.addEventListener('click', function h(e) {
      if(!document.getElementById('notif-panel')?.contains(e.target) &&
         !document.getElementById('notif-bell')?.contains(e.target)) {
        document.getElementById('notif-panel').style.display = 'none';
        document.removeEventListener('click', h);
      }
    }), 100);
  }
}

function notifClick(notifId, zakazkaId) {
  document.getElementById('notif-panel').style.display = 'none';
  if(zakazkaId) {
    switchTab && switchTab('orders');
    setTimeout(() => openDetail && openDetail(zakazkaId), 100);
  }
}

function clearAllNotifs() {
  _notifList = [];
  renderNotifPanel();
}

// Požádej o povolení notifikací
(function requestNotifPermission() {
  setTimeout(() => {
    if(Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, 3000);
})();

// ══ PORTÁL ZÁKAZNÍKA ══════════════════════════════════════════════
function generatePortalLink(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;

  // Generuj 4místný přístupový kód z ID (deterministický)
  const kod = (parseInt(zakazkaId.slice(-8),16) % 9000 + 1000).toString();

  // Ulož kód do Firestore
  window._fb.updateDoc(window._fb.doc(window._fb.db,'zakazky',zakazkaId), {
    portalKod: kod, portalEnabled: true, updatedAt: window._fb.serverTimestamp()
  }).catch(()=>{});

  // Vytvoř odkaz
  const url = window.location.href.split('?')[0] + `?portal=${z.cislo||zakazkaId}&kod=${kod}`;

  // Zobraz dialog
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
  msg.innerHTML = `<div style="background:#fff;border-radius:14px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
    <h3 style="margin:0 0 8px;font-size:16px;color:var(--navy)">🔗 Odkaz pro zákazníka</h3>
    <p style="font-size:12px;color:var(--muted);margin:0 0 14px">Zákazník uvidí stav, fotky a servisní protokol.</p>
    <div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Přístupový kód</div>
      <div style="font-size:28px;font-weight:900;letter-spacing:8px;color:var(--navy);font-family:'DM Mono',monospace">${kod}</div>
    </div>
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--muted);word-break:break-all;margin-bottom:14px">${url}</div>
    <div style="display:flex;gap:8px">
      <button onclick="navigator.clipboard.writeText('${url}').then(()=>{showToast('✅ Odkaz zkopírován')})"
        style="flex:1;padding:10px;background:var(--navy);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">
        📋 Kopírovat odkaz
      </button>
      <button onclick="navigator.share&&navigator.share({title:'Zakázka ${esc(z.cislo||'')}',url:'${url}'})"
        style="flex:1;padding:10px;background:var(--green);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600">
        📤 Sdílet
      </button>
    </div>
    <button onclick="this.closest('[style*=fixed]').remove()"
      style="width:100%;margin-top:8px;padding:8px;background:none;border:1px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;color:var(--muted)">
      Zavřít
    </button>
  </div>`;
  document.body.appendChild(msg);
  msg.onclick = e => { if(e.target===msg) msg.remove(); };
}

// Zkontroluj URL při načtení — portál
(function checkPortalUrl() {
  const params = new URLSearchParams(window.location.search);
  const portal = params.get('portal');
  const kod    = params.get('kod');
  if(!portal || !kod) return;

  // Zobraz portál
  setTimeout(() => openPortal(portal, kod), 1000);
})();

async function portalLogin() {
  const cislo = document.getElementById('portal-cislo')?.value.trim();
  const kod   = document.getElementById('portal-kod')?.value.trim();
  if(!cislo || !kod) return;
  openPortal(cislo, kod);
}

async function openPortal(cislo, kod) {
  // Zobraz portál screen
  document.querySelectorAll('[id^="app-"]').forEach(el => el.style.display='none');
  const portalEl = document.getElementById('app-portal');
  if(portalEl) portalEl.style.display='block';

  try {
    // Hledej zakázku
    const snap = await window._fb.getDocs(window._fb.query(
      window._fb.collection(window._fb.db,'zakazky'),
      window._fb.where('cislo','==',cislo)
    ));

    if(snap.empty) {
      // Zkus podle ID
      const byId = await window._fb.getDoc(window._fb.doc(window._fb.db,'zakazky',cislo)).catch(()=>null);
      if(!byId?.exists()) throw new Error('Zakázka nenalezena');
    }

    const doc = snap.empty ? null : snap.docs[0];
    const z   = doc ? {id:doc.id,...doc.data()} : null;

    if(!z) { showPortalError('Zakázka nenalezena'); return; }

    // Ověř kód
    const expectedKod = (parseInt(z.id.slice(-8)||z.id,16) % 9000 + 1000).toString();
    if(z.portalKod !== kod && expectedKod !== kod) {
      showPortalError('Nesprávný přístupový kód'); return;
    }

    renderPortal(z);
  } catch(e) {
    showPortalError('Chyba: ' + e.message);
  }
}

function showPortalError(msg) {
  const err = document.getElementById('portal-login-err');
  if(err) { err.textContent = msg; err.style.display='block'; }
}

function renderPortal(z) {
  document.getElementById('portal-login').style.display = 'none';
  const content = document.getElementById('portal-content');
  if(content) content.style.display='block';

  // Název a meta
  document.getElementById('portal-nazev').textContent = z.nazev||'—';
  document.getElementById('portal-meta').textContent =
    `Č. ${z.cislo||'—'} · Technik: ${z.technik||'—'} · Termín: ${fmtD(z.termin)||'—'}`;
  document.getElementById('portal-badge').innerHTML = stavBadge(z.stav||'nová');

  // Progress
  const mainSteps = WORKFLOW.filter(w=>!['stornována','čeká na díly'].includes(w.stav));
  const curIdx = mainSteps.findIndex(w=>w.stav===(z.stav||'nová'));
  document.getElementById('portal-progress').innerHTML = `
    <div style="display:flex;gap:0;align-items:center;overflow-x:auto;margin:10px 0">
      ${mainSteps.map((w,i)=>{
        const done=curIdx>i, active=curIdx===i;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0;min-width:48px">
          <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;
            background:${active?w.color:done?'#d1fae5':'#f1f5f9'};border:2px solid ${active?w.color:done?'#6ee7b7':'#e2e8f0'}">${done?'✓':w.icon}</div>
          <div style="font-size:8px;color:${active?w.color:'#94a3b8'};text-align:center">${w.label}</div>
        </div>${i<mainSteps.length-1?`<div style="flex:1;height:2px;background:${done?'#6ee7b7':'#e2e8f0'};min-width:6px;margin-bottom:16px"></div>`:''}`;
      }).join('')}
    </div>`;

  // Detaily
  document.getElementById('portal-details').innerHTML = [
    z.zakaznik?`<div>🏢 <strong>Zákazník:</strong> ${esc(z.zakaznik)}</div>`:'',
    z.adresa?`<div>📍 <strong>Adresa:</strong> ${esc(z.adresa)}</div>`:'',
    z.duzp?`<div>📅 <strong>DUZP:</strong> ${fmtD(z.duzp)}</div>`:'',
  ].filter(Boolean).join('');

  // Práce
  if(z.prace) {
    document.getElementById('portal-prace-wrap').style.display='block';
    document.getElementById('portal-prace').textContent = z.prace;
  }

  // Fotky
  const photos = (z.photos||[]).filter(p=>p.cloudUrl||p.dataUrl);
  if(photos.length) {
    document.getElementById('portal-foto-wrap').style.display='block';
    document.getElementById('portal-foto').innerHTML = photos.map(p=>
      `<img src="${p.cloudUrl||p.dataUrl}" alt="${esc(p.caption||'')}"
        style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;cursor:zoom-in"
        onclick="openLightbox(this.src)">`
    ).join('');
  }

  // Kontakt
  document.getElementById('portal-kontakt').textContent = `Pro dotazy kontaktujte svého technika: ${z.technik||'—'}`;
}

// ══ WORKFLOW BAR HOOK DO OPENDETAIL ═══════════════════════════════
(function hookWorkflowBar() {
  let a = 0;
  const iv = setInterval(()=>{
    a++;
    if(typeof openDetail!=='undefined'||a>40){
      clearInterval(iv);
      if(typeof openDetail==='undefined') return;
      const prev = openDetail;
      openDetail = id => {
        prev(id);
        setTimeout(()=>renderWorkflowBar(id), 300);
      };
    }
  },200);
})();

// ══ INIT NOTIFIKACÍ PO PŘIHLÁŠENÍ ════════════════════════════════
(function hookInitNotif() {
  let a = 0;
  const iv = setInterval(()=>{
    a++;
    if((window._currentRole && window._zakazky)||a>60){
      clearInterval(iv);
      if(['admin','kancelar','dispatcher'].includes(window._currentRole)) {
        setTimeout(initKancelarNotif, 2000);
      }
    }
  },500);
})();

// ════════════════════════════════════════════════════════════════
//  NOVÉ FUNKCE 6 — workflow role, kancelář notifikace,
//  komprese kancelář fotek, souhrn zakázky, addUser s rolí
// ════════════════════════════════════════════════════════════════

// ══ WORKFLOW DEFINICE ════════════════════════════════════════════
// Kdo může posunout na jaký krok a co znamená "předat dál" / "vrátit zpět"
const WORKFLOW_STEPS = [
  { stav: 'nová',           label: 'Nová',          icon: '🆕', role: ['admin','dispatcher','kancelar','koordinator'] },
  { stav: 'ke zpracování',  label: 'Zadána',         icon: '📋', role: ['admin','dispatcher','kancelar'] },
  { stav: 'rozpracovaná',   label: 'V terénu',       icon: '🔧', role: ['admin','koordinator','kancelar'] },
  { stav: 'ke kontrole',    label: 'Ke kontrole',    icon: '🔍', role: ['admin','koordinator','kancelar'] },
  { stav: 'ke fakturaci',   label: 'Ke fakturaci',   icon: '📤', role: ['admin','fakturant','kancelar'] },
  { stav: 'fakturovaná',    label: 'Fakturovaná',    icon: '🧾', role: ['admin','fakturant','kancelar'] },
  { stav: 'zaplacena',      label: 'Zaplacena',      icon: '✅', role: ['admin','fakturant','kancelar'] },
];

// Role popis
const ROLE_LABELS = {
  admin:       '👑 Admin',
  kancelar:    '💼 Kancelář',
  dispatcher:  '📋 Dispečer',
  koordinator: '🔄 Koordinátor',
  fakturant:   '🧾 Fakturant',
  technik:     '🔧 Technik',
};

function getWorkflowIdx(stav) {
  return WORKFLOW_STEPS.findIndex(s => s.stav === stav);
}

function canActOnWorkflow(stav) {
  const role = window._currentRole || 'kancelar';
  const idx  = getWorkflowIdx(stav);
  if(idx < 0) return true; // neznámý stav — povolíme
  return WORKFLOW_STEPS[idx].role.includes(role);
}

function renderWorkflowSteps(zakazkaId, currentStav) {
  const el = document.getElementById('workflow-steps-' + zakazkaId);
  const badge = document.getElementById('workflow-role-badge-' + zakazkaId);
  if(!el) return;

  const curIdx = getWorkflowIdx(currentStav);
  const role   = window._currentRole || 'kancelar';
  if(badge) badge.textContent = ROLE_LABELS[role] || role;

  el.innerHTML = WORKFLOW_STEPS.map((step, i) => {
    const done    = i < curIdx;
    const current = i === curIdx;
    const future  = i > curIdx;
    const bg      = done ? 'var(--green)' : current ? 'var(--navy)' : 'var(--border)';
    const color   = (done||current) ? '#fff' : 'var(--muted)';
    const connector = i < WORKFLOW_STEPS.length-1
      ? `<div style="width:20px;height:2px;background:${done?'var(--green)':'var(--border)'}"></div>` : '';
    return `<div style="display:flex;align-items:center;flex-shrink:0">
      <div title="${step.label}" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:${canActOnWorkflow(step.stav)?'pointer':'default'}"
        onclick="${!future?`workflowJumpTo('${zakazkaId}','${step.stav}')`:''}">
        <div style="width:30px;height:30px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:13px;transition:transform .15s"
          onmouseenter="if(${!future})this.style.transform='scale(1.15)'" onmouseleave="this.style.transform=''">
          ${done ? '✓' : step.icon}
        </div>
        <div style="font-size:9px;color:${color==='#fff'?'var(--navy)':'var(--muted)'};white-space:nowrap;font-weight:${current?'700':'400'}">${step.label}</div>
      </div>
      ${connector}
    </div>`;
  }).join('');

  // Zobraz/skryj tlačítka podle role
  const canNext = canActOnWorkflow(currentStav) && curIdx < WORKFLOW_STEPS.length - 1;
  const canBack = canActOnWorkflow(currentStav) && curIdx > 0;
  const nextBtn = document.getElementById('wf-next-' + zakazkaId);
  const backBtn = document.getElementById('wf-back-' + zakazkaId);
  if(nextBtn) {
    nextBtn.style.display = canNext ? '' : 'none';
    const nextStep = WORKFLOW_STEPS[curIdx + 1];
    if(nextStep) nextBtn.innerHTML = `✅ Předat: ${nextStep.icon} ${nextStep.label}`;
  }
  if(backBtn) backBtn.style.display = canBack ? '' : 'none';
}

async function workflowNext(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;
  const curIdx  = getWorkflowIdx(z.stav||'nová');
  const nextStep = WORKFLOW_STEPS[curIdx + 1];
  if(!nextStep) return;

  const note = document.getElementById('wf-note-' + zakazkaId)?.value.trim() || '';
  await doWorkflowTransition(zakazkaId, z.stav, nextStep.stav, note, 'předáno_dál');
}

async function workflowBack(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;
  const curIdx  = getWorkflowIdx(z.stav||'nová');
  const prevStep = WORKFLOW_STEPS[curIdx - 1];
  if(!prevStep) return;

  const note = document.getElementById('wf-note-' + zakazkaId)?.value.trim();
  if(!note && !confirm('Vrátit zakázku bez poznámky?')) return;
  await doWorkflowTransition(zakazkaId, z.stav, prevStep.stav, note||'Vráceno', 'vráceno');
}

async function workflowJumpTo(zakazkaId, newStav) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z || z.stav === newStav) return;
  if(!canActOnWorkflow(newStav)) { alert('Nemáte oprávnění pro tento krok.'); return; }
  const step = WORKFLOW_STEPS.find(s=>s.stav===newStav);
  if(!confirm(`Přeskočit na: ${step?.icon} ${step?.label}?`)) return;
  await doWorkflowTransition(zakazkaId, z.stav, newStav, 'Přeskočeno', 'přeskočeno');
}

async function doWorkflowTransition(zakazkaId, fromStav, toStav, note, action) {
  const me = window._currentUser;
  const role = window._currentRole || 'kancelar';

  try {
    // Ulož přechod do audit logu
    await window._fb.addDoc(
      window._fb.collection(window._fb.db, 'zakazky', zakazkaId, 'audit'),
      {
        action: action,
        value: `${fromStav} → ${toStav}`,
        note: note || '',
        uid: me?.uid || '',
        author: me?.displayName || me?.email || 'Neznámý',
        role,
        createdAt: window._fb.serverTimestamp()
      }
    );

    // Aktualizuj stav
    await window._fb.updateDoc(
      window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
      {
        stav: toStav,
        workflowNote: note || '',
        workflowUpdatedBy: me?.displayName || me?.email || '',
        workflowUpdatedAt: window._fb.serverTimestamp(),
        updatedAt: window._fb.serverTimestamp()
      }
    );

    // Notifikace kanceláři
    const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
    sendKancelarNotif(z||{id:zakazkaId}, `${action === 'vráceno' ? '↩' : '➡'} ${fromStav} → ${toStav}`, note, role);

    // Vymaž pole poznámky
    const noteInp = document.getElementById('wf-note-' + zakazkaId);
    if(noteInp) noteInp.value = '';

    showToast && showToast(`✓ Předáno: ${toStav}`);

  } catch(e) {
    alert('Chyba workflow: ' + e.message);
  }
}

// Napoj renderWorkflow na openDetail
(function hookWorkflowOnDetail() {
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
          if(z) renderWorkflowSteps(id, z.stav||'nová');
        }, 300);
      };
    }
  }, 200);
})();

// Napoj renderWorkflow na changeStav
(function hookWorkflowOnChangeStav() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof changeStav !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof changeStav === 'undefined') return;
      const prev = changeStav;
      changeStav = function(id, stav) {
        prev(id, stav);
        setTimeout(() => renderWorkflowSteps(id, stav), 300);
      };
    }
  }, 200);
})();

// ══ KANCELÁŘ NOTIFIKACE ══════════════════════════════════════════
// Sleduje změny zakázek a posílá notifikace relevantním rolím

const NOTIF_TRIGGERS = {
  // stav → kdo dostane notifikaci
  'zpracovaná':   ['admin','koordinator','fakturant','kancelar'],
  'ke kontrole':  ['admin','koordinator','kancelar'],
  'ke fakturaci': ['admin','fakturant','kancelar'],
  'vrácena':      ['admin','dispatcher','koordinator'],
  'zaplacena':    ['admin','kancelar'],
  'fakturovaná':  ['admin','fakturant'],
};

let _prevStavMap = {};

function checkStavChanges(zakazky) {
  zakazky.forEach(z => {
    const prev = _prevStavMap[z.id];
    if(prev !== undefined && prev !== z.stav) {
      // Stav se změnil
      const notifRoles = NOTIF_TRIGGERS[z.stav] || [];
      const myRole = window._currentRole || 'kancelar';
      if(notifRoles.includes(myRole)) {
        triggerKancelarNotif(z, prev, z.stav);
      }
    }
    _prevStavMap[z.id] = z.stav;
  });
}

function triggerKancelarNotif(zakazka, fromStav, toStav) {
  // In-app notifikace (toast + badge)
  const msg = `📋 ${zakazka.nazev||'—'}: ${fromStav} → ${toStav}`;
  showInAppNotif(msg, zakazka.id);

  // E-mail notifikace pokud nakonfigurováno
  const cfg = getNotifSettings();
  if(cfg.serviceId && cfg.templateId && cfg.pubkey) {
    const me = window._currentUser;
    if(me?.email) {
      sendEmailNotif(me.email, me.displayName||'Kancelář', {
        ...zakazka,
        nazev: `[${toStav.toUpperCase()}] ${zakazka.nazev||'—'}`,
      });
    }
  }

  // Browser push notifikace
  if('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('AC EURO — Změna zakázky', {
        body: msg,
        icon: '/favicon.ico',
        tag: 'zakazka-' + zakazka.id,
      });
    } catch(e) {}
  }
}

// In-app notifikace panel
let _inAppNotifs = [];

function showInAppNotif(msg, zakazkaId) {
  _inAppNotifs.unshift({ msg, zakazkaId, ts: Date.now() });
  if(_inAppNotifs.length > 20) _inAppNotifs.pop();
  updateNotifBadge();

  // Toast
  showToast && showToast(msg);
}

function sendKancelarNotif(zakazka, action, note, fromRole) {
  const cfg = getNotifSettings();
  const myRole = window._currentRole || 'kancelar';

  // In-app
  const msg = `${ROLE_LABELS[fromRole]||fromRole}: ${zakazka.nazev||'—'} — ${action}${note?' · '+note:''}`;
  showInAppNotif(msg, zakazka.id);

  // E-mail
  if(cfg.serviceId && cfg.templateId && cfg.pubkey) {
    const me = window._currentUser;
    if(me?.email) {
      sendEmailNotif(me.email, 'Kancelář', {
        ...zakazka,
        zadani: note || action,
      });
    }
  }
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if(badge) {
    badge.textContent = _inAppNotifs.length;
    badge.style.display = _inAppNotifs.length ? 'flex' : 'none';
  }
}

function toggleNotifPanel() {
  let panel = document.getElementById('notif-panel');
  if(!panel) {
    panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.style.cssText = 'position:fixed;top:54px;right:14px;width:320px;max-height:400px;background:var(--card);border:1.5px solid var(--border);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:900;overflow:hidden;display:flex;flex-direction:column';
    panel.innerHTML = `<div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13px;font-weight:700;color:var(--navy)">🔔 Oznámení</span>
      <button onclick="clearNotifs()" style="font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer">Smazat vše</button>
    </div>
    <div id="notif-list" style="overflow-y:auto;flex:1;padding:6px 0"></div>`;
    document.body.appendChild(panel);

    // Zavři při kliknutí jinam
    setTimeout(() => {
      document.addEventListener('click', function closePanel(e) {
        if(!panel.contains(e.target) && !e.target.closest('#notif-btn')) {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      });
    }, 100);
  } else {
    panel.remove();
    return;
  }
  renderNotifPanel();
}

function renderNotifPanel() {
  const list = document.getElementById('notif-list');
  if(!list) return;
  list.innerHTML = _inAppNotifs.length
    ? _inAppNotifs.map(n => `<div style="padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;font-size:12px"
        onclick="if('${n.zakazkaId}'){switchTab('orders');setTimeout(()=>openDetail('${n.zakazkaId}'),50)}"
        onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
        <div style="color:var(--text)">${esc(n.msg)}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${new Date(n.ts).toLocaleTimeString('cs-CZ')}</div>
      </div>`).join('')
    : '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Žádná oznámení</div>';
}

function clearNotifs() {
  _inAppNotifs = [];
  updateNotifBadge();
  renderNotifPanel();
}

// Přidej 🔔 tlačítko do kancelář topbaru
(function addNotifButton() {
  setTimeout(() => {
    const darkBtn = document.getElementById('dark-toggle');
    if(!darkBtn || darkBtn._notifAdded) return;
    darkBtn._notifAdded = true;

    const btn = document.createElement('button');
    btn.id = 'notif-btn';
    btn.title = 'Oznámení';
    btn.style.cssText = 'position:relative;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.85);border-radius:7px;padding:5px 10px;cursor:pointer;font-size:14px';
    btn.innerHTML = '🔔<span id="notif-badge" style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;border-radius:50%;width:16px;height:16px;display:none;align-items:center;justify-content:center"></span>';
    btn.onclick = toggleNotifPanel;
    darkBtn.before(btn);

    // Požádej o push notifikace
    if('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 3000);
    }
  }, 800);
})();

// Napoj checkStavChanges na realtime listener
(function hookNotifOnListener() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(window._zakazky || tries > 30) {
      clearInterval(iv);
      // Inicializuj _prevStavMap se současným stavem (nezasílej notifikace pro existující)
      if(window._zakazky) {
        window._zakazky.forEach(z => { _prevStavMap[z.id] = z.stav; });
      }
      // Override renderList pro checkování
      if(typeof renderList !== 'undefined') {
        const prev = renderList;
        renderList = function() {
          prev();
          checkStavChanges(window._zakazky || []);
        };
      }
    }
  }, 500);
})();

// ══ KOMPRESE FOTEK V KANCELÁŘI ════════════════════════════════════
// Přepiš upload fotek v kancelář detailu (photo-input v detail panelu)
(function hookKancelarPhotoCompression() {
  // compressPhoto je definována v technik scriptu — bude dostupná globálně
  // Override upload při přidání fotek v kanceláři
  document.addEventListener('change', async e => {
    const inp = e.target;
    if(inp.id !== 'kancelar-photo-input') return; // jen kancelář upload
    // Toto je handled jinde — hook přidáme na savePhotoCaption extension
  });

  // Přepiš kancelář addKancelPhoto pokud existuje
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof compressPhoto !== 'undefined' || tries > 30) {
      clearInterval(iv);
      // compressPhoto je dostupná — patch foto uploadů v kanceláři
      window._compressReady = true;
    }
  }, 300);
})();

// Přidej komprimovaný upload pro kancelář foto input
document.addEventListener('change', async function(e) {
  const inp = e.target;
  // Kancelář upload - photo-input v detail sekci  
  if(inp.type !== 'file' || !inp.accept?.includes('image')) return;
  if(inp.id === 'photo-input') return; // technik - má vlastní handler
  if(!inp.files?.length) return;

  // Najdi zakazkaId z context
  const zakazkaId = window.activeId;
  if(!zakazkaId) return;

  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;

  if(!z.photos) z.photos = [];

  const prog = document.createElement('div');
  prog.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--navy);color:#fff;padding:10px 16px;border-radius:8px;font-size:12px;z-index:999';
  prog.id = 'kancelar-upload-prog';
  document.body.appendChild(prog);

  let done = 0;
  const total = inp.files.length;

  for(const file of Array.from(inp.files)) {
    try {
      prog.textContent = `Komprimuji ${file.name}…`;
      const dataUrl = await (typeof compressPhoto !== 'undefined'
        ? compressPhoto(file, 1600, 1200, 0.82)
        : new Promise(res => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(file); })
      );

      const photoObj = { dataUrl, cloudUrl: '', name: file.name, caption: '' };
      z.photos.push(photoObj);

      // Upload do Storage
      if(navigator.onLine) {
        try {
          const url = await uploadPhotoToServer(dataUrl, file.name);
          photoObj.cloudUrl = url;
          photoObj.dataUrl = '';
          // Cache verze
          photoObj.dataUrl = await (typeof compressPhoto !== 'undefined'
            ? compressPhoto(file, 400, 300, 0.6)
            : dataUrl);
        } catch(err) { console.warn('Kancelář upload failed:', err); }
      }

      done++;
      prog.textContent = `Nahráno ${done}/${total}`;

      // Ulož do Firestore
      await window._fb.updateDoc(
        window._fb.doc(window._fb.db, 'zakazky', zakazkaId),
        { photos: z.photos, updatedAt: window._fb.serverTimestamp() }
      );

      // Překresli detail
      openDetail && openDetail(zakazkaId);
    } catch(err) {
      console.error('Upload error:', err);
      done++;
    }
  }

  setTimeout(() => prog.remove(), 2000);
  inp.value = '';
});

// ══ SOUHRN ZAKÁZKY ════════════════════════════════════════════════
function openZakazkaSouhrn(zakazkaId) {
  const z = (window._zakazky||[]).find(x=>x.id===zakazkaId);
  if(!z) return;

  const body = document.getElementById('souhrn-body');
  if(!body) return;

  function parseCena(c) { return parseFloat((c||'0').replace(/[^\d,.-]/g,'').replace(',','.'))||0; }

  // Načti audit log
  window._fb.getDocs(
    window._fb.query(
      window._fb.collection(window._fb.db, 'zakazky', zakazkaId, 'audit'),
      window._fb.orderBy('createdAt', 'asc')
    )
  ).then(snap => {
    const auditItems = snap.docs.map(d => d.data());

    body.innerHTML = `
      <!-- Hlavička -->
      <div style="background:var(--navy);color:#fff;padding:20px;border-radius:12px;margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:20px;font-weight:800;margin-bottom:4px">${esc(z.nazev||'—')}</div>
            <div style="font-size:13px;color:rgba(255,255,255,.7)">
              Číslo: <strong style="color:#fff">${esc(z.cislo||'—')}</strong>
              · Termín: <strong style="color:#fff">${fmtD(z.termin)||'—'}</strong>
            </div>
          </div>
          <div>${stavBadge(z.stav||'nová')}</div>
        </div>
      </div>

      <!-- Zákazník + technik -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="dsec">
          <div class="dsec-hdr">🏢 Zákazník</div>
          <div class="dsec-body" style="font-size:13px">
            <div style="font-weight:700">${esc(z.zakaznik||'—')}</div>
            ${z.ico?`<div style="font-size:11px;color:var(--muted)">IČO: ${esc(z.ico)}</div>`:''}
            ${z.adresa?`<div style="font-size:11px;color:var(--muted)">${esc(z.adresa)}</div>`:''}
            ${z.adresa?`<a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" target="_blank"
              style="font-size:11px;color:#1d4ed8;display:inline-flex;align-items:center;gap:3px;margin-top:4px;text-decoration:none">📍 Mapa</a>`:''}
          </div>
        </div>
        <div class="dsec">
          <div class="dsec-hdr">🔧 Technik</div>
          <div class="dsec-body" style="font-size:13px">
            <div style="font-weight:700">${esc(z.technik||'—')}</div>
            ${z.hodiny?`<div style="font-size:11px;color:var(--muted)">⏱ ${z.hodiny} h odpracováno</div>`:''}
            ${z.km?`<div style="font-size:11px;color:var(--muted)">🚗 ${z.km} km · náhrada ${((z.km||0)*(z.kmSazba||5.6)).toLocaleString('cs-CZ',{maximumFractionDigits:0})} Kč</div>`:''}
            ${z.casNaZakazce?`<div style="font-size:11px;color:var(--muted)">⏰ Časovač: ${formatDuration(z.casNaZakazce)}</div>`:''}
          </div>
        </div>
      </div>

      <!-- Popis prací -->
      ${z.prace||z.zadani?`<div class="dsec" style="margin-bottom:12px">
        <div class="dsec-hdr">📝 Provedené práce</div>
        <div class="dsec-body" style="font-size:13px;white-space:pre-wrap">${esc(z.prace||z.zadani||'—')}</div>
      </div>`:''}

      <!-- Cena -->
      <div class="dsec" style="margin-bottom:12px;border:1.5px solid var(--green)">
        <div class="dsec-hdr" style="background:rgba(106,191,62,.08)">💰 Fakturační souhrn</div>
        <div class="dsec-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:13px">Celková cena (bez DPH)</span>
            <span style="font-size:16px;font-weight:800;color:var(--green);font-family:'DM Mono',monospace">${z.cena||'—'}</span>
          </div>
          ${z.duzp?`<div style="font-size:12px;color:var(--muted)">DUZP: ${fmtD(z.duzp)}</div>`:''}
        </div>
      </div>

      <!-- Fotky -->
      ${z.photos?.length?`<div class="dsec" style="margin-bottom:12px">
        <div class="dsec-hdr">📷 Fotodokumentace (${z.photos.length} ks)</div>
        <div class="dsec-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
          ${z.photos.map(p=>`<div style="aspect-ratio:4/3;border-radius:6px;overflow:hidden;cursor:pointer" onclick="openLightbox('${p.cloudUrl||p.dataUrl}')">
            <img src="${p.cloudUrl||p.dataUrl}" style="width:100%;height:100%;object-fit:cover">
          </div>`).join('')}
        </div>
      </div>`:''}

      <!-- Časová osa -->
      ${auditItems.length?`<div class="dsec">
        <div class="dsec-hdr">📅 Průběh zakázky</div>
        <div class="dsec-body" style="padding:0">
          ${auditItems.map(a=>{
            const ts = a.createdAt?.toDate?.() || new Date();
            const icon = {stav_zmena:'🔄',předáno_dál:'➡',vráceno:'↩',vytvoreno:'🆕',import:'📥'}[a.action]||'📋';
            return `<div style="display:flex;gap:10px;padding:8px 14px;border-bottom:1px solid var(--border)">
              <span style="font-size:16px;flex-shrink:0">${icon}</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${esc(a.value||a.action||'—')}</div>
                ${a.note?`<div style="font-size:11px;color:var(--muted)">${esc(a.note)}</div>`:''}
                <div style="font-size:10px;color:var(--muted)">${esc(a.author||'')} · ${ts.toLocaleString('cs-CZ')}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`:''}
    `;
  }).catch(() => {
    body.innerHTML = '<div style="padding:20px;color:var(--muted)">Chyba při načítání souhrnu.</div>';
  });

  document.getElementById('souhrn-modal').classList.add('open');
}

function printSouhrn() {
  const body = document.getElementById('souhrn-body');
  const pc = document.getElementById('print-container');
  if(body && pc) {
    pc.innerHTML = `<div style="padding:20px;font-family:Arial,sans-serif">${body.innerHTML}</div>`;
    generatePDF({ filename: 'souhrn-zakazky.pdf' });
  }
}

// ══ OVERRIDE addUser — ulož roli ═════════════════════════════════
(function hookAddUserRole() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    if(typeof addUser !== 'undefined' || tries > 40) {
      clearInterval(iv);
      if(typeof addUser === 'undefined') return;
      const prev = addUser;
      addUser = async function() {
        // Zavolej původní funkci
        await prev();
        // Pokud bylo vytvoření úspěšné, ulož roli do Firestore
        // (bohužel původní addUser nevrací uid — sledujeme přes auth)
        const role = document.getElementById('nu-role')?.value || 'technik';
        const notifEmail = document.getElementById('nu-notif-email')?.value.trim() || '';
        const email = document.getElementById('nu-email')?.value.trim();
        if(!email) return;
        // Najdi uživatele podle emailu v users kolekci
        try {
          const snap = await window._fb.getDocs(
            window._fb.query(
              window._fb.collection(window._fb.db, 'users'),
              window._fb.where('email', '==', email)
            )
          );
          snap.forEach(async doc => {
            await window._fb.updateDoc(doc.ref, {
              role,
              notifEmail: notifEmail || email,
              updatedAt: window._fb.serverTimestamp()
            });
          });
          console.log(`Role ${role} nastavena pro ${email}`);
        } catch(e) { console.warn('Role set error:', e); }
      };
    }
  }, 300);
})();
