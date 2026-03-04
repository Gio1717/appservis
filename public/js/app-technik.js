

// ════════════════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════════════════
let _currentFirma = 'aceuro'; // 'aceuro' or 'progres'
const LOGO_DATA = "/img/logo-aceuro.jpeg";
const EXT_LABELS = ["Cestovní čas","Celkem ujeté km","Paušál cestovného"];
const EXT_STEPS  = [0.5, 1, 1];

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fmt(n){return n.toLocaleString("cs-CZ",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmtD(v){if(!v)return"";if(v.includes("-")){const[y,m,d]=v.split("-");return d+"."+m+"."+y;}return v;}
function fmtTS(ts){if(!ts)return"—";const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString("cs-CZ")+" "+d.toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"});}

// ── AUTOCOMPLETE suggestions (built from saved zakázky) ──────
let _suggestions = [];
function updateSuggestions(zakazky){
  const freq = {};
  (zakazky||[]).forEach(z=>(z.rows||[]).forEach(r=>{
    if(r.pol&&r.pol.trim()){
      const k=r.pol.trim();
      if(!freq[k])freq[k]={label:k,cen:r.cen||"",count:0};
      freq[k].count++;
      if(r.cen)freq[k].cen=r.cen;
    }
  }));
  _suggestions=Object.values(freq).sort((a,b)=>b.count-a.count).slice(0,60);
}
function showAutocomplete(inp, priceFld){
  const q=(inp.value||"").toLowerCase().trim();
  let ac=document.getElementById("ac-list");
  if(!ac){ac=document.createElement("ul");ac.id="ac-list";ac.style.cssText="position:fixed;z-index:999;background:#fff;border:1.5px solid #d0d8e8;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.12);list-style:none;margin:0;padding:4px 0;font-size:12px;max-height:180px;overflow-y:auto;min-width:200px";document.body.appendChild(ac);}
  if(!q){ac.style.display="none";return;}
  const matches=_suggestions.filter(s=>s.label.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){ac.style.display="none";return;}
  const r=inp.getBoundingClientRect();
  ac.style.display="block";
  ac.style.left=r.left+"px";
  ac.style.top=(r.bottom+2)+"px";
  ac.style.width=Math.max(r.width,220)+"px";
  ac.innerHTML=matches.map((s,i)=>`<li data-i="${i}" style="padding:7px 13px;cursor:pointer;display:flex;justify-content:space-between;gap:10px"><span>${esc(s.label)}</span><span style="color:#6b7a99;font-family:'DM Mono',monospace">${s.cen?fmt(parseFloat(s.cen)||0)+" Kč/ks":""}</span></li>`).join("");
  ac.querySelectorAll("li").forEach(li=>{
    li.onmousedown=e=>{e.preventDefault();const s=matches[+li.dataset.i];inp.value=s.label;if(priceFld&&s.cen&&!priceFld.value)priceFld.value=s.cen;inp.dispatchEvent(new Event("input",{bubbles:true}));ac.style.display="none";};
    li.onmouseenter=()=>li.style.background="#f0f5ff";
    li.onmouseleave=()=>li.style.background="";
  });
}
document.addEventListener("click",()=>{const ac=document.getElementById("ac-list");if(ac)ac.style.display="none";});
document.addEventListener("scroll",()=>{const ac=document.getElementById("ac-list");if(ac)ac.style.display="none";},{passive:true});

// ════════════════════════════════════════════════════════
//  BUILD PRINT VIEW (shared A4 renderer)
// ════════════════════════════════════════════════════════
function buildPrintView(d){
  const firma = d.firma || (typeof _currentFirma !== 'undefined' ? _currentFirma : 'aceuro');
  const fd = Object.assign({}, (typeof FIRMA_DATA !== 'undefined' ? FIRMA_DATA[firma] : null) || {
    name:'AC EURO a.s.', addr:'Houbalova 2553/4, 628 00 Brno',
    ic:'28264347', dic:'CZ28264347', tel:'544 234 330', web:'www.aceuro.cz',
    color:'#6abf3e', dark:'#0f1f3d'
  });
  const isProgres = firma === 'progres';
  fd.logo = (typeof PROGRES_LOGO !== 'undefined' && isProgres) ? PROGRES_LOGO
           : (typeof LOGO_DATA !== 'undefined' ? LOGO_DATA : '');
  const dc = fd.dark || '#0f1f3d';
  const ac = fd.color || '#6abf3e';

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fld(label,value){
    return '<div style="display:flex;align-items:baseline;margin-bottom:8px;border-bottom:1.5px dotted #9aaac4">'
      +'<label style="font-weight:700;font-size:11px;white-space:nowrap;color:'+dc+';padding-right:6px;flex-shrink:0">'+esc(label)+'</label>'
      +'<span style="font-size:11.5px;color:#1a2540;padding:2px 4px 4px;flex:1">'+esc(value||'—')+'</span></div>';
  }
  function secHead(title){
    return '<div style="font-weight:700;font-size:12px;color:'+dc+';letter-spacing:.04em;margin:16px 0 6px;display:flex;align-items:center;gap:8px">'
      +esc(title)+'<div style="flex:1;height:1px;background:#c8d2e0"></div></div>';
  }
  const LH=26;
  function dotLines(text,count){
    var ls=(text&&text!=='—')?text.split('\n'):[''];
    while(ls.length<count)ls.push('');
    return ls.slice(0,count).map(function(l){
      return '<div style="height:'+LH+'px;border-bottom:1.5px dotted #9aaac4;font-size:11.5px;'
        +'line-height:'+LH+'px;padding:0 4px;color:#1a2540;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+esc(l)+'</div>';
    }).join('');
  }

  // Tabulka
  var tblRows='';
  (d.rows||[]).forEach(function(r){
    if(!r.pol&&!r.poc&&!r.cel)return;
    tblRows+='<div style="display:grid;grid-template-columns:2fr 70px 90px 100px;border-bottom:1px dotted #c8d2e0">'
      +'<div style="padding:5px 10px;font-size:10.5px;color:#1a2540">'+esc(r.pol||'')+'</div>'
      +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;border-left:1px solid #e8ecf2">'+esc(r.poc||'')+'</div>'
      +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;border-left:1px solid #e8ecf2">'+esc(r.cen||'')+'</div>'
      +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;font-weight:600;border-left:1px solid #e8ecf2;background:rgba(0,0,80,.03)">'+esc(r.cel||'')+'</div>'
      +'</div>';
  });
  var hasExts=(d.exts||[]).some(function(e){return e.poc||e.cel;});
  if(hasExts){
    tblRows+='<div style="background:#f4f6fa;padding:4px 10px;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7a99;border-top:2px solid #c8d2e0">Cestovné</div>';
    (d.exts||[]).forEach(function(e){
      if(!e.poc&&!e.cel)return;
      tblRows+='<div style="display:grid;grid-template-columns:2fr 70px 90px 100px;border-bottom:1px dotted #c8d2e0">'
        +'<div style="padding:5px 10px;font-size:10.5px;font-style:italic;color:#6b7a99">'+esc(e.label||'')+'</div>'
        +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;border-left:1px solid #e8ecf2">'+esc(e.poc||'')+'</div>'
        +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;border-left:1px solid #e8ecf2">'+esc(e.cen||'')+'</div>'
        +'<div style="padding:5px 8px;font-size:10.5px;font-family:monospace;text-align:right;font-weight:600;border-left:1px solid #e8ecf2;background:rgba(0,0,80,.03)">'+esc(e.cel||'')+'</div>'
        +'</div>';
    });
  }
  var pricesNote=d.pricesSkipped?'<div style="font-size:9px;font-style:italic;color:#7a5500;padding:4px 10px;background:#fffbe6;border-top:1px solid #f0e090">Ceny budou doplněny při fakturaci</div>':'';
  var cena=d.cena||'Bude doplněno';

  // Extra signatories
  var extraSigs=d.extraSignatories||[];
  var extraSigHTML='';
  if(extraSigs.length){
    extraSigHTML='<div style="padding:6px 12px;border-top:1px dashed #c8d2e0">'
      +'<div style="font-size:9px;color:#6b7a99;font-weight:700;margin-bottom:4px">DALŠÍ PŘEBÍRAJÍCÍ OSOBY:</div>'
      +extraSigs.map(function(name){
        return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
          +'<span style="font-size:10.5px;color:#1a2540;white-space:nowrap">'+esc(name)+'</span>'
          +'<div style="flex:1;border-bottom:1px dotted #9aaac4"></div>'
          +'</div>';
      }).join('')
      +'</div>';
  }

  var wrap=document.createElement('div');
  wrap.style.cssText="width:100%;background:#fff;font-family:'IBM Plex Sans',Arial,sans-serif";

  var logoHtml=fd.logo?'<img src="'+fd.logo+'" style="height:42px;width:auto;object-fit:contain;object-position:left">':'';
  var webHtml=fd.web?'<div style="font-size:10px;color:#2d5fa6">'+esc(fd.web)+'</div>':'';
  var sig1Img=d.sig1?'<img src="'+esc(d.sig1)+'" style="max-height:70px;max-width:100%;object-fit:contain">':'<span style="font-size:10px;color:#d0d8e8">Bez podpisu</span>';
  var sig2Img=d.sig2?'<img src="'+esc(d.sig2)+'" style="max-height:70px;max-width:100%;object-fit:contain">':'<span style="font-size:10px;color:#d0d8e8">Bez podpisu</span>';

  wrap.innerHTML=
    '<div style="max-width:860px;margin:0 auto;background:#fff">'

    // HEADER
    +'<div style="padding:20px 32px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;border-bottom:3px solid '+dc+'">'
      +logoHtml
      +'<div style="text-align:right;line-height:1.6">'
        +'<div style="font-weight:700;font-size:13px;color:'+dc+'">'+esc(fd.name)+'</div>'
        +'<div style="font-size:10.5px;color:#6b7a99">'+esc(fd.addr)+'</div>'
        +'<div style="font-size:10.5px;color:#6b7a99">IČ: '+esc(fd.ic)+(fd.dic?' &nbsp;·&nbsp; DIČ: '+esc(fd.dic):'')+(fd.tel?' &nbsp;·&nbsp; Tel.: '+esc(fd.tel):'')+'</div>'
        +webHtml
      +'</div>'
    +'</div>'

    // TITLE BAR
    +'<div style="background:'+dc+';padding:12px 32px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact">'
      +'<span style="font-size:18px;font-weight:700;letter-spacing:.12em;color:#fff;text-transform:uppercase">Servisní list</span>'
      +'<span style="font-size:10px;color:rgba(255,255,255,.55);letter-spacing:.03em">'+esc(d.cislo||'')+'</span>'
    +'</div>'

    // BODY
    +'<div style="padding:20px 32px 28px">'

      // Info grid
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:4px">'
        +fld('Název zakázky:',d.nazev)
        +fld('Číslo servisu:',d.cislo)
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px;margin-bottom:14px">'
        +fld('Servisní technik:',d.technik)
        +fld('Termín provedení:',(typeof fmtD==='function'?fmtD(d.termin)||d.termin:d.termin)||'—')
      +'</div>'

      // Práce
      +secHead('Provedené servisní práce')
      +dotLines(d.prace,11)

      // Tabulka
      +secHead('Spotřebovaný materiál a práce')
      +'<div style="border:1px solid #c8d2e0;border-radius:3px;overflow:hidden">'
        +'<div style="display:grid;grid-template-columns:2fr 70px 90px 100px;background:'+dc+';-webkit-print-color-adjust:exact;print-color-adjust:exact">'
          +'<div style="padding:8px 10px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff">Položka</div>'
          +'<div style="padding:8px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-align:center">Počet</div>'
          +'<div style="padding:8px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-align:center">Kč/ks</div>'
          +'<div style="padding:8px;font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-align:center">Celkem</div>'
        +'</div>'
        +(tblRows||'<div style="padding:10px;font-size:10px;color:#9aaac4;text-align:center">—</div>')
      +'</div>'
      +pricesNote

      // Cena
      +'<div style="margin-top:10px;background:'+dc+';border-radius:3px;display:flex;justify-content:space-between;align-items:center;padding:10px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact">'
        +'<span style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.85)">Cena bez DPH</span>'
        +'<span style="font-family:monospace;font-size:18px;font-weight:700;color:'+ac+'">'+esc(cena)+'</span>'
      +'</div>'

      // DUZP
      +'<div style="margin-top:12px;display:flex;align-items:baseline;gap:8px;border-bottom:1.5px dotted #9aaac4;padding-bottom:5px">'
        +'<label style="font-weight:700;font-size:11px;white-space:nowrap;color:'+dc+'">Datum ukončení prací (DUZP):</label>'
        +'<span style="font-size:11.5px;color:#1a2540;padding:0 4px;flex:1">'+esc((typeof fmtD==='function'?fmtD(d.duzp)||d.duzp:d.duzp)||'')+'</span>'
      +'</div>'

      // Poznámky
      +secHead('Poznámky')
      +dotLines(d.pozn,4)

      // Podpisy
      +'<div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px">'

        // Zhotovitel
        +'<div style="border:1.5px solid #c8d2e0;border-radius:4px;overflow:hidden">'
          +'<div style="background:'+dc+';color:#fff;font-size:9.5px;font-weight:700;padding:7px 12px;text-transform:uppercase;letter-spacing:.08em;-webkit-print-color-adjust:exact;print-color-adjust:exact">Za zhotovitele</div>'
          +'<div style="height:80px;background:#fafbfd;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8ecf2">'+sig1Img+'</div>'
          +'<div style="padding:5px 12px;display:flex;justify-content:space-between;align-items:center">'
            +'<span style="font-size:9.5px;color:#6b7a99">Datum: <strong style="color:#1a2540">'+esc(d.sd1||'')+'</strong></span>'
            +(d.sig1name?'<span style="font-size:9.5px;color:#1a2540;font-weight:600">'+esc(d.sig1name)+'</span>':'')
          +'</div>'
        +'</div>'

        // Objednatel
        +'<div style="border:1.5px solid #c8d2e0;border-radius:4px;overflow:hidden">'
          +'<div style="background:'+dc+';color:#fff;font-size:9.5px;font-weight:700;padding:7px 12px;text-transform:uppercase;letter-spacing:.08em;-webkit-print-color-adjust:exact;print-color-adjust:exact">Za objednatele</div>'
          +'<div style="height:80px;background:#fafbfd;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #e8ecf2">'+sig2Img+'</div>'
          +'<div style="padding:5px 12px;display:flex;justify-content:space-between;align-items:center">'
            +'<span style="font-size:9.5px;color:#6b7a99">Datum: <strong style="color:#1a2540">'+esc(d.sd2||'')+'</strong></span>'
            +(d.sig2name?'<span style="font-size:9.5px;color:#1a2540;font-weight:600">'+esc(d.sig2name)+'</span>':'')
          +'</div>'
          +extraSigHTML
        +'</div>'
      +'</div>'

      // Footer
      +'<div style="margin-top:14px;padding-top:10px;border-top:1px solid #c8d2e0;font-size:9px;color:#9aaac4;line-height:1.6">'
        +'Pokud je cena za jednotlivé úkony a materiál předem stanovena, bude tato následně doplněna při fakturaci. '
        +'Přebírající osoba za objednatele stvrzuje svým podpisem, že činnosti popsané na tomto listě byly provedeny a je oprávněna tyto práce převzít.'
      +'</div>'

    +'</div></div>';

  // Fotostránky
  if(d.includePhotos&&d.photos&&d.photos.length){
    var PER_PAGE=6,PER_ROW=3,pages=[];
    for(var i=0;i<d.photos.length;i+=PER_PAGE)pages.push(d.photos.slice(i,i+PER_PAGE));
    pages.forEach(function(pp,pi){
      var rows='';
      for(var r=0;r<pp.length;r+=PER_ROW){
        var trio=pp.slice(r,r+PER_ROW);
        while(trio.length<PER_ROW)trio.push(null);
        rows+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">'
          +trio.map(function(ph,ci){
            var gi=pi*PER_PAGE+r+ci+1;
            if(!ph)return '<div></div>';
            return '<div style="border:1px solid #d0d8e8;border-radius:4px;overflow:hidden">'
              +'<img src="'+(ph.cloudUrl||ph.dataUrl||'')+'" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block">'
              +'<div style="padding:4px 8px;font-size:9px;color:#6b7a99;border-top:1px solid #e8ecf2;background:#fafbfc">'
                +'<strong style="color:#0f1f3d">Foto '+gi+'</strong>'+(ph.caption?' — '+esc(ph.caption):'')
              +'</div></div>';
          }).join('')
          +'</div>';
      }
      var pg=document.createElement('div');
      pg.style.cssText='page-break-before:always;width:100%;background:#fff';
      pg.innerHTML='<div style="max-width:860px;margin:0 auto">'
        +'<div style="padding:12px 32px 0;display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid '+dc+'">'
          +(fd.logo?'<img src="'+fd.logo+'" style="height:28px;width:auto">':'')
          +'<div style="font-size:9px;color:#6b7a99">Servisní list č. '+esc(d.cislo||'—')+' — '+esc(d.nazev||'—')+'</div>'
        +'</div>'
        +'<div style="background:'+dc+';padding:6px 32px;-webkit-print-color-adjust:exact;print-color-adjust:exact">'
          +'<span style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.75)">Fotodokumentace — strana '+(pi+1)+'</span>'
        +'</div>'
        +'<div style="padding:14px 32px">'+rows+'</div>'
        +'<div style="padding:6px 32px 10px;font-size:8px;color:#9aaac4;border-top:1px solid #e8ecf2;text-align:center">'
          +esc(d.nazev||'—')+' | Technik: '+esc(d.technik||'—')+' | '+esc(d.termin||'—')
        +'</div>'
      +'</div>';
      wrap.appendChild(pg);
    });
  }
  return wrap;
}



// ════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════
let step = 0;
let photos = []; // {dataUrl, cloudUrl, name}
let pricesSkipped = false;
let _sigFsIndex = 0;
let _sigData = {1: null, 2: null}; // base64 dataUrl
function gv(id){ const el=document.getElementById(id); return el?el.value:''; }

async function uploadPhotoToServer(dataUrl, filename) {
  const res = await fetch('/api/upload/base64', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify({dataUrl, filename: filename || 'photo.jpg'})
  });
  if (!res.ok) throw new Error('Upload selhal: ' + res.status);
  const j = await res.json();
  return j.url; // napr. /uploads/userId/filename.jpg
}
function getSig(n){ return _sigData[n] || ''; }

// ── Náhled servisního listu v kroku 5 ─────────────────────────
function buildPreview(){
  const pb = document.getElementById('preview-body');
  if(!pb) return;
  const d = {
    nazev:gv('f_nazev')||'—', cislo:gv('f_cislo')||'—',
    zakaznik:gv('f_zakaznik')||'', adresa:gv('f_adresa')||'',
    ico:gv('f_ico')||'', dic:gv('f_dic')||'',
    technik:(()=>{
      const rows=document.querySelectorAll('#technici-list .tech-row');
      if(!rows.length) return window._currentUser?.displayName||window._currentUser?.email||'';
      const names=[];
      rows.forEach(row=>{
        const sel=row.querySelector('select');
        const vlastni=row.querySelector('input[type=text]');
        if(sel&&sel.value==='vlastni'&&vlastni?.value.trim()) names.push(vlastni.value.trim());
        else if(sel&&sel.value&&sel.value!=='vlastni') names.push(sel.options[sel.selectedIndex]?.text||sel.value);
        else names.push(window._currentUser?.displayName||window._currentUser?.email||'');
      });
      return names.filter(Boolean).join(', ');
    })(),
    termin:gv('f_termin')||'', prace:gv('f_prace')||'—',
    pozn:gv('f_pozn')||'', duzp:gv('f_duzp')||'',
    firma:window._currentFirma||'aceuro',
    cena:document.getElementById('cena_total')?.textContent||'',
    pricesSkipped,
    rows:(()=>{const r=[];for(let i=1;i<=8;i++)r.push({pol:gv('pol'+i),poc:gv('poc'+i),cen:gv('cen'+i),cel:gv('cel'+i)});return r;})(),
    exts:(()=>{const e=[];for(let i=1;i<=3;i++)e.push({label:EXT_LABELS[i-1],poc:gv('epoc'+i),cen:gv('ecen'+i),cel:gv('ecel'+i)});return e;})(),
    sd1:fmtD(gv('sd1')), sd2:fmtD(gv('sd2')),
    sig1:getSig(1), sig2:getSig(2),
    extraSignatories:getExtraSignatories(),
    photos:[], includePhotos:false,
  };
  try {
    const pv = buildPrintView(d);
    pb.innerHTML = '';
    const sw = document.createElement('div');
    sw.style.cssText = 'transform:scale(0.52);transform-origin:top left;width:193%;pointer-events:none;background:#fff';
    sw.appendChild(pv);
    pb.appendChild(sw);
    pb.style.cssText = 'overflow:hidden;border-radius:0 0 8px 8px;height:300px';
  } catch(e) {
    pb.innerHTML = '<div style="padding:20px;color:var(--muted);font-size:13px">Náhled není k dispozici</div>';
  }
}

function updateSigPreview(n){
  const sp = document.getElementById('sp'+n);
  if(!sp) return;
  if(_sigData[n]){
    sp.innerHTML = '<img src="'+_sigData[n]+'" style="max-width:100%;max-height:80px;object-fit:contain">';
    sp.style.background = '#f8fbff';
  } else {
    sp.innerHTML = '<span style="color:var(--muted);font-size:12px">Bez podpisu</span>';
    sp.style.background = '#f4f6fb';
  }
}

function resizeSigPreviews(){
  [1,2].forEach(n => updateSigPreview(n));
  // Předvyplň jméno technika
  const n1 = document.getElementById('sig1-name');
  if(n1 && !n1.value && window._currentUser){
    n1.value = window._currentUser.displayName || window._currentUser.email || '';
  }
}

// ── Fullscreen podpis ──────────────────────────────────────────
let _sigFSTarget = null;
let _sigFSDrawing = false;
let _sigFSLastX = 0, _sigFSLastY = 0;

function openSigFS(n){
  _sigFSTarget = n;
  const overlay = document.getElementById('sig-fs');
  const title = document.getElementById('sig-fs-title');
  if(title) title.textContent = n===1 ? 'Podpis technika' : 'Podpis zákazníka';
  const canvas = document.getElementById('sig-fs-canvas');
  if(canvas){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 120;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Načti existující podpis
    if(_sigData[n]){
      const img = new Image();
      img.onload = () => ctx.drawImage(img,0,0,canvas.width,canvas.height);
      img.src = _sigData[n];
    }
    // Touch/mouse events
    canvas.onpointerdown = e => { _sigFSDrawing=true; const r=canvas.getBoundingClientRect(); _sigFSLastX=e.clientX-r.left; _sigFSLastY=e.clientY-r.top; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if(!_sigFSDrawing)return; const r=canvas.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; const c=canvas.getContext('2d'); c.strokeStyle='#000';c.lineWidth=2;c.lineCap='round';c.lineJoin='round'; c.beginPath();c.moveTo(_sigFSLastX,_sigFSLastY);c.lineTo(x,y);c.stroke(); _sigFSLastX=x;_sigFSLastY=y; };
    canvas.onpointerup = () => { _sigFSDrawing=false; };
  }
  if(overlay) overlay.classList.add('open');
}

function clearSigFS(){
  const canvas = document.getElementById('sig-fs-canvas');
  if(canvas){ const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); }
}

function closeSigFS(save){
  if(save && _sigFSTarget){
    const canvas = document.getElementById('sig-fs-canvas');
    if(canvas) {
      _sigData[_sigFSTarget] = canvas.toDataURL('image/png');
      updateSigPreview(_sigFSTarget);
      saveDraft();
    }
  }
  const overlay = document.getElementById('sig-fs');
  if(overlay) overlay.classList.remove('open');
  _sigFSTarget = null;
}

function clearSig(n){
  _sigData[n]=null;
  const c=document.getElementById('sig'+n);
  if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);c.style.display='none';}
  const h=document.getElementById('sh'+n); if(h) h.style.display='';
  const p=document.getElementById('sp'+n); if(p) p.innerHTML='';
  saveDraft();
}
const LINE_H = 32;

