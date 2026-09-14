const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const dt=v=>v?new Intl.DateTimeFormat('pt-BR').format(new Date(v)):'—';

export function createAdminPlanModule({supabase,getContext,showToast,onChanged}){
  const ctx=()=>getContext?.()||{};
  const isOwner=()=>Boolean(ctx().profile?.dono_sistema);

  function modal(title,html,onReady){
    document.getElementById('adminPlanModal')?.remove();
    const wrap=document.createElement('div');
    wrap.id='adminPlanModal';
    wrap.className='module-modal-backdrop';
    wrap.innerHTML=`<div class="module-modal" role="dialog" aria-modal="true"><div class="module-modal-head"><h3>${esc(title)}</h3><button class="module-modal-close" data-plan-close type="button">×</button></div><div class="module-modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-plan-close]'))close()});
    onReady?.(wrap,close);
  }

  function defaultExpiry(existing){
    if(existing){const d=new Date(existing);if(Number.isFinite(d.getTime())&&d>new Date())return d.toISOString().slice(0,10)}
    const d=new Date();d.setDate(d.getDate()+30);return d.toISOString().slice(0,10);
  }

  async function enhance(){
    if(!isOwner())return;
    const page=document.getElementById('adminPage');
    const shell=page?.querySelector('.module-shell');
    if(!shell||document.getElementById('manualPlanPanel'))return;

    const host=document.createElement('article');
    host.id='manualPlanPanel';
    host.className='module-panel';
    host.innerHTML='<div class="module-loading">Carregando controle de planos...</div>';
    shell.appendChild(host);

    const [{data:companies,error:companyError},{data:plans,error:planError},{data:history}]=await Promise.all([
      supabase.from('empresas').select('id,nome,owner_user_id,plano_codigo,status_assinatura,plano_valido_ate,plano_pagamento_confirmado,ativo').eq('ativo',true).order('nome'),
      supabase.from('planos_config').select('codigo,nome,preco,descricao,ativo,somente_dono,modo_teste,ordem').eq('ativo',true).order('ordem'),
      supabase.from('empresa_planos_historico').select('id,empresa_id,evento,plano_anterior,plano_novo,origem,valido_ate,pagamento_confirmado,valor,motivo,created_at').order('created_at',{ascending:false}).limit(30)
    ]);
    if(companyError||planError){host.innerHTML=`<div class="module-empty">${esc(companyError?.message||planError?.message||'Não foi possível carregar os planos.')}</div>`;return}

    const cs=companies||[];
    const ps=(plans||[]).filter(p=>!p.somente_dono&&!p.modo_teste);
    const hs=history||[];
    const companyMap=new Map(cs.map(c=>[c.id,c]));

    host.innerHTML=`
      <div class="module-panel-head">
        <div><h3>Controle manual de planos</h3><p>Use quando o pagamento for recebido por PIX direto, dinheiro, transferência, cortesia ou ajuste administrativo. As automações do Mercado Pago continuam funcionando normalmente.</p></div>
      </div>
      <div class="module-note" style="margin:14px"><strong>Conta Dono:</strong> qualquer mudança manual fica registrada no histórico com plano anterior, plano novo, origem, valor, validade e motivo.</div>
      <div class="module-table-wrap">
        ${cs.length?`<table class="module-table"><thead><tr><th>Empresa</th><th>Plano atual</th><th>Assinatura</th><th>Validade</th><th>Pagamento</th><th>Ação</th></tr></thead><tbody>${cs.map(c=>`<tr><td><strong>${esc(c.nome)}</strong><small>${esc(c.id)}</small></td><td><span class="module-status info">${esc((c.plano_codigo||'free').toUpperCase())}</span></td><td>${esc(c.status_assinatura||'—')}</td><td>${dt(c.plano_valido_ate)}</td><td>${c.plano_pagamento_confirmado?'Confirmado':'Não confirmado'}</td><td><button class="module-mini" type="button" data-manage-plan="${c.id}">Gerenciar plano</button></td></tr>`).join('')}</tbody></table>`:'<div class="module-empty">Nenhuma empresa ativa.</div>'}
      </div>
      <div class="module-panel-head" style="margin-top:18px"><div><h3>Histórico recente</h3><p>Últimas alterações manuais e automáticas de plano.</p></div></div>
      <div class="module-table-wrap">
        ${hs.length?`<table class="module-table"><thead><tr><th>Data</th><th>Empresa</th><th>Alteração</th><th>Origem</th><th>Valor</th><th>Validade</th></tr></thead><tbody>${hs.map(h=>`<tr><td>${dt(h.created_at)}</td><td>${esc(companyMap.get(h.empresa_id)?.nome||h.empresa_id)}</td><td><strong>${esc((h.plano_anterior||'—').toUpperCase())} → ${esc((h.plano_novo||'—').toUpperCase())}</strong><small>${esc(h.motivo||h.evento||'')}</small></td><td>${esc(h.origem||'—')}</td><td>${h.valor!=null?money.format(Number(h.valor||0)):'—'}</td><td>${dt(h.valido_ate)}</td></tr>`).join('')}</tbody></table>`:'<div class="module-empty">Nenhuma alteração registrada.</div>'}
      </div>`;

    host.querySelectorAll('[data-manage-plan]').forEach(btn=>btn.addEventListener('click',()=>{
      const company=cs.find(c=>c.id===btn.dataset.managePlan);if(!company)return;
      const currentPlan=ps.find(p=>p.codigo===company.plano_codigo);
      const expiry=defaultExpiry(company.plano_valido_ate);
      modal(`Gerenciar plano • ${company.nome}`,`
        <form id="manualPlanForm" class="module-form">
          <div class="module-note"><strong>Plano atual:</strong> ${esc((company.plano_codigo||'free').toUpperCase())} • ${esc(company.status_assinatura||'—')}</div>
          <label>Novo plano<select id="mpPlan" class="module-select" required>${ps.map(p=>`<option value="${esc(p.codigo)}" data-price="${Number(p.preco||0)}" ${p.codigo===company.plano_codigo?'selected':''}>${esc(p.nome)} • ${money.format(Number(p.preco||0))}</option>`).join('')}</select></label>
          <div class="module-form-grid"><label>Válido até<input id="mpExpiry" class="module-input" type="date" value="${expiry}"></label><label>Valor recebido<input id="mpValue" class="module-input" type="number" min="0" step="0.01" value="${Number(currentPlan?.preco||0).toFixed(2)}"></label></div>
          <div class="module-form-grid"><label>Origem<select id="mpOrigin" class="module-select"><option value="manual_pix">PIX recebido manualmente</option><option value="manual_dinheiro">Dinheiro</option><option value="manual_transferencia">Transferência</option><option value="manual_cortesia">Cortesia</option><option value="manual_ajuste">Ajuste administrativo</option></select></label><label>Referência do pagamento<input id="mpRef" class="module-input" placeholder="Ex.: PIX 14/09/2026"></label></div>
          <label class="module-check"><input id="mpPaid" type="checkbox" checked><span>Pagamento confirmado</span></label>
          <label>Motivo / observação<textarea id="mpReason" class="module-textarea" placeholder="Ex.: Pagamento recebido diretamente via PIX."></textarea></label>
          <div class="module-note"><strong>Importante:</strong> para plano Free, a validade é ignorada. Nos demais planos, você pode definir a data de vencimento ou deixar o campo vazio para acesso sem prazo manual.</div>
          <div class="module-form-actions"><button class="module-btn" data-plan-close type="button">Cancelar</button><button class="module-btn primary" type="submit">Salvar alteração de plano</button></div>
        </form>`,(m,close)=>{
          const plan=m.querySelector('#mpPlan'),value=m.querySelector('#mpValue');
          plan.addEventListener('change',()=>{const opt=plan.selectedOptions[0];value.value=Number(opt?.dataset.price||0).toFixed(2);if(plan.value==='free')m.querySelector('#mpExpiry').value=''});
          m.querySelector('#manualPlanForm').addEventListener('submit',async e=>{
            e.preventDefault();
            const submit=e.submitter;submit.disabled=true;submit.textContent='Salvando...';
            const expiryValue=m.querySelector('#mpExpiry').value;
            const payload={
              p_empresa_id:company.id,
              p_usuario_referencia_id:company.owner_user_id,
              p_plano_novo:plan.value,
              p_valido_ate:plan.value==='free'||!expiryValue?null:new Date(`${expiryValue}T23:59:59`).toISOString(),
              p_pagamento_confirmado:m.querySelector('#mpPaid').checked,
              p_valor:m.querySelector('#mpValue').value===''?null:Number(m.querySelector('#mpValue').value),
              p_referencia:m.querySelector('#mpRef').value.trim()||null,
              p_motivo:m.querySelector('#mpReason').value.trim()||null,
              p_origem:m.querySelector('#mpOrigin').value,
              p_plano_retorno:'free'
            };
            const {data,error}=await supabase.rpc('admin_alterar_plano_empresa_manual',payload);
            if(error){submit.disabled=false;submit.textContent='Salvar alteração de plano';showToast(error.message);return}
            close();showToast(`Plano de ${company.nome} atualizado para ${(data?.plano_novo||plan.value).toUpperCase()}.`);
            host.remove();await enhance();try{await onChanged?.()}catch(_){ }
          });
        });
    }));
  }

  function reset(){document.getElementById('adminPlanModal')?.remove();document.getElementById('manualPlanPanel')?.remove()}
  return{enhance,reset};
}
