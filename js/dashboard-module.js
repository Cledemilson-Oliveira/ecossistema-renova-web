const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const dateFmt=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'});
const CLOSED=new Set(['concluida','concluído','concluido','cancelada','cancelado','fechada','fechado']);
const SALE_CLOSED=new Set(['fechada','fechado','pago','paga','aprovado','approved']);
const APPOINTMENT_CLOSED=new Set(['cancelado','cancelada','concluido','concluído','realizado']);
const n=v=>{const x=Number(v||0);return Number.isFinite(x)?x:0};
const low=v=>String(v||'').trim().toLowerCase();
function dateOf(row,fields){for(const f of fields){if(row?.[f]){const d=new Date(row[f]);if(!Number.isNaN(d.getTime()))return d}}return null}
function sameMonth(d,now=new Date()){return d&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}
function setText(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
function esc(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function ensureStyles(){if(document.getElementById('renovaDashboardCss'))return;const l=document.createElement('link');l.id='renovaDashboardCss';l.rel='stylesheet';l.href='./css/dashboard.css?v=20260914-004';document.head.appendChild(l)}
function ensureShell(){const page=document.getElementById('dashboardPage');if(!page)return;page.innerHTML=`
<div class="welcome-row"><div><h2 id="welcomeText">Olá! 👋</h2><p>Dashboard central do Ecossistema RENOVA: todos os módulos da empresa em uma única visão.</p></div></div>
<div class="dashboard-context"><strong id="dashboardContext">Carregando contexto...</strong><span id="dashboardUpdated">Atualizando dados...</span></div>
<div class="dashboard-metrics">
 <article class="dashboard-metric positive"><span class="metric-label">Faturamento do mês</span><strong id="dashRevenue">R$ 0,00</strong><small>Receitas pagas de todos os módulos</small></article>
 <article class="dashboard-metric"><span class="metric-label">Vendas fechadas</span><strong id="dashSalesCount">0</strong><small id="dashSalesValue">R$ 0,00</small></article>
 <article class="dashboard-metric warning"><span class="metric-label">Leads</span><strong id="dashLeads">0</strong><small>CRM • Vitrine • Agenda • Food</small></article>
 <article class="dashboard-metric positive"><span class="metric-label">Clientes</span><strong id="dashClients">0</strong><small>Contatos convertidos</small></article>
 <article class="dashboard-metric"><span class="metric-label">Agendamentos do mês</span><strong id="dashAppointments">0</strong><small id="dashUpcomingAppointments">0 próximos</small></article>
 <article class="dashboard-metric warning"><span class="metric-label">Pedidos do mês</span><strong id="dashOrdersCount">0</strong><small id="dashOpenPedidos">0 em operação</small></article>
 <article class="dashboard-metric danger"><span class="metric-label">Despesas pagas</span><strong id="dashExpense">R$ 0,00</strong><small>No mês atual</small></article>
 <article class="dashboard-metric positive"><span class="metric-label">Resultado operacional</span><strong id="dashBalance">R$ 0,00</strong><small>Receitas − despesas pagas</small></article>
</div>
<div class="dashboard-columns">
 <section class="dashboard-panel"><div class="panel-heading"><div><span class="eyebrow">ATIVIDADE CENTRAL</span><h3>Movimentações recentes</h3></div><span>Todos os módulos</span></div><div id="dashboardActivity" class="activity-list"><div class="empty-state">Carregando...</div></div></section>
 <section class="dashboard-panel"><div class="panel-heading"><div><span class="eyebrow">OPERAÇÃO</span><h3>Atenção agora</h3></div></div><div class="operation-stack">
  <div class="operation-row"><span>Ordens de serviço abertas</span><strong id="dashOpenOrders">0</strong></div>
  <div class="operation-row"><span>Tarefas abertas</span><strong id="dashOpenTasks">0</strong></div>
  <div class="operation-row"><span>Tarefas atrasadas</span><strong id="dashOverdueTasks">0</strong></div>
  <div class="operation-row"><span>Aguardando ação do dono</span><strong id="dashOwnerAction">0</strong></div>
  <div class="operation-row"><span>Tarefas bloqueadas</span><strong id="dashBlockedTasks">0</strong></div>
 </div><p class="operation-note">Pedido ainda não pago entra na operação. Quando o pagamento é confirmado, ele vira Venda e Receita automaticamente.</p></section>
</div>`}
function renderActivity(items){const root=document.getElementById('dashboardActivity');if(!root)return;if(!items.length){root.innerHTML='<div class="empty-state">Nenhuma atividade recente.</div>';return}root.innerHTML=items.slice(0,12).map(item=>{const d=item.date?dateFmt.format(item.date):'—';return `<div class="activity-item"><div class="activity-icon ${item.kind}">${item.icon}</div><div class="activity-copy"><strong>${esc(item.title)}</strong><span>${esc(item.detail)} • ${d}</span></div>${item.value!==undefined&&item.value!==null?`<b>${money.format(item.value)}</b>`:''}</div>`}).join('')}
export async function loadDashboard({supabase,company,profile}){
 ensureStyles();ensureShell();if(!supabase||!company?.id)return;
 const companyId=company.id;
 const [contactsRes,salesRes,financeRes,tasksRes,serviceOrdersRes,appointmentsRes,pedidosRes]=await Promise.all([
  supabase.from('contatos').select('id,nome,tipo,etapa,origem,criado_em').eq('empresa_id',companyId),
  supabase.from('vendas').select('id,cliente_nome,produto_nome,produto,valor,status,data_venda,criado_em,origem').eq('empresa_id',companyId),
  supabase.from('financeiro').select('id,tipo,categoria,descricao,valor,status,vencimento,data_pagamento,criado_em,origem').eq('empresa_id',companyId),
  supabase.from('tarefas').select('id,titulo,categoria,status,prioridade,data,bloqueada,requer_acao_dono,criado_em').eq('empresa_id',companyId),
  supabase.from('ordens_servico').select('id,servico,valor,status,prazo,criado_em').eq('empresa_id',companyId),
  supabase.from('agendamentos').select('id,cliente_nome,status,inicio_em,fim_em,origem,criado_em').eq('empresa_id',companyId),
  supabase.from('pedidos').select('id,codigo,cliente_nome,total,status,status_pagamento,forma_pagamento,criado_em,atualizado_em').eq('empresa_id',companyId)
 ]);
 const responses=[contactsRes,salesRes,financeRes,tasksRes,serviceOrdersRes,appointmentsRes,pedidosRes];const errors=responses.map(r=>r.error).filter(Boolean);if(errors.length){console.error('RENOVA dashboard',errors);setText('dashboardUpdated','Dados parcialmente disponíveis')}
 const contacts=contactsRes.data||[],sales=salesRes.data||[],finance=financeRes.data||[],tasks=tasksRes.data||[],serviceOrders=serviceOrdersRes.data||[],appointments=appointmentsRes.data||[],pedidos=pedidosRes.data||[],now=new Date();
 const paidFinance=finance.filter(f=>low(f.status)==='pago');
 const monthRevenue=paidFinance.filter(f=>low(f.tipo)==='receita'&&sameMonth(dateOf(f,['data_pagamento','criado_em']),now)).reduce((s,f)=>s+n(f.valor),0);
 const monthExpense=paidFinance.filter(f=>low(f.tipo)==='despesa'&&sameMonth(dateOf(f,['data_pagamento','criado_em']),now)).reduce((s,f)=>s+n(f.valor),0);
 const monthSales=sales.filter(v=>SALE_CLOSED.has(low(v.status))&&sameMonth(dateOf(v,['data_venda','criado_em']),now));
 const monthSalesValue=monthSales.reduce((s,v)=>s+n(v.valor),0);
 const leads=contacts.filter(c=>low(c.tipo)!=='cliente'),clients=contacts.filter(c=>low(c.tipo)==='cliente');
 const monthAppointments=appointments.filter(a=>sameMonth(dateOf(a,['inicio_em','criado_em']),now));
 const upcomingAppointments=appointments.filter(a=>{const d=dateOf(a,['inicio_em']);return d&&d>=now&&!APPOINTMENT_CLOSED.has(low(a.status))});
 const monthPedidos=pedidos.filter(p=>sameMonth(dateOf(p,['criado_em']),now));
 const openPedidos=pedidos.filter(p=>!['concluido','concluído','cancelado','cancelada'].includes(low(p.status)));
 const openTasks=tasks.filter(t=>!CLOSED.has(low(t.status))),openOrders=serviceOrders.filter(o=>!CLOSED.has(low(o.status)));
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const overdue=openTasks.filter(t=>{const d=dateOf(t,['data']);return d&&d<today}),ownerAction=openTasks.filter(t=>t.requer_acao_dono===true),blocked=openTasks.filter(t=>t.bloqueada===true);
 setText('dashRevenue',money.format(monthRevenue));setText('dashSalesCount',String(monthSales.length));setText('dashSalesValue',money.format(monthSalesValue));setText('dashLeads',String(leads.length));setText('dashClients',String(clients.length));setText('dashAppointments',String(monthAppointments.length));setText('dashUpcomingAppointments',`${upcomingAppointments.length} próximos`);setText('dashOrdersCount',String(monthPedidos.length));setText('dashOpenPedidos',`${openPedidos.length} em operação`);setText('dashOpenTasks',String(openTasks.length));setText('dashExpense',money.format(monthExpense));setText('dashBalance',money.format(monthRevenue-monthExpense));setText('dashOpenOrders',String(openOrders.length));setText('dashOverdueTasks',String(overdue.length));setText('dashOwnerAction',String(ownerAction.length));setText('dashBlockedTasks',String(blocked.length));setText('dashboardUpdated',`Atualizado agora • ${company.nome||'Empresa'}`);
 const activities=[];
 finance.forEach(f=>activities.push({kind:low(f.tipo)==='receita'?'revenue':'expense',icon:low(f.tipo)==='receita'?'↗':'↘',title:f.descricao||f.tipo,detail:`${f.tipo} • ${f.status||''}${f.origem?` • ${f.origem}`:''}`,value:n(f.valor),date:dateOf(f,['data_pagamento','vencimento','criado_em'])}));
 sales.forEach(v=>activities.push({kind:'sale',icon:'◈',title:v.cliente_nome||'Venda',detail:`${v.produto_nome||v.produto||'Venda'} • ${v.status||''}${v.origem?` • ${v.origem}`:''}`,value:n(v.valor),date:dateOf(v,['data_venda','criado_em'])}));
 appointments.forEach(a=>activities.push({kind:'task',icon:'◷',title:a.cliente_nome||'Agendamento',detail:`Agendamento • ${a.status||''}`,date:dateOf(a,['inicio_em','criado_em'])}));
 pedidos.forEach(p=>activities.push({kind:'sale',icon:'▦',title:p.cliente_nome||'Pedido',detail:`Pedido ${p.codigo||''} • ${p.status_pagamento||p.status||''}`,value:n(p.total),date:dateOf(p,['atualizado_em','criado_em'])}));
 tasks.forEach(t=>activities.push({kind:'task',icon:'▣',title:t.titulo||'Tarefa',detail:`${t.categoria||'Tarefa'} • ${t.status||''}`,date:dateOf(t,['data','criado_em'])}));
 activities.sort((a,b)=>(b.date?.getTime()||0)-(a.date?.getTime()||0));renderActivity(activities);
 const role=profile?.dono_sistema?'Conta Dono':(profile?.admin?'Administrador':(profile?.papel||'Usuário'));setText('dashboardContext',`${company.nome||'RENOVA'} • ${(company.plano_codigo||'free').toUpperCase()} • ${role}`);
 const welcome=document.getElementById('welcomeText');if(welcome){const name=profile?.nome||'Usuário';welcome.textContent=`Olá, ${name.split(' ')[0]}! 👋`}
}