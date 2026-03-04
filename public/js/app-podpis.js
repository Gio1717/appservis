// ════════════════════════════════════════════════════════════════
//  ZÁKAZNÍK PODPIS — celoobrazovkový podpis pro zákazníka
// ════════════════════════════════════════════════════════════════

let _zakSigCtx = null;
let _zakSigDrawing = false;
let _zakSigLx = 0, _zakSigLy = 0;
let _zakSigHasData = false;

function openZakaznikSig() {
  const overlay = document.getElementById('zakaznik-sig-overlay');
  const canvas  = document.getElementById('zak-sig-canvas');
  if(!overlay || !canvas) return;

  // Naplň souhrn zakázky
  const nazev = document.getElementById('f_nazev')?.value || document.getElementById('f_cislo')?.value || 'Servisní zásah';
  const prace = document.getElementById('f_prace')?.value || '';
  const zakaznik = document.getElementById('f_zakaznik')?.value || '';

  document.getElementById('zak-sig-nazev').textContent = nazev;
  document.getElementById('zak-sig-prace').textContent = zakaznik ? `Zákazník: ${zakaznik}` : '';

  const summary = document.getElementById('zak-sig-summary');
  if(summary) {
    summary.innerHTML = prace
      ? `<strong>Provedené práce:</strong> ${esc(prace.substring(0,300))}${prace.length>300?'…':''}`
      : '<em>Servisní zásah dle dohody</em>';
  }

  // Zobraz overlay
  overlay.style.display = 'flex';
  _zakSigHasData = false;

  // Inicializuj canvas
  canvas.width  = window.innerWidth;
  canvas.height = canvas.offsetHeight || (window.innerHeight - 260);
  _zakSigCtx = canvas.getContext('2d');
  _zakSigCtx.clearRect(0, 0, canvas.width, canvas.height);

  // Nakresli vodítko (jemná čára)
  _zakSigCtx.strokeStyle = '#dde3f0';
  _zakSigCtx.lineWidth = 1;
  _zakSigCtx.setLineDash([8, 8]);
  _zakSigCtx.beginPath();
  _zakSigCtx.moveTo(20, canvas.height * 0.65);
  _zakSigCtx.lineTo(canvas.width - 20, canvas.height * 0.65);
  _zakSigCtx.stroke();
  _zakSigCtx.setLineDash([]);

  // Nápis "Podpis zákazníka" jako vodoznak
  _zakSigCtx.font = '13px Arial';
  _zakSigCtx.fillStyle = '#c8d0e0';
  _zakSigCtx.textAlign = 'center';
  _zakSigCtx.fillText('Podpis zákazníka', canvas.width / 2, canvas.height * 0.65 + 20);
  _zakSigCtx.textAlign = 'left';

  // Zamkni scroll stránky
  document.body.style.overflow = 'hidden';

  // Event listenery na canvas
  canvas.onmousedown  = canvas.ontouchstart = zakSigStart;
  canvas.onmousemove  = canvas.ontouchmove  = zakSigMove;
  canvas.onmouseup    = canvas.ontouchend   =
  canvas.onmouseleave                       = zakSigEnd;
}

