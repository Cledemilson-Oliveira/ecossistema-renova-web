import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { RENOVA_CONFIG, isSupabaseConfigured } from './config.js?v=20260913-001';

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const root = document.documentElement;
const body = document.body;

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentCompany = null;

const pageMeta = {
  dashboard:['VISÃO GERAL','Painel'], crm:['GESTÃO','CRM / Clientes'], sales:['GESTÃO','Vendas'],
  orders:['OPERAÇÃO','Ordens de Serviço'], tasks:['PRODUTIVIDADE','Tarefas / Agenda'],
  products:['CATÁLOGO','Produtos / Serviços'], finance:['FINANCEIRO','Financeiro'], ai:['INTELIGÊNCIA','RENOVA IA'],
  affiliates:['CRESCIMENTO','Afiliados'], members:['CONHECIMENTO','Área de Membros'], settings:['SISTEMA','Configurações'],
  admin:['ADMINISTRAÇÃO','Administração']
};

function showToast(message, timeout=2800){
  const toast = $('#toast');
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>toast.classList.remove('show'), timeout);
}

function applyBrand(){
  const { brand } = RENOVA_CONFIG;
  ['#authLogo','#authLogoMobile','#sidebarLogo','#companyLogo'].forEach(id=>{const img=$(id);if(img)img.src=brand.logoUrl;});
  const dev=$('#developerPhoto'); if(dev)dev.src=brand.developerPhotoUrl;
}

function preferredTheme(){
  const saved=localStorage.getItem('renova_web_theme');
  return saved==='dark'?'dark':'light';
}
function applyTheme(theme){
  root.dataset.theme=theme;
  localStorage.setItem('renova_web_theme',theme);
  const meta=$('meta[name="theme-color"]');
  if(meta)meta.content=theme==='dark'?'#061426':'#f6f9fc';
  const btn=$('#themeToggle'); if(btn)btn.textContent=theme==='dark'?'☀':'☾';
}

function closeMobileMenu(){
  body.classList.remove('menu-open');
  const btn=$('#mobileMenuBtn');
  if(btn){btn.setAttribute('aria-expanded','false');btn.innerHTML='<span>☰</span><b>Menu</b>';}
}
function toggleMobileMenu(){
  const open=!body.classList.contains('menu-open');
  body.classList.toggle('menu-open',open);
  const btn=$('#mobileMenuBtn');
  if(btn){btn.setAttribute('aria-expanded',open?'true':'false');btn.innerHTML=open?'<span>×</span><b>Fechar</b>':'<span>☰</span><b>Menu</b>';}
}

function goToPage(page){
  if(!pageMeta[page]) page='dashboard';
  $$('.page').forEach(el=>el.classList.toggle('active',el.id===`${page}Page`));
  $$('[data-page]').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
  const [eyebrow,title]=pageMeta[page];
  $('#pageEyebrow').textContent=eyebrow;
  $('#pageTitle').textContent=title;
  closeMobileMenu();
}

function initials(name='RENOVA'){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'R';
}

function setConnection(status, ok=true){
  const badge=$('#connectionBadge');
  if(!badge)return;
  badge.innerHTML=`<i></i> ${status}`;
  badge.style.opacity=ok?'1':'.78';
}

function renderUserContext(){
  const profile=currentProfile||{};
  const company=currentCompany||{};
  const name=profile.nome || currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0] || 'Usuário RENOVA';
  const role=profile.dono_sistema?'Conta Dono':(profile.admin?'Administrador':(profile.papel||'Usuário'));
  $('#sidebarUserName').textContent=name;
  $('#sidebarUserRole').textContent=role;
  $('#userAvatar').textContent=initials(name);
  $('#welcomeText').textContent=`Olá, ${name.split(' ')[0]}! 👋`;
  $('#metricCompany').textContent=company.nome||'RENOVA';
  $('#metricPlan').textContent=(company.plano_codigo||'free').toUpperCase();
  $('#metricRole').textContent=role;
  $('#metricStatus').textContent='Conectado';
  $$('.owner-only').forEach(el=>el.classList.toggle('hidden',!profile.dono_sistema));
}

