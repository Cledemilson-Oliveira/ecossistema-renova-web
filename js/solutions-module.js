const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export function createSolutionsModule({supabase,getContext,showToast,onNavigate}){
  const ctx=()=>getContext?.()||{};
  const companyId=()=>ctx().company?.id;
  const isOwner=()=>Boolean(ctx().profile?.dono_sistema);
  const routes={agenda:'appointments',food:'food',store:'products',cursos:'members',servicos:'orders'};

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
      <div class="solutions-grid">${(solutions||[]).map(s=>{const e=map.get(s.codigo),active=Boolean(e?.ativo)||isOwner();return `<article class="solution-card ${active?'enabled':''}"><div class="solution-icon">${esc(s.icone||'◆')}</div><div><span class="module-status ${active?'ok':'warn'}">${active?'Liberado':'Não contratado'}</span><h3>${esc(s.nome)}</h3><p>${esc(s.descricao||'')}</p></div><div class="solution-actions">${active&&routes[s.codigo]?`<button class="module-btn primary" data-open-solution="${esc(s.codigo)}" type="button">Abrir módulo</button>`:'<span class="solution-note">Liberação controlada pela Conta Dono</span>'}</div></article>`}).join('')}</div>
      <div class="module-note"><strong>Modelo RENOVA:</strong> as soluções compartilham CRM, produtos, clientes, vendas, financeiro, usuários e permissões. A empresa só recebe no menu os módulos liberados para sua conta.</div>
    </div>`;
    root.querySelectorAll('[data-open-solution]').forEach(btn=>btn.addEventListener('click',()=>onNavigate?.(routes[btn.dataset.openSolution])));
  }
  return{load,reset(){}};
}