function zakSigPos(e) {
  const rect = document.getElementById('zak-sig-canvas').getBoundingClientRect();
  const touch = e.touches?.[0] || e;
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

function zakSigStart(e) {
  e.preventDefault();
  _zakSigDrawing = true;
  _zakSigHasData = true;
  const p = zakSigPos(e);
  _zakSigLx = p.x;
  _zakSigLy = p.y;
  _zakSigCtx.beginPath();
  _zakSigCtx.moveTo(p.x, p.y);
}

function zakSigMove(e) {
  if(!_zakSigDrawing) return;
  e.preventDefault();
  const p = zakSigPos(e);
  _zakSigCtx.lineTo(p.x, p.y);
  _zakSigCtx.strokeStyle = '#0f1f3d';
  _zakSigCtx.lineWidth = 2.5;
  _zakSigCtx.lineCap = 'round';
  _zakSigCtx.lineJoin = 'round';
  _zakSigCtx.stroke();
  _zakSigLx = p.x;
  _zakSigLy = p.y;
}

function zakSigEnd(e) {
  _zakSigDrawing = false;
}

function clearZakaznikSig() {
  const canvas = document.getElementById('zak-sig-canvas');
  if(!canvas) return;
  _zakSigCtx.clearRect(0, 0, canvas.width, canvas.height);
  _zakSigHasData = false;
  // Překresli vodítko
  _zakSigCtx.strokeStyle = '#dde3f0';
  _zakSigCtx.lineWidth = 1;
  _zakSigCtx.setLineDash([8, 8]);
  _zakSigCtx.beginPath();
  _zakSigCtx.moveTo(20, canvas.height * 0.65);
  _zakSigCtx.lineTo(canvas.width - 20, canvas.height * 0.65);
  _zakSigCtx.stroke();
  _zakSigCtx.setLineDash([]);
  _zakSigCtx.font = '13px Arial';
  _zakSigCtx.fillStyle = '#c8d0e0';
  _zakSigCtx.textAlign = 'center';
  _zakSigCtx.fillText('Podpis zákazníka', canvas.width / 2, canvas.height * 0.65 + 20);
  _zakSigCtx.textAlign = 'left';
}

function cancelZakaznikSig() {
  document.getElementById('zakaznik-sig-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function confirmZakaznikSig() {
  if(!_zakSigHasData) {
    // Vizuální feedback — zákazník ještě nepodepsal
    const canvas = document.getElementById('zak-sig-canvas');
    canvas.style.border = '3px solid #ef4444';
    setTimeout(() => canvas.style.border = '', 1000);
    return;
  }

  const canvas = document.getElementById('zak-sig-canvas');
  const dataUrl = canvas.toDataURL('image/png');

  // Ulož do _sigData[2] — stejné místo jako ruční podpis zákazníka
  _sigData[2] = dataUrl;
  updateSigPreview && updateSigPreview(2);

  // Nastav datum podpisu na dnešek
  const sd2 = document.getElementById('sd2');
  if(sd2 && !sd2.value) sd2.value = new Date().toISOString().slice(0, 10);

  // Zavři overlay
  document.getElementById('zakaznik-sig-overlay').style.display = 'none';
  document.body.style.overflow = '';

  // Vizuální potvrzení
  const hint = document.getElementById('sh2');
  if(hint) hint.style.display = 'none';
  const preview = document.getElementById('sp2');
  if(preview) {
    preview.innerHTML = `<img src="${dataUrl}" style="max-height:80px;max-width:100%;object-fit:contain">`;
  }

  // Uložit draft
  saveDraft && saveDraft();

  // Krátký toast
  showToast('✅ Zákazník podepsal');
}

// ── Toast helper (pokud neexistuje) ──────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('toast-msg');
  if(!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-msg';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#0f1f3d;color:#fff;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:700;z-index:9999;pointer-events:none;transition:opacity .3s';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2500);
}

// ── Orientace obrazovky pro zákazníka ────────────────────────────
// Pokud je telefon na výšku, vyčkej na otočení nebo pokračuj v landscape
(function handleOrientation() {
  const overlay = document.getElementById('zakaznik-sig-overlay');
  if(!overlay) return;

  window.addEventListener('orientationchange', () => {
    if(overlay.style.display === 'flex') {
      // Přizpůsob canvas po otočení
      setTimeout(() => {
        const canvas = document.getElementById('zak-sig-canvas');
        if(!canvas) return;
        const saved = canvas.toDataURL();
        canvas.width  = window.innerWidth;
        canvas.height = canvas.offsetHeight || (window.innerHeight - 260);
        // Obnov obsah
        if(_zakSigHasData) {
          const img = new Image();
          img.onload = () => _zakSigCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
          img.src = saved;
        }
      }, 300);
    }
  });
})();
