import { createPublicCheckout } from './public-checkout.js?v=20260913-004';

function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

function ensureCss(){
  if(document.querySelector('link[data-public-store]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='./css/public-store.css?v=20260913-004';link.dataset.publicStore='1';document.head.appendChild(link);
}

function mount(config){
  if(document.getElementById('publicView'))return;
  const {brand}=config;
  const section=document.createElement('section');
  section.id='publicView';section.className='public-view hidden';
  section.innerHTML=`
    <header class="public-header">
      <div class="public-brand"><img src="${esc(brand.logoUrl)}" alt="Ecossistema RENOVA"><div><strong>ECOSSISTEMA RENOVA</strong><span>${esc(brand.slogan)}</span></div></div>
      <div class="public-actions">
        <button id="publicThemeBtn" class="public-btn ghost" type="button" aria-label="Alternar tema">☾</button>
        <button id="publicLoginBtn" class="public-btn" type="button">Entrar</button>
        <button id="publicSignupBtn" class="public-btn primary create" type="button">Criar conta grátis</button>
      </div>
    </header>
    <main class="public-main">
      <section class="public-hero">
        <div class="public-hero-copy">
          <span class="eyebrow">VITRINE OFICIAL • ECOSSISTEMA RENOVA</span>
          <h1>Produtos, serviços e soluções de empresas conectadas ao RENOVA.</h1>
          <p>Explore ofertas de diferentes empresas em uma única vitrine. Compre sem precisar criar conta ou conheça o Ecossistema RENOVA para administrar seu próprio negócio.</p>
          <div class="public-hero-actions">
            <button id="exploreProductsBtn" class="public-btn primary" type="button">Explorar produtos</button>
            <button id="heroSignupBtn" class="public-btn" type="button">Criar conta grátis</button>
          </div>
        </div>
        <div class="public-hero-card">
          <img src="${esc(brand.logoUrl)}" alt="RENOVA">
          <strong>Uma vitrine. Muitas empresas.</strong>
          <span>Produtos digitais, serviços, planos e soluções em um único ambiente.</span>
          <small>Checkout transparente: compre como convidado com PIX, cartão ou boleto quando a oferta disponibilizar essas formas de pagamento.</small>
        </div>
      </section>

      <section id="publicCatalogSection" class="public-section">
        <div class="public-section-heading">
          <div><span class="eyebrow">MARKETPLACE RENOVA</span><h2>Descubra o que está disponível</h2></div>
          <p id="publicCatalogCount">Carregando ofertas...</p>
        </div>
        <div class="store-toolbar">
          <input id="publicSearch" class="store-control search" type="search" placeholder="Buscar produto, serviço ou empresa...">
          <select id="publicCompanyFilter" class="store-control"><option value="">Todas as empresas</option></select>
          <select id="publicCategoryFilter" class="store-control"><option value="">Todas as categorias</option></select>
        </div>
        <div id="publicCatalogGrid" class="store-grid"><div class="store-loading">Carregando produtos publicados...</div></div>
      </section>

      <footer class="public-footer">
        <span>© Ecossistema RENOVA • Pessoas • Tecnologia • Resultados em equilíbrio</span>
        <span>Desenvolvido por ${esc(brand.developer)}</span>
      </footer>
    </main>
  `;
  document.body.prepend(section);
}

function modalShell(title,body){
  const old=document.getElementById('publicModalBackdrop');if(old)old.remove();
  const wrap=document.createElement('div');wrap.id='publicModalBackdrop';wrap.className='public-modal-backdrop';
  wrap.innerHTML=`<div class="public-modal" role="dialog" aria-modal="true"><div class="public-modal-head"><h3>${esc(title)}</h3><button class="public-modal-close" data-close-public-modal type="button">×</button></div><div class="public-modal-body">${body}</div></div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-close-public-modal]'))wrap.remove();});
  return wrap;
}

function paymentBadges(p){
  return [p.aceita_pix?'PIX':'',p.aceita_cartao?'Cartão':'',p.aceita_boleto?'Boleto':''].filter(Boolean).map(x=>`<span>${x}</span>`).join('');
}

export function createPublicStore({supabase,config,onLogin,onThemeToggle,showToast}){
  ensureCss();mount(config);
  let products=[];
  const guestCheckout=createPublicCheckout({supabase,showToast});

  function show(){document.getElementById('publicView')?.classList.remove('hidden');}
  function hide(){document.getElementById('publicView')?.classList.add('hidden');document.getElementById('publicModalBackdrop')?.remove();}

  function syncThemeIcon(){const b=document.getElementById('publicThemeBtn');if(b)b.textContent=document.documentElement.dataset.theme==='dark'?'☀':'☾';}

  function openSignup(){
    const modal=modalShell('Criar conta no RENOVA',`
      <form id="publicSignupForm" class="signup-form">
        <label>Seu nome<input id="signupName" required autocomplete="name" placeholder="Nome completo"></label>
        <label>Nome da empresa<input id="signupCompany" required placeholder="Nome do seu negócio"></label>
        <label>WhatsApp<input id="signupPhone" autocomplete="tel" placeholder="(14) 99999-9999"></label>
        <label>E-mail<input id="signupEmail" type="email" required autocomplete="email" placeholder="voce@email.com"></label>
        <label>Senha<input id="signupPassword" type="password" minlength="8" required autocomplete="new-password" placeholder="Mínimo 8 caracteres"></label>
        <button id="signupSubmit" class="public-btn primary" type="submit">Criar minha conta gratuita</button>
        <div class="signup-note">Ao criar sua conta, o RENOVA cria automaticamente seu perfil, sua empresa e seu acesso inicial no plano Free.</div>
      </form>`);
    modal.querySelector('#publicSignupForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=modal.querySelector('#signupSubmit');btn.disabled=true;btn.textContent='Criando conta...';
      try{
        const nome=modal.querySelector('#signupName').value.trim();
        const empresa_nome=modal.querySelector('#signupCompany').value.trim();
        const telefone=modal.querySelector('#signupPhone').value.trim();
        const email=modal.querySelector('#signupEmail').value.trim();
        const password=modal.querySelector('#signupPassword').value;
        const redirectTo=`${location.origin}${location.pathname}`;
        const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{nome,empresa_nome,telefone}}});
        if(error)throw error;
        if(data.session){showToast('Conta criada. Bem-vindo ao Ecossistema RENOVA!');modal.remove();}
        else{modal.querySelector('.public-modal-body').innerHTML='<div class="signup-note" style="font-size:.85rem"><strong>Conta criada.</strong><br><br>Verifique seu e-mail para confirmar o cadastro. Depois, volte ao RENOVA e faça login.</div>';}
      }catch(err){showToast(err.message||'Não foi possível criar sua conta.');btn.disabled=false;btn.textContent='Criar minha conta gratuita';}
    });
  }

  function openOffer(p){
    const price=p.gratuito?'<strong class="free">Gratuito</strong>':`${Number(p.preco_promocional||0)>0&&Number(p.preco_promocional)<Number(p.preco||0)?`<del>${money.format(Number(p.preco))}</del>`:''}<strong>${money.format(Number(p.preco_promocional||p.preco||0))}</strong>`;
    const image=p.imagem_url||config.brand.logoUrl;
    const modal=modalShell(p.nome,`<div class="offer-modal-body"><img class="offer-modal-image" src="${esc(image)}" alt="${esc(p.nome)}"><div class="offer-modal-company">${esc(p.empresa_nome||'Empresa RENOVA')} • ${esc(p.categoria||p.tipo||'Oferta')}</div><h2>${esc(p.nome)}</h2><p>${esc(p.descricao||'Oferta publicada no Ecossistema RENOVA.')}</p><div class="product-price">${price}</div><div class="offer-payment">${paymentBadges(p)}</div><div class="offer-cta"><button class="primary" data-buy-product type="button">${p.gratuito?'Acessar oferta':'Comprar agora'}</button><button class="secondary" data-create-account type="button">Criar conta</button></div></div>`);
    modal.querySelector('[data-create-account]')?.addEventListener('click',()=>{modal.remove();openSignup();});
    modal.querySelector('[data-buy-product]')?.addEventListener('click',()=>handleBuy(p));
  }

  function handleBuy(p){
    localStorage.setItem('renova_pending_product',JSON.stringify({produto_id:p.produto_id,empresa_id:p.empresa_id,nome:p.nome,preco:p.preco_promocional||p.preco,checkout_tipo:p.checkout_tipo,at:new Date().toISOString()}));
    document.getElementById('publicModalBackdrop')?.remove();
    guestCheckout.open(p);
  }

  function render(){
    const q=(document.getElementById('publicSearch')?.value||'').trim().toLowerCase();
    const company=document.getElementById('publicCompanyFilter')?.value||'';
    const category=document.getElementById('publicCategoryFilter')?.value||'';
    const filtered=products.filter(p=>{
      const hay=`${p.nome||''} ${p.descricao||''} ${p.empresa_nome||''} ${p.categoria||''}`.toLowerCase();
      return (!q||hay.includes(q))&&(!company||p.empresa_id===company)&&(!category||p.categoria===category);
    });
    const grid=document.getElementById('publicCatalogGrid');
    const count=document.getElementById('publicCatalogCount');if(count)count.textContent=`${filtered.length} oferta${filtered.length===1?'':'s'} disponível${filtered.length===1?'':'is'}`;
    if(!grid)return;
    if(!filtered.length){grid.innerHTML='<div class="store-empty">Nenhuma oferta encontrada com esses filtros.</div>';return;}
    grid.innerHTML=filtered.map(p=>{
      const image=p.imagem_url||config.brand.logoUrl;
      const sellerLogo=p.empresa_logo_url||config.brand.logoUrl;
      const promo=Number(p.preco_promocional||0)>0&&Number(p.preco_promocional)<Number(p.preco||0);
      const price=p.gratuito?'<strong class="free">Gratuito</strong>':`${promo?`<del>${money.format(Number(p.preco))}</del>`:''}<strong>${money.format(Number(p.preco_promocional||p.preco||0))}</strong>`;
      return `<article class="product-card" data-product-id="${esc(p.produto_id)}"><div class="product-image-wrap"><img class="product-image" src="${esc(image)}" alt="${esc(p.nome)}" loading="lazy"><span class="product-badge ${p.destaque?'featured':''}">${p.destaque?'Destaque':esc(p.tipo||'Oferta')}</span></div><div class="product-body"><div class="seller-line"><img src="${esc(sellerLogo)}" alt=""><span>${esc(p.empresa_nome||'Empresa RENOVA')}</span></div><h3>${esc(p.nome)}</h3><div class="product-description">${esc(p.descricao||'Produto ou serviço publicado no Ecossistema RENOVA.')}</div><div class="product-meta"><span>${esc(p.categoria||p.tipo||'Geral')}</span>${p.aceita_pix?'<span>PIX</span>':''}${p.aceita_cartao?'<span>Cartão</span>':''}</div><div class="product-price">${price}</div><div class="product-actions"><button class="buy" data-buy type="button">${p.gratuito?'Acessar':'Comprar'}</button><button class="details" data-details type="button" aria-label="Ver detalhes">＋</button></div></div></article>`;
    }).join('');
    grid.querySelectorAll('[data-product-id]').forEach(card=>{
      const p=products.find(x=>x.produto_id===card.dataset.productId);if(!p)return;
      card.querySelector('[data-details]')?.addEventListener('click',()=>openOffer(p));
      card.querySelector('[data-buy]')?.addEventListener('click',()=>handleBuy(p));
    });
  }

  async function loadCatalog(){
    const grid=document.getElementById('publicCatalogGrid');if(grid)grid.innerHTML='<div class="store-loading">Carregando produtos publicados...</div>';
    const {data,error}=await supabase.rpc('get_catalogo_publico');
    if(error){console.error('Public catalog',error);if(grid)grid.innerHTML='<div class="store-empty">Não foi possível carregar a vitrine agora.</div>';return;}
    products=data||[];
    const companies=[...new Map(products.map(p=>[p.empresa_id,p.empresa_nome])).entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
    const categories=[...new Set(products.map(p=>p.categoria).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
    const companySel=document.getElementById('publicCompanyFilter');if(companySel)companySel.innerHTML='<option value="">Todas as empresas</option>'+companies.map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('');
    const categorySel=document.getElementById('publicCategoryFilter');if(categorySel)categorySel.innerHTML='<option value="">Todas as categorias</option>'+categories.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    render();
  }

  document.getElementById('publicLoginBtn')?.addEventListener('click',()=>{hide();onLogin?.();});
  document.getElementById('publicSignupBtn')?.addEventListener('click',openSignup);
  document.getElementById('heroSignupBtn')?.addEventListener('click',openSignup);
  document.getElementById('exploreProductsBtn')?.addEventListener('click',()=>document.getElementById('publicCatalogSection')?.scrollIntoView({behavior:'smooth'}));
  document.getElementById('publicThemeBtn')?.addEventListener('click',()=>{onThemeToggle?.();syncThemeIcon();});
  ['publicSearch','publicCompanyFilter','publicCategoryFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='publicSearch'?'input':'change',render));
  syncThemeIcon();

  return {show,hide,loadCatalog,openSignup,syncThemeIcon};
}
