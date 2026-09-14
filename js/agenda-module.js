const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const low=v=>String(v??'').trim().toLowerCase();
const dayNames=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const dt=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—';
const statusClass=v=>{const s=low(v);if(['confirmado','concluido'].includes(s))return'ok';if(s==='solicitado')return'warn';if(['cancelado','recusado','faltou'].includes(s))return'bad';return'info'};
const badge=v=>`<span class="module-status ${statusClass(v)}">${esc(v||'—')}</span>`;
const empty=t=>`<div class="module-empty">${esc(t)}</div>`;

export function createAgendaModule({supabase,getContext,showToast,onDataChange}){
  const ctx=()=>getContext?.()||{};
  const companyId=()=>ctx().company?.id;
  const userId=()=>ctx().user?.id;
  const root=()=>document.getElementById('appointmentsPage');

  function modal(title,html,onReady){
    document.getElementById('agendaModalBackdrop')?.remove();
    const wrap=document.createElement('div');wrap.id='agendaModalBackdrop';wrap.className='module-modal-backdrop';
    wrap.innerHTML=`<div class="module-modal" role="dialog" aria-modal="true"><div class="module-modal-head"><h3>${esc(title)}</h3><button class="module-modal-close" data-agenda-close type="button">×</button></div><div class="module-modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-agenda-close]'))close()});onReady?.(wrap,close);return wrap;
  }

  async function allowed(){const empresa=companyId();if(!empresa)return false;const {data,error}=await supabase.rpc('pode_gerenciar_agenda_empresa',{p_empresa_id:empresa});if(error){console.error('RENOVA agenda permission',error);return false}return Boolean(data)}

  async function configureProfessional(prof,products,links,availability,reload){
    const currentLinks=new Set(links.filter(x=>x.profissional_id===prof?.id&&x.ativo).map(x=>x.produto_id));
    const byDay=new Map();for(const d of availability.filter(x=>x.profissional_id===prof?.id&&x.ativo))if(!byDay.has(Number(d.dia_semana)))byDay.set(Number(d.dia_semana),d);
    modal(prof?.id?'Editar profissional e horários':'Novo profissional',`<form id="agendaProfessionalForm" class="module-form">
      <label>Nome do profissional<input class="module-input" id="apName" required value="${esc(prof?.nome||'')}"></label>
      <div class="module-form-grid"><label>E-mail<input class="module-input" id="apEmail" type="email" value="${esc(prof?.email||'')}"></label><label>WhatsApp<input class="module-input" id="apPhone" value="${esc(prof?.telefone||'')}"></label></div>
      <div class="module-note"><strong>Produtos / serviços atendidos</strong><br>Marque os itens para os quais este profissional aceita agendamentos.</div>
      <div style="display:grid;gap:8px">${products.length?products.map(p=>`<label class="module-check"><input type="checkbox" data-agenda-product="${p.id}" ${currentLinks.has(p.id)?'checked':''}><span>${esc(p.nome)}${p.agenda_habilitada?'':' • agenda ainda não habilitada no produto'}</span></label>`).join(''):empty('Crie um produto ou serviço antes de vincular um profissional.')}</div>
      <div class="module-note"><strong>Disponibilidade semanal</strong><br>Ative os dias em que o profissional atende. Nesta versão, cada dia usa uma faixa contínua; novos períodos podem ser adicionados depois sem mudar a arquitetura.</div>
      <div style="display:grid;gap:8px">${dayNames.map((name,i)=>{const d=byDay.get(i);return `<div class="module-form-grid" style="align-items:end"><label class="module-check"><input type="checkbox" data-day-enabled="${i}" ${d?'checked':''}><span>${name}</span></label><label>Início<input class="module-input" type="time" data-day-start="${i}" value="${d?String(d.hora_inicio).slice(0,5):'09:00'}"></label><label>Fim<input class="module-input" type="time" data-day-end="${i}" value="${d?String(d.hora_fim).slice(0,5):'18:00'}"></label></div>`}).join('')}</div>
      <div class="module-form-actions"><button class="module-btn" data-agenda-close type="button">Cancelar</button><button class="module-btn primary" id="agendaProfessionalSave" type="submit">Salvar profissional e agenda</button></div>
    </form>`,(m,close)=>m.querySelector('#agendaProfessionalForm').addEventListener('submit',async e=>{
      e.preventDefault();const empresa=companyId(),btn=m.querySelector('#agendaProfessionalSave');btn.disabled=true;btn.textContent='Salvando...';
      try{
        let id=prof?.id;
        const base={empresa_id:empresa,nome:m.querySelector('#apName').value.trim(),email:m.querySelector('#apEmail').value.trim()||null,telefone:m.querySelector('#apPhone').value.trim()||null,ativo:true,atualizado_em:new Date().toISOString()};
        if(id){const {error}=await supabase.from('agenda_profissionais').update(base).eq('id',id).eq('empresa_id',empresa);if(error)throw error}else{const {data,error}=await supabase.from('agenda_profissionais').insert({...base,criado_por:userId()}).select('id').single();if(error)throw error;id=data.id}
        const selected=[...m.querySelectorAll('[data-agenda-product]:checked')].map(x=>x.dataset.agendaProduct);
        const {error:delRel}=await supabase.from('agenda_produto_profissionais').delete().eq('empresa_id',empresa).eq('profissional_id',id);if(delRel)throw delRel;
        if(selected.length){const {error}=await supabase.from('agenda_produto_profissionais').insert(selected.map(produto_id=>({empresa_id:empresa,produto_id,profissional_id:id,intervalo_min:15,ativo:true})));if(error)throw error}
        const {error:delDisp}=await supabase.from('agenda_disponibilidades').delete().eq('empresa_id',empresa).eq('profissional_id',id);if(delDisp)throw delDisp;
        const rows=[];for(let i=0;i<7;i++){if(!m.querySelector(`[data-day-enabled="${i}"]`)?.checked)continue;rows.push({empresa_id:empresa,profissional_id:id,dia_semana:i,hora_inicio:m.querySelector(`[data-day-start="${i}"]`).value,hora_fim:m.querySelector(`[data-day-end="${i}"]`).value,ativo:true})}
        if(rows.length){const {error}=await supabase.from('agenda_disponibilidades').insert(rows);if(error)throw error}
        close();showToast('Profissional e horários atualizados.');await reload();await onDataChange?.();
      }catch(err){showToast(err.message||'Não foi possível salvar a agenda.');btn.disabled=false;btn.textContent='Salvar profissional e agenda'}
    }));
  }

  function blockTime(professionals,reload){
    modal('Bloquear período da agenda',`<form id="agendaBlockForm" class="module-form"><label>Profissional<select class="module-select" id="abProf" required>${professionals.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></label><div class="module-form-grid"><label>Início<input class="module-input" id="abStart" type="datetime-local" required></label><label>Fim<input class="module-input" id="abEnd" type="datetime-local" required></label></div><label>Motivo<input class="module-input" id="abReason" placeholder="Férias, reunião, compromisso..."></label><div class="module-form-actions"><button class="module-btn" data-agenda-close type="button">Cancelar</button><button class="module-btn primary" type="submit">Bloquear período</button></div></form>`,(m,close)=>m.querySelector('#agendaBlockForm').addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabase.from('agenda_bloqueios').insert({empresa_id:companyId(),profissional_id:m.querySelector('#abProf').value,inicio_em:new Date(m.querySelector('#abStart').value).toISOString(),fim_em:new Date(m.querySelector('#abEnd').value).toISOString(),motivo:m.querySelector('#abReason').value.trim()||null,criado_por:userId()});if(error)return showToast(error.message);close();showToast('Período bloqueado.');reload()}));
  }

  async function load(){
    const el=root(),empresa=companyId();if(!el||!empresa)return;el.innerHTML='<div class="module-loading">Carregando agenda RENOVA...</div>';
    if(!(await allowed())){el.innerHTML=`<div class="module-shell">${empty('O plano ou o perfil atual não possui acesso à gestão de agendamentos.')}</div>`;return}
    const [aRes,pRes,rRes,dRes,bRes,prodRes]=await Promise.all([
      supabase.from('agendamentos').select('id,produto_id,profissional_id,cliente_nome,cliente_email,cliente_telefone,inicio_em,fim_em,status,observacoes_cliente,observacoes_internas,origem,criado_em').eq('empresa_id',empresa).order('inicio_em',{ascending:true}).limit(500),
      supabase.from('agenda_profissionais').select('id,nome,email,telefone,ativo,timezone').eq('empresa_id',empresa).order('nome'),
      supabase.from('agenda_produto_profissionais').select('id,produto_id,profissional_id,duracao_min,intervalo_min,ativo').eq('empresa_id',empresa),
      supabase.from('agenda_disponibilidades').select('id,profissional_id,dia_semana,hora_inicio,hora_fim,ativo').eq('empresa_id',empresa).order('dia_semana'),
      supabase.from('agenda_bloqueios').select('id,profissional_id,inicio_em,fim_em,motivo').eq('empresa_id',empresa).gte('fim_em',new Date().toISOString()).order('inicio_em').limit(100),
      supabase.from('catalogo_itens').select('id,nome,tipo,ativo,agenda_habilitada,agenda_duracao_min').eq('empresa_id',empresa).eq('ativo',true).order('nome')
    ]);
    const err=[aRes,pRes,rRes,dRes,bRes,prodRes].find(x=>x.error)?.error;if(err){el.innerHTML=`<div class="module-shell">${empty(err.message)}</div>`;return}
    const appointments=aRes.data||[],professionals=pRes.data||[],links=rRes.data||[],availability=dRes.data||[],blocks=bRes.data||[],products=prodRes.data||[];
    const pMap=new Map(professionals.map(x=>[x.id,x])),prodMap=new Map(products.map(x=>[x.id,x]));
    const now=Date.now(),requested=appointments.filter(x=>x.status==='solicitado').length,confirmed=appointments.filter(x=>x.status==='confirmado'&&new Date(x.inicio_em).getTime()>=now).length,todayKey=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()),todayCount=appointments.filter(x=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(x.inicio_em))===todayKey&&!['cancelado','recusado'].includes(x.status)).length;
    el.innerHTML=`<div class="module-shell"><div class="module-toolbar"><div><span class="eyebrow">CONSULTORIAS • AGENDA</span><h2>Agendamentos RENOVA</h2><p>Disponibilidade, profissionais e solicitações conectados aos produtos e serviços da empresa.</p></div><div class="module-actions"><button class="module-btn" id="agendaBlock" type="button">Bloquear período</button><button class="module-btn primary" id="agendaProfessionalNew" type="button">+ Profissional</button></div></div><div class="module-kpis"><article class="module-kpi"><span>Solicitações</span><strong>${requested}</strong></article><article class="module-kpi"><span>Confirmados futuros</span><strong>${confirmed}</strong></article><article class="module-kpi"><span>Hoje</span><strong>${todayCount}</strong></article><article class="module-kpi"><span>Profissionais ativos</span><strong>${professionals.filter(x=>x.ativo).length}</strong></article></div><article class="module-panel"><div class="module-panel-head"><div><h3>Próximos atendimentos</h3><p>Confirme, conclua, recuse ou cancele diretamente por aqui.</p></div></div><div class="module-table-wrap">${appointments.length?`<table class="module-table"><thead><tr><th>Cliente</th><th>Serviço</th><th>Profissional</th><th>Data / hora</th><th>Status</th></tr></thead><tbody>${appointments.map(a=>`<tr><td><strong>${esc(a.cliente_nome)}</strong><small>${esc(a.cliente_telefone||'')} ${a.cliente_email?`• ${esc(a.cliente_email)}`:''}</small></td><td>${esc(prodMap.get(a.produto_id)?.nome||'Consultoria')}</td><td>${esc(pMap.get(a.profissional_id)?.nome||'Profissional')}</td><td>${dt(a.inicio_em)}</td><td><select class="module-select" data-agenda-status="${a.id}">${['solicitado','confirmado','concluido','cancelado','recusado','faltou'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`:empty('Nenhum agendamento registrado.')}</div></article><article class="module-panel"><div class="module-panel-head"><div><h3>Profissionais e disponibilidade</h3><p>Defina quem atende cada produto e os horários que aparecem para o cliente.</p></div></div><div class="module-grid" style="padding:14px">${professionals.length?professionals.map(p=>{const pl=links.filter(x=>x.profissional_id===p.id&&x.ativo),av=availability.filter(x=>x.profissional_id===p.id&&x.ativo);return `<article class="module-card"><div class="module-badge-row">${badge(p.ativo?'confirmado':'cancelado')}</div><h3>${esc(p.nome)}</h3><p>${pl.length?pl.map(x=>esc(prodMap.get(x.produto_id)?.nome||'Produto')).join(' • '):'Nenhum produto vinculado'}</p><small>${av.length?av.map(x=>`${dayNames[x.dia_semana].slice(0,3)} ${String(x.hora_inicio).slice(0,5)}–${String(x.hora_fim).slice(0,5)}`).join(' • '):'Nenhum horário publicado'}</small><div class="module-card-footer"><button class="module-mini" data-agenda-prof="${p.id}" type="button">Editar horários</button></div></article>`}).join(''):empty('Nenhum profissional cadastrado.')}</div></article><article class="module-panel"><div class="module-panel-head"><div><h3>Bloqueios futuros</h3><p>Férias, reuniões e indisponibilidades temporárias.</p></div></div><div class="module-table-wrap">${blocks.length?`<table class="module-table"><thead><tr><th>Profissional</th><th>Período</th><th>Motivo</th><th></th></tr></thead><tbody>${blocks.map(b=>`<tr><td>${esc(pMap.get(b.profissional_id)?.nome||'Profissional')}</td><td>${dt(b.inicio_em)} → ${dt(b.fim_em)}</td><td>${esc(b.motivo||'Bloqueio')}</td><td><button class="module-mini" data-agenda-unblock="${b.id}" type="button">Remover</button></td></tr>`).join('')}</tbody></table>`:empty('Nenhum bloqueio futuro.')}</div></article></div>`;
    el.querySelectorAll('[data-agenda-status]').forEach(s=>s.addEventListener('change',async()=>{const payload={status:s.value,atualizado_em:new Date().toISOString()};if(s.value==='confirmado'){payload.confirmado_por=userId();payload.confirmado_em=new Date().toISOString()}const {error}=await supabase.from('agendamentos').update(payload).eq('id',s.dataset.agendaStatus).eq('empresa_id',empresa);if(error)return showToast(error.message);showToast('Agendamento atualizado.');load();onDataChange?.()}));
    el.querySelector('#agendaProfessionalNew')?.addEventListener('click',()=>configureProfessional(null,products,links,availability,load));
    el.querySelectorAll('[data-agenda-prof]').forEach(btn=>btn.addEventListener('click',()=>configureProfessional(professionals.find(x=>x.id===btn.dataset.agendaProf),products,links,availability,load)));
    el.querySelector('#agendaBlock')?.addEventListener('click',()=>professionals.length?blockTime(professionals,load):showToast('Cadastre um profissional primeiro.'));
    el.querySelectorAll('[data-agenda-unblock]').forEach(btn=>btn.addEventListener('click',async()=>{const {error}=await supabase.from('agenda_bloqueios').delete().eq('id',btn.dataset.agendaUnblock).eq('empresa_id',empresa);if(error)return showToast(error.message);showToast('Bloqueio removido.');load()}));
  }
  function reset(){document.getElementById('agendaModalBackdrop')?.remove()}
  return{load,reset,allowed};
}