// ════════════════════════════════════════════════════════
//  OFFLINE
// ════════════════════════════════════════════════════════
function showOfflineBanner(offline){
  document.getElementById('offline-banner').classList.toggle('show', offline);
}
window.addEventListener('online',  ()=>{ showOfflineBanner(false); syncPendingQueue(); });
window.addEventListener('offline', ()=>{ showOfflineBanner(true);  });

function getPendingQueue(){try{return JSON.parse(localStorage.getItem('aceuro_pending')||'[]');}catch{return [];}}
function savePendingQueue(q){try{localStorage.setItem('aceuro_pending',JSON.stringify(q));}catch{}}

async function syncPendingQueue(){
  const q=getPendingQueue();
  if(!q.length)return;
  const user=window._currentUser;
  if(!user)return;
  for(let i=q.length-1;i>=0;i--){
    try{
      await window._fb.addDoc(window._fb.collection(window._fb.db,'zakazky'),{...q[i],_offline:true});
      q.splice(i,1);
      savePendingQueue(q);
    }catch(e){break;}
  }
  updatePendingBadge();
}

function updatePendingBadge(){
  const q=getPendingQueue();
  const badge=document.getElementById('pending-badge');
  badge.classList.toggle('show',q.length>0);
  if(q.length) badge.textContent='⏳ '+q.length+' ve frontě';
}