async function loadProfileAndCompany(){
  if(!supabase || !currentUser)return;
  try{
    const {data:profile,error:profileError}=await supabase.from('perfis')
      .select('id,nome,email,telefone,papel,admin,dono_sistema,ativo,tema_interface')
      .eq('id',currentUser.id).maybeSingle();
    if(profileError)throw profileError;
    currentProfile=profile||{};

    const {data:links,error:linkError}=await supabase.from('empresa_usuarios')
      .select('empresa_id,papel,ativo').eq('user_id',currentUser.id).eq('ativo',true).limit(1);
    if(linkError)throw linkError;
    const companyId=links?.[0]?.empresa_id;
    if(companyId){
      const {data:company,error:companyError}=await supabase.from('empresas')
        .select('id,nome,plano_codigo,status_assinatura,ativo').eq('id',companyId).maybeSingle();
      if(companyError)throw companyError;
      currentCompany=company||{};
    }else currentCompany={};
    renderUserContext();
  }catch(err){
    console.error('RENOVA context error',err);
    showToast('Sessão conectada, mas o contexto da empresa ainda precisa ser validado.');
    renderUserContext();
  }
}

async function showApp(session){
  currentUser=session.user;
  $('#authView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  setConnection('Conectado');
  await loadProfileAndCompany();
  goToPage('dashboard');
}
function showAuth(){
  currentUser=null;currentProfile=null;currentCompany=null;
  $('#appView').classList.add('hidden');
  $('#authView').classList.remove('hidden');
}

async function login(event){
  event.preventDefault();
  if(!supabase){showToast('A chave pública do Supabase ainda não foi configurada.');return;}
  const email=$('#loginEmail').value.trim();
  const password=$('#loginPassword').value;
  const btn=$('#loginBtn');
  btn.disabled=true;btn.textContent='Entrando...';
  try{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)throw error;
    if(!data.session)throw new Error('Sessão não criada.');
    await showApp(data.session);
  }catch(err){showToast(err.message||'Não foi possível entrar.');}
  finally{btn.disabled=false;btn.textContent='Entrar';}
}

async function logout(){
  if(supabase) await supabase.auth.signOut();
  showAuth();
}

async function forgotPassword(){
  if(!supabase){showToast('Conexão pública do Supabase ainda não configurada.');return;}
  const email=$('#loginEmail').value.trim();
  if(!email){showToast('Informe seu e-mail primeiro.');return;}
  try{
    const redirectTo=`${location.origin}${location.pathname}`;
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    if(error)throw error;
    showToast('Enviamos o link de recuperação para seu e-mail.');
  }catch(err){showToast(err.message||'Não foi possível enviar a recuperação.');}
}

function bindUi(){
  $('#loginForm')?.addEventListener('submit',login);
  $('#forgotBtn')?.addEventListener('click',forgotPassword);
  $('#logoutBtn')?.addEventListener('click',logout);
  $('#themeToggle')?.addEventListener('click',()=>applyTheme(root.dataset.theme==='dark'?'light':'dark'));
  $('#mobileMenuBtn')?.addEventListener('click',toggleMobileMenu);
  $('#mobileBackdrop')?.addEventListener('click',closeMobileMenu);
  $('#mainNav')?.addEventListener('click',e=>{const btn=e.target.closest('[data-page]');if(btn)goToPage(btn.dataset.page);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobileMenu();});
  window.addEventListener('resize',()=>{if(innerWidth>760)closeMobileMenu();});
}

async function initSupabase(){
  const notice=$('#setupNotice');
  if(!isSupabaseConfigured()){
    notice.classList.remove('hidden');
    notice.innerHTML='<strong>Base Web criada.</strong><br>Falta somente cadastrar a chave pública/publishable do Supabase em <code>js/config.js</code>. Nenhum segredo privado deve ser colocado no frontend.';
    $('#loginBtn').disabled=true;
    setConnection('Configuração pendente',false);
    return;
  }
  supabase=createClient(RENOVA_CONFIG.supabaseUrl,RENOVA_CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await supabase.auth.getSession();
  if(session)await showApp(session);else showAuth();
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_OUT'||!session)showAuth();
    else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')await showApp(session);
  });
}

applyBrand();
applyTheme(preferredTheme());
bindUi();
initSupabase();
