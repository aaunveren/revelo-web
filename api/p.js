import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).send(errorPage('Bad Request', 'Link ID eksik.'));

  let share;
  try {
    share = await kv.get(`share:${id}`);
  } catch (e) {
    console.error('[api/p] kv error', e);
    return res.status(500).send(errorPage('Sunucu Hatası', 'Bir sorun oluştu.'));
  }

  if (!share) return res.status(404).send(expiredPage());
  if (share.expiresAt < Date.now()) return res.status(410).send(expiredPage());

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.send(buildPage(share));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function h2r(hex, a) {
  try {
    hex = (hex || '#000000').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return `rgba(${r},${g},${b},${a})`;
  } catch(e) { return `rgba(0,0,0,${a})`; }
}

function fmtExpiry(ts) {
  return new Date(ts).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
}

function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'Süresi doldu';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return h + ' saat';
  return Math.floor(h / 24) + ' gün';
}

// ─── Slider HTML (uses EXACT same revelo-* classes as index.html) ────────────

function buildStyle(cfg) {
  const hc  = cfg.hcolor  || '#ffffff';
  const ac  = cfg.acolor  || '#111111';
  const hs  = parseInt(cfg.hsize  || 50);
  const cs  = Math.round(hs * 0.8);
  const sH  = cfg.showH   !== false;
  const sS  = cfg.showSep !== false;
  const sL  = cfg.showL   !== false;
  const ls  = parseInt(cfg.lsize  || 11);
  const lf  = cfg.lfont   || 'inherit';
  const lc  = cfg.lcolor  || '#ffffff';
  const sLb = cfg.showLbg !== false;
  const lb  = cfg.lbg     || '#000000';
  const r   = cfg.radius  || '8px';
  const lbv = sLb ? h2r(lb, 0.82) : 'transparent';
  return [
    `--revelo-handle:${hc}`,
    `--revelo-arrow:${ac}`,
    `--revelo-circle-size:${cs}px`,
    `--revelo-circle-vis:${sH ? 'visible' : 'hidden'}`,
    `--revelo-line-vis:${sS ? 'visible' : 'hidden'}`,
    `--revelo-radius:${r}`,
    `--revelo-label-vis:${sL ? 'visible' : 'hidden'}`,
    `--revelo-label-bg:${lbv}`,
    `--revelo-label-color:${lc}`,
    `--revelo-label-font:${lf}`,
    `--revelo-label-size:${ls}px`,
  ].join(';');
}

