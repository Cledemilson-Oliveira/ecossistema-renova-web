const esc=(v='')=>String(v??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function createPublicFood({supabase,config,showToast}){
  let data=null,cart=[];
  const requestedSlug=()=>new URLSearchParams(location.search).get('food');
  const hasRequest=()=>Boolean(requestedSlug());

  function mount(){
    if(document.getElementById('publicFoodView')) return document.getElementById('publicFoodView');
    const el=document.createElement('section');
    el.id='publicFoodView';
    el.className='food-public hidden';
    document.body.prepend(el);
    return el;
  }

  function total(){return cart.reduce((s,x)=>s+Number(x.preco||0)*Number(x.qtd||1),0)}
  function cartCount(){return cart.reduce((s,x)=>s+Number(x.qtd||1),0)}

  function renderCart(){
    const box=document.getElementById('foodCartPanel');
    const badge=document.getElementById('foodCartCount');
    if(badge) badge.textContent=String(cartCount());
    if(!box) return;
    if(!cart.length){box.innerHTML='<div class="food-empty">Seu carrinho está vazio.</div>';return}
    box.innerHTML=`<div class="food-cart-items">${cart.map((x,i)=>`<div class="food-cart-item"><div><strong>${esc(x.nome)}</strong><small>${money.format(Number(x.preco))} × ${x.qtd}</small></div><div><button data-cart-dec="${i}">−</button><span>${x.qtd}</span><button data-cart-inc="${i}">+</button></div></div>`).join('')}</div><div class="food-cart-total"><span>Subtotal</span><strong>${money.format(total())}</strong></div><button id="foodCheckoutBtn" class="food-primary" type="button">Finalizar pedido</button>`;
    box.querySelectorAll('[data-cart-inc]').forEach(b=>b.addEventListener('click',()=>{cart[Number(b.dataset.cartInc)].qtd++;renderCart()}));
    box.querySelectorAll('[data-cart-dec]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.cartDec);cart[i].qtd--;if(cart[i].qtd<=0)cart.splice(i,1);renderCart()}));
    box.querySelector('#foodCheckoutBtn')?.addEventListener('click',openCheckout);
  }

  function addProduct(p){
    if(!p) return;
    const found=cart.find(x=>x.id===p.id);
    if(found) found.qtd++;
    else cart.push({id:p.id,nome:p.nome,preco:Number(p.preco_promocional||p.preco||0),qtd:1});
    renderCart();
    showToast?.('Item adicionado ao carrinho.');
  }

  function openCheckout(){
    if(!cart.length) return;
    const modal=document.createElement('div');
    modal.className='food-modal-backdrop';
    modal.id='foodCheckoutModal';
    const cfg=data.config;
    modal.innerHTML=`<div class="food-modal"><div class="food-modal-head"><h3>Finalizar pedido</h3><button data-food-close type="button">×</button></div><form id="foodOrderForm" class="food-form"><label>Nome<input id="foName" required></label><label>WhatsApp<input id="foPhone" required placeholder="(14) 99999-9999"></label><label>E-mail<input id="foEmail" type="email"></label><label>Como quer receber?<select id="foType">${cfg.aceita_retirada?'<option value="retirada">Retirada</option>':''}${cfg.aceita_entrega?'<option value="entrega">Entrega</option>':''}<option value="local">Consumir no local</option></select></label><label id="foAddressWrap" class="hidden">Endereço de entrega<textarea id="foAddress" placeholder="Rua, número, bairro, complemento"></textarea></label><label>Forma de pagamento<select id="foPay"><option>PIX</option><option>Cartão</option><option>Dinheiro</option></select></label><label>Observações<textarea id="foNotes" placeholder="Ex.: sem cebola, tocar campainha..."></textarea></label><div class="food-checkout-summary"><span>Subtotal</span><strong>${money.format(total())}</strong></div><button class="food-primary" type="submit">Enviar pedido</button></form></div>`;
    document.body.appendChild(modal);
    const close=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-food-close]'))close()});
    const type=modal.querySelector('#foType');
    const wrap=modal.querySelector('#foAddressWrap');
    const sync=()=>wrap.classList.toggle('hidden',type.value!=='entrega');
    type.addEventListener('change',sync);
    sync();
    modal.querySelector('#foodOrderForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const btn=e.submitter;
      btn.disabled=true;
      btn.textContent='Enviando...';
      try{
        const itens=cart.map(x=>({produto_id:x.id,quantidade:x.qtd,adicionais:[]}));
        const {data:result,error}=await supabase.rpc('criar_food_pedido_publico',{
          p_slug:requestedSlug(),
          p_cliente_nome:modal.querySelector('#foName').value.trim(),
          p_cliente_telefone:modal.querySelector('#foPhone').value.trim(),
          p_cliente_email:modal.querySelector('#foEmail').value.trim(),
          p_tipo_atendimento:type.value,
          p_endereco:type.value==='entrega'?{texto:modal.querySelector('#foAddress').value.trim()}:null,
          p_forma_pagamento:modal.querySelector('#foPay').value,
          p_observacoes:modal.querySelector('#foNotes').value.trim(),
          p_itens:itens
        });
        if(error) throw error;
        cart=[];
        renderCart();
        modal.querySelector('.food-modal').innerHTML=`<div class="food-success"><strong>Pedido recebido! ✅</strong><p>Código <b>${esc(result?.codigo||'RENOVA')}</b></p><p>Total: ${money.format(Number(result?.total||0))}</p><button class="food-primary" data-food-close type="button">Fechar</button></div>`;
        modal.querySelector('[data-food-close]')?.addEventListener('click',close);
      }catch(err){
        showToast?.(err.message||'Não foi possível enviar o pedido.');
        btn.disabled=false;
        btn.textContent='Enviar pedido';
      }
    });
  }

  function render(){
    const root=mount(),cfg=data.config,empresa=data.empresa,cats=data.categorias||[],products=data.produtos||[];
    root.classList.remove('hidden');
    root.innerHTML=`<header class="food-header"><div class="food-brand"><img src="${esc(empresa.logo_url||config.brand.logoUrl)}" alt=""><div><strong>${esc(cfg.nome||empresa.nome)}</strong><span>Powered by RENOVA Food</span></div></div><a href="${esc(config.githubPagesUrl)}">Ecossistema RENOVA</a></header><main class="food-main"><section class="food-hero"><div><span class="eyebrow">RENOVA FOOD</span><h1>${esc(cfg.nome||empresa.nome)}</h1><p>${esc(cfg.descricao||'Escolha seus produtos e faça seu pedido online.')}</p><div class="food-badges"><span class="${cfg.aberto?'open':'closed'}">${cfg.aberto?'Aberto agora':'Fechado'}</span>${cfg.aceita_entrega?'<span>Entrega</span>':''}${cfg.aceita_retirada?'<span>Retirada</span>':''}<span>${cfg.tempo_min}–${cfg.tempo_max} min</span></div></div><button id="foodCartToggle" class="food-cart-button" type="button">Carrinho <b id="foodCartCount">0</b></button></section>${cats.length?`<nav class="food-categories"><button data-food-filter="">Todos</button>${cats.map(c=>`<button data-food-filter="${c.id}">${esc(c.nome)}</button>`).join('')}</nav>`:''}<section id="foodProductsGrid" class="food-products">${products.length?products.map(p=>`<article class="food-product" data-cat="${esc(p.categoria_id||'')}">${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="${esc(p.nome)}">`:''}<div class="food-product-body"><h3>${esc(p.nome)}</h3><p>${esc(p.descricao||'')}</p><div><strong>${money.format(Number(p.preco_promocional||p.preco||0))}</strong><button data-food-add="${p.id}" type="button">Adicionar</button></div></div></article>`).join(''):'<div class="food-empty">Cardápio em preparação.</div>'}</section><aside id="foodCartPanel" class="food-cart-panel"></aside></main>`;
    root.querySelectorAll('[data-food-add]').forEach(btn=>btn.addEventListener('click',()=>addProduct(products.find(x=>x.id===btn.dataset.foodAdd))));
    root.querySelectorAll('[data-food-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      root.querySelectorAll('[data-food-filter]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      const cat=btn.dataset.foodFilter;
      root.querySelectorAll('.food-product').forEach(card=>card.classList.toggle('hidden',Boolean(cat)&&card.dataset.cat!==cat));
    }));
    root.querySelector('#foodCartToggle')?.addEventListener('click',()=>root.classList.toggle('cart-open'));
    renderCart();
  }

  async function showRequested(){
    const slug=requestedSlug();
    if(!slug) return false;
    document.getElementById('authView')?.classList.add('hidden');
    document.getElementById('appView')?.classList.add('hidden');
    document.getElementById('publicView')?.classList.add('hidden');
    const root=mount();
    root.classList.remove('hidden');
    root.innerHTML='<div class="food-public-loading">Carregando cardápio...</div>';
    const {data:payload,error}=await supabase.rpc('get_food_cardapio_publico',{p_slug:slug});
    if(error||!payload){root.innerHTML='<div class="food-public-loading">Cardápio indisponível.</div>';return true}
    data=payload;
    render();
    return true;
  }

  function hide(){document.getElementById('publicFoodView')?.classList.add('hidden')}
  return{hasRequest,showRequested,hide};
}
