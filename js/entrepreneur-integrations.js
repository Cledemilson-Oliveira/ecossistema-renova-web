const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const low=v=>String(v??'').trim().toLowerCase();

export function createEntrepreneurIntegrations({supabase,getContext,showToast,onDataChange}){
  const ctx=()=>getContext?.()||{};
  const companyId=()=>ctx().company?.id;

  async function invokeMp(action,extra={}){
    const empresa_id=companyId();
    if(!empresa_id)throw new Error('Empresa atual não identificada.');
    const {data,error}=await supabase.functions.invoke('renova-mercadopago-conectar',{body:{action,empresa_id,...extra}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'Não foi possível concluir a operação.');
    return data;
  }

  async function loadTaxStatus(){
    const empresa=companyId();if(!empresa)return null;
    const {data,error}=await supabase.rpc('get_taxa_renova_empresa',{p_empresa_id:empresa});
    if(error){console.warn('RENOVA taxa status',error);return null}
    return data||null;
  }

  function taxCopy(tax){
    if(!tax)return 'Modelo atual: assinatura RENOVA. A plataforma não desconta taxa das vendas.';
    if(tax.pioneiro&&tax.isencao_vitalicia)return `Pioneiro RENOVA #${tax.posicao} • taxa RENOVA 0% vitalícia sobre vendas.`;
    if(!tax.cobranca_ativa)return `Taxa RENOVA sobre vendas: 0% no momento. Estrutura futura preparada (${Number(tax.taxa_operacional_futura||0).toFixed(2)}%), mas cobrança desativada.`;
    return `Taxa operacional RENOVA configurada: ${Number(tax.taxa_percentual||0).toFixed(2)}%.`;
  }

  async function enhanceSettings(){
    const root=document.getElementById('settingsPage'),empresa=companyId();if(!root||!empresa)return;
    const shell=root.querySelector('.module-shell');if(!shell||document.getElementById('renovaMpConnectBlock'))return;
    const [{data:planCfg},tax]=await Promise.all([
      supabase.from('planos_config').select('mercado_pago').eq('codigo',ctx().company?.plano_codigo||'free').maybeSingle(),
      loadTaxStatus()
    ]);
    const block=document.createElement('section');block.id='renovaMpConnectBlock';block.className='settings-block';
    block.innerHTML=`<span class="eyebrow">RECEBIMENTOS DA EMPRESA</span><h3>Mercado Pago do estabelecimento</h3><p>Conecte a conta Mercado Pago da própria empresa. O cliente paga diretamente ao estabelecimento. O Ecossistema RENOVA trabalha por assinatura e não retém percentual da venda neste momento.</p><div id="renovaMpState" class="module-badge-row"><span class="module-status">Consultando...</span></div><div class="module-note" style="margin-top:12px"><strong>Modelo comercial:</strong> ${esc(taxCopy(tax))}<br>Comissões do programa <strong>Indique e Ganhe</strong> ficam registradas separadamente e não alteram o valor recebido pelo estabelecimento até existir split compatível.</div><div id="renovaMpBody" style="margin-top:14px"></div>`;
    const grid=root.querySelector('.settings-grid');(grid||shell).appendChild(block);
    const state=block.querySelector('#renovaMpState'),body=block.querySelector('#renovaMpBody');

    const render=async()=>{
      state.innerHTML='<span class="module-status">Consultando...</span>';body.innerHTML='';
      try{
        const data=await invokeMp('status'),account=data.account||null,connected=Boolean(data.connected);
        state.innerHTML=connected?`<span class="module-status ok">Conectado</span><span class="module-badge">${account?.live_mode?'Produção':'Teste'}</span>${account?.mp_user_id?`<span class="module-badge">Conta MP ${esc(account.mp_user_id)}</span>`:''}`:'<span class="module-status warn">Não conectado</span>';
        if(connected){
          body.innerHTML=`<div class="module-form"><div class="module-note"><strong>Conta ativa.</strong> Public Key: ${esc(account?.public_key||'—')}<br>${account?.metadata?.email?`Conta: ${esc(account.metadata.email)}<br>`:''}O Access Token permanece protegido no Vault do Supabase e nunca é exibido novamente.</div><div class="module-form-actions"><button id="mpReconnect" class="module-btn" type="button">Atualizar credenciais</button><button id="mpDisconnect" class="module-btn danger" type="button">Desconectar</button></div></div>`;
          body.querySelector('#mpReconnect')?.addEventListener('click',()=>renderForm(account?.public_key||''));
          body.querySelector('#mpDisconnect')?.addEventListener('click',async()=>{if(!confirm('Desconectar o Mercado Pago desta empresa? O checkout online ficará indisponível até reconectar.'))return;try{await invokeMp('disconnect');showToast('Mercado Pago desconectado.');await render()}catch(e){showToast(e.message||'Não foi possível desconectar.')}});
        }else renderForm('');
      }catch(e){state.innerHTML='<span class="module-status bad">Erro de conexão</span>';body.innerHTML=`<div class="module-note">${esc(e.message||'Não foi possível consultar o Mercado Pago.')}</div>`}
    };

    const renderForm=(publicKey='')=>{
      body.innerHTML=`<form id="mpConnectForm" class="module-form"><label>Public Key<input id="mpPublicKey" class="module-input" autocomplete="off" value="${esc(publicKey)}" placeholder="APP_USR-..."></label><label>Access Token<input id="mpAccessToken" class="module-input" type="password" autocomplete="new-password" placeholder="APP_USR-... ou TEST-..." required></label><div class="module-note"><strong>Segurança:</strong> o Access Token é enviado diretamente ao backend, validado no Mercado Pago e armazenado criptografado no Vault. Ele não fica salvo no navegador.</div>${planCfg?.mercado_pago===false?'<div class="module-note"><strong>Atenção:</strong> o plano atual não inclui checkout Mercado Pago. A conexão pode ser preparada, mas a liberação comercial do recurso continua respeitando o plano.</div>':''}<div class="module-form-actions"><button class="module-btn primary" type="submit">Conectar Mercado Pago</button></div></form>`;
      body.querySelector('#mpConnectForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;btn.textContent='Validando...';try{await invokeMp('connect',{public_key:body.querySelector('#mpPublicKey').value.trim(),access_token:body.querySelector('#mpAccessToken').value.trim()});showToast('Mercado Pago conectado com segurança.');await render();await onDataChange?.()}catch(err){showToast(err.message||'Não foi possível conectar o Mercado Pago.');btn.disabled=false;btn.textContent='Conectar Mercado Pago'}})
    };
    await render();
  }

  async function enhanceAffiliates(){
    const root=document.getElementById('affiliatesPage');if(!root)return;
    const h2=root.querySelector('.module-toolbar h2');if(h2)h2.textContent='Indique e Ganhe / Afiliados';
    const p=root.querySelector('.module-toolbar p');if(p)p.textContent='Um único núcleo para indicadores, afiliados, códigos de indicação e comissões.';
    if(root.querySelector('#affiliateUnifiedNote'))return;
    const shell=root.querySelector('.module-shell');if(!shell)return;
    const note=document.createElement('div');note.id='affiliateUnifiedNote';note.className='module-note';note.innerHTML='<strong>Regra RENOVA:</strong> indicador e afiliado são o mesmo cadastro operacional. O código de indicação acompanha o lead/venda e, quando houver comissão, ela é registrada no mesmo núcleo. Enquanto não houver split 1→N disponível, a comissão fica como valor a pagar ao afiliado e não reduz automaticamente o recebimento do estabelecimento.';
    shell.insertBefore(note,shell.children[1]||null);
  }

  async function enhance(page){if(page==='settings')await enhanceSettings();if(page==='affiliates')await enhanceAffiliates()}
  return{enhance,reset(){}};
}
