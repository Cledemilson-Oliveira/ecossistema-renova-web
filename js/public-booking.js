const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateKey=v=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date(v));
const dateLabel=v=>new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(v));
const timeLabel=v=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date(v));

function ensureCss(){if(document.querySelector('link[data-booking-css]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='./css/booking.css?v=20260914-001';l.dataset.bookingCss='1';document.head.appendChild(l)}

export function createPublicBooking({supabase,showToast}){
  ensureCss();
  function close(){document.getElementById('bookingBackdrop')?.remove()}
  function shell(title,body){close();const wrap=document.createElement('div');wrap.id='bookingBackdrop';wrap.className='booking-backdrop';wrap.innerHTML=`<div class="booking-modal" role="dialog" aria-modal="true"><div class="booking-head"><h3>${esc(title)}</h3><button class="booking-close" data-booking-close type="button">×</button></div><div class="booking-body">${body}</div></div>`;document.body.appendChild(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-booking-close]'))close()});return wrap}

  async function loadProductBySlug(slug){const {data,error}=await supabase.rpc('get_catalogo_publico');if(error)throw error;return (data||[]).find(p=>p.slug===slug)||null}

  async function openBySlug(slug){try{const product=await loadProductBySlug(slug);if(!product)return showToast?.('Consultoria indisponível no momento.');return open(product)}catch(err){console.error('RENOVA booking product',err);showToast?.('Não foi possível abrir a agenda agora.')}}

  async function open(product){
    const id=product?.produto_id||product?.id;if(!id)return showToast?.('Produto inválido para agendamento.');
    const wrap=shell(product.nome||'Agendar consultoria','<div class="booking-note">Consultando os horários disponíveis...</div>');
    const body=wrap.querySelector('.booking-body');
    try{
      const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
      const {data,error}=await supabase.rpc('get_agenda_publica_produto',{p_produto_id:id,p_data_inicio:today,p_dias:14});
      if(error)throw error;
      const slots=data||[];
      if(!slots.length){body.innerHTML='<div class="booking-note"><strong>Nenhum horário publicado agora.</strong><br>O profissional ainda não liberou horários ou a agenda está completa. Tente novamente mais tarde.</div>';return}
      const groups=new Map();for(const s of slots){const k=dateKey(s.inicio_em);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s)}
      body.innerHTML=`<div class="booking-note"><strong>${esc(product.nome||'Consultoria')}</strong><br>Escolha um horário disponível e preencha seus dados para solicitar o atendimento.</div><div class="booking-slots">${[...groups.entries()].map(([,arr])=>`<section class="booking-day"><strong>${esc(dateLabel(arr[0].inicio_em))}</strong><div class="booking-slot-grid">${arr.map((s,i)=>`<button class="booking-slot" type="button" data-slot="${esc(s.profissional_id)}|${esc(s.inicio_em)}" title="${esc(s.profissional_nome)}">${esc(timeLabel(s.inicio_em))}</button>`).join('')}</div></section>`).join('')}</div><form id="bookingForm" class="booking-form" style="display:none"><input id="bookingProfessional" type="hidden"><input id="bookingStart" type="hidden"><div class="booking-note" id="bookingSelected"></div><div class="booking-grid"><label>Seu nome<input id="bookingName" required autocomplete="name"></label><label>WhatsApp<input id="bookingPhone" required autocomplete="tel"></label></div><label>E-mail<input id="bookingEmail" type="email" autocomplete="email"></label><label>O que você gostaria de conversar?<textarea id="bookingNotes" placeholder="Conte rapidamente o contexto para o profissional se preparar."></textarea></label><div class="booking-actions"><button class="booking-btn" data-booking-close type="button">Cancelar</button><button class="booking-btn primary" id="bookingSubmit" type="submit">Solicitar agendamento</button></div></form>`;
      const form=body.querySelector('#bookingForm');
      body.querySelectorAll('[data-slot]').forEach(btn=>btn.addEventListener('click',()=>{body.querySelectorAll('[data-slot]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');const [prof,start]=btn.dataset.slot.split('|');const slot=slots.find(s=>s.profissional_id===prof&&s.inicio_em===start);body.querySelector('#bookingProfessional').value=prof;body.querySelector('#bookingStart').value=start;body.querySelector('#bookingSelected').innerHTML=`<strong>Horário escolhido:</strong> ${esc(dateLabel(start))} às ${esc(timeLabel(start))}${slot?.profissional_nome?` • ${esc(slot.profissional_nome)}`:''}`;form.style.display='grid';form.scrollIntoView({behavior:'smooth',block:'nearest'})}));
      form.addEventListener('submit',async e=>{e.preventDefault();const btn=body.querySelector('#bookingSubmit');btn.disabled=true;btn.textContent='Enviando...';try{const {data,error}=await supabase.rpc('criar_agendamento_publico',{p_produto_id:id,p_profissional_id:body.querySelector('#bookingProfessional').value,p_inicio_em:body.querySelector('#bookingStart').value,p_nome:body.querySelector('#bookingName').value.trim(),p_email:body.querySelector('#bookingEmail').value.trim(),p_telefone:body.querySelector('#bookingPhone').value.trim(),p_observacoes:body.querySelector('#bookingNotes').value.trim()||null});if(error)throw error;body.innerHTML=`<div class="booking-success"><strong>Solicitação enviada ✅</strong><span>Seu agendamento foi registrado para ${esc(dateLabel(data.inicio_em))} às ${esc(timeLabel(data.inicio_em))}. A empresa poderá confirmar ou ajustar o atendimento pelo RENOVA.</span><div class="booking-actions" style="justify-content:center"><button class="booking-btn primary" data-booking-close type="button">Fechar</button></div></div>`}catch(err){showToast?.(err.message||'Não foi possível concluir o agendamento.');btn.disabled=false;btn.textContent='Solicitar agendamento'}})
    }catch(err){console.error('RENOVA booking slots',err);body.innerHTML='<div class="booking-note">Não foi possível carregar os horários agora.</div>'}
  }
  return{open,openBySlug,close};
}