async function checkPendingUploads(){
  updatePendingBadge();
  if(navigator.onLine)await syncPendingQueue();
}

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════

function showRegister(){
  document.getElementById('login-screen').querySelector('.login-card').style.display='none';
  document.getElementById('register-card').style.display='';
}
function showLogin(){
  document.getElementById('register-card').style.display='none';
  document.getElementById('login-screen').querySelector('.login-card').style.display='';
}

async function doRegister(){
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim();
  const pass=document.getElementById('r-pass').value;
  const pass2=document.getElementById('r-pass2').value;
  const err=document.getElementById('r-err');
  const btn=document.getElementById('r-btn');
  err.style.display='none';
  if(!name||!email||!pass){err.textContent='Vyplňte všechna pole.';err.style.display='block';return;}
  if(pass!==pass2){err.textContent='Hesla se neshodují.';err.style.display='block';return;}
  if(pass.length<6){err.textContent='Heslo musí mít alespoň 6 znaků.';err.style.display='block';return;}
  btn.disabled=true; btn.textContent='Registruji...';
  try{
    window._registerDisplayName = name;
    window._registerFirma = document.getElementById('r-firma')?.value || 'ac';
    await window._fb.createUserWithEmailAndPassword(window._fb.auth, email, pass);
  }catch(e){
    if(e.code==='auth/pending-approval'){
      err.style.color='#16a34a';
      err.textContent='Registrace proběhla ✓ Čeká na schválení administrátorem.';
      err.style.display='block';
      btn.disabled=false; btn.textContent='Zaregistrovat se';
      return;
    }
    err.style.color='var(--err)';
    err.textContent=e.message||'Chyba registrace';
    err.style.display='block';
    btn.disabled=false; btn.textContent='Zaregistrovat se';
  }
}

async function loginEmail(){
  const email=document.getElementById('l-email').value.trim();
  const pass=document.getElementById('l-pass').value;
  const btn=document.getElementById('btn-login');
  const err=document.getElementById('login-err');
  err.style.display='none';
  if(!email||!pass){showLoginErr('Vyplňte e-mail a heslo.');return;}
  btn.disabled=true;btn.textContent='Přihlašuji...';
  try{await window._fb.signInWithEmailAndPassword(window._fb.auth,email,pass);}
  catch(e){showLoginErr(authErrMsg(e.code));btn.disabled=false;btn.textContent='Přihlásit se';}
}
async function loginGoogle(){
  alert('Přihlášení přes Google není dostupné v lokálním režimu.\nPoužijte přihlášení e-mailem a heslem.');
}
function authErrMsg(c){const m={'auth/invalid-credential':'Nesprávný e-mail nebo heslo.','auth/user-not-found':'Účet nenalezen.','auth/wrong-password':'Nesprávné heslo.','auth/too-many-requests':'Příliš mnoho pokusů.','auth/popup-closed-by-user':'Přihlášení zrušeno (zavřeli jste okno).','auth/popup-blocked':'Prohlížeč blokuje přihlašovací okno — viz tip níže.','auth/network-request-failed':'Chyba sítě.'};return m[c]||'Chyba: '+c;}
function showLoginErr(msg){const e=document.getElementById('login-err');e.textContent=msg;e.style.display='block';}
async function doSignOut(){if(!confirm('Odhlásit se?'))return;saveDraft();await window._fb.signOut(window._fb.auth);}

// ════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════
function goTo(n){
  // Pouze step-0 až step-6 panely (ne sl-panel, tab-panel atd.)
  for(let i=0;i<=6;i++){
    const p=document.getElementById('step-'+i);
    if(p) p.classList.toggle('active',i===n);
  }
  document.querySelectorAll('.stab').forEach((t,i)=>{
    t.classList.remove('active','done');
    if(i<n)t.classList.add('done');
    if(i===n)t.classList.add('active');
  });
  step=n;
  if(n===5){buildPreview();resizeSigPreviews();}
  if(n===6)buildSubmitSummary();
  window.scrollTo({top:0,behavior:'smooth'});
  saveDraft();
}
function nextStep(from){if(from===0&&!validate0())return;goTo(from+1);}
function validate0(){
  let ok=true;
  [['f_nazev','e_nazev'],['f_cislo','e_cislo']].forEach(([fi,ei])=>{
    const el=document.getElementById(fi);
    const empty=!el.value.trim();
    el.classList.toggle('err',empty);
    document.getElementById(ei).classList.toggle('show',empty);
    if(empty)ok=false;
    else el.addEventListener('input',()=>{el.classList.remove('err');document.getElementById(ei).classList.remove('show');},{once:true});
  });
  return ok;
}

