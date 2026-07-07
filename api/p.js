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

// ─── HTML Builders ─────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtExpiry(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'Süresi doldu';
  const h = Math.floor(ms / 3600000);
  if (h < 24) return h + ' saat';
  const days = Math.floor(h / 24);
  return days + ' gün';
}

function buildSlider(bKey, aKey, sfx, cfg, blobUrls, perLabels, isSingle) {
  const bSrc = blobUrls[bKey] || '';
  const aSrc = blobUrls[aKey] || '';
  if (!bSrc && !aSrc) return '';

  const sp  = parseInt(cfg.start || '50');
  const orient = isSingle ? (cfg.orient || 'horizontal') : 'horizontal';
  const r   = esc(cfg.radius || '8px');
  const af  = cfg.autofit ? ' revelo-autofit' : '';
  const sH  = cfg.showH !== false;
  const sS  = cfg.showSep !== false;
  const sL  = cfg.showL !== false;
  const hc  = esc(cfg.hcolor  || '#ffffff');
  const ac  = esc(cfg.acolor  || '#111111');
  const hs  = parseInt(cfg.hsize || '50');
  const cs  = Math.round(hs * 0.8);
  const ls  = parseInt(cfg.lsize || '11');
  const lf  = esc(cfg.lfont   || 'inherit');
  const lc  = esc(cfg.lcolor  || '#ffffff');
  const sLb = cfg.showLbg !== false;
  const lb  = esc(cfg.lbg    || '#000000');
  const lp  = esc(cfg.lpos   || 'bottom');
  const lbgCss = sLb ? hexToRgba(cfg.lbg || '#000000', 0.8) : 'transparent';
  const intro = cfg.intro !== false;
  const loop  = !!cfg.loop;

  const lblB = sL && perLabels?.[bKey] ? `<span class="rv-lbl rv-lbl-b">${esc(perLabels[bKey])}</span>` : '';
  const lblA = sL && perLabels?.[aKey] ? `<span class="rv-lbl rv-lbl-a">${esc(perLabels[aKey])}</span>` : '';
  const hIcon = `<svg viewBox="0 0 28 20" width="20" height="16" fill="none"><polyline points="10,2 3,10 10,18" stroke="${ac}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="18,2 25,10 18,18" stroke="${ac}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const style = [
    `--rh:${hc}`,
    `--csize:${cs}px`,
    `--cvis:${sH ? 'visible' : 'hidden'}`,
    `--lvis:${sS ? 'visible' : 'hidden'}`,
    `--rr:${r}`,
    `--lblvis:${sL ? 'visible' : 'hidden'}`,
    `--lblbg:${lbgCss}`,
    `--lblc:${lc}`,
    `--lblf:${lf}`,
    `--lbls:${ls}px`,
  ].join(';');

  return `<div class="rv-s${af}" id="rs${sfx}"
    data-start="${sp}" data-orient="${orient}" data-intro="${intro}" data-loop="${loop}" data-lp="${lp}"
    role="group" aria-label="Before and after comparison" style="${style}">
  <div class="rv-clip">
    <div class="rv-b"><img src="${esc(bSrc)}" alt="" draggable="false" onload="fitPv()"></div>
    <div class="rv-a" aria-hidden="true"><img src="${esc(aSrc)}" alt="" draggable="false"></div>
  </div>
  ${lblB}${lblA}
  <div class="rv-h" role="slider" tabindex="0" aria-valuemin="5" aria-valuemax="95" aria-valuenow="${sp}">
    <div class="rv-hc">${hIcon}</div>
  </div>
</div>`;
}

function hexToRgba(hex, a) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

function buildPage(share) {
  const { sliderConfig: cfg = {}, blobUrls = {}, mode = 1, theme = 'dark', expiresAt, tier, id } = share;
  const perLabels = cfg.perLabels || {};
  const dark = theme === 'dark';
  const bg   = dark ? '#0b0b0b' : '#f0f0f0';
  const fg   = dark ? '#ffffff' : '#111111';
  const fg2  = dark ? '#888888' : '#666666';
  const cardBg = dark ? '#141414' : '#ffffff';

  let sliderHtml = '';
  const isSingle = mode === 1;
  if (isSingle) {
    sliderHtml = buildSlider('before','after','1', cfg, blobUrls, perLabels, true);
  } else {
    const cols = mode;
    sliderHtml = `<div class="gal" style="--cols:${cols};">`;
    for (let i = 1; i <= mode; i++) {
      sliderHtml += buildSlider(`before${i}`,`after${i}`,i, cfg, blobUrls, perLabels, false);
    }
    sliderHtml += '</div>';
  }

  const title = cfg.title || '';
  const sub   = cfg.sub   || '';
  const lf    = cfg.lfont || 'inherit';
  const expiresStr  = fmtExpiry(expiresAt);
  const timeLeftStr = timeLeft(expiresAt);
  const soonExpiry  = expiresAt - Date.now() < 7 * 24 * 3600 * 1000;

  const codapayBase = process.env.CODAPAY_1MO_URL || '#';

  return `<!DOCTYPE html>
<html lang="tr" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || 'Revelo Slider')}</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{min-height:100%;background:${bg};color:${fg};font-family:'Inter',system-ui,sans-serif;font-size:14px;}
.wrap{max-width:960px;margin:0 auto;padding:40px 24px 60px;}
.hdr{margin-bottom:24px;}
.hdr-title{font-size:22px;font-weight:700;color:${fg};line-height:1.2;font-family:${lf};}
.hdr-sub{font-size:13px;color:${fg2};margin-top:4px;font-family:${lf};}
/* Gallery */
.gal{display:grid;grid-template-columns:repeat(var(--cols,2),1fr);gap:12px;}
@media(max-width:640px){.gal{grid-template-columns:1fr!important;}}
/* Revelo core */
.rv-s{position:relative;overflow:visible;display:block;width:100%;user-select:none;touch-action:none;cursor:ew-resize;}
.rv-s[data-orient="vertical"]{cursor:ns-resize;}
.rv-clip{position:relative;overflow:hidden;border-radius:var(--rr,8px);background:#222;}
.rv-b{position:relative;display:block;width:100%;line-height:0;}
.rv-b img{display:block;width:100%;height:auto;pointer-events:none;}
.rv-a{position:absolute;inset:0;clip-path:inset(0 0 0 50%);will-change:clip-path;}
.rv-a img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;}
.rv-s[data-orient="vertical"] .rv-a{clip-path:inset(50% 0 0 0);}
.rv-s::before{content:'';position:absolute;top:0;bottom:0;left:var(--lp,50%);width:2px;background:var(--rh,#fff);transform:translateX(-50%);pointer-events:none;z-index:9;visibility:var(--lvis,visible);transition:left var(--lt,0ms);}
.rv-s[data-orient="vertical"]::before{top:var(--lp,50%);left:0;bottom:auto;width:100%;height:2px;transform:translateY(-50%);}
.rv-h{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:44px;display:flex;align-items:center;justify-content:center;cursor:ew-resize;z-index:10;outline:none;}
.rv-s[data-orient="vertical"] .rv-h{top:50%;left:0;right:0;bottom:auto;width:100%;height:44px;flex-direction:row;transform:translateY(-50%);}
.rv-hc{width:var(--csize,40px);height:var(--csize,40px);border-radius:50%;background:var(--rh,#fff);box-shadow:0 2px 8px rgba(0,0,0,.25),0 0 0 2px rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;transition:transform .15s;visibility:var(--cvis,visible);}
.rv-s:hover .rv-hc{transform:scale(1.08);}
.rv-s:active .rv-hc{transform:scale(1.15);}
.rv-hc svg{width:50%;pointer-events:none;}
/* Labels */
.rv-lbl{position:absolute;bottom:12px;padding:.45em 1em;font-size:var(--lbls,11px);font-weight:700;letter-spacing:.04em;border-radius:4px;background:var(--lblbg);color:var(--lblc,#fff);pointer-events:none;z-index:5;font-family:var(--lblf,inherit);white-space:nowrap;visibility:var(--lblvis,visible);}
.rv-lbl-b{left:12px;}
.rv-lbl-a{right:12px;}
.rv-s[data-lp="top"] .rv-lbl{bottom:auto;top:12px;}
.rv-s[data-lp="center"] .rv-lbl{bottom:auto;top:50%;transform:translateY(-50%);}
.rv-s[data-lp="center"] .rv-lbl-b{left:12px;transform:translateY(-50%);}
.rv-s[data-lp="center"] .rv-lbl-a{right:12px;transform:translateY(-50%);}
/* Autofit */
.rv-autofit .rv-clip{aspect-ratio:1/1;}
.rv-autofit .rv-b{height:100%;}
.rv-autofit .rv-b img{height:100%;object-fit:cover;}
/* Footer bar */
.fbar{margin-top:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.expiry{font-size:11px;color:${fg2};display:flex;align-items:center;gap:6px;}
.expiry-dot{width:7px;height:7px;border-radius:50%;background:${soonExpiry ? '#f59e0b' : '#22c55e'};flex-shrink:0;}
.extend-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:${dark ? '#1a1a1a' : '#f0f0f0'};border:1.5px solid ${dark ? '#2a2a2a' : '#d8d8d8'};border-radius:6px;font-size:11px;font-weight:600;color:${fg2};text-decoration:none;transition:all .15s;cursor:pointer;}
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
.ext-tier{flex:1;border:1.5px solid ${dark ? '#2a2a2a' : '#e0e0e0'};border-radius:8px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .15s;}
.ext-tier:hover,.ext-tier.sel{border-color:#6366f1;background:rgba(99,102,241,.08);}
.ext-tier .dur{font-size:12px;font-weight:700;color:${fg};}
.ext-tier .pr{font-size:11px;color:${fg2};margin-top:2px;}
.ext-pay{width:100%;height:38px;background:#6366f1;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;}
.ext-pay:hover{background:#818cf8;}
.ext-close{float:right;background:none;border:none;color:${fg2};cursor:pointer;font-size:18px;padding:0;margin-top:-2px;}
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
  if(!url||url==='#'){alert('Ödeme URL\'si henüz yapılandırılmamış.');return;}
  var full=url+(url.includes('?')?'&':'?')+'custom='+encodeURIComponent(SHARE_ID)+'&tier='+selTier;
  window.open(full,'_blank');
  closeExt();
}

// ── Slider engine ─────────────────────────────────────
function setPos(s,a,h,v,sp){
  sp=Math.min(95,Math.max(5,sp));
  if(v){a.style.clipPath='inset('+sp+'% 0 0 0)';h.style.top=sp+'%';s.style.setProperty('--lp',sp+'%');}
  else{a.style.clipPath='inset(0 0 0 '+sp+'%)';h.style.left=sp+'%';s.style.setProperty('--lp',sp+'%');}
  h.setAttribute('aria-valuenow',Math.round(sp));
}
function gp(e,s,v){var r=s.getBoundingClientRect();return v?((e.clientY-r.top)/r.height)*100:((e.clientX-r.left)/r.width)*100;}

function initS(s){
  if(s.dataset.done)return;s.dataset.done='1';
  var a=s.querySelector('.rv-a'),h=s.querySelector('.rv-h');if(!a||!h)return;
  var v=s.dataset.orient==='vertical',sp=parseFloat(s.dataset.start)||50;
  var si=s.dataset.intro!=='false',sl=s.dataset.loop==='true';
  var drag=false,lt=null;
  function set(p){setPos(s,a,h,v,p);}
  function loop(){
    if(!sl||drag)return;
    var e='cubic-bezier(.45,0,.55,1)',d='0.7s';
    a.style.transition='clip-path '+d+' '+e;h.style.transition=(v?'top':'left')+' '+d+' '+e;s.style.setProperty('--lt',d+' '+e);
    set(25);lt=setTimeout(function(){if(drag)return;set(75);lt=setTimeout(function(){if(drag)return;set(sp);lt=setTimeout(function(){a.style.transition='';h.style.transition='';s.style.setProperty('--lt','0ms');lt=setTimeout(loop,1500);},800);},1200);},1200);
  }
  function intro(){
    setTimeout(function(){
      var e='cubic-bezier(.4,0,.2,1)',d='0.55s';
      a.style.transition='clip-path '+d+' '+e;h.style.transition=(v?'top':'left')+' '+d+' '+e;s.style.setProperty('--lt',d+' '+e);
      set(30);setTimeout(function(){set(sp);setTimeout(function(){a.style.transition='';h.style.transition='';s.style.setProperty('--lt','0ms');if(sl)lt=setTimeout(loop,1000);},600);},650);
    },350);
  }
  set(sp);
  if(typeof IntersectionObserver!=='undefined'){
    new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){if(si)intro();else if(sl)lt=setTimeout(loop,350);}});},{threshold:0.3}).observe(s);
  } else{if(si)intro();else if(sl)setTimeout(loop,350);}
  s.addEventListener('pointerdown',function(e){drag=true;if(lt){clearTimeout(lt);lt=null;}s.setPointerCapture(e.pointerId);a.style.transition='';h.style.transition='';s.style.setProperty('--lt','0ms');set(gp(e,s,v));e.preventDefault();});
  s.addEventListener('pointermove',function(e){if(!drag)return;set(gp(e,s,v));});
  s.addEventListener('pointerup',function(){drag=false;});
  s.addEventListener('pointercancel',function(){drag=false;});
  h.addEventListener('keydown',function(e){
    var c=v?parseFloat(h.style.top)||sp:parseFloat(h.style.left)||sp,step=e.shiftKey?10:5;
    if(e.key==='ArrowLeft'||e.key==='ArrowUp'){set(c-step);e.preventDefault();}
    else if(e.key==='ArrowRight'||e.key==='ArrowDown'){set(c+step);e.preventDefault();}
    else if(e.key==='Home'){set(5);e.preventDefault();}
    else if(e.key==='End'){set(95);e.preventDefault();}
  });
}
function fitPv(){
  var c=document.getElementById('pv-c');if(!c)return;
  var img=c.querySelector('.rv-b img');if(!img||!img.naturalWidth)return;
  // Sliders are naturally 100% width; just ensure wrap isn't too wide.
}
document.querySelectorAll('.rv-s').forEach(initS);
document.getElementById('ext-modal').addEventListener('click',function(e){if(e.target===this)closeExt();});
</script>
</body>
</html>`;
}

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
