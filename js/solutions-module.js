const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export function createSolutionsModule({supabase,getContext,showToast,onNavigate}){
  const ctx=()=>getContext?.()||{};
  const companyId=()=>ctx().company?.id;
  const isOwner=()=>Boolean(ctx().profile?.dono_sistema);
  const routes={agenda:'appointments',food:'food',store:'products',cursos:'members',servicos:'orders',franquias:'franchises'};

  async function ownerAdmin(root,solutions){
    if(!isOwner())return;
    const {data:companies,error}=await supabase.from('empresas').select('id,nome,nome_fantasia,plano_codigo,ativo').eq('ativo',true).order('nome');
    if(error)return;
    const wrap=document.createElement('article');wrap.className='module-panel';wrap.innerHTML=`<div class="panel-heading"><div><span class="eyebrow">CONTA DONO</span><h3>Liberação de soluções por empresa</h3><p>Ative ou retire módulos contratados sem alterar o restante do plano.</p></div></div><div class="module-filter-row"><select id="solutionCompany" class="module-select"><option value="">Selecione uma empresa</option>${(companies||[]).map(c=>`<option value="${c.id}">${esc(c.nome_fantasia||c.nome)} • ${esc(c.plano_codigo||'free')}</option>`).join('')}</select></div><div id="solutionCompanyAccess" class="solution-company-access"><div class="module-empty">Selecione uma empresa para administrar os módulos.</div></div>`;root.querySelector('.module-shell')?.appendChild(wrap);
    const select=wrap.querySelector('#solutionCompany'),box=wrap.querySelector('#solutionCompanyAccess');
    const renderCompany=async()=>{const id=select.value;if(!id){box.innerHTML='<div class="module-empty">Selecione uma empresa.</div>';return}box.innerHTML='<div class="module-loading">Carregando acessos...</div>';const {data,error}=await supabase.from('empresa_solucoes').select('solucao_codigo,ativo,origem,habilitado_em').eq('empresa_id',id);if(error){box.innerHTML=`<div class="module-empty">${esc(error.message)}</div>`;return}const map=new Map((data||[]).map(x=>[x.solucao_codigo,x]));box.innerHTML=`<div class="solution-access-grid">${solutions.map(s=>{const row=map.get(s.codigo),active=Boolean(row?.ativo);return `<label class="solution-access-row"><div><strong>${esc(s.icone||'◆')} ${esc(s.nome)}</strong><small>${active?'Liberado para a empresa':'Não liberado'}</small></div><input type="checkbox" data-solution-toggle="${esc(s.codigo)}" ${active?'checked':''}></label>`}).join('')}</div><div class="module-note"><strong>Regra comercial:</strong> esta alteração só libera o módulo. Preços, cobrança e plano continuam controlados separadamente.</div>`;box.querySelectorAll('[data-solution-toggle]').forEach(input=>input.addEventListener('change',async()=>{input.disabled=true;const codigo=input.dataset.solutionToggle;if(input.checked){const {error}=await supabase.from('empresa_solucoes').upsert({empresa_id:id,solucao_codigo:codigo,ativo:true,origem:'conta_dono',atualizado_em:new Date().toISOString()},{onConflict:'empresa_id,solucao_codigo'});if(error){input.checked=false;showToast(error.message)}else showToast('Solução liberada para a empresa.')}else{const {error}=await supabase.from('empresa_solucoes').update({ativo:false,origem:'conta_dono',atualizado_em:new Date().toISOString()}).eq('empresa_id',id).eq('solucao_codigo',codigo);if(error){input.checked=true;showToast(error.message)}else showToast('Solução desativada para a empresa.')}input.disabled=false}))};select.addEventListener('change',renderCompany)
  }

  async function load(){
    const root=document.getElementById('solutionsPage'),empresa=companyId();
    if(!root||!empresa)return;
    root.innerHTML='<div class="module-loading">Carregando soluções RENOVA...</div>';
    const [{data:solutions,error:sErr},{data:enabled,error:eErr}]=await Promise.all([
      supabase.from('renova_solucoes').select('codigo,nome,descricao,categoria,icone,ordem,ativo').eq('ativo',true).order('ordem'),
      supabase.from('empresa_solucoes').select('solucao_codigo,ativo,origem,habilitado_em').eq('empresa_id',empresa)
    ]);
    if(sErr||eErr){root.innerHTML=`<div class="module-empty">${esc((sErr||eErr).message)}</div>`;return}
    const map=new Map((enabled||[]).map(x=>[x.solucao_codigo,x]));
    root.innerHTML=`<div class="module-shell">
      <div class="module-toolbar"><div><span class="eyebrow">PLATAFORMA MODULAR</span><h2>Soluções RENOVA</h2><p>Um único painel para operar diferentes modelos de negócio sem duplicar sistemas, usuários ou base de dados.</p></div></div>
      <div class="solution-architecture"><strong>Cliente final</strong><span>→</span><strong>Página pública da solução</strong><span>→</span><strong>Supabase</strong><span>→</span><strong>Painel Ecossistema RENOVA</strong></div>
      <div class="solutions-grid">${(solutions||[]).map(s=>{const e=map.get(s.codigo),active=s.codigo==='franquias'||Boolean(e?.ativo)||isOwner();return `<article class="solution-card ${active?'enabled':''}"><div class="solution-icon">${esc(s.icone||'◆')}</div><div><span class="module-status ${active?'ok':'warn'}">${active?'Liberado':'Não contratado'}</span><h3>${esc(s.nome)}</h3><p>${esc(s.descricao||'')}</p></div><div class="solution-actions">${active&&routes[s.codigo]?`<button class="module-btn primary" data-open-solution="${esc(s.codigo)}" type="button">Abrir módulo</button>`:'<span class="solution-note">Liberação controlada pela Conta Dono</span>'}</div></article>`}).join('')}</div>
      <div class="module-note"><strong>Modelo RENOVA:</strong> as soluções compartilham CRM, produtos, clientes, vendas, financeiro, usuários e permissões. A empresa só recebe no menu os módulos liberados para sua conta.</div>
    </div>`;
    root.querySelectorAll('[data-open-solution]').forEach(btn=>btn.addEventListener('click',()=>onNavigate?.(routes[btn.dataset.openSolution])));
    await ownerAdmin(root,solutions||[]);
  }
  return{load,reset(){}};
}