// ════════════════════════════════════════════════════════
//  DOTTED LINES
// ════════════════════════════════════════════════════════
function buildDotLines(wrapId,taId,lines){
  const wrap=document.getElementById(wrapId);
  wrap.style.cssText='position:relative;height:'+(LINE_H*lines)+'px';
  for(let i=0;i<lines;i++){const d=document.createElement('div');d.className='dotline-row';wrap.appendChild(d);}
  const ta=document.createElement('textarea');
  ta.id=taId;ta.className='dotlines-ta';
  ta.style.cssText='height:'+(LINE_H*lines)+'px;width:100%';
  ta.spellcheck=false;
  ta.addEventListener('input',()=>{
    while(ta.scrollHeight>LINE_H*lines+6&&ta.value.length>0)ta.value=ta.value.slice(0,-1);
    saveDraft();
  });
  wrap.appendChild(ta);
}
buildDotLines('prace-wrap','f_prace',11);
buildDotLines('pozn-wrap','f_pozn',4);

// ════════════════════════════════════════════════════════
//  ITEMS TABLE + AUTOCOMPLETE
// ════════════════════════════════════════════════════════
function buildItemsTable(){
  const tb=document.getElementById('items-tbody');
  for(let i=1;i<=8;i++){
    const tr=document.createElement('tr');
    tr.innerHTML=
      `<td><input type="text"   id="pol${i}" autocomplete="off" maxlength="60" oninput="showAutocomplete(this,document.getElementById('cen${i}'));saveDraft()"></td>`+
      `<td><input type="number" id="poc${i}" min="0" step="1"    oninput="calcRow(${i})" onchange="calcRow(${i})" placeholder="0"></td>`+
      `<td><input type="number" id="cen${i}" min="0" step="0.01" oninput="calcRow(${i})" onchange="calcRow(${i})" placeholder="0,00"></td>`+
      `<td class="cel"><input id="cel${i}" readonly tabindex="-1"></td>`;
    tb.appendChild(tr);
  }
  const etb=document.getElementById('ext-tbody');
  for(let i=1;i<=3;i++){
    const tr=document.createElement('tr');
    tr.innerHTML=
      `<td><input type="text" value="${esc(EXT_LABELS[i-1])}" readonly style="color:var(--lt)"></td>`+
      `<td><input type="number" id="epoc${i}" min="0" step="${EXT_STEPS[i-1]}" oninput="calcExt(${i})" onchange="calcExt(${i})" placeholder="0"></td>`+
      `<td><input type="number" id="ecen${i}" min="0" step="1" oninput="calcExt(${i})" onchange="calcExt(${i})" placeholder="0,00"></td>`+
      `<td class="cel"><input id="ecel${i}" readonly tabindex="-1"></td>`;
    etb.appendChild(tr);
  }
}
buildItemsTable();

function calcRow(i){const p=parseFloat(document.getElementById('poc'+i).value)||0,c=parseFloat(document.getElementById('cen'+i).value)||0;document.getElementById('cel'+i).value=p*c?fmt(p*c):'';calcTotal();saveDraft();}
function calcExt(i){const p=parseFloat(document.getElementById('epoc'+i).value)||0,c=parseFloat(document.getElementById('ecen'+i).value)||0;document.getElementById('ecel'+i).value=p*c?fmt(p*c):'';calcTotal();saveDraft();}
function calcTotal(){let t=0;for(let i=1;i<=8;i++)t+=parseFloat((document.getElementById('cel'+i).value||'0').replace(/\s/g,'').replace(',','.'))||0;for(let i=1;i<=3;i++)t+=parseFloat((document.getElementById('ecel'+i).value||'0').replace(/\s/g,'').replace(',','.'))||0;document.getElementById('cena_total').textContent=fmt(t)+' Kč';}
function skipPrices(){pricesSkipped=true;goTo(3);}