function buildOneSlider(bKey, aKey, sfx, cfg, blobUrls, perLabels, isSingle) {
  const bSrc = blobUrls[bKey] || '';
  const aSrc = blobUrls[aKey] || '';

  const sp     = parseInt(cfg.start || 50);
  const orient = isSingle ? (cfg.orient || 'horizontal') : 'horizontal';
  const af     = cfg.autofit ? ' revelo-autofit' : '';
  const sL     = cfg.showL !== false;
  const lp     = cfg.lpos  || 'bottom';
  const intro  = cfg.intro !== false;
  const loop   = !!cfg.loop;
  const style  = buildStyle(cfg);

  const lb = (perLabels && perLabels[bKey]) || '';
  const la = (perLabels && perLabels[aKey]) || '';
  const lblB = sL && lb ? `<span class="revelo-label revelo-label-before">${esc(lb)}</span>` : '';
  const lblA = sL && la ? `<span class="revelo-label revelo-label-after">${esc(la)}</span>` : '';

  // Handle icon — matches getHI() in index.html
  const hIcon = blobUrls.handleLogo
    ? `<img src="${esc(blobUrls.handleLogo)}" class="revelo-handle-logo" alt="" draggable="false">`
    : `<svg viewBox="0 0 28 20" width="20" height="16" fill="none" aria-hidden="true"><polyline points="10,2 3,10 10,18" stroke="var(--revelo-arrow)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="18,2 25,10 18,18" stroke="var(--revelo-arrow)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

  // Overlay — matches getOV() in index.html
  let ov = '';
  if (blobUrls.overlay) {
    const opos  = cfg.opos  || 'top-right';
    const oopa  = (parseInt(cfg.oopa  || 80) / 100);
    const osize = cfg.osize || 20;
    const oinv  = cfg.oinv  ? 'filter:invert(1);' : '';
    ov = `<div class="revelo-logo-overlay revelo-logo-${esc(opos)}" style="opacity:${oopa};width:${osize}%;${oinv}"><img src="${esc(blobUrls.overlay)}" alt="" draggable="false"></div>`;
  }

  // HTML — matches buildOne() in index.html exactly
  return `<div class="revelo-slider${af}" id="rs${sfx}" data-start="${sp}" data-orientation="${esc(orient)}" data-intro="${intro}" data-loop="${loop}" data-label-pos="${esc(lp)}" role="group" aria-label="Before and after image comparison" style="${esc(style)}"><div class="revelo-clip"><div class="revelo-before"><img src="${esc(bSrc)}" alt="Before" draggable="false"></div><div class="revelo-after" aria-hidden="true"><img src="${esc(aSrc)}" alt="After" draggable="false"></div></div>${lblB}${lblA}<div class="revelo-handle" role="slider" tabindex="0" aria-label="Drag to compare" aria-valuemin="5" aria-valuemax="95" aria-valuenow="${sp}"><div class="revelo-handle-circle">${hIcon}</div></div>${ov}</div>`;
}

// ─── Page builder ────────────────────────────────────────────────────────────

function buildPage(share) {
  const { sliderConfig: cfg = {}, blobUrls = {}, mode = 1, theme = 'dark', expiresAt, id } = share;
  const perLabels = cfg.perLabels || {};
  const dark      = theme === 'dark';
  const bg        = dark ? '#0b0b0b' : '#f0f0f0';
  const fg        = dark ? '#ffffff' : '#111111';
  const fg2       = dark ? '#888888' : '#666666';
  const cardBg    = dark ? '#141414' : '#ffffff';
  const border    = dark ? '#1e1e1e' : '#e0e0e0';

  // Build slider(s)
  let sliderHtml = '';
  if (mode === 1) {
    sliderHtml = buildOneSlider('before', 'after', '1', cfg, blobUrls, perLabels, true);
  } else {
    sliderHtml = `<div class="revelo-gallery-grid" style="--rg-cols:${mode};--rg-gap:14px;">`;
    for (let i = 1; i <= mode; i++) {
      sliderHtml += buildOneSlider(`before${i}`, `after${i}`, i, cfg, blobUrls, perLabels, false);
    }
    sliderHtml += '</div>';
  }

  const title       = cfg.title || '';
  const sub         = cfg.sub   || '';
  const lf          = cfg.lfont || 'inherit';
  const expiresStr  = fmtExpiry(expiresAt);
  const timeLeftStr = timeLeft(expiresAt);
  const soonExpiry  = expiresAt - Date.now() < 7 * 24 * 3600 * 1000;

  return `<!DOCTYPE html>
<html lang="tr" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || 'Revelo Slider')}</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{min-height:100%;background:${bg};color:${fg};font-family:'Inter',system-ui,sans-serif;font-size:14px;}
.wrap{max-width:960px;margin:0 auto;padding:40px 24px 60px;}
.hdr{margin-bottom:24px;}
.hdr-title{font-size:22px;font-weight:700;color:${fg};line-height:1.2;font-family:${lf};}
.hdr-sub{font-size:13px;color:${fg2};margin-top:4px;font-family:${lf};}
/* Footer */
.fbar{margin-top:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.expiry{font-size:11px;color:${fg2};display:flex;align-items:center;gap:6px;}
.expiry-dot{width:7px;height:7px;border-radius:50%;background:${soonExpiry ? '#f59e0b' : '#22c55e'};flex-shrink:0;}
.extend-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:${dark?'#1a1a1a':'#f0f0f0'};border:1.5px solid ${dark?'#2a2a2a':'#d8d8d8'};border-radius:6px;font-size:11px;font-weight:600;color:${fg2};text-decoration:none;transition:all .15s;cursor:pointer;}
.extend-btn:hover{border-color:#6366f1;color:#6366f1;}
.brand{font-size:11px;color:${fg2};text-decoration:none;}
.brand span{color:#6366f1;font-weight:600;}
/* Extend modal */
#ext-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999;align-items:center;justify-content:center;}
#ext-modal.open{display:flex;}
.ext-card{background:${cardBg};border-radius:12px;padding:24px;width:320px;max-width:90vw;}
.ext-title{font-size:15px;font-weight:700;margin-bottom:6px;}
.ext-sub{font-size:12px;color:${fg2};margin-bottom:18px;line-height:1.5;}
.ext-tiers{display:flex;gap:8px;margin-bottom:16px;}
.ext-tier{flex:1;border:1.5px solid ${border};border-radius:8px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .15s;}
.ext-tier:hover,.ext-tier.sel{border-color:#6366f1;background:rgba(99,102,241,.08);}
.ext-tier .dur{font-size:12px;font-weight:700;color:${fg};}
.ext-tier .pr{font-size:11px;color:${fg2};margin-top:2px;}
.ext-pay{width:100%;height:38px;background:#6366f1;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;}
.ext-pay:hover{background:#818cf8;}
.ext-close{float:right;background:none;border:none;color:${fg2};cursor:pointer;font-size:18px;padding:0;margin-top:-2px;}

/* ── REVELO SLIDER CSS — exact copy from index.html ────────────────────── */
.revelo-slider{position:relative;overflow:visible;display:block;width:100%;max-width:var(--revelo-max-width,100%);margin:0 auto;user-select:none;-webkit-user-select:none;touch-action:none;cursor:ew-resize;}
.revelo-clip{position:relative;overflow:hidden;border-radius:var(--revelo-radius,8px);background:#e8e8e8;}
.revelo-before{position:relative;display:block;width:100%;line-height:0;}
.revelo-before img,.revelo-before .rph{display:block;width:100%;height:auto;pointer-events:none;-webkit-user-drag:none;}
.revelo-after{position:absolute;top:0;right:0;bottom:0;left:0;clip-path:inset(0 0 0 50%);will-change:clip-path;}
.revelo-after img,.revelo-after .rph{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none;}
.revelo-slider[data-orientation="vertical"]{cursor:ns-resize;}
.revelo-slider[data-orientation="vertical"] .revelo-after{clip-path:inset(50% 0 0 0);}
.revelo-slider[data-orientation="vertical"] .revelo-handle{top:50%;left:0;right:0;bottom:auto;width:100%;height:44px;flex-direction:row;transform:translateY(-50%);}
.revelo-handle{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:44px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;z-index:10;outline:none;}
.revelo-slider::before{content:'';position:absolute;top:0;bottom:0;left:var(--revelo-line-pos,50%);width:2px;background:var(--revelo-handle,#fff);transform:translateX(-50%);box-shadow:0 0 6px rgba(0,0,0,.3);pointer-events:none;z-index:9;transition:left var(--revelo-ltrans,0ms);visibility:var(--revelo-line-vis,visible);}
.revelo-handle-circle{width:var(--revelo-circle-size,40px);height:var(--revelo-circle-size,40px);border-radius:50%;overflow:hidden;background:var(--revelo-handle,#fff);box-shadow:0 2px 8px rgba(0,0,0,.25),0 0 0 2px rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative;z-index:1;transition:transform .15s,box-shadow .15s;visibility:var(--revelo-circle-vis,visible);}
.revelo-slider:hover .revelo-handle-circle{transform:scale(1.08);}
.revelo-slider:active .revelo-handle-circle{transform:scale(1.15);box-shadow:0 4px 16px rgba(0,0,0,.35),0 0 0 3px rgba(255,255,255,.5);}
.revelo-handle-circle svg{width:50%;height:auto;display:block;pointer-events:none;flex-shrink:0;}
.revelo-handle-logo{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;}
.revelo-label{position:absolute;bottom:12px;padding:.45em 1em;font-size:var(--revelo-label-size,11px);font-weight:700;line-height:1;letter-spacing:.04em;border-radius:4px;background:var(--revelo-label-bg,rgba(0,0,0,.72));color:var(--revelo-label-color,#fff);pointer-events:none;z-index:5;font-family:var(--revelo-label-font,inherit);white-space:nowrap;visibility:var(--revelo-label-vis,visible);}
.revelo-label-before{left:12px;}
.revelo-label-after{right:12px;}
.revelo-slider[data-label-pos="top"] .revelo-label{bottom:auto;top:12px;}
.revelo-slider[data-label-pos="center"] .revelo-label{bottom:auto;top:50%;transform:translateY(-50%);}
.revelo-slider[data-label-pos="center"] .revelo-label-before{left:12px;transform:translateY(-50%);}
.revelo-slider[data-label-pos="center"] .revelo-label-after{right:12px;transform:translateY(-50%);}
.revelo-logo-overlay{position:absolute;z-index:8;pointer-events:none;}
.revelo-logo-overlay img{display:block;width:100%;height:auto;}
.revelo-logo-top-left{top:12px;left:12px;}.revelo-logo-top-center{top:12px;left:50%;transform:translateX(-50%);}.revelo-logo-top-right{top:12px;right:12px;}.revelo-logo-bottom-left{bottom:12px;left:12px;}.revelo-logo-bottom-center{bottom:12px;left:50%;transform:translateX(-50%);}.revelo-logo-bottom-right{bottom:12px;right:12px;}.revelo-logo-center{top:50%;left:50%;transform:translate(-50%,-50%);}
.revelo-autofit .revelo-clip{aspect-ratio:1/1;}
.revelo-autofit .revelo-before{height:100%;}
.revelo-autofit .revelo-before img{height:100%;object-fit:cover;}
.revelo-gallery-grid{display:grid;gap:var(--rg-gap,14px);grid-template-columns:repeat(var(--rg-cols,2),1fr);}
.revelo-gallery-grid .revelo-slider{margin:0;}
@media(max-width:640px){.revelo-gallery-grid{grid-template-columns:1fr!important;}}
</style>
</head>
<body>
<div class="wrap">
${(title || sub) ? `<div class="hdr">${title ? `<div class="hdr-title">${esc(title)}</div>` : ''}${sub ? `<div class="hdr-sub">${esc(sub)}</div>` : ''}</div>` : ''}

<div id="pv-c">
  ${sliderHtml}
</div>

<div class="fbar">
  <div class="expiry">
    <div class="expiry-dot"></div>
    <span>${timeLeftStr} kaldı &mdash; ${expiresStr} tarihine kadar geçerli</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;">
    <button class="extend-btn" onclick="openExt()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Süreyi Uzat
    </button>
    <a class="brand" href="https://reveloslider.vercel.app" target="_blank">Made with <span>Revelo</span></a>
  </div>
</div>
</div>

<!-- Extend modal -->
<div id="ext-modal">
  <div class="ext-card">
    <button class="ext-close" onclick="closeExt()">&#x2715;</button>
    <div class="ext-title">Süreyi Uzat</div>
    <div class="ext-sub">Ödeme sonrası link mevcut sürenin üzerine eklenir.</div>
    <div class="ext-tiers">
      <div class="ext-tier sel" onclick="selT(this,'1mo')"><div class="dur">1 Ay</div><div class="pr">$2.99</div></div>
      <div class="ext-tier" onclick="selT(this,'3mo')"><div class="dur">3 Ay</div><div class="pr">$6.99</div></div>
      <div class="ext-tier" onclick="selT(this,'12mo')"><div class="dur">12 Ay</div><div class="pr">$19.99</div></div>
    </div>
    <button class="ext-pay" onclick="goPay()">Ödemeye Git</button>
  </div>
</div>

<script>
var SHARE_ID='${id}';
var selTier='1mo';
var CODAPAY_URLS={
  '1mo':'${process.env.CODAPAY_1MO_URL||"#"}',
  '3mo':'${process.env.CODAPAY_3MO_URL||"#"}',
  '12mo':'${process.env.CODAPAY_12MO_URL||"#"}'
};

function openExt(){document.getElementById('ext-modal').classList.add('open');}
function closeExt(){document.getElementById('ext-modal').classList.remove('open');}
function selT(el,t){selTier=t;document.querySelectorAll('.ext-tier').forEach(function(x){x.classList.remove('sel');});el.classList.add('sel');}
function goPay(){
  var url=CODAPAY_URLS[selTier];
  if(!url||url==='#'){alert('Ödeme URL\\'si henüz yapılandırılmamış.');return;}
  var full=url+(url.includes('?')?'&':'?')+'custom='+encodeURIComponent(SHARE_ID)+'&tier='+selTier;
  window.open(full,'_blank');
  closeExt();
}

/* ── SLIDER ENGINE — exact copy from index.html ──────────────────────────── */
function setPos(s,a,h,v,sp,pct){
  pct=Math.min(95,Math.max(5,pct));
  if(v){a.style.clipPath='inset('+pct+'% 0 0 0)';h.style.top=pct+'%';h.style.left='50%';s.style.setProperty('--revelo-line-pos','50%');}
  else{a.style.clipPath='inset(0 0 0 '+pct+'%)';h.style.left=pct+'%';h.style.top='50%';s.style.setProperty('--revelo-line-pos',pct+'%');}
  h.setAttribute('aria-valuenow',Math.round(pct));
}
function initSlider(slider){
  var a=slider.querySelector('.revelo-after'),h=slider.querySelector('.revelo-handle');if(!a||!h)return;
  delete slider.dataset.reveloDone;slider.dataset.reveloDone='1';
  var v=slider.dataset.orientation==='vertical',sp=parseFloat(slider.dataset.start)||50;
  var si=slider.dataset.intro!=='false',sl=slider.dataset.loop==='true';
  var drag=false,ip=false,lt=null;
  function set(p){setPos(slider,a,h,v,sp,p);}
  function gp(e){var r=slider.getBoundingClientRect();return v?((e.clientY-r.top)/r.height)*100:((e.clientX-r.left)/r.width)*100;}
  function loop(){
    if(!sl||drag)return;
    var ease='cubic-bezier(0.45,0,0.55,1)',d='0.7s';
    a.style.transition='clip-path '+d+' '+ease;h.style.transition=(v?'top':'left')+' '+d+' '+ease;slider.style.setProperty('--revelo-ltrans',d+' '+ease);
    set(25);lt=setTimeout(function(){if(drag)return;set(75);lt=setTimeout(function(){if(drag)return;set(sp);lt=setTimeout(function(){a.style.transition='';h.style.transition='';slider.style.setProperty('--revelo-ltrans','0ms');lt=setTimeout(loop,1500);},800);},1200);},1200);
  }
  function intro(){
    if(ip||!si)return;ip=true;
    var ease='cubic-bezier(0.4,0,0.2,1)',d='0.55s';
    setTimeout(function(){a.style.transition='clip-path '+d+' '+ease;h.style.transition=(v?'top':'left')+' '+d+' '+ease;slider.style.setProperty('--revelo-ltrans',d+' '+ease);set(30);setTimeout(function(){set(sp);setTimeout(function(){a.style.transition='';h.style.transition='';slider.style.setProperty('--revelo-ltrans','0ms');if(sl)lt=setTimeout(loop,1000);},600);},650);},350);
  }
  set(sp);
  if(typeof IntersectionObserver!=='undefined'){
    var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){obs.disconnect();if(si)intro();else if(sl)lt=setTimeout(loop,350);}});},{threshold:0.3});
    obs.observe(slider);
  }else{if(si)intro();else if(sl)setTimeout(loop,350);}
  slider.addEventListener('pointerdown',function(e){drag=true;if(lt){clearTimeout(lt);lt=null;}slider.setPointerCapture(e.pointerId);a.style.transition='';h.style.transition='';slider.style.setProperty('--revelo-ltrans','0ms');set(gp(e));e.preventDefault();});
  slider.addEventListener('pointermove',function(e){if(!drag)return;set(gp(e));});
  slider.addEventListener('pointerup',function(){drag=false;});
  slider.addEventListener('pointercancel',function(){drag=false;});
  h.addEventListener('keydown',function(e){
    var c=v?parseFloat(h.style.top)||sp:parseFloat(h.style.left)||sp,step=e.shiftKey?10:5;
    if(e.key==='ArrowLeft'||e.key==='ArrowUp'){set(c-step);e.preventDefault();}
    else if(e.key==='ArrowRight'||e.key==='ArrowDown'){set(c+step);e.preventDefault();}
    else if(e.key==='Home'){set(5);e.preventDefault();}
    else if(e.key==='End'){set(95);e.preventDefault();}
  });
}

document.querySelectorAll('.revelo-slider').forEach(initSlider);
document.getElementById('ext-modal').addEventListener('click',function(e){if(e.target===this)closeExt();});
</script>
</body>
</html>`;
}

// ─── Error pages ────────────────────────────────────────────────────────────

function expiredPage() {
  return `<!DOCTYPE html><html lang="tr">
<head><meta charset="UTF-8"><title>Link Süresi Doldu — Revelo</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0b0b0b;color:#fff;font-family:'Inter',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;}
.card{max-width:360px;}
.icon{font-size:48px;margin-bottom:16px;}
h1{font-size:20px;font-weight:700;margin-bottom:8px;}
p{font-size:14px;color:#888;line-height:1.6;margin-bottom:20px;}
a{display:inline-block;padding:10px 22px;background:#6366f1;color:#fff;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;}
a:hover{background:#818cf8;}
</style></head>
<body><div class="card">
<div class="icon">⏰</div>
<h1>Link Süresi Doldu</h1>
<p>Bu paylaşım linki süresi doldu ve görüntüler silindi.<br>Revelo ile yeni bir link oluşturabilirsin.</p>
<a href="https://reveloslider.vercel.app">Yeni Link Oluştur</a>
</div></body></html>`;
}

function errorPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Hata</title></head><body style="font-family:sans-serif;padding:40px;color:#fff;background:#0b0b0b;"><h1>${title}</h1><p style="color:#888;margin-top:8px;">${msg}</p></body></html>`;
}
