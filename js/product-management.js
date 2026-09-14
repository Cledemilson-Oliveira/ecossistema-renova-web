const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function createProductManagement({supabase,getContext,showToast,onDataChange}){
  const ctx=()=>getContext?.()||{};
  const companyId=()=>ctx().company?.id;
  const isOwner=()=>Boolean(ctx().profile?.dono_sistema);

  function modal(title,html,onReady){
    document.getElementById('productManagerModal')?.remove();
    const wrap=document.createElement('div');
    wrap.id='productManagerModal';
    wrap.className='module-modal-backdrop';
    wrap.innerHTML=`<div class="module-modal" role="dialog" aria-modal="true"><div class="module-modal-head"><h3>${esc(title)}</h3><button class="module-modal-close" data-product-modal-close type="button">×</button></div><div class="module-modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-product-modal-close]'))close()});
    onReady?.(wrap,close);
    return wrap;
  }

  async function canManage(){
    if(isOwner())return true;
    const empresa=companyId();
    if(!empresa)return false;
    const {data,error}=await supabase.rpc('usuario_tem_permissao_empresa',{p_empresa_id:empresa,p_permissao:'produtos.gerenciar'});
    if(error){console.error('RENOVA product permission',error);return false}
    return Boolean(data);
  }

  function productForm(p={}){
    const price=Number(p.preco||0);
    const promo=p.preco_promocional==null?'':Number(p.preco_promocional||0);
    return `<form id="productEditForm" class="module-form">
      <label>Nome<input class="module-input" id="peName" required value="${esc(p.nome||'')}"></label>
      <div class="module-form-grid">
        <label>Tipo<select class="module-select" id="peType"><option value="produto" ${String(p.tipo||'').toLowerCase()==='produto'?'selected':''}>Produto</option><option value="servico" ${['servico','serviço'].includes(String(p.tipo||'').toLowerCase())?'selected':''}>Serviço</option></select></label>
        <label>Categoria<input class="module-input" id="peCategory" value="${esc(p.categoria||'')}"></label>
      </div>
      <div class="module-form-grid">
        <label>Preço<input class="module-input" id="pePrice" type="number" min="0" step="0.01" required value="${price}"></label>
        <label>Preço promocional<input class="module-input" id="pePromo" type="number" min="0" step="0.01" value="${promo}"></label>
      </div>
      <label>Descrição<textarea class="module-textarea" id="peDesc">${esc(p.descricao||'')}</textarea></label>
      <label>Foto / URL da imagem<input class="module-input" id="peImage" type="url" placeholder="https://..." value="${esc(p.imagem_url||'')}"></label>
      <div id="productImagePreview" style="${p.imagem_url?'':'display:none;'}margin-top:-4px"><img src="${esc(p.imagem_url||'')}" alt="Prévia da imagem" style="width:100%;max-height:220px;object-fit:contain;border-radius:14px;border:1px solid var(--border);background:var(--surface-2)"></div>
      <div class="module-form-grid">
        <label class="module-check"><input id="peActive" type="checkbox" ${p.ativo!==false?'checked':''}><span>Produto ativo</span></label>
        <label class="module-check"><input id="pePublic" type="checkbox" ${p.publicado_pede_rapido?'checked':''}><span>Publicar na vitrine</span></label>
      </div>
      <div class="module-form-grid">
        <label class="module-check"><input id="peFeatured" type="checkbox" ${p.destaque?'checked':''}><span>Destacar na vitrine</span></label>
        <label class="module-check"><input id="peOnline" type="checkbox" ${p.pagamento_online!==false?'checked':''}><span>Pagamento online</span></label>
      </div>
      <div class="module-form-grid">
        <label class="module-check"><input id="pePix" type="checkbox" ${p.aceita_pix!==false?'checked':''}><span>Aceitar PIX</span></label>
        <label class="module-check"><input id="peCard" type="checkbox" ${p.aceita_cartao?'checked':''}><span>Aceitar cartão</span></label>
      </div>
      <label class="module-check"><input id="peBoleto" type="checkbox" ${p.aceita_boleto?'checked':''}><span>Aceitar boleto</span></label>
      <div class="module-form-actions"><button class="module-btn" data-product-modal-close type="button">Cancelar</button><button class="module-btn primary" type="submit">Salvar alterações</button></div>
    </form>`;
  }

  async function openEdit(product,onSaved){
    modal(`Editar produto • ${product.nome}`,productForm(product),(m,close)=>{
      const image=m.querySelector('#peImage'),preview=m.querySelector('#productImagePreview'),img=preview?.querySelector('img');
      image?.addEventListener('input',()=>{const url=image.value.trim();if(!preview||!img)return;preview.style.display=url?'block':'none';if(url)img.src=url});
      m.querySelector('#productEditForm')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const empresa=companyId();
        const active=m.querySelector('#peActive').checked;
        const payload={
          nome:m.querySelector('#peName').value.trim(),
          tipo:m.querySelector('#peType').value,
          categoria:m.querySelector('#peCategory').value.trim()||null,
          preco:Number(m.querySelector('#pePrice').value||0),
          preco_promocional:m.querySelector('#pePromo').value?Number(m.querySelector('#pePromo').value):null,
          descricao:m.querySelector('#peDesc').value.trim()||null,
          imagem_url:m.querySelector('#peImage').value.trim()||null,
          ativo:active,
          publicado_pede_rapido:active&&m.querySelector('#pePublic').checked,
          destaque:m.querySelector('#peFeatured').checked,
          pagamento_online:m.querySelector('#peOnline').checked,
          aceita_pix:m.querySelector('#pePix').checked,
          aceita_cartao:m.querySelector('#peCard').checked,
          aceita_boleto:m.querySelector('#peBoleto').checked,
          atualizado_em:new Date().toISOString()
        };
        const {error}=await supabase.from('catalogo_itens').update(payload).eq('id',product.id).eq('empresa_id',empresa);
        if(error)return showToast(error.message||'Não foi possível editar o produto.');
        close();showToast('Produto atualizado com sucesso.');await onSaved?.();await onDataChange?.();
      });
    });
  }

  async function removeProduct(product,onDeleted){
    if(!confirm(`Excluir definitivamente “${product.nome}”?\n\nA vitrine será atualizada e os registros históricos de vendas serão preservados sem vínculo direto ao item.`))return;
    const {error}=await supabase.from('catalogo_itens').delete().eq('id',product.id).eq('empresa_id',companyId());
    if(error)return showToast(error.message||'Não foi possível excluir o produto.');
    showToast('Produto excluído.');await onDeleted?.();await onDataChange?.();
  }

  async function enhance(reloadPage){
    const page=document.getElementById('productsPage');
    if(!page?.classList.contains('active'))return;
    const empresa=companyId();if(!empresa)return;
    const allowed=await canManage();
    const newBtn=page.querySelector('#productNew');
    if(newBtn)newBtn.style.display=allowed?'':'none';
    page.querySelectorAll('[data-product-edit],[data-product-delete]').forEach(x=>x.remove());
    if(!allowed){
      const shell=page.querySelector('.module-shell');
      if(shell&&!shell.querySelector('[data-product-readonly-note]')){const note=document.createElement('div');note.dataset.productReadonlyNote='1';note.className='module-note';note.innerHTML='<strong>Catálogo em modo consulta.</strong> Seu perfil não possui a permissão Produtos • Gerenciar.';shell.appendChild(note)}
      return;
    }
    const {data,error}=await supabase.from('catalogo_itens').select('id,nome,tipo,categoria,descricao,preco,preco_promocional,imagem_url,ativo,publicado_pede_rapido,destaque,pagamento_online,aceita_pix,aceita_cartao,aceita_boleto,checkout_status').eq('empresa_id',empresa).order('criado_em',{ascending:false}).limit(500);
    if(error)return console.error('RENOVA product management',error);
    for(const p of data||[]){
      const anchor=page.querySelector(`[data-product-public="${p.id}"]`)||page.querySelector(`[data-product-active="${p.id}"]`);
      const footer=anchor?.closest('.module-card-footer');if(!footer)continue;
      const edit=document.createElement('button');edit.className='module-mini';edit.type='button';edit.dataset.productEdit=p.id;edit.textContent='Editar';edit.addEventListener('click',()=>openEdit(p,reloadPage));
      const del=document.createElement('button');del.className='module-mini';del.type='button';del.dataset.productDelete=p.id;del.textContent='Excluir';del.style.color='#b42318';del.addEventListener('click',()=>removeProduct(p,reloadPage));
      footer.append(edit,del);
    }
    const shell=page.querySelector('.module-shell');
    if(shell&&!shell.querySelector('[data-product-manager-note]')){const note=document.createElement('div');note.dataset.productManagerNote='1';note.className='module-note';note.innerHTML='<strong>Gestão de catálogo liberada.</strong> Você pode criar, editar, publicar, desativar e excluir produtos desta empresa.';shell.appendChild(note)}
  }

  function reset(){document.getElementById('productManagerModal')?.remove()}
  return{enhance,reset};
}
