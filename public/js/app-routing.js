// ── ROLE ROUTING ──────────────────────────────────────
let _kUnsubscribe = null;

window._fb.onAuthStateChanged(window._fb.auth, async user => {
  if (!user) {
    showScreen('login');
    if (_kUnsubscribe) { _kUnsubscribe(); _kUnsubscribe = null; }
    return;
  }
  // Role přichází z /api/auth/me přes firebase-compat
  let role = user.role || window._userRole || 'technik';
  console.log('[Auth] email:', user.email, 'role:', role);
  if (role === 'pending') {
    const err = document.getElementById('login-err');
    if (err) { err.textContent='⏳ Čeká na schválení.'; err.style.display='block'; }
    await _auth.signOut(); return;
  }
  window._currentUser = user;
  window._currentRole = role;
  if (role === 'admin' || role === 'kancelar') {
    showScreen('kancelar'); initKancelar(user, role);
  } else {
    showScreen('technik'); initTechnik(user);
  }
});

function showScreen(which) {
  document.getElementById('login-screen').style.display  = which==='login'    ? 'flex' : 'none';
  document.getElementById('app-technik').style.display   = which==='technik'  ? 'block' : 'none';
  document.getElementById('app-kancelar').style.display  = which==='kancelar' ? 'flex' : 'none';
}

function initKancelar(user, role) {
  const n=document.getElementById('user-name'); if(n) n.textContent=user.displayName||user.email;
  const a=document.getElementById('user-av');   if(a) a.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  const r=document.getElementById('role-badge');if(r) r.textContent=role==='admin'?'Admin':'Kancelář';
  startKancelarLive();
}

function initTechnik(user) {
  _lockState.prace = false; _lockState.pozn = false;
  setTimeout(function(){ ['prace','pozn'].forEach(function(w){ var ta=document.getElementById('f_'+w); if(ta){ta.readOnly=false;ta.style.background='';ta.style.color='';} var icon=document.getElementById('lock-'+w+'-icon'); var label=document.getElementById('lock-'+w+'-label'); if(icon)icon.textContent='🔓'; if(label)label.textContent='Odemčeno'; }); }, 200);
  window._currentUser = user;
  const n=document.getElementById('user-name');    if(n) n.textContent=user.displayName||user.email;
  const a=document.getElementById('user-avatar');  if(a) a.textContent=(user.displayName||user.email||'?')[0].toUpperCase();
  try { window._fb.db.collection('zakazky').orderBy('createdAt','desc').get()
    .then(s=>updateSuggestions(s.docs.map(d=>d.data()))).catch(()=>{}); } catch(e) {}
  loadDraft();
  checkPendingUploads && checkPendingUploads();
  showOfflineBanner(!navigator.onLine);
  loadZakazkyList(); loadTechList();
  loadAssignedZakazky(user);
  setFirma('aceuro');
}

function startKancelarLive() {
  _kUnsubscribe = window._fb.db.collection('zakazky').orderBy('createdAt','desc')
    .onSnapshot(snap => {
      window._zakazky = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderList && renderList();
      renderDashboard && renderDashboard();
      updateSuggestions && updateSuggestions(window._zakazky);
    });
}
