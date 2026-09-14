const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function youtubeId(raw=''){
  try{
    const u=new URL(raw);
    if(u.hostname.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';
    if(u.hostname.includes('youtube.com')){
      if(u.pathname==='/watch')return u.searchParams.get('v')||'';
      const parts=u.pathname.split('/').filter(Boolean);
      const i=parts.findIndex(x=>['embed','shorts','live'].includes(x));
      if(i>=0)return parts[i+1]||'';
    }
  }catch(_){ }
  return '';
}
function kind(url=''){
  const y=youtubeId(url);if(y)return{type:'youtube',id:y};
  const clean=String(url).split('?')[0].toLowerCase();
  if(/\.(png|jpe?g|webp|gif|avif)$/.test(clean))return{type:'image'};
  if(/\.(mp4|webm|mov|m4v)$/.test(clean))return{type:'video'};
  if(/\.pdf$/.test(clean))return{type:'pdf'};
  return{type:'link'};
}

function ensureCss(){
  if(document.getElementById('networkMediaCss'))return;
  const s=document.createElement('style');s.id='networkMediaCss';s.textContent=`
  .network-media-thumb{width:100%;min-height:160px;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center;cursor:pointer;margin:10px 0;padding:0;position:relative}
  .network-media-thumb img{width:100%;height:220px;object-fit:cover;display:block}
  .network-media-thumb .network-generic{padding:34px 20px;display:grid;gap:8px;text-align:center;color:var(--text)}
  .network-media-thumb .network-generic strong{font-size:1rem}.network-media-thumb .network-generic span{font-size:.8rem;color:var(--muted)}
  .network-media-play{position:absolute;inset:auto auto 14px 14px;background:rgba(4,15,27,.84);color:#fff;border-radius:999px;padding:7px 11px;font-size:.78rem;font-weight:800}
  .network-preview{width:min(980px,94vw);max-height:88vh}.network-preview img,.network-preview video,.network-preview iframe{width:100%;max-height:76vh;border:0;border-radius:14px;background:#06111d}.network-preview img{object-fit:contain}.network-preview iframe{height:72vh}.network-preview video{height:auto}
  `;document.head.appendChild(s);
}

function openPreview(title,url){
  document.getElementById('networkPreviewBackdrop')?.remove();
  const k=kind(url);let media='';
  if(k.type==='youtube')media=`<iframe src="https://www.youtube-nocookie.com/embed/${esc(k.id)}?autoplay=1" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  else if(k.type==='image')media=`<img src="${esc(url)}" alt="${esc(title)}">`;
  else if(k.type==='video')media=`<video src="${esc(url)}" controls autoplay playsinline></video>`;
  else if(k.type==='pdf')media=`<iframe src="${esc(url)}" title="${esc(title)}"></iframe>`;
  else media=`<div class="module-note"><strong>Material externo</strong><br>Este formato não possui reprodução embutida. Use o botão abaixo para abrir o material.</div><a class="module-btn primary" href="${esc(url)}" target="_blank" rel="noopener">Abrir material</a>`;
  const wrap=document.createElement('div');wrap.id='networkPreviewBackdrop';wrap.className='module-modal-backdrop';wrap.innerHTML=`<div class="module-modal network-preview" role="dialog" aria-modal="true"><div class="module-modal-head"><h3>${esc(title||'Material')}</h3><button class="module-modal-close" data-network-close type="button">×</button></div><div class="module-modal-body">${media}</div></div>`;document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-network-close]'))close()});
}

export function createNetworkingMediaModule(){
  ensureCss();
  function enhance(){
    const panel=document.getElementById('networkingPanel');if(!panel)return;
    panel.querySelectorAll('a.module-mini[href]').forEach(link=>{
      if(link.dataset.networkEnhanced==='1')return;
      const url=link.href;if(!url)return;link.dataset.networkEnhanced='1';
      const card=link.closest('.module-card');const title=card?.querySelector('h3')?.textContent?.trim()||'Material RENOVA';
      const k=kind(url);const btn=document.createElement('button');btn.type='button';btn.className='network-media-thumb';btn.setAttribute('aria-label',`Visualizar ${title}`);
      if(k.type==='youtube')btn.innerHTML=`<img src="https://img.youtube.com/vi/${esc(k.id)}/hqdefault.jpg" alt="Thumbnail ${esc(title)}"><span class="network-media-play">▶ Reproduzir</span>`;
      else if(k.type==='image')btn.innerHTML=`<img src="${esc(url)}" alt="Thumbnail ${esc(title)}"><span class="network-media-play">⌕ Visualizar</span>`;
      else if(k.type==='video')btn.innerHTML=`<div class="network-generic"><strong>▶ Vídeo</strong><span>Toque para reproduzir no RENOVA</span></div>`;
      else if(k.type==='pdf')btn.innerHTML=`<div class="network-generic"><strong>PDF</strong><span>Toque para visualizar o documento</span></div>`;
      else btn.innerHTML=`<div class="network-generic"><strong>🔗 Material</strong><span>Toque para visualizar</span></div>`;
      link.insertAdjacentElement('beforebegin',btn);
      btn.addEventListener('click',()=>openPreview(title,url));
      link.removeAttribute('target');link.textContent='Visualizar material';link.addEventListener('click',e=>{e.preventDefault();openPreview(title,url)});
    });
  }
  function reset(){document.getElementById('networkPreviewBackdrop')?.remove()}
  return{enhance,reset};
}