// ════════════════════════════════════════════════════════
//  PHOTOS
// ════════════════════════════════════════════════════════
// Komprese fotky před uložením
async function compressPhoto(file, maxW=1600, maxH=1200, quality=0.82) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if(w > maxW || h > maxH) {
          const ratio = Math.min(maxW/w, maxH/h);
          w = Math.round(w*ratio); h = Math.round(h*ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function addPhotos(input){
  const files=Array.from(input.files);
  if(!files.length)return;
  const prog=document.getElementById('upload-prog');
  const bar=document.getElementById('bar-fill');
  const msg=document.getElementById('upload-msg');
  prog.style.display='block';bar.style.width='0%';
  let done=0;
  const total=files.length;
  files.forEach(file=>{
    (async()=>{
      try{
        msg.textContent='Komprimuji '+file.name+'...';
        const dataUrl = await compressPhoto(file);
        const origKB = Math.round(file.size/1024);
        const compKB = Math.round(dataUrl.length*0.75/1024);
        const photoObj={dataUrl,cloudUrl:'',name:file.name,caption:'',addedAt:new Date().toISOString()};
        photos.push(photoObj);
        renderPhotos();
        if(navigator.onLine){
          try{
            const res=await fetch('/api/upload/base64',{
              method:'POST',
              headers:{'Content-Type':'application/json'},
              credentials:'include',
              body:JSON.stringify({dataUrl,filename:file.name})
            });
            if(res.ok){
              const j=await res.json();
              photoObj.cloudUrl=j.url;
              photoObj.dataUrl=''; // Nepotrebujeme lokalni kopii
              renderPhotos();
            } else {
              const err = await res.json().catch(()=>({error: res.status}));
              console.warn('Upload failed:', err);
              msg.textContent = '⚠ Upload selhal: ' + (err.error||res.status);
            }
          }catch(err){
            console.warn('Upload failed:',err);
            msg.textContent = '⚠ Chyba: ' + err.message;
          }
        }
        done++;
        bar.style.width=Math.round(done/total*100)+'%';
        msg.textContent='Nahráno '+done+' z '+total+(compKB<origKB?' · ušetřeno '+(origKB-compKB)+'KB':'');
        if(done===total){setTimeout(()=>prog.style.display='none',2000);}
        saveDraft();
      }catch(err){
        console.error('Foto chyba:',err);
        done++;
        if(done===total){setTimeout(()=>prog.style.display='none',1500);}
      }
    })();
  });
  input.value='';
}
function renderPhotos(){
  const grid=document.getElementById('photo-grid');
  grid.innerHTML='';
  photos.forEach((ph,i)=>{
    const div=document.createElement('div');
    div.className='photo-thumb';
    div.style.cssText='position:relative;display:flex;flex-direction:column;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:#fff';
    const statusDot=ph.cloudUrl?'':'<div style="position:absolute;top:5px;left:5px;width:8px;height:8px;border-radius:50%;background:#f0a500;border:1.5px solid #fff" title="Čeká na upload"></div>';
    div.innerHTML=`
      <div style="position:relative;cursor:pointer" onclick="openLightbox('${ph.dataUrl||ph.cloudUrl}','${(ph.caption||'').replace(/'/g,"\'")}',photos,${i})">
        <img src="${ph.dataUrl||ph.cloudUrl}" style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block">
        <button class="photo-del" onclick="event.stopPropagation();removePhoto(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
        ${statusDot}
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.45);color:#fff;font-size:10px;padding:3px 6px;${ph.caption?'':'display:none'}">${ph.caption||''}</div>
      </div>
      <div style="padding:4px 6px;background:#fafbfc">
        <input type="text" placeholder="Popis / anotace…" value="${(ph.caption||'').replace(/"/g,'&quot;')}"
          style="width:100%;border:none;outline:none;font-size:10.5px;font-family:inherit;background:transparent;color:var(--text);padding:1px 0"
          oninput="photos[${i}].caption=this.value;saveDraft();this.closest('.photo-thumb').querySelector('div[style*=absolute][style*=bottom]').textContent=this.value;this.closest('.photo-thumb').querySelector('div[style*=absolute][style*=bottom]').style.display=this.value?'':'none'">
      </div>`;
    grid.appendChild(div);
  });
  // Tlačítko stáhnout vše
  if(photos.length > 0){
    const dlAll = document.createElement('button');
    dlAll.type='button';
    dlAll.style.cssText='grid-column:1/-1;padding:9px;border:1.5px dashed var(--border);border-radius:8px;background:#fafbfc;cursor:pointer;font-size:12px;font-weight:600;color:var(--text);display:flex;align-items:center;justify-content:center;gap:6px';
    dlAll.innerHTML='⬇ Stáhnout všechny fotky ('+(photos.length)+')';
    dlAll.onclick=downloadAllPhotos;
    grid.appendChild(dlAll);
  }
  const add=document.createElement('label');
  add.className='photo-add';add.htmlFor='photo-input';
  add.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Přidat foto';
  grid.appendChild(add);
}

function removePhoto(idx) {
  if(idx < 0 || idx >= photos.length) return;
  // Pokud má cloudUrl, můžeme ji smazat ze serveru (nepovinné)
  photos.splice(idx, 1);
  renderPhotos();
  saveDraft();
}


// ════════════════════════════════════════════════════════
//  SUBMIT SUMMARY
// ════════════════════════════════════════════════════════
function buildSubmitSummary(){
  const cena=document.getElementById('cena_total').textContent;
  document.getElementById('submit-summary').innerHTML=
    `<strong>${esc(gv('f_nazev')||'—')}</strong> &nbsp;·&nbsp; ${esc(gv('f_cislo')||'—')}<br>`+
    `Zákazník: ${esc(gv('f_zakaznik')||'—')}<br>`+
    `Termín: ${fmtD(gv('f_termin'))||'—'}<br>`+
    `Fotografie: ${photos.length} ks<br>`+
    `Cena bez DPH: <strong>${cena}</strong>`+
    (pricesSkipped?`<br><span style="color:var(--warn)">⚠ Ceny přeskočeny — doplní kancelář</span>`:'');
}

// ════════════════════════════════════════════════════════
//  SUBMIT TO FIREBASE (with offline queue)
// ════════════════════════════════════════════════════════

// ── Extra signatories ────────────────────────────────────────────────────
function addExtraSignatory() {
  const container = document.getElementById('extra-signatories');
  if(!container) return;
  const n = container.children.length + 2; // 2., 3., ...
  const row = document.createElement('div');
  row.className = 'sig-foot';
  row.style.cssText = 'display:flex;align-items:center;gap:6px';
  row.innerHTML = `<label style="white-space:nowrap">${n}. Jméno a příjmení:</label>`
    + `<input type="text" id="extra-sig-${n}" placeholder="Přebírající osoba" autocomplete="off"`
    + ` style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--border);border-radius:6px">`
    + `<button onclick="this.parentElement.remove();renumberExtraSignatories()" `
    + `style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:15px;padding:0 4px" title="Odebrat">✕</button>`;
  container.appendChild(row);
}
function renumberExtraSignatories() {
  const container = document.getElementById('extra-signatories');
  if(!container) return;
  Array.from(container.children).forEach((row, i) => {
    const lbl = row.querySelector('label');
    if(lbl) lbl.textContent = `${i+2}. Jméno a příjmení:`;
    const inp = row.querySelector('input');
    if(inp) inp.id = `extra-sig-${i+2}`;
  });
}
function getExtraSignatories() {
  const c = document.getElementById('extra-signatories');
  if(!c) return [];
  return Array.from(c.querySelectorAll('input')).map(i=>i.value.trim()).filter(Boolean);
}

// ── Tisk servisního listu po odeslání ─────────────────────────────────────
function printSubmittedList() {
  const status = document.getElementById('pdf-status');
  if(status) status.textContent = 'Připravuji PDF...';
  const saved = window._lastSubmittedData;
  if(!saved) { if(status) status.textContent = '⚠ Data nejsou dostupná.'; return; }
  const d = {
    nazev:saved.nazev||'—', cislo:saved.cislo||'—',
    technik:saved.technik||'—', termin:saved.termin||'',
    prace:saved.prace||'—', pozn:saved.pozn||'',
    duzp:saved.duzp||'', firma:saved.firma||'aceuro',
    cena:saved.cena||'', pricesSkipped:saved.pricesSkipped||false,
    rows:saved.rows||[], exts:saved.exts||[],
    sd1:fmtD(saved.sd1)||saved.sd1||'', sd2:fmtD(saved.sd2)||saved.sd2||'',
    sig1:saved.sig1||'', sig2:saved.sig2||'',
    sig1name:saved.sig1name||'', sig2name:saved.sig2name||'',
    extraSignatories:saved.extraSignatories||[],
    photos:(saved.photos||[]).filter(Boolean),
    includePhotos:document.getElementById('print-photos-cb')?.checked||false,
    showPrices:true,
  };
  const pv = buildPrintView(d);
  const pc = document.getElementById('print-container');
  if(!pc){ if(status) status.textContent='⚠ print-container nenalezen'; return; }
  pc.innerHTML=''; pc.appendChild(pv);
  generatePDF({ statusEl: status, statusDone: '✓ PDF staženo.', filename: 'servisni-list-' + (d.cislo||'').replace(/[^a-zA-Z0-9]/g,'_') + '.pdf' });
}

async function submitZakazka(){
  const btn=document.getElementById('btn-submit');
  const status=document.getElementById('submit-status');
  const user=window._currentUser;
  if(!user){status.textContent='Nejste přihlášeni.';return;}

  btn.disabled=true;btn.innerHTML='⏳ Odesílám...';
  status.textContent='Připravuji data...';

  try { autoLockOnSave && autoLockOnSave(); } catch(e) {}
  const rows=[];
  for(let i=1;i<=8;i++)rows.push({pol:gv('pol'+i),poc:gv('poc'+i),cen:gv('cen'+i),cel:gv('cel'+i)});
  const exts=[];
  for(let i=1;i<=3;i++)exts.push({label:EXT_LABELS[i-1],poc:gv('epoc'+i),cen:gv('ecen'+i),cel:gv('ecel'+i)});

  const data={
    nazev:gv('f_nazev')||'—',cislo:gv('f_cislo')||'—',
    zakaznik:gv('f_zakaznik')||'',
    adresa:gv('f_adresa')||'',ico:gv('f_ico')||'',dic:gv('f_dic')||'',
      hodiny:parseFloat(document.getElementById('f_hodiny')?.value)||0,
      km:parseInt(document.getElementById('f_km')?.value)||0,
    firma:window._currentFirma||'aceuro',
    technik:(()=>{
      // Collect all technik rows
      const rows=document.querySelectorAll('#technici-list .tech-row');
      if(!rows.length) return user.displayName||user.email;
      const names=[];
      rows.forEach(row=>{
        const sel=row.querySelector('select');
        const vlastni=row.querySelector('input[type=text]');
        if(sel.value==='vlastni'&&vlastni.value.trim()){
          names.push(vlastni.value.trim());
        } else if(sel.value&&sel.value!=='vlastni'){
          const opt=sel.options[sel.selectedIndex];
          if(opt)names.push(opt.text);
        } else {
          // first row empty = přihlášený technik
          names.push(user.displayName||user.email);
        }
      });
      return names.filter(Boolean).join(', ')||user.displayName||user.email;
    })(),
    technici:(()=>{
      // Array of {name, uid} for billing purposes
      const rows=document.querySelectorAll('#technici-list .tech-row');
      if(!rows.length) return [{name:user.displayName||user.email,uid:user.uid,email:user.email}];
      const list=[];
      rows.forEach(row=>{
        const sel=row.querySelector('select');
        const vlastni=row.querySelector('input[type=text]');
        if(sel.value==='vlastni'){
          if(vlastni.value.trim()) list.push({name:vlastni.value.trim(),uid:'',email:''});
        } else if(sel.value){
          const tech=(_techList||[]).find(x=>x.uid===sel.value);
          if(tech) list.push({name:tech.name||tech.email||sel.value,uid:tech.uid,email:tech.email||''});
        } else {
          list.push({name:user.displayName||user.email,uid:user.uid,email:user.email});
        }
      });
      return list.filter(x=>x.name);
    })(),
    technikUid:user.uid,technikEmail:user.email,
    termin:gv('f_termin')||'',
    prace:gv('f_prace')||'',pozn:gv('f_pozn')||'',komentar:gv('f_komentar')||'',
    duzp:gv('f_duzp')||'',pricesSkipped,rows,exts,
    vedouci:gv('f_vedouci')||'',vedouciEmail:gv('f_vedouci_email')||'',
    cena:document.getElementById('cena_total').textContent,
    sig1:getSig(1),sig2:getSig(2),sd1:gv('sd1'),sd2:gv('sd2'),sig1name:gv('sig1-name'),sig2name:gv('sig2-name'),extraSignatories:getExtraSignatories(),
    photos:(photos||[]).filter(p=>p).map(p=>({cloudUrl:p.cloudUrl||'',name:p.name||'',caption:p.caption||'',dataUrl:p.cloudUrl?'':p.dataUrl||''})),
    stav:'nová',updatedAt:new Date().toISOString(),
  };

  if(!navigator.onLine){
    // Save to pending queue
    const q=getPendingQueue();
    q.push(data);
    savePendingQueue(q);
    updatePendingBadge();
    status.textContent='📵 Uloženo offline — odešle se po připojení.';
    status.style.color='var(--warn)';
    btn.innerHTML='➕ Začít novou zakázku';
    btn.style.background='var(--warn)';
    btn.onclick=resetForm;
    try{localStorage.removeItem('aceuro_draft_'+user.uid);}catch(e){}
    return;
  }

  try{
    status.textContent='Ukládám do databáze...';
    const docRef=await window._fb.addDoc(
      window._fb.collection(window._fb.db,'zakazky'),
      {...data,createdAt:window._fb.serverTimestamp(),updatedAt:window._fb.serverTimestamp()}
    );
    window._lastSubmittedData = {...data, sig1:getSig(1), sig2:getSig(2), sig1name:gv('sig1-name'), sig2name:gv('sig2-name'), extraSignatories:getExtraSignatories()};
    document.getElementById('pre-submit').style.display='none';
    document.getElementById('post-submit').style.display='block';
    localStorage.removeItem('aceuro_draft_'+user.uid);
  }catch(err){
    console.error('Submit error:',err);
    let msg='⚠ Chyba: '+err.message;
    if(err.code==='permission-denied'||err.message.includes('permission')){
      msg='⚠ Chyba oprávnění — kontaktujte správce systému';
    }
    status.textContent=msg;
    status.style.color='var(--err)';
    btn.disabled=false;btn.innerHTML='Zkusit znovu';
  }
}

// ════════════════════════════════════════════════════════
//  PRINT
// ════════════════════════════════════════════════════════
function printCustomer(){
  const status=document.getElementById('print-status');
  status.textContent='Připravuji...';
  const inclPhotos=document.getElementById('print-photos-cb')?.checked||false;
  const d={
    nazev:gv('f_nazev')||'—',cislo:gv('f_cislo')||'—',
    technik:(()=>{const rows=document.querySelectorAll('#technici-list .tech-row');if(!rows.length)return window._currentUser?.displayName||window._currentUser?.email||'';const names=[];rows.forEach(row=>{const sel=row.querySelector('select');const vl=row.querySelector('input[type=text]');if(sel&&sel.value==='vlastni'&&vl?.value.trim())names.push(vl.value.trim());else if(sel&&sel.value&&sel.value!=='vlastni')names.push(sel.options[sel.selectedIndex]?.text||sel.value);else names.push(window._currentUser?.displayName||'');});return names.filter(Boolean).join(', ')||window._currentUser?.displayName||'';})(),
    zakaznik:gv('f_zakaznik')||'',termin:gv('f_termin'),
    prace:gv('f_prace')||'—',pozn:gv('f_pozn')||'',duzp:gv('f_duzp')||'',
    firma:window._currentFirma||'aceuro',
    cena:'',pricesSkipped:true,
    rows:[],exts:EXT_LABELS.map(l=>({label:l,poc:'',cen:'',cel:''})),
    sd1:fmtD(gv('sd1')),sd2:fmtD(gv('sd2')),
    sig1:getSig(1),sig2:getSig(2),
    sig1name:gv('sig1-name'),sig2name:gv('sig2-name'),
    extraSignatories:getExtraSignatories(),
    photos:inclPhotos?photos:[],
    includePhotos:inclPhotos,
  };
  const pv=buildPrintView(d);
  const pc=document.getElementById('print-container');
  if(!pc){console.error('print-container nenalezen');return;}
  pc.innerHTML='';pc.appendChild(pv);
  generatePDF({ statusEl: status, statusDone: '✓ PDF staženo.', filename: 'servisni-list-zakaznik.pdf' });
}

// ════════════════════════════════════════════════════════
//  DRAFT
// ════════════════════════════════════════════════════════
function saveDraft(){
  const user=window._currentUser;if(!user)return;
  const ids=['f_nazev','f_cislo','f_zakaznik','f_adresa','f_ico','f_dic','f_termin','f_prace','f_pozn','f_duzp','sd1','sd2','f_technik_vlastni','f_komentar'];
  for(let i=1;i<=8;i++)ids.push('pol'+i,'poc'+i,'cen'+i,'cel'+i);
  for(let i=1;i<=3;i++)ids.push('epoc'+i,'ecen'+i,'ecel'+i);
  const d={pricesSkipped,sigs:_sigData,sig1name:gv('sig1-name'),sig2name:gv('sig2-name')};
  ids.forEach(id=>{const el=document.getElementById(id);if(el)d[id]=el.value;});
  d._photos=photos.map(p=>({dataUrl:p.dataUrl,cloudUrl:p.cloudUrl,name:p.name}));
  try{d.f_firma=_currentFirma;
  localStorage.setItem('aceuro_draft_'+user.uid,JSON.stringify(d));}catch(e){}
}

function loadDraft(){
  const user=window._currentUser;if(!user)return;
  const raw=localStorage.getItem('aceuro_draft_'+user.uid);
  if(!raw){setDefaultDates();return;}
  const d=JSON.parse(raw);
  pricesSkipped=d.pricesSkipped||false;
  if(d.sigs){_sigData=d.sigs;[1,2].forEach(updateSigPreview);}
  if(d.sig1name){const el=document.getElementById('sig1-name');if(el)el.value=d.sig1name;}
  if(d.sig2name){const el=document.getElementById('sig2-name');if(el)el.value=d.sig2name;}
  Object.keys(d).forEach(k=>{if(['pricesSkipped','_photos','sigs'].includes(k))return;const el=document.getElementById(k);if(el)el.value=d[k];});
  if(d._photos&&Array.isArray(d._photos)){photos=d._photos;renderPhotos();}
  calcTotal();
  setDefaultDates();
}

function setDefaultDates(){
  const today=new Date().toISOString().slice(0,10);
  ['f_termin','f_duzp','sd1','sd2','sl-termin','sl-sd1','sl-sd2','sl-duzp'].forEach(id=>{
    const el=document.getElementById(id);if(el&&!el.value)el.value=today;
  });
}

// ══ LOCK / UNLOCK POZNÁMKY A PRÁCE ══════════════════════
const _lockState = { prace: false, pozn: false };

function toggleLock(which){
  _lockState[which] = !_lockState[which];
  const locked = _lockState[which];
  const ta = document.getElementById('f_' + which);
  const btn = document.getElementById('lock-' + which + '-btn');
  const icon = document.getElementById('lock-' + which + '-icon');
  const label = document.getElementById('lock-' + which + '-label');
  if(ta){
    ta.readOnly = locked;
    ta.style.background = locked ? 'var(--locked,#f4f6fb)' : '';
    ta.style.color = locked ? 'var(--muted)' : '';
  }
  if(icon) icon.textContent = locked ? '🔒' : '🔓';
  if(label) label.textContent = locked ? 'Uzamčeno' : 'Odemčeno';
  if(btn){
    btn.style.background = locked ? '#f4f6fb' : '#fff';
    btn.style.borderColor = locked ? '#c8d4e4' : 'var(--border)';
    btn.style.color = locked ? 'var(--muted)' : 'var(--text)';
  }
}

function autoLockOnSave(){
  // Uzamkne obě pole po uložení
  if(!_lockState.prace) toggleLock('prace');
  if(!_lockState.pozn) toggleLock('pozn');
}

// ══ VEDOUCÍ DROPDOWN ═════════════════════════════════════
function populateVedouciDropdown(){
  const sel = document.getElementById('f_vedouci');
  if(!sel || !_techList) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— Nevybráno —</option>';
  _techList.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.email || u.uid;
    opt.textContent = (u.displayName || u.name || u.email) + (u.role==='admin'?' (Admin)':'');
    sel.appendChild(opt);
  });
  if(current) sel.value = current;
}


