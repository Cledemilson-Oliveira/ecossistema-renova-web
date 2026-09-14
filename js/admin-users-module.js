const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

export function createAdminUsersModule({supabase,getContext,showToast}){
  const ctx=()=>getContext?.()||{};
  const isOwner=()=>Boolean(ctx().profile?.dono_sistema);

  function modal(title,html,onReady){
    document.getElementById('adminUsersModal')?.remove();
    const wrap=document.createElement('div');
    wrap.id='adminUsersModal';
    wrap.className='module-modal-backdrop';
    wrap.innerHTML=`<div class="module-modal" role="dialog" aria-modal="true"><div class="module-modal-head"><h3>${esc(title)}</h3><button class="module-modal-close" data-admin-user-close type="button">×</button></div><div class="module-modal-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-admin-user-close]'))close()});
    onReady?.(wrap,close);
  }

  async function invoke(body){
    const {data,error}=await supabase.functions.invoke('renova-admin-usuarios',{body});
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||'Não foi possível concluir a ação.');
    return data;
  }

  async function enhance(){
    if(!isOwner())return;
    const page=document.getElementById('adminPage');
    const shell=page?.querySelector('.module-shell');
    if(!shell||document.getElementById('adminUsersPanel'))return;

    const host=document.createElement('article');
    host.id='adminUsersPanel';
    host.className='module-panel';
    host.innerHTML='<div class="module-loading">Carregando usuários...</div>';
    shell.appendChild(host);

    let data;
    try{data=await invoke({action:'list'})}
    catch(err){
      console.error('RENOVA admin users',err);
      host.innerHTML='<div class="module-empty">Não foi possível carregar os usuários agora.</div>';
      return;
    }

    const users=data.users||[];
    host.innerHTML=`
      <div class="module-panel-head">
        <div><h3>Usuários e acesso</h3><p>Conta Dono pode redefinir a senha dos usuários do Ecossistema RENOVA.</p></div>
      </div>
      <div class="module-note" style="margin:14px"><strong>Segurança:</strong> a nova senha é enviada para uma função administrativa protegida no Supabase e nunca fica salva ou exposta no navegador.</div>
      <div class="module-table-wrap">
        ${users.length?`<table class="module-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Empresa</th><th>Status</th><th>Ação</th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.nome||'Usuário RENOVA')}</strong><small>${esc(u.email||'Sem e-mail')}</small></td><td><span class="module-status info">${esc(u.papel||'Usuário')}</span></td><td>${esc((u.empresas||[]).map(e=>e.nome).join(', ')||'—')}</td><td><span class="module-status ${u.ativo?'ok':'bad'}">${u.ativo?'Ativo':'Inativo'}</span></td><td>${u.dono_sistema?'<span class="module-status">Protegido</span>':`<button class="module-mini" type="button" data-change-password="${esc(u.id)}">Alterar senha</button>`}</td></tr>`).join('')}</tbody></table>`:'<div class="module-empty">Nenhum usuário encontrado.</div>'}
      </div>`;

    host.querySelectorAll('[data-change-password]').forEach(btn=>btn.addEventListener('click',()=>{
      const user=users.find(u=>u.id===btn.dataset.changePassword);
      if(!user)return;
      modal(`Alterar senha • ${user.nome||user.email||'Usuário'}`,`
        <form id="adminPasswordForm" class="module-form">
          <div class="module-note"><strong>Usuário:</strong> ${esc(user.nome||'Usuário RENOVA')}<br>${esc(user.email||'')}</div>
          <label>Nova senha
            <div class="admin-password-field"><input id="adminNewPassword" class="module-input" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><button class="module-mini" data-toggle-password="adminNewPassword" type="button">Mostrar</button></div>
          </label>
          <label>Confirmar nova senha
            <div class="admin-password-field"><input id="adminConfirmPassword" class="module-input" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><button class="module-mini" data-toggle-password="adminConfirmPassword" type="button">Mostrar</button></div>
          </label>
          <div class="module-note">Use pelo menos 8 caracteres. A alteração passa a valer imediatamente no próximo login do usuário.</div>
          <div class="module-form-actions"><button class="module-btn" data-admin-user-close type="button">Cancelar</button><button class="module-btn primary" type="submit">Alterar senha</button></div>
        </form>`,(m,close)=>{
          m.querySelectorAll('[data-toggle-password]').forEach(toggle=>toggle.addEventListener('click',()=>{
            const input=m.querySelector('#'+toggle.dataset.togglePassword);
            const reveal=input.type==='password';
            input.type=reveal?'text':'password';
            toggle.textContent=reveal?'Ocultar':'Mostrar';
          }));
          m.querySelector('#adminPasswordForm').addEventListener('submit',async e=>{
            e.preventDefault();
            const password=m.querySelector('#adminNewPassword').value;
            const confirm=m.querySelector('#adminConfirmPassword').value;
            if(password.length<8)return showToast('A nova senha deve ter pelo menos 8 caracteres.','error');
            if(password!==confirm)return showToast('As senhas não coincidem. Confira e tente novamente.','error');
            const submit=e.submitter;
            submit.disabled=true;submit.textContent='Alterando...';
            try{
              const result=await invoke({action:'set_password',user_id:user.id,password});
              close();
              showToast(result.message||'Senha alterada com sucesso.','success');
            }catch(err){
              console.error('RENOVA password change',err);
              showToast(err.message||'Não foi possível alterar a senha.','error');
              submit.disabled=false;submit.textContent='Alterar senha';
            }
          });
        });
    }));
  }

  function reset(){document.getElementById('adminUsersModal')?.remove();document.getElementById('adminUsersPanel')?.remove()}
  return{enhance,reset};
}