function resetForm(){
  if(typeof _lockState !== 'undefined'){_lockState.prace=false;_lockState.pozn=false;}
  setTimeout(function(){['prace','pozn'].forEach(function(w){var ta=document.getElementById('f_'+w);var ic=document.getElementById('lock-'+w+'-icon');var lb=document.getElementById('lock-'+w+'-label');if(ta){ta.readOnly=false;ta.style.background='';ta.style.color='';}if(ic)ic.textContent='🔓';if(lb)lb.textContent='Odemčeno';});},150);
  const _esC=document.getElementById('extra-signatories');if(_esC)_esC.innerHTML='';
  const user=window._currentUser;
  localStorage.removeItem('aceuro_draft_'+(user?.uid||''));
  photos=[];pricesSkipped=false;_sigData={1:null,2:null};['sig1-name','sig2-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['f_nazev','f_cislo','f_zakaznik','f_termin','f_prace','f_pozn','f_duzp','sd1','sd2','f_technik_vlastni','f_komentar'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  for(let i=1;i<=8;i++){['pol','poc','cen','cel'].forEach(p=>{const el=document.getElementById(p+i);if(el)el.value='';});}
  for(let i=1;i<=3;i++){['epoc','ecen','ecel'].forEach(p=>{const el=document.getElementById(p+i);if(el)el.value='';});}
  [1,2].forEach(updateSigPreview);
  renderPhotos();calcTotal();
  document.getElementById('pre-submit').style.display='block';
  document.getElementById('post-submit').style.display='none';
  document.getElementById('btn-submit').disabled=false;
  document.getElementById('submit-status').textContent='';
  goTo(0);setDefaultDates();
}

document.addEventListener('input',e=>{if(!e.target.closest('#print-container')&&!e.target.closest('#sig-fs'))saveDraft();});

// ═══════════════════════════════════════════════════════════════════
//  ZAKÁZKY ZE SEZNAMU + TECHNICI ZE SEZNAMU
// ═══════════════════════════════════════════════════════════════════

let _zakazkyList = [];   // {id, nazev, cislo, zakaznik}
let _techList    = [];   // {uid, name, email}
let _assignedZakazky = []; // zakazky assigned to this technik from kancelář

async function loadZakazkyList() {
  try {
    const snap = await window._fb.getDocs(
      window._fb.query(window._fb.collection(window._fb.db,'zakazky_typy'),
        window._fb.orderBy('nazev','asc'))
    );
    _zakazkyList = snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(e) {
    // Fallback: load from zakazky collection as unique names
    try {
      const snap2 = await window._fb.getDocs(
        window._fb.query(window._fb.collection(window._fb.db,'zakazky'),
          window._fb.orderBy('createdAt','desc'))
      );
      const seen = new Set();
      _zakazkyList = [];
      snap2.docs.forEach(d => {
        const z = d.data();
        const key = (z.nazev||'').trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          _zakazkyList.push({id: d.id, nazev: z.nazev, cislo: z.cislo||'', zakaznik: z.zakaznik||''});
        }
      });
    } catch(e2) {}
  }
  renderZakazkyDropdown();
}

function renderZakazkyDropdown() {
  const sel = document.getElementById('zakaz_select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Vyberte ze seznamu nebo zadejte vlastní —</option>' +
    '<option value="vlastni">✏ Vlastní (jednorázová) zakázka</option>' +
    (_zakazkyList.length ? '<optgroup label="──────────────────">' : '') +
    _zakazkyList.map(z =>
      `<option value="${esc(z.id)}">${esc(z.nazev||'—')}${z.zakaznik?' ('+esc(z.zakaznik)+')':''}</option>`
    ).join('') +
    (_zakazkyList.length ? '</optgroup>' : '');
  if (cur) sel.value = cur;
}

function onZakazSelect(val) {
  const infoDiv = document.getElementById('assigned-info');
  if (!val || val === 'vlastni') {
    document.getElementById('f_nazev').value = '';
    document.getElementById('f_cislo').value = '';
    document.getElementById('f_zakaznik').value = '';
    if(infoDiv) infoDiv.innerHTML = '';
    document.getElementById('f_nazev').focus();
    return;
  }
  const z = _zakazkyList.find(x => x.id === val) || _assignedZakazky.find(x => x.id === val);
  if (!z) return;
  if (z.nazev)     document.getElementById('f_nazev').value    = z.nazev;
  if (z.cislo)     document.getElementById('f_cislo').value    = z.cislo;
  if (z.zakaznik)  document.getElementById('f_zakaznik').value = z.zakaznik;
  if (z.termin)    document.getElementById('f_termin').value   = z.termin;
  // Show zadani (assigned work instructions)
  if(infoDiv){
    if(z.zadani){
      infoDiv.innerHTML = `
        <div style="margin-bottom:14px;padding:14px 16px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">
            📋 Zadání od kanceláře
          </div>
          <div style="font-size:13px;color:#1e3a5f;line-height:1.55;white-space:pre-wrap">${esc(z.zadani)}</div>
          ${z.termin?`<div style="margin-top:8px;font-size:11px;color:#2d5fa6;font-weight:600">📅 Termín: ${esc(fmtDate(z.termin))}</div>`:''}
        </div>`;
    } else {
      infoDiv.innerHTML = '';
    }
  }
}

async function reloadZakazkyList() {
  const btn = document.querySelector('[onclick="reloadZakazkyList()"]');
  if (btn) { btn.textContent = '⟳'; btn.disabled = true; }
  await loadZakazkyList();
  if (btn) { btn.textContent = '↻'; btn.disabled = false; }
}

// ── TECHNICI ──────────────────────────────────────────────────────

async function loadTechList() {
  try {
    const snap = await window._fb.getDocs(
      window._fb.collection(window._fb.db,'users')
    );
    _techList = snap.docs
      .map(d => ({uid: d.id, ...d.data()}))
      .filter(u => u.role === 'technik' || u.role === 'admin')
      .sort((a,b) => (a.name||'').localeCompare(b.name||''));
  } catch(e) { _techList = []; }
  if (document.getElementById('technici-list')) initTechRows();
  else renderTechDropdown();
  populateVedouciDropdown && populateVedouciDropdown();
}

function renderTechDropdown() {
  // Build all technik rows (called after _techList loaded)
  const container = document.getElementById('technici-list');
  if (!container) return;
  const rows = container.querySelectorAll('.tech-row');
  rows.forEach(row => {
    const sel = row.querySelector('select');
    if (!sel) return;
    const cur = sel.value;
    rebuildTechSelect(sel);
    if (cur) sel.value = cur;
  });
  // If no rows yet, init first row
  if (rows.length === 0) initTechRows();
}

function buildTechSelectOptions(excludeUids=[]) {
  const me = window._currentUser;
  return `<option value="">— ${esc(me?.displayName||me?.email||'Přihlášený technik')} (já) —</option>` +
    '<option value="vlastni">✏ Jiný / brigádník (zadat ručně)</option>' +
    (_techList.length ? '<optgroup label="──────────────────">' : '') +
    _techList
      .filter(u => u.uid !== me?.uid && !excludeUids.includes(u.uid))
      .map(u => `<option value="${esc(u.uid)}">${esc(u.name||u.email||u.uid)}</option>`)
      .join('') +
    (_techList.length ? '</optgroup>' : '');
}

function rebuildTechSelect(sel) {
  const cur = sel.value;
  // exclude UIDs already selected in other rows
  const allSels = document.querySelectorAll('.tech-row select');
  const taken = [];
  allSels.forEach(s => { if (s !== sel && s.value && s.value !== 'vlastni') taken.push(s.value); });
  sel.innerHTML = buildTechSelectOptions(taken);
  if (cur) sel.value = cur;
}

function initTechRows() {
  const container = document.getElementById('technici-list');
  if (!container) return;
  container.innerHTML = '';
  addTechRow();
}

function addTechRow() {
  const container = document.getElementById('technici-list');
  if (!container) return;
  const idx = container.querySelectorAll('.tech-row').length;
  const row = document.createElement('div');
  row.className = 'tech-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:start';

  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:#fff;color:var(--text)';
  rebuildTechSelect(sel);
  sel.addEventListener('change', () => onTechRowChange(row, sel));

  const vlastniInput = document.createElement('input');
  vlastniInput.type = 'text';
  vlastniInput.placeholder = 'Jméno brigádníka / externího technika';
  vlastniInput.style.cssText = 'flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%;display:none;margin-top:4px';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.innerHTML = '✕';
  removeBtn.title = 'Odebrat';
  removeBtn.style.cssText = 'padding:9px 10px;background:transparent;border:1.5px solid #d0d8e8;border-radius:7px;cursor:pointer;font-size:12px;color:#6b7a99;flex-shrink:0';
  removeBtn.style.display = idx === 0 ? 'none' : 'flex';
  removeBtn.addEventListener('click', () => { row.remove(); });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;display:flex;flex-direction:column';
  wrap.appendChild(sel);
  wrap.appendChild(vlastniInput);

  row.appendChild(wrap);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function onTechRowChange(row, sel) {
  const vlastni = row.querySelector('input[type=text]');
  if (sel.value === 'vlastni') {
    vlastni.style.display = 'block'; vlastni.focus();
  } else {
    vlastni.style.display = 'none'; vlastni.value = '';
  }
}

async function reloadTechList() {
  const btn = document.querySelector('[onclick="reloadTechList()"]');
  if (btn) { btn.textContent = '⟳'; btn.disabled = true; }
  await loadTechList();
  if (btn) { btn.textContent = '↻'; btn.disabled = false; }
}

function onTechSelect(val) {
  // legacy - no-op (kept for compatibility)
}





// ══ ZADÁNÍ A HISTORIE ═══════════════════════════════════════════════
function fmtDate(v){return fmtD(v);}  // alias

async function loadAssignedZakazky(user) {
  try {
    const db = window._fb.db;
    const col = window._fb.collection;
    const q = window._fb.collection;
    // Load zakazky where this user is the assignee or technik
    const email = user.email;
    const name = user.displayName || '';
    const snap = await window._fb.getDocs(
      window._fb.query(
        window._fb.collection(db, 'zakazky'),
        window._fb.orderBy('createdAt', 'desc'),
        window._fb.limit(50)
      )
    );
    _assignedZakazky = [];
    snap.docs.forEach(d => {
      const z = {id: d.id, ...d.data()};
      const isMe = z.assignedTo === name || z.assignedTo === email ||
                   z.technik === name || z.technik === email ||
                   (z.technikEmail && z.technikEmail === email);
      if(isMe) _assignedZakazky.push(z);
    });
    renderAssignedPanel();
  } catch(e) {
    console.warn('loadAssignedZakazky failed:', e.message);
  }
}

// ══ FIRMA SWITCHER ══════════════════════════════════════════════════

const PROGRES_LOGO = "/img/logo-progres.jpeg";
const FIRMA_DATA = {
  aceuro: {
    name: 'AC EURO a.s.',
    addr: 'Houbalova 2553/4, 628 00 Brno',
    ic: '28264347', dic: 'CZ28264347',
    tel: '544 234 330', web: 'www.aceuro.cz',
    color: '#6abf3e', dark: '#0f1f3d', logo: null, // logo set after LOGO_DATA
    class: 'brand-aceuro'
  },
  progres: {
    name: 'Progresklima CZ s.r.o.',
    addr: 'Sekaninova 2706/27, 616 00 Brno',
    ic: '26299442', dic: 'CZ26299442',
    tel: '546 220 831', web: 'www.progresklima.cz',
    color: '#1e90ff', dark: '#0a3d8f', logo: null,
    class: 'brand-progres'
  }
};

function setFirma(firma) {
  _currentFirma = firma;
  const fd = FIRMA_DATA[firma];
  // Body class
  document.body.classList.remove('brand-aceuro','brand-progres');
  document.body.classList.add(fd.class);
  // Buttons
  const btnAC = document.getElementById('btn-firma-aceuro');
  const btnPR = document.getElementById('btn-firma-progres');
  if(btnAC){
    const isAC = firma === 'aceuro';
    btnAC.style.border = isAC ? '2px solid #6abf3e' : '2px solid #d0d8e8';
    btnAC.style.background = isAC ? '#f0fff4' : '#fff';
    btnAC.style.color = isAC ? '#0f1f3d' : '#6b7a99';
    btnPR.style.border = !isAC ? '2px solid #1e90ff' : '2px solid #d0d8e8';
    btnPR.style.background = !isAC ? '#eff6ff' : '#fff';
    btnPR.style.color = !isAC ? '#0a3d8f' : '#6b7a99';
  }
  // Update topbar accent line color
  const topbarLine = document.getElementById('topbar-accent');
  if(topbarLine) topbarLine.style.background = fd.color;
  // Store in draft
  saveDraft && saveDraft();
}

// ══ ARES NAŠEPTÁVAČ ══════════════════════════════════════════════════
let _aresTimer = null;
let _aresActive = false;

function aresDebounce(val) {
  clearTimeout(_aresTimer);
  const dropdown = document.getElementById('ares-dropdown');
  const loading = document.getElementById('ares-loading');
  if (!val || val.length < 2) {
    if(dropdown) dropdown.style.display = 'none';
    return;
  }
  if(loading) loading.style.display = 'block';
  _aresTimer = setTimeout(() => aresSearch(val), 500);
}

async function aresSearch(query) {
  const dropdown = document.getElementById('ares-dropdown');
  const loading = document.getElementById('ares-loading');
  if (!dropdown) return;
  try {
    // ARES API — ekonomické subjekty
    const isICO = /^\d{6,8}$/.test(query.trim());
    let url;
    if (isICO) {
      url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${query.trim()}`;
    } else {
      url = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr?nazev=${encodeURIComponent(query)}&pocet=8&razeni=NAZEV`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('ARES error');
    const data = await res.json();
    
    let items = [];
    if (isICO && data.ico) {
      items = [data];
    } else if (data.ekonomickeSubjekty) {
      items = data.ekonomickeSubjekty;
    }
    
    if (!items.length) {
      dropdown.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:var(--muted)">Nic nenalezeno v ARESu</div>';
      dropdown.style.display = 'block';
    } else {
      dropdown.innerHTML = items.map(s => {
        const ico = s.ico || '';
        const nazev = s.obchodniJmeno || s.nazev || '';
        const adresa = formatAresAddr(s);
        return `<div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid #f0f2f7;font-family:inherit"
          onmouseenter="this.style.background='#eff6ff'"
          onmouseleave="this.style.background=''"
          onclick='aresSelect(${JSON.stringify({ico,nazev,adresa,dic:s.dic||""})})'>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(nazev)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">IČO: ${ico} ${adresa?'· '+adresa:''}</div>
        </div>`;
      }).join('');
      dropdown.style.display = 'block';
    }
  } catch(e) {
    dropdown.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:var(--muted)">ARES nedostupný — zadejte ručně</div>`;
    dropdown.style.display = 'block';
  }
  if(loading) loading.style.display = 'none';
}

function formatAresAddr(s) {
  if (!s.sidlo) return '';
  const sid = s.sidlo;
  const parts = [
    sid.nazevUlice ? (sid.nazevUlice + (sid.cisloDomovni?' '+sid.cisloDomovni:'') + (sid.cisloOrientacni?'/'+sid.cisloOrientacni:'')) : '',
    sid.nazevObce||'',
    sid.psc ? String(sid.psc).replace(/(\d{3})(\d{2})/,'$1 $2') : ''
  ].filter(Boolean);
  return parts.join(', ');
}

function aresSelect(s) {
  const inp = document.getElementById('f_zakaznik');
  if(inp) inp.value = s.nazev;
  const addr = document.getElementById('f_adresa');
  if(addr) addr.value = s.adresa;
  const ico = document.getElementById('f_ico');
  if(ico) ico.value = s.ico;
  const dic = document.getElementById('f_dic');
  if(dic) dic.value = s.dic;
  const dropdown = document.getElementById('ares-dropdown');
  if(dropdown) dropdown.style.display = 'none';
  saveDraft && saveDraft();
}

// Close ARES dropdown on outside click
document.addEventListener('click', e => {
  if(!e.target.closest('#ares-dropdown') && !e.target.matches('#f_zakaznik')){
    const d = document.getElementById('ares-dropdown');
    if(d) d.style.display = 'none';
  }
});

function toggleCalendar() {
  const strip = document.getElementById('calendar-strip');
  if (!strip) return;
  const visible = strip.style.display !== 'none';
  strip.style.display = visible ? 'none' : 'block';
  if (!visible) renderCalendarStrip();
  updateCalBadge();
}

function updateCalBadge() {
  const badge = document.getElementById('cal-badge');
  if (!badge) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const future = new Date(today.getTime() + 14*86400000);
  const count = (_assignedZakazky||[]).filter(z => {
    if (!z.termin) return false;
    const d = new Date(z.termin);
    return d >= today && d < future && !['zpracovaná','fakturovaná'].includes(z.stav||'');
  }).length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
}

function renderCalendarStrip() {
  const strip = document.getElementById('calendar-strip');
  const calDays = document.getElementById('cal-days');
  if (!strip || !calDays) return;

  const today = new Date();
  today.setHours(0,0,0,0);
  const DAYS = 14;
  const dayNames = ['Ne','Po','Út','St','Čt','Pá','So'];
  const monthNames = ['led','úno','bře','dub','kvě','čvn','čvc','srp','zář','říj','lis','pro'];

  // Sestavit mapu termin -> [zakazky]
  const byDate = {};
  (_assignedZakazky || []).forEach(z => {
    if (!z.termin) return;
    const key = z.termin.substring(0,10); // YYYY-MM-DD
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(z);
  });

  const hasSomething = Object.keys(byDate).some(k => {
    const d = new Date(k);
    return d >= today && d < new Date(today.getTime() + DAYS*86400000);
  });

  strip.style.display = 'block';

  let html = '';
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(today.getTime() + i*86400000);
    const key = d.toISOString().substring(0,10);
    const items = byDate[key] || [];
    const isToday = i === 0;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const bg = isToday ? '#0f1f3d' : isWeekend ? '#f4f6fa' : '#fff';
    const col = isToday ? '#fff' : isWeekend ? '#9aaac4' : '#1a2540';
    const border = items.length ? '#2d5fa6' : (isToday ? 'transparent' : 'var(--border)');

    html += `<div style="flex:0 0 52px;min-width:52px;border:1.5px solid ${border};border-radius:8px;background:${bg};padding:5px 4px;text-align:center;cursor:${items.length?'pointer':'default'}"
      ${items.length ? `onclick="calDayClick('${key}')"
        onmouseenter="this.style.background='#eff6ff';this.style.borderColor='#93c5fd'"
        onmouseleave="this.style.background='${bg}';this.style.borderColor='${border}'"` : ''}>
      <div style="font-size:9px;font-weight:700;color:${isToday?'rgba(255,255,255,.65)':isWeekend?'#b0bdd4':'#6b7a99'};text-transform:uppercase;letter-spacing:.04em">${dayNames[d.getDay()]}</div>
      <div style="font-size:17px;font-weight:700;color:${col};line-height:1.2;margin:2px 0">${d.getDate()}</div>
      <div style="font-size:8px;color:${isToday?'rgba(255,255,255,.5)':isWeekend?'#b0bdd4':'#9aaac4'};margin-bottom:4px">${monthNames[d.getMonth()]}</div>
      ${items.length ? `<div style="display:flex;justify-content:center;gap:2px;flex-wrap:wrap">
        ${items.slice(0,3).map(z => `<div style="width:6px;height:6px;border-radius:50%;background:${isToday?'#6abf3e':'#2d5fa6'}" title="${esc(z.nazev)}"></div>`).join('')}
        ${items.length > 3 ? `<div style="font-size:8px;color:${isToday?'#a0e070':'#2d5fa6'};font-weight:700">+${items.length-3}</div>` : ''}
      </div>` : `<div style="font-size:8px;color:${isToday?'rgba(255,255,255,.3)':'#d0d8e8'}">—</div>`}
    </div>`;
  }
  calDays.innerHTML = html;
}

function calDayClick(dateKey) {
  // Najít zakázky pro tento den a nabídnout výběr
  const items = (_assignedZakazky || []).filter(z => (z.termin||'').substring(0,10) === dateKey);
  if (!items.length) return;
  if (items.length === 1) {
    selectAssignedZakazka(items[0].id);
    return;
  }
  // Více zakázek — zobrazit v assigned-panel filtrovane na tento den
  const panel = document.getElementById('assigned-panel');
  if (!panel) return;
  // Scroll to step 0
  goTo(0);
  // Highlight the day's zakazky at top
  const stavIcon = {'nová':'🆕','ke zpracování':'👁','rozpracovaná':'🔧','na cestě':'🚗','zpracovaná':'✅','fakturovaná':'🧾','zaplacena':'💰'};
  const stavColor = {'nová':'#f0a500','ke zpracování':'#2d5fa6','rozpracovaná':'#d97706','na cestě':'#b45309','zpracovaná':'#16a34a','fakturovaná':'#7c3aed','zaplacena':'#059669'};
  const d = new Date(dateKey);
  const dayStr = d.toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});
  panel.innerHTML = `<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:6px">📅 ${dayStr}</div>` +
    items.map(z => {
      const stav = z.stav||'nová';
      const col = stavColor[stav]||'#6b7a99';
      return `<div style="padding:10px 12px;background:#fff;border:1.5px solid #93c5fd;border-radius:8px;margin-bottom:6px;cursor:pointer;display:flex;gap:10px;align-items:flex-start"
        onclick="selectAssignedZakazka('${z.id}')"
        onmouseenter="this.style.background='#f0f7ff'"
        onmouseleave="this.style.background='#fff'">
        <div style="font-size:18px">${stavIcon[stav]||'📋'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;color:var(--navy)">${esc(z.nazev||'—')}</div>
          <div style="font-size:11px;color:var(--muted)">${esc(z.cislo||'')}</div>
          ${z.zadani ? `<div style="font-size:11px;color:#1d4ed8;margin-top:3px;font-style:italic">${esc(z.zadani.substring(0,80))}${z.zadani.length>80?'…':''}</div>` : ''}
        </div>
        <div style="font-size:10px;font-weight:600;color:${col};background:${col}18;padding:2px 7px;border-radius:20px;white-space:nowrap">${stav}</div>
      </div>`;
    }).join('');
}

function renderAssignedPanel() {
  const container = document.getElementById('assigned-panel');
  if(!container) return;
  const open = _assignedZakazky.filter(z => !['zpracovaná','fakturovaná','zaplacena'].includes(z.stav||'nová'));
  if(!open.length){
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic;text-align:center;padding:12px">Žádné přiřazené zakázky</div>';
    return;
  }
  const stavIcon = {'nová':'🆕','ke zpracování':'👁','rozpracovaná':'🔧','zpracovaná':'✅','fakturovaná':'🧾'};
  const stavColor = {'nová':'#f0a500','ke zpracování':'#2d5fa6','rozpracovaná':'#d97706','zpracovaná':'#16a34a','fakturovaná':'#7c3aed'};
  container.innerHTML = open.map(z => {
    const stav = z.stav||'nová';
    const col = stavColor[stav]||'#6b7a99';
    return `<div style="padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer;display:flex;gap:10px;align-items:flex-start"
      onclick="selectAssignedZakazka('${z.id}')"
      onmouseenter="this.style.borderColor='#93c5fd';this.style.background='#f0f7ff'"
      onmouseleave="this.style.borderColor='var(--border)';this.style.background='#fff'">
      <div style="font-size:18px;flex-shrink:0">${stavIcon[stav]||'📋'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(z.nazev||'—')}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${esc(z.cislo||'')}${z.termin?' · 📅 '+fmtD(z.termin):''}</div>
        ${z.zadani?`<div style="font-size:11px;color:#1d4ed8;margin-top:3px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📋 ${esc(z.zadani.substring(0,50))}${z.zadani.length>50?'…':''}</div>`:''}
        ${z.adresa?`<a href="https://maps.google.com/?q=${encodeURIComponent(z.adresa)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:11px;color:#059669;margin-top:2px;display:inline-flex;align-items:center;gap:3px;text-decoration:none;font-weight:600">📍 ${esc(z.adresa.substring(0,40))}</a>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <div style="font-size:10px;font-weight:600;color:${col};background:${col}18;padding:2px 7px;border-radius:20px;white-space:nowrap">${stav}</div>
        <button onclick="event.stopPropagation();downloadZakazkaSouhrn('${z.id}')" style="font-size:10px;padding:2px 8px;border-radius:6px;border:1px solid #93c5fd;background:#eff6ff;cursor:pointer;color:#1d4ed8;white-space:nowrap">
          📄 Souhrn
        </button>
        ${stav!=='zpracovaná'&&stav!=='zaplacena'?`<button onclick="event.stopPropagation();techUpdateStav('${z.id}','${stav}')" style="font-size:10px;padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:#fff;cursor:pointer;color:var(--text);white-space:nowrap">
          ${stav==='na cestě'?'✅ Dokončit':'🚗 Na cestě'}
        </button>`:''}
      </div>
    </div>`;
  }).join('');
}
  renderCalendarStrip();


function selectAssignedZakazka(id) {
  const z = _assignedZakazky.find(x => x.id === id);
  if(!z) return;
  // Pre-fill step-0 form
  document.getElementById('f_nazev').value = z.nazev||'';
  document.getElementById('f_cislo').value = z.cislo||'';
  document.getElementById('f_zakaznik').value = z.zakaznik||'';
  if(z.termin) document.getElementById('f_termin').value = z.termin;
  // Show zadani
  const infoDiv = document.getElementById('assigned-info');
  if(infoDiv){
    if(z.zadani){
      infoDiv.innerHTML = `
        <div style="margin-bottom:14px;padding:14px 16px;background:#eff6ff;border:1.5px solid #93c5fd;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:#1d4ed8;letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px">
            📋 Zadání od kanceláře
          </div>
          <div style="font-size:13px;color:#1e3a5f;line-height:1.55;white-space:pre-wrap">${esc(z.zadani)}</div>
          ${z.termin?`<div style="margin-top:8px;font-size:11px;color:#2d5fa6;font-weight:600">📅 Termín: ${esc(fmtD(z.termin))}</div>`:''}
        </div>`;
    } else {
      infoDiv.innerHTML = '';
    }
  }
  // Scroll to step 0 / go to step 0
  goTo(0);
}
