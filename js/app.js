/* =========================================================
   CONFIG DA API / BACKEND
   Se o frontend e o backend estiverem em domínios/portas diferentes,
   troque o valor abaixo pela URL completa, ex: 'https://minhaapi.com/api'
========================================================= */
const API_BASE = 'https://curso-ingles-ep7u.onrender.com/api';

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('service-worker.js').catch(()=>{ /* offline/instalável fica indisponível, mas o app segue funcionando normal */ });
  });
}

/* =========================================================
   AUTENTICACAO E SINCRONIZACAO COM O BACKEND
========================================================= */
const AUTH_TOKEN_KEY = 'passaporte_auth_token';
const AUTH_USER_KEY = 'passaporte_auth_user';
let authToken = null;
let syncTimer = null;

function getAuthToken(){ return authToken || (authToken = localStorage.getItem(AUTH_TOKEN_KEY)); }
function setAuth(token, user){
  authToken = token;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user||{}));
  updateAccountPill();
}
function clearAuth(){
  authToken = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  updateAccountPill();
}
function getCachedUser(){
  const raw = localStorage.getItem(AUTH_USER_KEY);
  try{ return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
}
function updateAccountPill(){
  const pill = document.getElementById('account-pill');
  const label = document.getElementById('account-label');
  const avatarSpan = document.getElementById('account-pill-avatar');
  if(!pill) return;
  const user = getCachedUser();
  if(getAuthToken() && user){
    label.textContent = user.name || user.email || 'Conta';
    avatarSpan.innerHTML = user.avatarData ? '<img src="'+user.avatarData+'" alt="">' : '👤';
    pill.style.display = 'flex';
  } else {
    pill.style.display = 'none';
  }
}
/* Redimensiona/comprime uma imagem escolhida pelo usuário antes de mandar pro servidor
   (evita fotos gigantes de celular lotarem o banco de dados). */
function resizeImageFile(file, maxDim, quality){
  maxDim = maxDim || 200; quality = quality || 0.82;
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = ()=>{
      const img = new Image();
      img.onerror = ()=>reject(new Error('Arquivo de imagem inválido.'));
      img.onload = ()=>{
        let w = img.width, h = img.height;
        const side = Math.min(w, h); // recorta um quadrado central
        const sx = (w-side)/2, sy = (h-side)/2;
        const canvas = document.createElement('canvas');
        canvas.width = maxDim; canvas.height = maxDim;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxDim, maxDim);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function apiRequest(path, opts){
  opts = opts || {};
  const headers = Object.assign({'Content-Type':'application/json'}, opts.headers||{});
  if(getAuthToken()) headers['Authorization'] = 'Bearer '+getAuthToken();
  const res = await fetch(API_BASE+path, Object.assign({}, opts, {headers}));
  let data = null;
  try{ data = await res.json(); }catch(e){ /* resposta sem corpo */ }
  if(!res.ok) throw new Error((data && data.error) || 'Erro de conexão com o servidor.');
  return data;
}
async function fetchRemoteProgress(){
  const data = await apiRequest('/progress');
  if(data && data.state && Object.keys(data.state).length){
    state = Object.assign(state, data.state);
  }
}
async function pushRemoteProgress(){
  if(!getAuthToken()) return;
  try{ await apiRequest('/progress', {method:'PUT', body: JSON.stringify({state: state})}); }
  catch(e){ /* falha silenciosa - tenta de novo na próxima alteração; dado já está salvo local */ }
}
function scheduleSync(){
  if(!getAuthToken()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushRemoteProgress, 1200);
}
document.getElementById('account-pill').addEventListener('click', ()=>{
  const user = getCachedUser();
  const preview = document.getElementById('account-avatar-preview');
  const removeBtn = document.getElementById('account-avatar-remove');
  if(user && user.avatarData){
    preview.innerHTML = '<img src="'+user.avatarData+'" alt="">';
    removeBtn.style.display = 'inline';
  } else {
    preview.innerHTML = '<span>👤</span>';
    removeBtn.style.display = 'none';
  }
  document.getElementById('logout-overlay').classList.add('show');
});
document.getElementById('logout-cancel-btn').addEventListener('click', ()=>{
  document.getElementById('logout-overlay').classList.remove('show');
});
document.getElementById('logout-confirm-btn').addEventListener('click', ()=>{
  clearAuth();
  location.reload();
});

/* ---- Configurações ---- */
function applyMotionPref(){
  document.body.classList.toggle('reduce-motion', !!state.reduceMotion);
}
function applyDarkMode(){
  document.body.classList.toggle('dark-mode', !!state.darkMode);
}
document.getElementById('open-settings-btn').addEventListener('click', ()=>{
  document.getElementById('logout-overlay').classList.remove('show');
  const user = getCachedUser();
  document.getElementById('settings-name-input').value = (user && user.name) || '';
  document.getElementById('settings-reduce-motion').checked = !!state.reduceMotion;
  document.getElementById('settings-dark-mode').checked = !!state.darkMode;
  document.getElementById('settings-name-feedback').textContent = '';
  document.getElementById('settings-delete-confirm-area').style.display = 'none';
  document.getElementById('settings-delete-input').value = '';
  showPage('settings');
});
document.getElementById('settings-back-btn').addEventListener('click', ()=>showPage('trilha'));

document.getElementById('settings-name-save').addEventListener('click', async ()=>{
  const name = document.getElementById('settings-name-input').value.trim();
  const fb = document.getElementById('settings-name-feedback');
  if(!getAuthToken()){
    fb.className='produce-feedback bad'; fb.textContent = 'Você está sem conta — crie uma pra salvar o nome na nuvem.';
    return;
  }
  try{
    await apiRequest('/account/name', {method:'PUT', body: JSON.stringify({name})});
    const user = getCachedUser() || {};
    user.name = name;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    updateAccountPill();
    fb.className='produce-feedback ok'; fb.textContent = '✓ Nome salvo!';
  }catch(e){
    fb.className='produce-feedback bad'; fb.textContent = e.message || 'Não foi possível salvar agora.';
  }
});

document.getElementById('settings-reduce-motion').addEventListener('change', (e)=>{
  state.reduceMotion = e.target.checked;
  saveState();
  applyMotionPref();
});
document.getElementById('settings-dark-mode').addEventListener('change', (e)=>{
  state.darkMode = e.target.checked;
  saveState();
  applyDarkMode();
});

document.getElementById('settings-delete-btn').addEventListener('click', ()=>{
  document.getElementById('settings-delete-confirm-area').style.display = 'block';
});
document.getElementById('settings-delete-input').addEventListener('input', (e)=>{
  document.getElementById('settings-delete-confirm-btn').disabled = e.target.value.trim().toUpperCase() !== 'APAGAR';
});
document.getElementById('settings-delete-confirm-btn').addEventListener('click', async ()=>{
  const btn = document.getElementById('settings-delete-confirm-btn');
  btn.disabled = true; btn.textContent = 'Apagando...';
  try{
    if(getAuthToken()) await apiRequest('/account', {method:'DELETE'});
    clearAuth();
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }catch(e){
    btn.disabled = false; btn.textContent = 'Apagar pra sempre';
    alert(e.message || 'Não foi possível apagar a conta agora. Tente de novo.');
  }
});

document.getElementById('account-avatar-choose').addEventListener('click', ()=>document.getElementById('account-avatar-input').click());
document.getElementById('account-avatar-input').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const preview = document.getElementById('account-avatar-preview');
  const previousHtml = preview.innerHTML;
  try{
    const resized = await resizeImageFile(file);
    preview.innerHTML = '<img src="'+resized+'" alt="">';
    await apiRequest('/account/avatar', {method:'PUT', body: JSON.stringify({avatarData: resized})});
    const user = getCachedUser() || {};
    user.avatarData = resized;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    document.getElementById('account-avatar-remove').style.display = 'inline';
    updateAccountPill();
    showToast('✓ Foto atualizada!');
  }catch(err){
    preview.innerHTML = previousHtml;
    showToast('Não foi possível salvar a foto agora. Tente de novo.');
  }
  document.getElementById('account-avatar-input').value = '';
});
document.getElementById('account-avatar-remove').addEventListener('click', async ()=>{
  const preview = document.getElementById('account-avatar-preview');
  try{
    await apiRequest('/account/avatar', {method:'PUT', body: JSON.stringify({avatarData: null})});
    const user = getCachedUser() || {};
    user.avatarData = null;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    preview.innerHTML = '<span>👤</span>';
    document.getElementById('account-avatar-remove').style.display = 'none';
    updateAccountPill();
    showToast('Foto removida.');
  }catch(err){
    showToast('Não foi possível remover a foto agora. Tente de novo.');
  }
});

/* ---- UI da tela de login/cadastro ---- */
let authMode = 'login';
let pendingAvatarData = null;
function resetAvatarPicker(){
  pendingAvatarData = null;
  document.getElementById('auth-avatar-preview').innerHTML = '<span>👤</span>';
  document.getElementById('auth-avatar-remove').style.display = 'none';
  document.getElementById('auth-avatar-input').value = '';
}
function setAuthMode(mode){
  authMode = mode;
  document.getElementById('auth-tab-login').classList.toggle('active', mode==='login');
  document.getElementById('auth-tab-register').classList.toggle('active', mode==='register');
  document.getElementById('auth-field-name').style.display = mode==='register' ? 'block' : 'none';
  document.getElementById('auth-field-avatar').style.display = mode==='register' ? 'block' : 'none';
  if(mode==='login') resetAvatarPicker();
  document.getElementById('auth-submit').textContent = mode==='register' ? 'Criar conta' : 'Entrar';
  document.getElementById('auth-error').classList.remove('show');
}
document.getElementById('auth-avatar-choose').addEventListener('click', ()=>document.getElementById('auth-avatar-input').click());
document.getElementById('auth-avatar-input').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    pendingAvatarData = await resizeImageFile(file);
    document.getElementById('auth-avatar-preview').innerHTML = '<img src="'+pendingAvatarData+'" alt="">';
    document.getElementById('auth-avatar-remove').style.display = 'inline';
  }catch(err){
    document.getElementById('auth-error').textContent = 'Não foi possível usar essa imagem. Tente outra.';
    document.getElementById('auth-error').classList.add('show');
  }
});
document.getElementById('auth-avatar-remove').addEventListener('click', resetAvatarPicker);
document.getElementById('auth-tab-login').addEventListener('click', ()=>setAuthMode('login'));
document.getElementById('auth-tab-register').addEventListener('click', ()=>setAuthMode('register'));
function revealAppWithFade(){
  const overlay = document.getElementById('auth-overlay');
  overlay.classList.add('fading-out');
  document.querySelector('.app-shell').classList.add('entering');
  startApp();
  setTimeout(()=>{ overlay.style.display = 'none'; }, 450); // espera a transição de fade acabar
}
document.getElementById('auth-skip').addEventListener('click', revealAppWithFade);
document.getElementById('auth-submit').addEventListener('click', async ()=>{
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value.trim();
  const errBox = document.getElementById('auth-error');
  errBox.classList.remove('show');
  if(!email || !password){ errBox.textContent = 'Preencha e-mail e senha.'; errBox.classList.add('show'); return; }
  const btn = document.getElementById('auth-submit');
  btn.disabled = true; btn.textContent = 'Aguarde...';
  try{
    const path = authMode==='register' ? '/auth/register' : '/auth/login';
    const body = authMode==='register' ? {email,password,name,avatarData:pendingAvatarData} : {email,password};
    const data = await apiRequest(path, {method:'POST', body: JSON.stringify(body)});
    setAuth(data.token, data.user);
    resetAvatarPicker();
    await fetchRemoteProgress();
    revealAppWithFade();
  }catch(e){
    errBox.textContent = e.message || 'Não foi possível conectar ao servidor.';
    errBox.classList.add('show');
  }finally{
    btn.disabled = false; btn.textContent = authMode==='register' ? 'Criar conta' : 'Entrar';
  }
});

/* =========================================================
   TTS
========================================================= */
function speak(text){
  if(!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g,''));
  u.lang = 'en-US'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/* =========================================================
   VOCABULARIO (17 temas)
========================================================= */
const VOCAB = {
  cumprimentos:{title:"Cumprimentos",icon:"👋",words:[
    ["Hello","Olá"],["Good morning","Bom dia"],["Good afternoon","Boa tarde"],["Good evening","Boa noite (chegando)"],
    ["Goodbye","Tchau"],["See you later","Até mais"],["Thank you","Obrigado(a)"],["Please","Por favor"],
    ["Excuse me","Com licença"],["Sorry","Desculpe"],["How are you?","Como você está?"],["I'm fine, thanks","Estou bem, obrigado"],
    ["Welcome","Bem-vindo"],["Take care","Se cuida"]]},
  familia:{title:"Família",icon:"👨‍👩‍👧",words:[
    ["Mother","Mãe"],["Father","Pai"],["Sister","Irmã"],["Brother","Irmão"],
    ["Son","Filho"],["Daughter","Filha"],["Grandmother","Avó"],["Grandfather","Avô"],
    ["Husband","Marido"],["Wife","Esposa"],["Friend","Amigo(a)"],["Cousin","Primo(a)"]]},
  numeros:{title:"Números",icon:"🔢",words:[
    ["One","Um"],["Two","Dois"],["Three","Três"],["Four","Quatro"],["Five","Cinco"],
    ["Six","Seis"],["Seven","Sete"],["Eight","Oito"],["Nine","Nove"],["Ten","Dez"],
    ["Eleven","Onze"],["Twelve","Doze"],["Twenty","Vinte"],["Thirty","Trinta"],["Hundred","Cem"],["Thousand","Mil"]]},
  comida:{title:"Comida e bebida",icon:"🍽️",words:[
    ["Water","Água"],["Coffee","Café"],["Bread","Pão"],["Rice","Arroz"],
    ["Chicken","Frango"],["Fruit","Fruta"],["Milk","Leite"],["Juice","Suco"],
    ["Beer","Cerveja"],["Wine","Vinho"],["Vegetable","Vegetal"],["Meat","Carne"],["Dessert","Sobremesa"],["Snack","Lanche"]]},
  lugares:{title:"Lugares",icon:"🏙️",words:[
    ["House","Casa"],["School","Escola"],["Hospital","Hospital"],["Airport","Aeroporto"],
    ["Restaurant","Restaurante"],["Market","Mercado"],["Bank","Banco"],["Park","Parque"],
    ["Office","Escritório"],["Gym","Academia"],["Pharmacy","Farmácia"],["Supermarket","Supermercado"]]},
  adjetivos:{title:"Adjetivos comuns",icon:"✨",words:[
    ["Big","Grande"],["Small","Pequeno"],["Fast","Rápido"],["Slow","Lento"],["Easy","Fácil"],["Difficult","Difícil"],
    ["Cheap","Barato"],["Expensive","Caro"],["New","Novo"],["Old","Velho"],["Important","Importante"],["Different","Diferente"]]},
  verbos:{title:"Verbos comuns",icon:"⚡",words:[
    ["To be","Ser / Estar"],["To have","Ter"],["To go","Ir"],["To eat","Comer"],
    ["To drink","Beber"],["To want","Querer"],["To like","Gostar"],["To need","Precisar"],
    ["To work","Trabalhar"],["To speak","Falar"],["To listen","Ouvir"],["To understand","Entender"],["To help","Ajudar"],["To try","Tentar"]]},
  trabalho:{title:"Trabalho",icon:"💼",words:[
    ["Job","Emprego"],["Meeting","Reunião"],["Deadline","Prazo"],["Screen","Tela"],
    ["Password","Senha"],["Update","Atualização"],["Issue","Problema"],["Manager","Gerente"],
    ["Report","Relatório"],["Task","Tarefa"],["Project","Projeto"],["Coworker","Colega de trabalho"]]},
  tempo:{title:"Tempo e Rotina",icon:"⏰",words:[
    ["Today","Hoje"],["Tomorrow","Amanhã"],["Yesterday","Ontem"],["Morning","Manhã"],
    ["Afternoon","Tarde"],["Night","Noite"],["Weekend","Fim de semana"],["Schedule","Agenda/Horário"],
    ["Always","Sempre"],["Never","Nunca"],["Sometimes","Às vezes"],["Often","Frequentemente"]]},
  negocios:{title:"Negócios e Networking",icon:"🤝",words:[
    ["Colleague","Colega"],["Client","Cliente"],["Company","Empresa"],["Presentation","Apresentação"],
    ["Speaker","Palestrante"],["Attendee","Participante"],["Business card","Cartão de visita"],["Follow up","Dar retorno/continuidade"],
    ["Networking","Fazer contatos"],["Keynote","Palestra principal"],["Session","Sessão"],["Booth","Estande"],
    ["Agenda","Pauta"],["Deal","Acordo"],["Partner","Parceiro"],["Opportunity","Oportunidade"]]},
  viagem:{title:"Viagem e Hospedagem",icon:"🧳",words:[
    ["Flight","Voo"],["Gate","Portão de embarque"],["Boarding pass","Cartão de embarque"],["Luggage","Bagagem"],
    ["Delay","Atraso"],["Reservation","Reserva"],["Check-in","Fazer check-in"],["Check-out","Fazer check-out"],
    ["Front desk","Recepção"],["Receipt","Recibo"],["Ticket","Passagem"],["Customs","Alfândega"],["Terminal","Terminal"],["Currency","Moeda"]]},
  perguntas:{title:"Palavras de pergunta",icon:"❔",words:[
    ["What","O quê"],["Where","Onde"],["When","Quando"],["Why","Por quê"],
    ["How","Como"],["Who","Quem"],["Which","Qual"],["How much / How many","Quanto / Quantos"]]},
  emocoes:{title:"Emoções e Reações",icon:"😅",words:[
    ["Excited","Animado(a)"],["Nervous","Nervoso(a)"],["Confident","Confiante"],["Confused","Confuso(a)"],
    ["Impressed","Impressionado(a)"],["Tired","Cansado(a)"],["Curious","Curioso(a)"],["Overwhelmed","Sobrecarregado(a)"],
    ["Happy","Feliz"],["Worried","Preocupado(a)"],["Relaxed","Relaxado(a)"],["Bored","Entediado(a)"]]},
  girias:{title:"Expressões do dia a dia",icon:"💬",words:[
    ["No worries","Sem problema"],["Sounds good","Parece bom / combinado"],["Makes sense","Faz sentido"],["I'm not sure","Não tenho certeza"],
    ["Let me think","Deixa eu pensar"],["Actually...","Na verdade..."],["To be honest...","Sendo sincero..."],["Anyway...","Enfim..."],
    ["Kind of / Sort of","Meio que / Tipo"],["I guess so","Acho que sim"],["No big deal","Não é grande coisa"],["I'm on it","Já tô resolvendo"],
    ["Let's see","Vamos ver"],["By all means","Claro, sem problema"]]},
  casa:{title:"Casa e Objetos",icon:"🏠",words:[
    ["Phone","Telefone"],["Charger","Carregador"],["Wi-Fi","Wi-Fi"],["Key","Chave"],
    ["Bag","Bolsa / Mala"],["Wallet","Carteira"],["Umbrella","Guarda-chuva"],["Laptop","Notebook"]]},
  roupas:{title:"Roupas",icon:"👕",words:[
    ["Shirt","Camisa"],["Pants","Calça"],["Shoes","Sapatos"],["Jacket","Jaqueta"],["Suit","Terno"],["Tie","Gravata"]]},
  transporte:{title:"Transporte",icon:"🚕",words:[
    ["Taxi","Táxi"],["Bus","Ônibus"],["Train","Trem"],["Subway","Metrô"],["Car","Carro"],["Rideshare app","Aplicativo de carona"]]}
};

/* =========================================================
   GRAMATICA (15 lições, com explicação detalhada, exemplos com áudio,
   erros comuns de brasileiro, tabela comparativa quando aplicável,
   banco de perguntas com sorteio, e produção com feedback palavra-a-palavra)
========================================================= */
const GRAMMAR = [
  {id:"tobe",title:"Verbo To Be (am / is / are)",
   explain:"O verbo <b>to be</b> significa \"ser\" ou \"estar\" — em português são dois verbos, em inglês é só um. Ele muda de forma dependendo do sujeito:<br><br><b>I am</b> · <b>You are</b> · <b>He/She/It is</b> · <b>We are</b> · <b>They are</b><br><br><b>Negativa:</b> adicione <b>not</b> depois do verbo → I am not (I'm not), he is not (he isn't), you are not (you aren't).<br><b>Pergunta:</b> inverta a ordem, o verbo vem ANTES do sujeito → <b>Are you</b> ready? <b>Is she</b> home?<br><br>Diferente do português, o to be NUNCA pode ser omitido: você não pode dizer <i>\"I happy\"</i>, precisa ser <i>\"I <b>am</b> happy\"</i>.",
   examples:[
    ["I am from Brazil.","Eu sou do Brasil."],
    ["We are ready for the meeting.","Nós estamos prontos para a reunião."],
    ["Is this seat taken?","Este assento está ocupado?"],
    ["They aren't here yet.","Eles ainda não estão aqui."]],
   misconceptions:[
    {wrong:"I happy today.",right:"I am happy today.",note:"O to be nunca pode ser omitido em inglês, mesmo quando em português a frase funciona sem 'ser/estar' explícito em outra estrutura."},
    {wrong:"She is have 30 years old.",right:"She is 30 years old.",note:"Idade em inglês usa o verbo <b>to be</b>, não <i>have</i> como em português ('ela tem 30 anos'). Traduzir literalmente é o erro nº1 aqui."},
    {wrong:"He no is here.",right:"He isn't here. / He is not here.",note:"A negativa não usa 'no' antes do verbo — o 'not' vem colado ao próprio to be."}],
   compare:{headers:["Pessoa","Afirmativa","Contração","Negativa"],rows:[
    ["I","I am","I'm","I'm not"],
    ["You/We/They","are","'re","aren't"],
    ["He/She/It","is","'s","isn't"]]},
   quiz:[
    {q:"Complete: I ___ a student.",opts:["am","is","are"],correct:0},
    {q:"Complete: She ___ my sister.",opts:["am","is","are"],correct:1},
    {q:"Complete: They ___ from Brazil.",opts:["is","am","are"],correct:2},
    {q:"Negativa de 'He is happy':",opts:["He not is happy","He isn't happy","He don't is happy"],correct:1},
    {q:"Pergunta de 'You are ready':",opts:["Are you ready?","You are ready?","Is you ready?"],correct:0},
    {q:"Complete: How old ___ you?",opts:["have","do","are"],correct:2},
    {q:"Complete: It ___ not raining now.",opts:["is","are","am"],correct:0},
    {q:"Contração de 'They are':",opts:["They's","They're","Their"],correct:1}],
   produce:[
    {p:"Traduza: Eu sou um estudante.",a:["i am a student","i'm a student"]},
    {p:"Traduza: Ela está feliz.",a:["she is happy","she's happy"]},
    {p:"Traduza: Nós não estamos prontos.",a:["we are not ready","we aren't ready"]}]},

  {id:"artigos",title:"Artigos: A, An, The",
   explain:"Use <b>a</b> antes de palavra que COMEÇA COM SOM de consoante: a book, a car, a university (o 'u' aqui tem som de 'iu', consoante!).<br><br>Use <b>an</b> antes de palavra que começa com SOM de vogal: an apple, an hour (o 'h' é mudo aqui!), an idea.<br><br>Use <b>the</b> quando o assunto já é específico/conhecido pelos dois lados da conversa: <i>The book</i> on the table (aquele livro específico, não qualquer livro).<br><br>Sem artigo nenhum: pra falar de algo em geral/plural sem especificar — <i>I like dogs</i> (cachorros em geral, sem artigo).",
   examples:[
    ["She works for a university.","Ela trabalha para uma universidade."],
    ["Can I ask an honest question?","Posso fazer uma pergunta honesta?"],
    ["The presentation starts at 9am.","A apresentação começa às 9h."],
    ["I love coffee.","Eu amo café. (sem artigo — em geral)"]],
   misconceptions:[
    {wrong:"a hour",right:"an hour",note:"O que importa é o SOM, não a letra. 'Hour' começa com H mudo, então o som é vogal → an hour. Já 'university' começa com letra vogal mas SOM de consoante ('iu') → a university."},
    {wrong:"I like the dogs.",right:"I like dogs.",note:"Quando você fala de algo em geral (cachorros no geral, não uns cachorros específicos), NÃO usa 'the'. Brasileiro tende a colocar 'the' demais por causa do 'o/a' do português."},
    {wrong:"She is a engineer.",right:"She is an engineer.",note:"'Engineer' começa com som de vogal (\"éndjinír\"), então é 'an', não 'a'."}],
   quiz:[
    {q:"Complete: I have ___ dog.",opts:["a","an","the"],correct:0},
    {q:"Complete: She ate ___ apple.",opts:["a","an","the"],correct:1},
    {q:"Complete: Close ___ door, please (a porta específica).",opts:["a","an","the"],correct:2},
    {q:"Complete: He is ___ engineer.",opts:["a","an","the"],correct:1},
    {q:"Complete: I need ___ umbrella.",opts:["a","an","the"],correct:1},
    {q:"Complete: ___ sun rises in the east.",opts:["A","An","The"],correct:2},
    {q:"Complete: I don't like ___ cold weather (em geral).",opts:["a","the","— (sem artigo)"],correct:2},
    {q:"Complete: It took ___ hour to get there.",opts:["a","an","the"],correct:1}],
   produce:[
    {p:"Traduza: Eu tenho um cachorro.",a:["i have a dog"]},
    {p:"Traduza: Ele é engenheiro.",a:["he is an engineer","he's an engineer"]},
    {p:"Traduza: Eu amo café (em geral).",a:["i love coffee","i like coffee"]}]},

  {id:"pronomes",title:"Pronomes Pessoais",
   explain:"<b>I</b> (eu) · <b>You</b> (você/vocês) · <b>He</b> (ele) · <b>She</b> (ela) · <b>It</b> (coisa/animal) · <b>We</b> (nós) · <b>They</b> (eles/elas).<br><br>Sempre vêm ANTES do verbo, e nunca podem ser omitidos como em português (onde 'eu' às vezes some pela conjugação): <i>She works</i> (não dá pra dizer só \"works\", precisa do 'she').<br><br><b>You</b> serve tanto pra singular quanto plural — inglês não distingue \"você\" de \"vocês\".",
   examples:[
    ["He is my brother.","Ele é meu irmão."],
    ["It's on the table.","Está na mesa. (referindo a um objeto)"],
    ["We work together.","Nós trabalhamos juntos."],
    ["You guys are late.","Vocês estão atrasados. ('you guys' deixa claro que é plural)"]],
   misconceptions:[
    {wrong:"Works every day.",right:"She works every day.",note:"Diferente do português, o pronome NUNCA pode ser omitido em inglês — a conjugação do verbo não deixa claro quem é o sujeito."},
    {wrong:"My friend and me are going.",right:"My friend and I are going.",note:"Quando o pronome é sujeito da frase (quem faz a ação), use 'I', não 'me'. 'Me' é usado como objeto: 'He called me'."},
    {wrong:"It is a good idea, is not?",right:"It's a good idea, isn't it?",note:"Question tags (tipo 'não é?') em inglês repetem o auxiliar + pronome no final, não é um 'is not?' genérico."}],
   quiz:[
    {q:"Pronome para 'a cadeira':",opts:["He","It","She"],correct:1},
    {q:"Pronome para 'meu amigo e eu' como sujeito:",opts:["We","They","You"],correct:0},
    {q:"Complete: ___ is my brother.",opts:["He","It","They"],correct:0},
    {q:"Complete: ___ are my parents.",opts:["He","She","They"],correct:2},
    {q:"Pronome para 'você' (singular ou plural):",opts:["You","It","We"],correct:0},
    {q:"Complete corretamente: My sister and ___ are going. (eu sou sujeito)",opts:["me","I","mine"],correct:1},
    {q:"Complete: He called ___ yesterday. (eu sou objeto aqui)",opts:["I","me","my"],correct:1}],
   produce:[
    {p:"Traduza: Ele é meu irmão.",a:["he is my brother","he's my brother"]},
    {p:"Traduza: Eles são meus pais.",a:["they are my parents","they're my parents"]}]},

  {id:"presente",title:"Presente Simples",
   explain:"Usado para rotinas, hábitos e fatos gerais: <i>I work</i>, <i>She works</i>, <i>Water boils at 100°C</i>.<br><br>Com <b>he/she/it</b> (3ª pessoa do singular) o verbo ganha <b>-s</b>: work→works, go→goes, watch→watches, study→studies.<br><br><b>Negativa:</b> don't/doesn't + verbo BASE (sem -s): <i>She doesn't work</i> (nunca 'doesn't works').<br><b>Pergunta:</b> Do/Does + sujeito + verbo BASE: <i>Does she work?</i> (nunca 'Does she works?').",
   examples:[
    ["I usually wake up at 7am.","Eu normalmente acordo às 7h."],
    ["She works in marketing.","Ela trabalha em marketing."],
    ["We don't speak French.","Nós não falamos francês."],
    ["Does he like coffee?","Ele gosta de café?"]],
   misconceptions:[
    {wrong:"She doesn't likes coffee.",right:"She doesn't like coffee.",note:"Depois de 'doesn't' o verbo volta pra forma BASE, sem -s. O -s só aparece quando não tem auxiliar (afirmativa)."},
    {wrong:"Does she works here?",right:"Does she work here?",note:"Mesma regra: depois de 'does/do', o verbo é sempre a forma base, mesmo em pergunta."},
    {wrong:"He go to the gym every day.",right:"He goes to the gym every day.",note:"Esqueceram o -s! Com he/she/it na afirmativa (sem auxiliar), o verbo SEMPRE ganha -s/-es."}],
   compare:{headers:["Terminação","Regra","Exemplo"],rows:[
    ["consoante+y","troca y por -ies","study → studies"],
    ["-ch, -sh, -ss, -x, -o","adiciona -es","watch → watches, go → goes"],
    ["demais casos","adiciona -s","work → works, like → likes"]]},
   quiz:[
    {q:"Complete: She ___ (work) every day.",opts:["work","works","working"],correct:1},
    {q:"Complete: I ___ (like) coffee.",opts:["likes","like","liking"],correct:1},
    {q:"Negativa de 'He plays soccer':",opts:["He don't play soccer","He doesn't plays soccer","He doesn't play soccer"],correct:2},
    {q:"Pergunta de 'They live here':",opts:["Do they live here?","Does they live here?","Are they live here?"],correct:0},
    {q:"Complete: My mother ___ (watch) TV at night.",opts:["watch","watchs","watches"],correct:2},
    {q:"Complete: He ___ (study) on weekends.",opts:["studys","studies","study"],correct:1},
    {q:"Pergunta de 'She works here':",opts:["Does she work here?","Does she works here?","Do she work here?"],correct:0},
    {q:"Complete: We ___ (not/have) a meeting today.",opts:["don't have","doesn't have","not have"],correct:0}],
   produce:[
    {p:"Traduza: Ela trabalha todos os dias.",a:["she works every day"]},
    {p:"Traduza: Eu gosto de café.",a:["i like coffee"]},
    {p:"Traduza: Ele não fala francês.",a:["he doesn't speak french","he does not speak french"]}]},

  {id:"continuo",title:"Presente Contínuo",
   explain:"Usado para ações acontecendo AGORA, no momento em que se fala: <b>am/is/are + verbo-ing</b>.<br><br><i>I am working</i>, <i>She is talking</i>, <i>They are waiting</i>.<br><br>Também serve pra planos já marcados num futuro próximo: <i>I'm meeting him tomorrow</i>.<br><br>Muito útil em conversa: <i>What are you working on?</i> (No que você está trabalhando?)<br><br><b>Atenção:</b> alguns verbos de estado (like, know, want, believe) normalmente NÃO vão pro contínuo, mesmo se a ação parecer 'atual': dizemos <i>I want this</i>, nunca <i>I am wanting this</i>.",
   examples:[
    ["I'm studying English right now.","Estou estudando inglês agora."],
    ["She is presenting at 3pm.","Ela vai apresentar às 15h. (plano marcado)"],
    ["They aren't listening.","Eles não estão escutando."],
    ["What are you working on?","No que você está trabalhando?"]],
   misconceptions:[
    {wrong:"I am liking this idea.",right:"I like this idea.",note:"'Like' é verbo de estado/sentimento — normalmente fica no presente simples, mesmo se você estiver sentindo isso 'agora'."},
    {wrong:"She is knowing the answer.",right:"She knows the answer.",note:"Mesma lógica: 'know' descreve um estado mental, não uma ação em progresso, então não usa -ing."},
    {wrong:"I studing now.",right:"I'm studying now.",note:"Faltou o auxiliar (am/is/are) — o -ing sozinho não forma o tempo verbal, precisa do to be junto."}],
   compare:{headers:["Situação","Tempo correto","Exemplo"],rows:[
    ["Ação acontecendo agora","Presente Contínuo","I am working now"],
    ["Rotina/hábito","Presente Simples","I work every day"],
    ["Verbo de estado (like, know, want)","Presente Simples","I know him (não 'I am knowing')"]]},
   quiz:[
    {q:"Complete: I ___ (study) English right now.",opts:["study","am studying","studies"],correct:1},
    {q:"Complete: They ___ (have) lunch at the moment.",opts:["are having","have","having"],correct:0},
    {q:"'What are you working on?' significa:",opts:["O que você trabalhou?","No que você está trabalhando?","Onde você trabalha?"],correct:1},
    {q:"Complete: She ___ (not/listen) right now.",opts:["isn't listening","doesn't listen","not listening"],correct:0},
    {q:"Forma -ing de 'run':",opts:["runing","runeing","running"],correct:2},
    {q:"Escolha a certa:",opts:["I am wanting a coffee","I want a coffee","I wants a coffee"],correct:1},
    {q:"Complete: We ___ (meet) the client tomorrow morning (plano marcado).",opts:["meet","are meeting","meets"],correct:1}],
   produce:[
    {p:"Traduza: Eu estou estudando inglês agora.",a:["i am studying english now","i'm studying english now"]},
    {p:"Traduza: No que você está trabalhando?",a:["what are you working on"]}]},

  {id:"passado",title:"Passado Simples",
   explain:"Usado pra ações completas, terminadas no passado. Verbos regulares ganham <b>-ed</b>: work→worked, play→played.<br><br>Muitos verbos comuns são IRREGULARES e mudam totalmente: go→went, have→had, see→saw, be→was/were.<br><br><b>Negativa:</b> didn't + verbo BASE (mesmo com irregulares!): <i>She didn't go</i> (nunca 'didn't went').<br><b>Pergunta:</b> Did + sujeito + verbo BASE: <i>Did you go?</i>",
   examples:[
    ["I worked from home yesterday.","Eu trabalhei de casa ontem."],
    ["We went to the conference last week.","Nós fomos à conferência semana passada."],
    ["She didn't call me.","Ela não me ligou."],
    ["Did you see the email?","Você viu o e-mail?"]],
   misconceptions:[
    {wrong:"She didn't went there.",right:"She didn't go there.",note:"Depois de 'didn't', o verbo SEMPRE volta pra forma base — mesmo verbos irregulares. O 'did' já carrega o passado, não precisa marcar duas vezes."},
    {wrong:"Did you went there?",right:"Did you go there?",note:"Mesma regra em pergunta: depois de 'did', verbo base."},
    {wrong:"I goed to the store.",right:"I went to the store.",note:"'Go' é irregular — não existe 'goed'. Isso precisa ser memorizado caso a caso, não tem regra fixa."}],
   compare:{headers:["Verbo","Passado","Tipo"],rows:[
    ["work","worked","regular (-ed)"],
    ["go","went","irregular"],
    ["have","had","irregular"],
    ["see","saw","irregular"],
    ["be (I/he/she)","was","irregular"],
    ["be (you/we/they)","were","irregular"]]},
   quiz:[
    {q:"Passado de 'go':",opts:["goed","went","gone"],correct:1},
    {q:"Complete: I ___ (work) yesterday.",opts:["work","worked","working"],correct:1},
    {q:"Negativa de 'She saw him':",opts:["She no saw him","She didn't see him","She didn't saw him"],correct:1},
    {q:"Pergunta de 'You went there':",opts:["Did you go there?","Did you went there?","You did go there?"],correct:0},
    {q:"Passado de 'to be' (I):",opts:["was","were","am"],correct:0},
    {q:"Passado de 'have':",opts:["haved","had","haved"],correct:1},
    {q:"Complete: They ___ (not/come) to the party.",opts:["didn't came","didn't come","not came"],correct:1},
    {q:"Passado de 'to be' (they):",opts:["was","were","are"],correct:1}],
   produce:[
    {p:"Traduza: Eu trabalhei ontem.",a:["i worked yesterday"]},
    {p:"Traduza: Ela viu ele.",a:["she saw him"]},
    {p:"Traduza: Eles não vieram.",a:["they didn't come","they did not come"]}]},

  {id:"comparativos",title:"Comparativos e Superlativos",
   explain:"Adjetivos CURTOS (1 sílaba, ou 2 terminados em -y): <b>-er + than</b> → cheaper than, bigger than, happier than.<br><br>Adjetivos LONGOS (2+ sílabas): <b>more ... than</b> → more expensive than, more interesting than.<br><br>Superlativo (\"o mais...\"): curtos ganham <b>the -est</b> (the cheapest), longos usam <b>the most</b> (the most expensive).<br><br>Alguns adjetivos são IRREGULARES: good→better→the best, bad→worse→the worst.",
   examples:[
    ["This hotel is cheaper than that one.","Este hotel é mais barato que aquele."],
    ["She is more experienced than him.","Ela é mais experiente que ele."],
    ["This is the best conference I've attended.","Esta é a melhor conferência que eu já fui."],
    ["Traffic today is worse than yesterday.","O trânsito hoje está pior que ontem."]],
   misconceptions:[
    {wrong:"more cheap","right":"cheaper",note:"Adjetivos curtos (1 sílaba) usam -er, não 'more'. 'More cheap' é a interferência direta do português 'mais barato'."},
    {wrong:"gooder / more good",right:"better",note:"'Good' é irregular: good → better → the best. Não existe 'gooder' nem 'more good'."},
    {wrong:"the most big",right:"the biggest",note:"Adjetivos curtos no superlativo usam -est, não 'the most'. Regra segue a mesma lógica do comparativo."}],
   compare:{headers:["Adjetivo","Comparativo","Superlativo"],rows:[
    ["cheap (curto)","cheaper","the cheapest"],
    ["big (curto, dobra consoante)","bigger","the biggest"],
    ["happy (2 síl. em -y)","happier","the happiest"],
    ["expensive (longo)","more expensive","the most expensive"],
    ["good (irregular)","better","the best"],
    ["bad (irregular)","worse","the worst"]]},
   quiz:[
    {q:"Complete: This hotel is ___ (cheap) than that one.",opts:["cheaper","more cheap","cheapest"],correct:0},
    {q:"Complete: She is ___ (interesting) person I know.",opts:["the more interesting","the most interesting","interestinger"],correct:1},
    {q:"Comparativo de 'good':",opts:["gooder","better","best"],correct:1},
    {q:"Complete: New York is ___ (big) than Rio.",opts:["bigger","more big","biggest"],correct:0},
    {q:"Superlativo de 'fast':",opts:["the most fast","the fastest","faster"],correct:1},
    {q:"Comparativo de 'bad':",opts:["badder","worse","the worst"],correct:1},
    {q:"Complete: This is ___ (good) restaurant in town.",opts:["the better","the best","the goodest"],correct:1},
    {q:"Comparativo de 'happy':",opts:["happier","more happy","happyer"],correct:0}],
   produce:[
    {p:"Traduza: Este hotel é mais barato que aquele.",a:["this hotel is cheaper than that one","this hotel is cheaper than that"]},
    {p:"Traduza: Ela é a pessoa mais interessante que eu conheço.",a:["she is the most interesting person i know"]},
    {p:"Traduza: Isso é pior que ontem.",a:["this is worse than yesterday","it is worse than yesterday","it's worse than yesterday"]}]},

  {id:"perguntas",title:"Fazendo Perguntas",
   explain:"Estrutura geral: <b>(palavra de pergunta) + auxiliar + sujeito + verbo</b>.<br><br><i>What do you do?</i> · <i>Where are you from?</i> · <i>How long have you worked there?</i><br><br>Sem palavra de pergunta (pergunta de sim/não): o auxiliar vem PRIMEIRO → <i>Do you like it?</i> <i>Are you coming?</i><br><br>O auxiliar muda de acordo com o tempo verbal: presente simples usa <b>do/does</b>, passado usa <b>did</b>, presente contínuo/to be usa o próprio <b>am/is/are</b>, present perfect usa <b>have/has</b>.",
   examples:[
    ["What do you do?","O que você faz (profissão)?"],
    ["Where are you from?","De onde você é?"],
    ["How long have you worked there?","Há quanto tempo você trabalha lá?"],
    ["Did you get my email?","Você recebeu meu e-mail?"]],
   misconceptions:[
    {wrong:"What you do?",right:"What do you do?",note:"Esqueceram o auxiliar 'do'. Toda pergunta com palavra interrogativa (what, where, when...) precisa do auxiliar, exceto quando a palavra É o sujeito ('Who called you?')."},
    {wrong:"You are coming?",right:"Are you coming?",note:"Isso funciona como pergunta em português só pelo tom de voz, mas em inglês escrito/formal a ordem realmente precisa inverter: verbo antes do sujeito."},
    {wrong:"Where you are from?",right:"Where are you from?",note:"A ordem depois da palavra de pergunta continua sendo auxiliar+sujeito, não sujeito+auxiliar."}],
   quiz:[
    {q:"Pergunta correta pra saber a profissão:",opts:["What you do?","What do you do?","What make you?"],correct:1},
    {q:"Pergunta correta com 'are':",opts:["You are coming?","Are you coming?","Coming you are?"],correct:1},
    {q:"'How long have you worked there?' pergunta sobre:",opts:["Onde você trabalha","Há quanto tempo você trabalha lá","Por que você trabalha lá"],correct:1},
    {q:"Complete: ___ is the meeting?",opts:["What time","What hour","Which time"],correct:0},
    {q:"Complete: ___ do you usually get to work?",opts:["How","What","Which"],correct:0},
    {q:"Complete: ___ did you get here?",opts:["When","Did when","You when"],correct:0},
    {q:"Pergunta certa no passado:",opts:["Did you called him?","Did you call him?","You did call him?"],correct:1}],
   produce:[
    {p:"Traduza: O que você faz?",a:["what do you do"]},
    {p:"Traduza: Há quanto tempo você trabalha lá?",a:["how long have you worked there"]},
    {p:"Traduza: Você recebeu meu e-mail?",a:["did you get my email"]}]},

  {id:"modais",title:"Modais: Can, Could, Should",
   explain:"<b>Can</b> = capacidade ou permissão no presente: <i>I can speak English</i> (consigo falar). <i>Can I sit here?</i> (posso?).<br><br><b>Could</b> = forma mais educada/formal de pedir algo, ou capacidade no passado: <i>Could you repeat that?</i> (bem mais educado que 'Can you...'). <i>I could swim when I was five</i> (eu conseguia nadar).<br><br><b>Should</b> = sugestão/recomendação, não obrigação: <i>You should try this</i> (é uma dica, não uma ordem).<br><br>Depois de qualquer modal, o verbo vem SEMPRE na forma base, sem 'to' e sem -s: <i>She can go</i> (nunca 'can to go' nem 'can goes').",
   examples:[
    ["Could you repeat that, please?","Você poderia repetir isso, por favor?"],
    ["I can help you with that.","Eu posso te ajudar com isso."],
    ["You should try the coffee here.","Você devia experimentar o café aqui."],
    ["She could speak three languages at 10.","Ela conseguia falar três línguas aos 10 anos."]],
   misconceptions:[
    {wrong:"She can to speak English.",right:"She can speak English.",note:"Depois de modal (can, could, should, must...) NUNCA usa 'to'. Isso é diferente de verbos normais como 'want to'."},
    {wrong:"He cans speak French.",right:"He can speak French.",note:"Modais nunca ganham -s, nem com he/she/it. 'Can' é sempre 'can', em qualquer pessoa."},
    {wrong:"You should to try this.",right:"You should try this.",note:"Mesma regra do 'to' — nenhum modal usa 'to' antes do verbo principal."}],
   quiz:[
    {q:"Forma educada de pedir algo:",opts:["Can you repeat?","Could you repeat that, please?","You repeat that"],correct:1},
    {q:"'I can help you' significa:",opts:["Eu vou ajudar você","Eu posso ajudar você","Eu ajudei você"],correct:1},
    {q:"Complete: You ___ try the coffee here, it's great.",opts:["should","can not","must not"],correct:0},
    {q:"'Could you speak slower?' significa:",opts:["Você pode falar mais rápido?","Você poderia falar mais devagar?","Você falou devagar?"],correct:1},
    {q:"Pedir permissão educadamente:",opts:["Can I ask you something?","I ask you something","You can ask"],correct:0},
    {q:"Complete corretamente:",opts:["She can to drive","She can drive","She cans drive"],correct:1},
    {q:"Capacidade no passado:",opts:["I can swim when I was young","I could swim when I was young","I should swim when I was young"],correct:1}],
   produce:[
    {p:"Traduza (educado): Você poderia repetir isso, por favor?",a:["could you repeat that please","could you repeat that, please"]},
    {p:"Traduza: Eu posso ajudar você.",a:["i can help you"]},
    {p:"Traduza: Você devia experimentar isso.",a:["you should try this","you should try it"]}]},

  {id:"futuro",title:"Futuro: Going to / Will",
   explain:"<b>Going to + verbo</b> = plano já decidido antes de falar: <i>I'm going to attend the conference</i> (já era plano).<br><br><b>Will + verbo</b> = decisão tomada NA HORA, promessa, ou previsão geral: <i>I'll send you my card</i> (decidindo agora), <i>It will be a great event</i> (previsão/opinião).<br><br>Em contexto profissional: <i>I'll follow up by email</i> (prometendo agora) vs <i>We're going to launch the product in March</i> (plano já definido).",
   examples:[
    ["I'm going to attend the conference next month.","Vou participar da conferência mês que vem. (já decidido)"],
    ["I'll send you my business card.","Vou te mandar meu cartão. (decidindo agora)"],
    ["It's going to rain later.","Vai chover mais tarde. (evidência agora, tipo céu nublado)"],
    ["I think it will be a great event.","Eu acho que vai ser um ótimo evento. (opinião/previsão)"]],
   misconceptions:[
    {wrong:"I go to travel next month.",right:"I'm going to travel next month.",note:"Faltou o to be (am/is/are) antes de 'going to' — não existe 'going to' sem o auxiliar."},
    {wrong:"I will travel yesterday.",right:"I traveled yesterday.",note:"'Will' é só para futuro, nunca passado. 'Yesterday' pede passado simples."},
    {wrong:"Tomorrow I go to the client.",right:"Tomorrow I'm going to the client. / Tomorrow I'll go to the client.",note:"Presente simples sozinho não marca futuro claramente em inglês do dia a dia — precisa de will ou going to (ou presente contínuo pra planos marcados: 'I'm meeting the client tomorrow')."}],
   compare:{headers:["Situação","Use","Exemplo"],rows:[
    ["Plano já decidido antes","going to","I'm going to present next week"],
    ["Decisão na hora / promessa","will","I'll call you back"],
    ["Previsão com evidência visível agora","going to","Look at those clouds — it's going to rain"],
    ["Previsão / opinião geral","will","I think it will rain tomorrow"]]},
   quiz:[
    {q:"Plano já decidido:",opts:["I go to travel","I'm going to travel next month","I will travel yesterday"],correct:1},
    {q:"Decisão na hora (oferecendo ajuda):",opts:["I help you","I'll help you","I helping you"],correct:1},
    {q:"'I'll follow up by email' significa:",opts:["Vou seguir por e-mail","Vou dar retorno por e-mail","Vou enviar e-mail agora"],correct:1},
    {q:"Complete: She ___ (present) at the conference tomorrow.",opts:["is going to present","present","presented"],correct:0},
    {q:"Previsão geral:",opts:["It's going to be a great event","It be great event","It great event"],correct:0},
    {q:"Complete (evidência visível agora): Look at the sky, it ___ rain.",opts:["will","is going to","goes to"],correct:1},
    {q:"Complete (plano já marcado com bastante antecedência): We ___ launch the product in March.",opts:["will going to","are going to","go to"],correct:1}],
   produce:[
    {p:"Traduza: Eu vou participar da conferência (plano já decidido).",a:["i am going to attend the conference","i'm going to attend the conference"]},
    {p:"Traduza: Eu vou te ajudar (decisão na hora).",a:["i will help you","i'll help you"]}]},

  {id:"phrasal",title:"Phrasal Verbs comuns",
   explain:"Phrasal verbs são verbo + preposição/partícula que juntos ganham um significado diferente do verbo isolado — não dá pra traduzir palavra por palavra.<br><br><b>Find out</b> = descobrir · <b>Look forward to</b> = esperar ansiosamente por (+ verbo-ing) · <b>Catch up</b> = colocar o papo em dia / se atualizar · <b>Get along (with)</b> = se dar bem (com) · <b>Follow up</b> = dar continuidade/retorno.<br><br>Atenção especial ao <b>look forward to</b>: depois dele o verbo vai pra forma <b>-ing</b>, não infinitivo → <i>I look forward to meeting you</i> (nunca 'to meet').",
   examples:[
    ["I look forward to meeting you in person.","Estou ansioso para te conhecer pessoalmente."],
    ["Let's catch up over coffee sometime.","Vamos colocar o papo em dia num café qualquer hora."],
    ["I need to find out the schedule.","Preciso descobrir a agenda."],
    ["I'll follow up with you next week.","Vou dar um retorno pra você semana que vem."]],
   misconceptions:[
    {wrong:"I look forward to meet you.",right:"I look forward to meeting you.",note:"Depois de 'look forward to' o verbo vai pra forma -ing, não infinitivo com 'to'. É uma excecão que trava muita gente."},
    {wrong:"We get along together.",right:"We get along (with each other).",note:"'Get along' já implica reciprocidade — normalmente usado sozinho ou com 'with' + pessoa específica, não com 'together'."},
    {wrong:"I will follow up you.",right:"I will follow up with you.",note:"'Follow up' pede a preposição 'with' antes da pessoa."}],
   quiz:[
    {q:"'I look forward to meeting you' significa:",opts:["Eu olho pra frente","Estou ansioso pra te conhecer","Eu vou te encontrar"],correct:1},
    {q:"'Let's catch up later' significa:",opts:["Vamos colocar o papo em dia depois","Vamos pegar depois","Vamos correr depois"],correct:0},
    {q:"'I need to find out the schedule' significa:",opts:["Preciso achar a agenda","Preciso descobrir a agenda","Preciso mudar a agenda"],correct:1},
    {q:"'We get along well' significa:",opts:["Nós nos damos bem","Nós vamos junto","Nós ficamos perto"],correct:0},
    {q:"'I'll follow up with you' significa:",opts:["Vou seguir você","Vou dar retorno pra você","Vou atrás de você"],correct:1},
    {q:"Complete: I look forward to ___ (hear) from you.",opts:["hear","hearing","to hear"],correct:1},
    {q:"'I need to find out' é seguido de:",opts:["um objeto direto (the schedule)","sempre uma pergunta","nada, é intransitivo"],correct:0}],
   produce:[
    {p:"Traduza: Estou ansioso pra te conhecer.",a:["i look forward to meeting you","i'm looking forward to meeting you"]},
    {p:"Traduza: Vamos colocar o papo em dia.",a:["let's catch up","lets catch up"]}]},

  {id:"presentperfect",title:"Present Perfect: quando NÃO é passado simples",
   explain:"<b>Have/Has + particípio</b>, usado quando o tempo específico não importa, ou quando a ação conecta passado e presente.<br><br><i>I have worked here for two years</i> (e ainda trabalho — conexão com o presente).<br><i>Have you ever been to a conference?</i> (experiência de vida, sem tempo específico).<br><br>A grande diferença com o Passado Simples: <b>Present Perfect</b> não menciona QUANDO exatamente aconteceu (ou usa 'ever/never/already/yet'); <b>Passado Simples</b> menciona ou implica um tempo específico ('yesterday', 'last year', 'in 2020').<br><br><i>I have visited Paris</i> (alguma vez, não importa quando) vs <i>I visited Paris in 2019</i> (momento específico).",
   examples:[
    ["I have worked here for two years.","Eu trabalho aqui há dois anos."],
    ["Have you ever been to the US?","Você já foi aos EUA (alguma vez)?"],
    ["She hasn't finished the report yet.","Ela ainda não terminou o relatório."],
    ["I visited Paris in 2019.","Eu visitei Paris em 2019. (passado simples — tempo específico)"]],
   misconceptions:[
    {wrong:"I have visited Paris in 2019.",right:"I visited Paris in 2019.",note:"Quando você diz UM MOMENTO ESPECÍFICO ('in 2019', 'last year', 'yesterday'), use Passado Simples, não Present Perfect — mesmo que pareça uma 'experiência'."},
    {wrong:"I have seen him yesterday.",right:"I saw him yesterday. / I have seen him.",note:"'Yesterday' é tempo específico, então pede passado simples. Se tirar o 'yesterday', o present perfect ('I have seen him') vira correto de novo."},
    {wrong:"She has go to the meeting.",right:"She has gone to the meeting.",note:"Depois de have/has usa-se o PARTICÍPIO, não a forma base. Particípio de 'go' é 'gone', não 'go'."}],
   compare:{headers:["Verbo","Passado (simples)","Particípio (perfect)"],rows:[
    ["see","saw","seen"],
    ["go","went","gone"],
    ["do","did","done"],
    ["write","wrote","written"],
    ["work (regular)","worked","worked"]]},
   quiz:[
    {q:"Complete: I ___ (work) here for two years.",opts:["have worked","worked","work"],correct:0},
    {q:"'Have you ever been to the US?' significa:",opts:["Você foi aos EUA ontem?","Você já foi aos EUA (alguma vez)?","Você vai aos EUA?"],correct:1},
    {q:"Particípio de 'see':",opts:["seen","saw","seed"],correct:0},
    {q:"Complete: She ___ (not/finish) the report yet.",opts:["hasn't finished","didn't finished","not finish"],correct:0},
    {q:"Particípio de 'go':",opts:["went","gone","goed"],correct:1},
    {q:"Escolha o tempo certo: 'I ___ him last week.'",opts:["have seen","saw","have see"],correct:1},
    {q:"Escolha o tempo certo: 'I ___ him already, no need to introduce us.'",opts:["saw","have seen","see"],correct:1}],
   produce:[
    {p:"Traduza: Eu trabalho aqui há dois anos.",a:["i have worked here for two years","i've worked here for two years"]},
    {p:"Traduza: Você já foi a uma conferência?",a:["have you ever been to a conference"]},
    {p:"Traduza: Eu visitei Paris em 2019.",a:["i visited paris in 2019"]}]},

  {id:"conectores",title:"Conectores no Discurso",
   explain:"Conectores organizam ideias e dão fluidez — essenciais pra parecer mais natural em apresentações e conversas:<br><br><b>However</b> (porém, contraste — geralmente inicia frase nova) · <b>Although</b> (embora, dentro da MESMA frase, antes da ideia contrária) · <b>Because</b> (porque, explica motivo) · <b>In addition</b> (além disso) · <b>On the other hand</b> (por outro lado) · <b>For example</b> (por exemplo) · <b>Actually</b> (na verdade — corrige/esclarece).<br><br>Diferença importante: <b>however</b> normalmente vem em frase separada (com vírgula ou ponto antes), enquanto <b>although</b> conecta duas ideias dentro da MESMA frase.",
   examples:[
    ["I like the idea. However, I have some concerns.","Eu gosto da ideia. Porém, tenho algumas preocupações."],
    ["Although it was raining, we still went out.","Embora estivesse chovendo, ainda saímos."],
    ["The talk was long. On the other hand, it was useful.","A palestra foi longa. Por outro lado, foi útil."],
    ["Actually, I think we should wait.","Na verdade, eu acho que devíamos esperar."]],
   misconceptions:[
    {wrong:"I like it, however I have concerns.",right:"I like it. However, I have concerns.",note:"'However' geralmente começa uma frase nova (depois de ponto), não conecta duas partes com vírgula no meio — diferente de 'but', que sim conecta com vírgula."},
    {wrong:"Although it was raining but we went out.",right:"Although it was raining, we went out.",note:"Não use 'although' e 'but' juntos na mesma frase — são redundantes, escolha um dos dois."},
    {wrong:"Actually significa 'atualmente'",right:"Actually = 'na verdade' (não 'atualmente')",note:"Falso cognato clássico! 'Actually' NÃO significa 'atualmente' (isso seria 'currently' ou 'nowadays'). 'Actually' serve pra corrigir ou esclarecer algo, tipo 'na verdade'."}],
   quiz:[
    {q:"Complete: I like the idea. ___, I have some concerns.",opts:["However","Because","For example"],correct:0},
    {q:"Complete: ___ it was raining, we still went out.",opts:["Because","Although","So"],correct:1},
    {q:"'On the other hand' significa:",opts:["Por outro lado","Na outra mão","Ao mesmo tempo"],correct:0},
    {q:"Complete: The talk was long. ___, it was very useful.",opts:["Because","However","For example"],correct:1},
    {q:"Introduzir um exemplo:",opts:["For example","However","So"],correct:0},
    {q:"'Actually' significa:",opts:["Atualmente","Na verdade","Realmente cansado"],correct:1},
    {q:"Escolha a frase correta:",opts:["I like it, however I have concerns.","I like it. However, I have concerns.","I like it however have concerns."],correct:1}],
   produce:[
    {p:"Complete em inglês: Eu gosto da ideia, tenho, porém, algumas preocupações (comece com 'I like the idea.').",a:["however"]},
    {p:"Complete em inglês: ___ estivesse chovendo, nós saímos.",a:["although"]}]},

  {id:"condicionais",title:"Condicionais (If clauses)",
   explain:"<b>Zero conditional</b> (fatos/verdades gerais, sempre acontece): <b>If + presente, presente</b> → <i>If you heat water, it boils.</i><br><br><b>First conditional</b> (futuro real/provável): <b>If + presente, will + verbo</b> → <i>If it rains, I will stay at the hotel.</i><br><br><b>Second conditional</b> (hipotético, pouco provável ou imaginário): <b>If + passado, would + verbo</b> → <i>If I had more time, I would learn faster.</i> (não tenho mais tempo, é hipotético).<br><br>Regra de ouro: depois de 'if' referindo-se a futuro, NUNCA use 'will' — o 'will' fica na outra parte da frase.",
   examples:[
    ["If you heat ice, it melts.","Se você esquenta gelo, ele derrete. (fato)"],
    ["If it rains, I will stay at the hotel.","Se chover, eu vou ficar no hotel. (futuro provável)"],
    ["If I had more time, I would travel more.","Se eu tivesse mais tempo, eu viajaria mais. (hipotético)"],
    ["If you have questions, I'll be happy to answer.","Se você tiver perguntas, terei prazer em responder."]],
   misconceptions:[
    {wrong:"If it will rain, I will stay home.",right:"If it rains, I will stay home.",note:"Depois de 'if' (falando de algo futuro/provável), NUNCA use 'will' — o verbo fica no presente simples. O 'will' só aparece na segunda parte da frase."},
    {wrong:"If I have more time, I would travel more.",right:"If I had more time, I would travel more.",note:"Pra ideia hipotética/pouco provável (second conditional), o 'if' precisa do verbo no PASSADO, mesmo falando do presente/futuro imaginário."},
    {wrong:"If I was you, I will accept it.",right:"If I were you, I would accept it.",note:"No second conditional, com 'I/he/she/it', o verbo to be correto depois de 'if' é 'were' (não 'was') em inglês mais formal/tradicional — e a segunda parte usa 'would', não 'will'."}],
   compare:{headers:["Tipo","Estrutura","Quando usar"],rows:[
    ["Zero conditional","If + presente, presente","Fatos/verdades gerais"],
    ["First conditional","If + presente, will + verbo","Futuro real e provável"],
    ["Second conditional","If + passado, would + verbo","Hipotético / pouco provável"]]},
   quiz:[
    {q:"Complete: If it rains, I ___ (stay) home.",opts:["will stay","stay","stayed"],correct:0},
    {q:"Complete: If you ___ (heat) ice, it melts.",opts:["heat","will heat","heated"],correct:0},
    {q:"'If you have questions, I'll be happy to answer' significa:",opts:["Se você teve perguntas...","Se você tiver perguntas...","Se você tem perguntas ontem..."],correct:1},
    {q:"Complete: If I ___ (see) him, I'll tell him.",opts:["see","will see","saw"],correct:0},
    {q:"Estrutura correta do first conditional:",opts:["If + will, presente","If + presente, will","Will + if + presente"],correct:1},
    {q:"Complete (hipotético): If I ___ (have) more time, I would learn faster.",opts:["have","had","will have"],correct:1},
    {q:"Complete (hipotético formal): If I ___ you, I would accept it.",opts:["was","were","am"],correct:1}],
   produce:[
    {p:"Traduza: Se chover, eu vou ficar no hotel.",a:["if it rains i will stay at the hotel","if it rains, i will stay at the hotel","if it rains i'll stay at the hotel"]},
    {p:"Traduza: Se você tiver perguntas, terei prazer em responder.",a:["if you have questions i will be happy to answer","if you have questions, i'll be happy to answer"]}]},

  {id:"reported",title:"Discurso Indireto (básico)",
   explain:"Usado pra contar o que alguém disse, sem citar as palavras exatas. Quando o verbo introdutor ('said') está no passado, o verbo da fala original geralmente VOLTA UM TEMPO VERBAL (o chamado 'backshift'):<br><br>Direto: <i>\"I work in support.\"</i> (presente) → Indireto: <i>He said he worked in support.</i> (volta pro passado)<br>Direto: <i>\"I will call you.\"</i> (will) → Indireto: <i>She said she would call me.</i> (will vira would)<br>Direto: <i>\"I am tired.\"</i> (presente) → Indireto: <i>He said he was tired.</i><br><br>Pronomes também mudam conforme quem está contando a história (I → he/she, etc.).",
   examples:[
    ["\"I work in support.\" → He said he worked in support.","'Eu trabalho no suporte.' → Ele disse que trabalhava no suporte."],
    ["\"I will call you.\" → She said she would call me.","'Eu vou te ligar.' → Ela disse que ligaria pra mim."],
    ["\"I am tired.\" → He said he was tired.","'Estou cansado.' → Ele disse que estava cansado."],
    ["\"I like it.\" → She said she liked it.","'Eu gosto disso.' → Ela disse que gostava disso."]],
   misconceptions:[
    {wrong:"He said he works here.",right:"He said he worked here.",note:"Como 'said' está no passado, o verbo da fala original também precisa voltar um tempo (backshift) — de presente simples pra passado simples."},
    {wrong:"She said she will help me.",right:"She said she would help me.",note:"'Will' no discurso direto se torna 'would' no indireto, seguindo a mesma lógica de 'voltar um tempo'."},
    {wrong:"He said that I was tired (mudou a pessoa errada).",right:"He said (that) he was tired.",note:"O pronome muda pra bater com quem é o sujeito da fala original, não com quem está ouvindo a história agora."}],
   quiz:[
    {q:"'I am tired' → discurso indireto:",opts:["He said he is tired","He said he was tired","He said he tired"],correct:1},
    {q:"'I will help you' → discurso indireto:",opts:["She said she will help me","She said she would help me","She said she helped me"],correct:1},
    {q:"'I work here' → discurso indireto:",opts:["He said he works here","He said he worked here","He said he work here"],correct:1},
    {q:"No discurso indireto, com 'said' no passado, o verbo geralmente:",opts:["Fica igual","Volta um tempo verbal","Vira futuro"],correct:1},
    {q:"'I like it' → discurso indireto:",opts:["She said she likes it","She said she liked it","She said she like it"],correct:1},
    {q:"'I can help' → discurso indireto:",opts:["He said he could help","He said he can help","He said he helped"],correct:0}],
   produce:[
    {p:"Transforme: 'I work in support.' → He said...",a:["he said he worked in support","he said that he worked in support"]},
    {p:"Transforme: 'I will call you.' → She said...",a:["she said she would call me","she said that she would call me"]}]}
];

/* =========================================================
   CONVERSACAO (16 diálogos + "sua vez")
========================================================= */
const CONVERSATION = [
  {id:"apresentar",title:"Apresentando-se",icon:"🙋",
   lines:[["them","Hi! What's your name?","Oi! Qual é o seu nome?"],
    ["you","My name is Mauricio. Nice to meet you.","Meu nome é Mauricio. Prazer em conhecê-lo."],
    ["them","Nice to meet you too. Where are you from?","Prazer também. De onde você é?"],
    ["you","I'm from Brazil, from Rio de Janeiro.","Sou do Brasil, do Rio de Janeiro."],
    ["them","Cool! What do you do?","Legal! O que você faz?"],
    ["you","I work in technical support.","Eu trabalho no suporte técnico."]],
   quiz:[{q:"Como perguntar 'de onde você é?'",opts:["Where are you from?","What is your name?","How old are you?"],correct:0},
    {q:"Como responder 'meu nome é...'",opts:["I am name...","My name is...","Me call..."],correct:1},
    {q:"'Prazer em conhecê-lo':",opts:["Nice to meet you","Good to see you","See you later"],correct:0}],
   suavez:{prompt:"Alguém pergunta: 'What do you do?'. Responda contando o que você faz.",sample:"I work in technical support for a software company. I analyze bugs and help the dev team."}},
  {id:"cafe",title:"No café",icon:"☕",
   lines:[["them","Hi, welcome! What would you like?","Oi, bem-vindo! O que você gostaria?"],
    ["you","I'd like a coffee, please.","Eu gostaria de um café, por favor."],
    ["them","Sure! For here or to go?","Claro! Para consumir aqui ou para levar?"],
    ["you","To go, please. How much is it?","Para levar, por favor. Quanto é?"],
    ["them","That's five dollars.","São cinco dólares."],
    ["you","Here you go. Thank you!","Aqui está. Obrigado!"]],
   quiz:[{q:"Pedir algo educadamente:",opts:["I want a coffee now","I'd like a coffee, please","Give me a coffee"],correct:1},
    {q:"Perguntar o preço:",opts:["How much is it?","How many is it?","What price this?"],correct:0},
    {q:"'Para levar':",opts:["For here","To go","For go"],correct:1}]},
  {id:"aeroporto",title:"No aeroporto",icon:"✈️",
   lines:[["them","Good morning! Can I see your passport, please?","Bom dia! Posso ver seu passaporte, por favor?"],
    ["you","Sure, here it is.","Claro, aqui está."],
    ["them","What is the purpose of your trip?","Qual é o propósito da sua viagem?"],
    ["you","I'm traveling for a conference.","Estou viajando pra uma conferência."],
    ["them","How long are you staying?","Quanto tempo você vai ficar?"],
    ["you","I'm staying for two weeks.","Vou ficar duas semanas."]],
   quiz:[{q:"'Estou viajando pra uma conferência':",opts:["I travel to conference","I'm traveling for a conference","I go for conference"],correct:1},
    {q:"Perguntar 'quanto tempo vai ficar?':",opts:["How much time you stay?","How long are you staying?","How many days stay?"],correct:1},
    {q:"'Aqui está' (entregando algo):",opts:["Here it is","There it is","Is here"],correct:0}]},
  {id:"direcoes",title:"Perguntando direções",icon:"🗺️",
   lines:[["you","Excuse me, how do I get to the train station?","Com licença, como eu chego à estação de trem?"],
    ["them","Go straight and turn left at the corner.","Siga em frente e vire à esquerda na esquina."],
    ["you","Is it far from here?","É longe daqui?"],
    ["them","No, it's about five minutes on foot.","Não, é uns cinco minutos a pé."],
    ["you","Thank you so much!","Muito obrigado!"]],
   quiz:[{q:"Perguntar o caminho pra um lugar:",opts:["How do I get to...?","Where I go...?","What is the way...?"],correct:0},
    {q:"'Siga em frente':",opts:["Go straight","Go front","Follow direct"],correct:0},
    {q:"'A pé':",opts:["By foot","On foot","In foot"],correct:1}]},
  {id:"compras",title:"Fazendo compras",icon:"🛍️",
   lines:[["you","Excuse me, do you have this in a smaller size?","Com licença, você tem isso em um tamanho menor?"],
    ["them","Let me check. Yes, we have a small.","Deixa eu verificar. Sim, temos um pequeno."],
    ["you","Great, can I try it on?","Ótimo, posso experimentar?"],
    ["them","Of course, the fitting room is over there.","Claro, o provador é ali."],
    ["you","It fits perfectly. I'll take it.","Serve perfeitamente. Vou levar."]],
   quiz:[{q:"Pedir pra experimentar uma roupa:",opts:["Can I try it on?","Can I use it?","Can I test it?"],correct:0},
    {q:"'Provador':",opts:["Fitting room","Trying room","Change room"],correct:0},
    {q:"'Vou levar' (comprar):",opts:["I will carry it","I'll take it","I go with it"],correct:1}]},
  {id:"trabalho",title:"Falando sobre o trabalho",icon:"💼",
   lines:[["them","So, what do you do for a living?","Então, o que você faz da vida?"],
    ["you","I work in technical support for a software company.","Trabalho no suporte técnico de uma empresa de software."],
    ["them","That sounds interesting. What does that involve?","Parece interessante. O que isso envolve?"],
    ["you","I analyze bugs and help the dev team fix issues.","Eu analiso erros e ajudo o time de desenvolvimento a corrigir problemas."],
    ["them","How long have you been doing this?","Há quanto tempo você faz isso?"],
    ["you","For about a year now.","Faz cerca de um ano."]],
   quiz:[{q:"'O que você faz da vida?':",opts:["What do you do for a living?","What you make for life?","What is your life?"],correct:0},
    {q:"'Parece interessante':",opts:["It seems interested","That sounds interesting","It sound interest"],correct:1},
    {q:"'Há quanto tempo você faz isso?':",opts:["How long you do this?","How long have you been doing this?","Since when you do this?"],correct:1}],
   suavez:{prompt:"'How long have you been doing this?' — responda sobre há quanto tempo você faz o seu trabalho.",sample:"I've been doing this for about a year now, and I really enjoy solving technical problems."}},
  {id:"conferencia",title:"Small talk em conferência",icon:"🎤",
   lines:[["them","Hi, is this seat taken?","Oi, esse lugar está ocupado?"],
    ["you","No, go ahead. I'm Mauricio, by the way.","Não, pode sentar. A propósito, eu sou o Mauricio."],
    ["them","Nice to meet you. Is this your first time at this event?","Prazer. É sua primeira vez nesse evento?"],
    ["you","Yes, it is! What about you?","Sim, é! E você?"],
    ["them","I've been coming for three years. Which talk are you most excited about?","Eu venho há três anos. Qual palestra você está mais animado pra ver?"],
    ["you","I'm really looking forward to the one on AI tools.","Eu tô bem animado pra ver a de ferramentas de IA."]],
   quiz:[{q:"'Esse lugar está ocupado?':",opts:["Is this seat taken?","This place is used?","Someone here?"],correct:0},
    {q:"'A propósito':",opts:["By the way","For the way","In the way"],correct:0},
    {q:"'Estou bem animado pra ver X':",opts:["I'm looking forward to X","I'm waiting X","I hope see X"],correct:0}],
   suavez:{prompt:"'Which talk are you most excited about?' — responda qual palestra/assunto te interessa mais.",sample:"I'm really looking forward to the session about automation tools, it's directly related to my job."}},
  {id:"contatos",title:"Trocando contatos",icon:"📇",
   lines:[["you","It was great talking to you. Do you have a business card?","Foi ótimo falar com você. Você tem um cartão de visita?"],
    ["them","Sure, here you go. Do you have LinkedIn?","Claro, aqui está. Você tem LinkedIn?"],
    ["you","Yes, let's connect there. I'll send you a message.","Sim, vamos nos conectar lá. Eu te mando uma mensagem."],
    ["them","Perfect. Let's keep in touch.","Perfeito. Vamos manter contato."],
    ["you","Definitely. It was a pleasure meeting you.","Com certeza. Foi um prazer te conhecer."]],
   quiz:[{q:"'Vamos manter contato':",opts:["Let's keep in touch","Let's stay contact","We keep touching"],correct:0},
    {q:"'Você tem um cartão de visita?':",opts:["You have card business?","Do you have a business card?","Have you business card?"],correct:1},
    {q:"'Foi um prazer te conhecer':",opts:["It was pleasure to meet you","It was a pleasure meeting you","Was a pleasure to know you"],correct:1}]},
  {id:"repetir",title:"Pedindo para repetir / não entendi",icon:"❓",
   lines:[["them","So basically the API rate limits are configured per endpoint...","Então basicamente os limites da API são configurados por endpoint..."],
    ["you","Sorry, could you repeat that a bit slower?","Desculpe, você poderia repetir um pouco mais devagar?"],
    ["them","Sure! I said the rate limits are set per endpoint.","Claro! Eu disse que os limites são definidos por endpoint."],
    ["you","Got it, thank you. Could you spell that word?","Entendi, obrigado. Você poderia soletrar essa palavra?"],
    ["them","Of course, it's E-N-D-P-O-I-N-T.","Claro, é E-N-D-P-O-I-N-T."]],
   quiz:[{q:"Pedir pra repetir mais devagar:",opts:["Could you repeat that a bit slower?","You say again fast?","Repeat me now"],correct:0},
    {q:"Dizer que não entendeu (educado):",opts:["I no understand","Sorry, I didn't catch that","You talk wrong"],correct:1},
    {q:"Pedir pra soletrar:",opts:["Could you spell that?","Write that for me","Say letters"],correct:0}]},
  {id:"opiniao",title:"Dando sua opinião",icon:"💭",
   lines:[["them","What did you think of the keynote?","O que você achou da palestra principal?"],
    ["you","I thought it was really insightful, especially the part about automation.","Achei bem esclarecedora, principalmente a parte sobre automação."],
    ["them","I agree. Although I think they could've gone deeper on the technical side.","Concordo. Embora eu ache que podiam ter ido mais fundo no lado técnico."],
    ["you","That's a fair point. I'd love to see a follow-up session on that.","É um bom ponto. Eu adoraria ver uma sessão de continuação sobre isso."]],
   quiz:[{q:"'Eu acho que...' pra dar opinião:",opts:["I think that...","I opinion that...","For me that..."],correct:0},
    {q:"'Eu concordo':",opts:["I agree","I concord","I same"],correct:0},
    {q:"'É um bom ponto':",opts:["It's good point","That's a fair point","Is fair the point"],correct:1}],
   suavez:{prompt:"'What did you think of the keynote?' — dê sua opinião sobre uma palestra (real ou imaginária).",sample:"I thought it was really practical. I'd love to see more real examples next time, though."}},
  {id:"encerrar",title:"Encerrando a conversa",icon:"👋",
   lines:[["you","Well, I don't want to keep you. It was great meeting you.","Bom, não quero te atrasar. Foi ótimo te conhecer."],
    ["them","Likewise! Enjoy the rest of the conference.","Igualmente! Aproveite o resto da conferência."],
    ["you","Thanks, you too. See you around!","Obrigado, você também. Nos vemos por aí!"]],
   quiz:[{q:"'Não quero te atrasar':",opts:["I don't want to keep you","I don't want delay you","No want your time"],correct:0},
    {q:"'Igualmente':",opts:["Same to me","Likewise","Equal you"],correct:1},
    {q:"'Nos vemos por aí':",opts:["See you around","We see later","Look you soon"],correct:0}]},
  {id:"depois",title:"Depois do evento (jantar/drinks)",icon:"🍻",
   lines:[["them","A few of us are grabbing drinks after this. Want to join?","Um pessoal vai tomar uma depois disso. Quer ir junto?"],
    ["you","I'd love to! What time and where?","Adoraria! Que horas e onde?"],
    ["them","Around 8, at the bar next to the hotel.","Por volta das 8, no bar do lado do hotel."],
    ["you","Sounds good, count me in.","Combinado, pode contar comigo."]],
   quiz:[{q:"'Pode contar comigo':",opts:["Count me in","Count with me","I count me"],correct:0},
    {q:"'Adoraria!':",opts:["I love","I'd love to!","I loving"],correct:1},
    {q:"'Quer ir junto?':",opts:["Want to join?","Want go together?","You want come?"],correct:0}]},
  {id:"hotel",title:"Check-in no hotel",icon:"🏨",
   lines:[["you","Hi, I have a reservation under Mauricio.","Oi, tenho uma reserva no nome de Mauricio."],
    ["them","Let me check... yes, found it. Can I see your ID?","Deixa eu verificar... sim, encontrei. Posso ver seu documento?"],
    ["you","Sure, here you go. Is breakfast included?","Claro, aqui está. O café da manhã está incluso?"],
    ["them","Yes, from 7 to 10 AM. Here's your key card.","Sim, das 7h às 10h. Aqui está o cartão da sua chave."],
    ["you","Great, thank you very much.","Ótimo, muito obrigado."]],
   quiz:[{q:"'Tenho uma reserva':",opts:["I have a reservation","I have reserved","I am reserved"],correct:0},
    {q:"'Está incluso?':",opts:["Is included?","Is it included?","It include?"],correct:1},
    {q:"'Cartão da chave':",opts:["Key card","Card key room","Room key card is"],correct:0}]},
  {id:"qanda",title:"Perguntas após uma palestra",icon:"🙋‍♂️",
   lines:[["them","Any questions before we wrap up?","Alguma pergunta antes de encerrarmos?"],
    ["you","Yes, I have a question. Could you explain that last point again?","Sim, tenho uma pergunta. Você poderia explicar aquele último ponto de novo?"],
    ["them","Sure, which part exactly?","Claro, qual parte exatamente?"],
    ["you","The part about scaling the system.","A parte sobre escalar o sistema."],
    ["them","Good question. Basically...","Boa pergunta. Basicamente..."]],
   quiz:[{q:"'Tenho uma pergunta':",opts:["I have a question","I have question","I question"],correct:0},
    {q:"Pedir pra explicar de novo:",opts:["Explain again please","Could you explain that again?","You explain again"],correct:1},
    {q:"'Boa pergunta':",opts:["Good question","Nice ask","Good ask"],correct:0}],
   suavez:{prompt:"Você tem uma dúvida sobre a palestra que acabou de assistir. Formule a pergunta em inglês.",sample:"Sorry, could you explain that last point again? I didn't quite follow the part about scaling."}},
  {id:"pitch",title:"Apresentando seu projeto",icon:"📊",
   lines:[["them","So, what are you currently working on?","Então, no que você tá trabalhando atualmente?"],
    ["you","I'm working on improving our support process using log analysis.","Estou trabalhando em melhorar nosso processo de suporte usando análise de logs."],
    ["them","Interesting. What's the main challenge?","Interessante. Qual é o principal desafio?"],
    ["you","The biggest challenge is identifying patterns across different bug reports.","O maior desafio é identificar padrões entre diferentes relatos de bugs."],
    ["them","That makes sense. How do you measure success?","Faz sentido. Como você mede o sucesso?"],
    ["you","We track how much faster issues get resolved.","A gente acompanha o quanto mais rápido os problemas são resolvidos."]],
   quiz:[{q:"'No que você tá trabalhando?':",opts:["What are you working on?","What you work?","In what you work?"],correct:0},
    {q:"'Qual é o principal desafio?':",opts:["What's the main challenge?","What is the big problem?","Which challenge main?"],correct:0},
    {q:"'Faz sentido':",opts:["Make sense","That makes sense","Is sense"],correct:1}],
   suavez:{prompt:"'What are you currently working on?' — descreva em 1-2 frases um projeto ou tarefa sua.",sample:"I'm currently working on analyzing crash logs to find patterns before escalating bugs to the dev team."}},
  {id:"videocall",title:"Chamada de vídeo",icon:"💻",
   lines:[["them","Hi, can you hear me okay?","Oi, você consegue me ouvir bem?"],
    ["you","Yes, I can hear you, but your video is a bit frozen.","Sim, consigo te ouvir, mas seu vídeo tá meio travado."],
    ["them","Sorry, let me reconnect. Is that better now?","Desculpe, deixa eu reconectar. Tá melhor agora?"],
    ["you","Yes, much better now. Can you share your screen?","Sim, bem melhor agora. Você pode compartilhar sua tela?"],
    ["them","Sure, one second.","Claro, um segundo."]],
   quiz:[{q:"'Você consegue me ouvir?':",opts:["Can you hear me?","Can you listen me?","You hear me?"],correct:0},
    {q:"'Compartilhar a tela':",opts:["Share the screen","Divide the screen","Show the screen"],correct:0},
    {q:"'Tá travado' (vídeo/conexão):",opts:["Is frozen","Is stopped","Is broken"],correct:0}]},
  {id:"sotaque",title:"Lidando com sotaques",icon:"🌍",
   lines:[["you","Sorry, I'm having a bit of trouble with your accent. Could you slow down?","Desculpa, tô com um pouco de dificuldade com seu sotaque. Você poderia falar mais devagar?"],
    ["them","No problem at all! I'll speak more slowly.","Sem problema nenhum! Vou falar mais devagar."],
    ["you","Thank you, that helps a lot.","Obrigado, isso ajuda muito."],
    ["them","No worries, happens all the time with different accents.","Sem problema, acontece o tempo todo com sotaques diferentes."]],
   quiz:[{q:"'Tô com dificuldade com seu sotaque':",opts:["I have trouble with your accent","I difficult your accent","Your accent is hard me"],correct:0},
    {q:"'Isso ajuda muito':",opts:["That helps a lot","That help much","Is very help"],correct:0},
    {q:"'Sem problema nenhum':",opts:["No problem at all","Not a problem never","No problem anything"],correct:0}]}
];

/* =========================================================
   FRASES DE SOBREVIVENCIA
========================================================= */
const FRASES = [
  {cat:"Começar uma conversa",items:[
    ["Hi, how's it going?","Oi, como vai?"],["Mind if I join you?","Posso me juntar a vocês?"],
    ["Is this your first time here?","É sua primeira vez aqui?"],["So, what brings you here?","Então, o que te trouxe aqui?"]]},
  {cat:"Quando não entender",items:[
    ["Sorry, could you repeat that?","Desculpe, você poderia repetir?"],
    ["Could you speak a bit slower, please?","Você poderia falar um pouco mais devagar, por favor?"],
    ["Sorry, my English isn't perfect.","Desculpe, meu inglês não é perfeito."],
    ["What does that word mean?","O que essa palavra significa?"],
    ["Sorry, I didn't catch that.","Desculpe, não entendi."]]},
  {cat:"Manter a conversa",items:[
    ["That's interesting, tell me more.","Isso é interessante, me conta mais."],
    ["Really? How come?","Sério? Como assim?"],["What do you mean by that?","O que você quer dizer com isso?"],
    ["I see what you mean.","Entendo o que você quer dizer."]]},
  {cat:"Dar opinião",items:[
    ["I think...","Eu acho que..."],["In my opinion...","Na minha opinião..."],
    ["I agree with that.","Eu concordo com isso."],["I'm not really sure about that.","Não tenho tanta certeza sobre isso."]]},
  {cat:"Encerrar educadamente",items:[
    ["It was great talking to you.","Foi ótimo falar com você."],
    ["I don't want to take up more of your time.","Não quero tomar mais do seu tempo."],
    ["Let's keep in touch.","Vamos manter contato."],["See you around!","Nos vemos por aí!"]]}
];

/* =========================================================
   PRONUNCIA - o que trava brasileiro
========================================================= */
const PRONUNCIA = [
  {title:"O som de TH (this / think)",tip:"Coloque a ponta da língua entre os dentes e sopre o ar — não é nem 'f' nem 't'. É o som que mais entrega sotaque forte de brasileiro.",words:["think","this","three","mother","with","thanks"]},
  {title:"Consoantes finais que não podem sumir",tip:"Em português a gente 'come' o final das palavras. Em inglês isso muda o sentido — o 'd' final de worked, por exemplo, é o que indica passado.",words:["worked","asked","looks","needs","helped","talks"]},
  {title:"Palavra-tônica muda o sentido",tip:"Algumas palavras mudam de substantivo pra verbo só mudando a sílaba forte. Ouça a diferença.",pairs:[["RECord (substantivo)","reCORD (verbo)"],["PRESent (substantivo)","preSENT (verbo)"],["PROject (substantivo)","proJECT (verbo)"]]},
  {title:"Fala conectada — o que você vai ouvir de verdade",tip:"Gringos falando rápido juntam as palavras assim. Você não precisa falar desse jeito, mas precisa RECONHECER quando ouvir, senão trava o entendimento.",pairs:[["gonna","= going to"],["wanna","= want to"],["gotta","= got to / have to"],["gimme","= give me"],["dunno","= don't know"],["lemme","= let me"]]},
  {title:"Pares mínimos pra afinar o ouvido",tip:"Toque nas duas palavras e perceba a diferença de som — confundir esses pares muda o sentido da frase.",pairs:[["ship","sheep"],["work","walk"],["live","leave"],["full","fool"],["bit","beat"],["think","sink"]]}
];

/* =========================================================
   RECURSOS E METODO
========================================================= */
const RECURSOS = [
  {nivel:"A1-A2 · iniciante",nome:"BBC Learning English — 6 Minute English",desc:"Podcast gratuito, episódios curtos (6 min) com transcrição no site. É o ponto de partida mais usado por quem começa do zero."},
  {nivel:"A2-B1 · intermediário",nome:"All Ears English",desc:"Duas americanas conversando em ritmo natural sobre o dia a dia. Ótimo pra acostumar o ouvido com inglês real antes de partir pra conteúdo sem legenda."},
  {nivel:"B1-B2 · negócios",nome:"Business English Pod",desc:"Centenas de episódios de 20-25 min focados em reuniões, apresentações, negociações e networking — quase feito sob medida pro seu objetivo de conferência."},
  {nivel:"B1-B2 · profissional",nome:"British Council LearnEnglish — Podcasts for Professionals",desc:"Recurso gratuito do British Council com foco em comunicação de negócios pra quem já tem uma base."},
  {nivel:"B1+ · imersão",nome:"TED Talks (com legenda em inglês)",desc:"Assista com legenda em inglês, não em português. Palestras de 10-18 min treinam o formato de apresentação + Q&A que você vai encontrar numa conferência."}
];
const METODO = [
  {t:"Shadowing (a técnica mais eficaz pra falar)",p:"Ouça uma frase curta e repita em voz alta imediatamente, imitando o ritmo e a entonação, não só as palavras. Use o 🔊 dos diálogos deste app antes de partir pros podcasts."},
  {t:"Produção, não só reconhecimento",p:"Reconhecer a resposta certa numa lista é mais fácil do que gerar a frase sozinho. Use o modo 'Produzir' no vocabulário e a seção 'Sua vez' nos diálogos — isso é o que realmente treina a fala."},
  {t:"Revisão espaçada (spaced repetition)",p:"Revise as palavras marcadas 'ainda não sei' a cada 2-3 dias. O app guarda seu progresso automaticamente; quando terminar o conteúdo, um app como o Anki (gratuito) ajuda a manter esse hábito com milhares de palavras."},
  {t:"Fale com estrangeiros de verdade",p:"Nenhum app substitui conversa real. Apps de intercâmbio de idiomas (como Tandem ou HelloTalk) conectam você com pessoas que querem praticar português em troca de te ajudarem com inglês."},
  {t:"Rotina realista pra 6-12 meses",p:"20-30 min de app + 15-20 min de listening (podcast/vídeo) + 1 conversa real por semana, todo dia. Fluência conversacional exige por volta de 2.000-3.000 palavras e 300-450 horas de prática — constância importa mais que sessões longas e espaçadas."}
];

/* =========================================================
   PATH (caminho estilo Duolingo)
========================================================= */
const FASE_INFO = {
  1:{title:"Fundamentos pra se virar",goal:"Meta: se apresentar e resolver situações básicas sozinho",color:"var(--teal)",
     schedule:"<b>Cronograma sugerido:</b><br>Sem. 1-2: To Be + Cumprimentos + Números · ouça BBC Learning English, 10 min/dia.<br>Sem. 3-4: Presente Simples + Família + Comida · shadowing com as falas dos diálogos.<br>Sem. 5-6: Artigos + Lugares + Adjetivos · use o modo Produzir no vocabulário.<br>Sem. 7-8: Revisão geral + diálogos · grave sua voz e compare."},
  2:{title:"Conversar sobre o dia a dia",goal:"Meta: contar o que você faz, comparar coisas, falar do passado",color:"#C6871D",
     schedule:"<b>Cronograma sugerido:</b><br>Sem. 9-10: Passado Simples + Trabalho · troque mais um app do celular pra inglês.<br>Sem. 11-12: Presente Contínuo + Tempo/Rotina + Perguntas · ouça All Ears English.<br>Sem. 13-14: Comparativos + Viagem/Casa/Roupas/Transporte · assista vídeos com legenda em inglês.<br>Sem. 15-16: Diálogos · grave um resumo de 1 minuto contando o que você faz."},
  3:{title:"Pronto para a conferência",goal:"Meta: puxar assunto, trocar contato, opinar, pedir pra repetir sem travar",color:"var(--coral)",
     schedule:"<b>Cronograma sugerido:</b><br>Sem. 17-18: Modais + Negócios/Networking · ouça Business English Pod.<br>Sem. 19-20: Futuro + Perguntas úteis · diálogos Conferência e Contatos.<br>Sem. 21-22: Conectores + Repetir/Opinião · pratique Q&amp;A e Pitch, use Sua Vez.<br>Sem. 23-24: Revisão geral + simule uma conferência completa do início ao fim."},
  4:{title:"Soar mais natural (opcional)",goal:"Meta: entender gírias leves, manter conversas mais longas, phrasal verbs",color:"var(--ink-navy)",
     schedule:"<b>Cronograma sugerido:</b><br>Mês 7-8: Phrasal Verbs + Present Perfect · diálogos Videocall/Sotaques/Depois do evento · comece a Pronúncia (Extras).<br>Mês 9-10: Condicionais + Discurso Indireto · ouça podcasts sem apoio de tradução.<br>Mês 11-12: Consolidação — 20 min/dia de listening + 1 conversa real por semana."}
};
const PATH = [
  {fase:1,type:'grammar',key:'tobe'},{fase:1,type:'vocab',key:'cumprimentos'},{fase:1,type:'grammar',key:'artigos'},
  {fase:1,type:'vocab',key:'numeros'},{fase:1,type:'grammar',key:'pronomes'},{fase:1,type:'vocab',key:'familia'},
  {fase:1,type:'grammar',key:'presente'},{fase:1,type:'vocab',key:'comida'},{fase:1,type:'vocab',key:'lugares'},
  {fase:1,type:'vocab',key:'adjetivos'},{fase:1,type:'conv',key:'apresentar'},{fase:1,type:'conv',key:'cafe'},
  {fase:1,type:'conv',key:'direcoes'},
  {fase:2,type:'grammar',key:'continuo'},{fase:2,type:'vocab',key:'verbos'},{fase:2,type:'grammar',key:'passado'},
  {fase:2,type:'vocab',key:'trabalho'},{fase:2,type:'grammar',key:'comparativos'},{fase:2,type:'vocab',key:'tempo'},
  {fase:2,type:'grammar',key:'perguntas'},{fase:2,type:'vocab',key:'viagem'},{fase:2,type:'vocab',key:'emocoes'},
  {fase:2,type:'vocab',key:'casa'},{fase:2,type:'vocab',key:'roupas'},{fase:2,type:'vocab',key:'transporte'},
  {fase:2,type:'conv',key:'aeroporto'},{fase:2,type:'conv',key:'compras'},{fase:2,type:'conv',key:'trabalho'},
  {fase:2,type:'conv',key:'hotel'},
  {fase:3,type:'grammar',key:'modais'},{fase:3,type:'vocab',key:'negocios'},{fase:3,type:'grammar',key:'futuro'},
  {fase:3,type:'vocab',key:'perguntas'},{fase:3,type:'grammar',key:'conectores'},{fase:3,type:'vocab',key:'girias'},
  {fase:3,type:'conv',key:'conferencia'},{fase:3,type:'conv',key:'contatos'},{fase:3,type:'conv',key:'repetir'},
  {fase:3,type:'conv',key:'opiniao'},{fase:3,type:'conv',key:'encerrar'},{fase:3,type:'conv',key:'qanda'},
  {fase:3,type:'conv',key:'pitch'},
  {fase:4,type:'grammar',key:'phrasal'},{fase:4,type:'grammar',key:'presentperfect'},{fase:4,type:'grammar',key:'condicionais'},
  {fase:4,type:'grammar',key:'reported'},{fase:4,type:'conv',key:'depois'},{fase:4,type:'conv',key:'videocall'},
  {fase:4,type:'conv',key:'sotaque'}
];
function pathItemMeta(item){
  if(item.type==='vocab'){ const c=VOCAB[item.key]; return {icon:c.icon,title:c.title}; }
  if(item.type==='grammar'){ const l=GRAMMAR.find(g=>g.id===item.key); return {icon:'📖',title:l.title}; }
  const d=CONVERSATION.find(c=>c.id===item.key); return {icon:d.icon,title:d.title};
}
function pathItemDone(item){
  if(item.type==='vocab'){
    const cat = VOCAB[item.key]; const known = vocabKnownSet();
    return cat.words.every(w=>known.has(item.key+'-'+w[0]));
  }
  if(item.type==='grammar') return state.grammarCompleted.indexOf(item.key)!==-1;
  return state.convCompleted.indexOf(item.key)!==-1;
}
function findCurrentPathIndex(){
  for(let i=0;i<PATH.length;i++){ if(!pathItemDone(PATH[i])) return i; }
  return -1; // tudo completo
}
function openPathItem(item){
  if(item.type==='vocab') openVocabCat(item.key);
  if(item.type==='grammar') openGrammarLesson(item.key);
  if(item.type==='conv') openConvDialog(item.key);
}
function renderDailyMission(){
  const wrap = document.getElementById('daily-mission-card');
  if(!wrap) return;
  ensureDailyXPFresh();
  const cur = Math.min(state.dailyXP, DAILY_XP_GOAL);
  const done = state.dailyXP >= DAILY_XP_GOAL;
  const pct = Math.round(cur/DAILY_XP_GOAL*100);
  wrap.innerHTML = '<div class="xp-bar-wrap">'+
    '<div class="xp-bar-top"><span>🎯 Missão do dia'+(done?' — concluída ✓':'')+'</span><span>'+cur+' / '+DAILY_XP_GOAL+' XP</span></div>'+
    '<div class="xp-bar-track"><div class="xp-bar-fill" style="width:'+pct+'%;"></div></div></div>';
}
const PATH_OFFSETS = [0,55,90,55,0,-55,-90,-55];
function renderPath(){
  const wrap = document.getElementById('path-nodes');
  if(!wrap) return;
  wrap.innerHTML = '';
  const curIdx = findCurrentPathIndex();
  let curFase = null;
  let currentNodeWrapEl = null;
  PATH.forEach((item,i)=>{
    if(item.fase !== curFase){
      curFase = item.fase;
      const info = FASE_INFO[curFase];
      const banner = document.createElement('div');
      banner.className = 'unit-banner';
      banner.style.background = info.color;
      banner.innerHTML = '<div class="u-num">Fase '+curFase+'</div><div class="u-title">'+info.title+'</div><div class="u-goal">'+info.goal+'</div>';
      wrap.appendChild(banner);
    }
    const done = pathItemDone(item);
    const isCurrent = (i===curIdx);
    const isLocked = !done && !isCurrent;
    let stateClass = done ? 'state-done' : (isCurrent ? 'state-current' : 'state-upcoming');
    const meta = pathItemMeta(item);
    const nodeWrap = document.createElement('div');
    nodeWrap.className = 'path-node-wrap';
    nodeWrap.style.marginLeft = PATH_OFFSETS[i % PATH_OFFSETS.length] + 'px';
    nodeWrap.innerHTML =
      '<button class="path-node '+stateClass+'">'+(isLocked?'🔒':meta.icon)+(done?'<span class="pn-check">✓</span>':'')+'</button>'+
      '<div class="path-node-label">'+meta.title+'</div>';
    nodeWrap.querySelector('.path-node').addEventListener('click',()=>{
      if(isLocked){ showToast('🔒 Complete o item atual da trilha antes de avançar pra este.'); return; }
      openPathItem(item);
    });
    wrap.appendChild(nodeWrap);
    if(isCurrent || (curIdx===-1 && i===PATH.length-1)) currentNodeWrapEl = nodeWrap;
  });
  positionPathCat(currentNodeWrapEl);
}
function positionPathCat(nodeWrapEl){
  const container = document.getElementById('path-container');
  if(!container || !nodeWrapEl) return;
  let avatar = document.getElementById('path-cat-avatar');
  const isFirstPlacement = !avatar;
  if(isFirstPlacement){
    avatar = document.createElement('div');
    avatar.id = 'path-cat-avatar';
    avatar.className = 'path-cat-avatar';
    avatar.innerHTML = '<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg">'+
      '<path class="tail" d="M225 300 C 278 288, 286 205, 248 158 C 272 210, 262 268, 218 278 Z" fill="#15161c"/>'+
      '<ellipse cx="98" cy="335" rx="24" ry="16" fill="#15161c"/>'+
      '<ellipse cx="202" cy="335" rx="24" ry="16" fill="#15161c"/>'+
      '<ellipse cx="150" cy="270" rx="98" ry="88" fill="#15161c"/>'+
      '<ellipse cx="150" cy="298" rx="50" ry="60" fill="#f4f4f2"/>'+
      '<rect x="112" y="330" width="26" height="38" rx="13" fill="#f4f4f2"/>'+
      '<rect x="162" y="330" width="26" height="38" rx="13" fill="#f4f4f2"/>'+
      '<path d="M 80 110 L 62 20 L 135 90 Z" fill="#15161c"/>'+
      '<path d="M 88 98 L 78 46 L 122 86 Z" fill="#4a2f38"/>'+
      '<path d="M 220 110 L 238 20 L 165 90 Z" fill="#15161c"/>'+
      '<path d="M 212 98 L 222 46 L 178 86 Z" fill="#4a2f38"/>'+
      '<circle cx="150" cy="150" r="92" fill="#15161c"/>'+
      '<path d="M 92 214 Q 150 242 208 214 L 200 234 Q 150 252 100 234 Z" fill="var(--mustard, #FFC800)"/>'+
      '<ellipse cx="108" cy="144" rx="23" ry="17" fill="#f4f4f2"/>'+
      '<ellipse cx="192" cy="144" rx="23" ry="17" fill="#f4f4f2"/>'+
      '<circle cx="114" cy="144" r="13" fill="#8fd44a"/>'+
      '<circle cx="186" cy="144" r="13" fill="#8fd44a"/>'+
      '<ellipse cx="114" cy="144" rx="4" ry="12.5" fill="#111"/>'+
      '<ellipse cx="186" cy="144" rx="4" ry="12.5" fill="#111"/>'+
      '<circle cx="117" cy="139" r="3" fill="#fff"/>'+
      '<circle cx="189" cy="139" r="3" fill="#fff"/>'+
      '<path d="M 84 136 Q 108 120 132 134 L 132 142 Q 108 130 84 146 Z" fill="#15161c"/>'+
      '<path d="M 168 134 Q 192 120 216 136 L 216 146 Q 192 130 168 142 Z" fill="#15161c"/>'+
      '<path d="M 141 180 L 159 180 L 150 192 Z" fill="#4a2f38"/>'+
      '<path d="M 126 196 Q 150 208 174 196" stroke="#f4f4f2" stroke-width="5" fill="none" stroke-linecap="round"/>'+
      '</svg>';
    container.appendChild(avatar);
  }
  const containerRect = container.getBoundingClientRect();
  const nodeRect = nodeWrapEl.getBoundingClientRect();
  const targetLeft = (nodeRect.left - containerRect.left) + (nodeRect.width/2) - 29;
  const targetTop = (nodeRect.top - containerRect.top) - 66;
  const prevLeft = avatar.dataset.left;
  avatar.style.left = targetLeft + 'px';
  avatar.style.top = targetTop + 'px';
  if(!isFirstPlacement && prevLeft !== undefined && Math.abs(parseFloat(prevLeft) - targetLeft) > 1){
    avatar.classList.add('walking');
    setTimeout(()=>avatar.classList.remove('walking'), 700);
  }
  avatar.dataset.left = targetLeft;
}

/* =========================================================
   BADGES (conquistas)
========================================================= */
const BADGES = [
  {id:"primeira_palavra",icon:"🌱",name:"Primeiro Passo",check:s=>s.vocabKnown.length>=1},
  {id:"vocab_50",icon:"📚",name:"Vocab. 50",check:s=>s.vocabKnown.length>=50},
  {id:"vocab_150",icon:"📖",name:"Vocab. 150",check:s=>s.vocabKnown.length>=150},
  {id:"vocab_all",icon:"🎓",name:"Vocab. Completo",check:s=>s.vocabKnown.length>=200},
  {id:"gram_5",icon:"✏️",name:"5 Lições",check:s=>s.grammarCompleted.length>=5},
  {id:"gram_all",icon:"🧠",name:"Gramática Completa",check:s=>s.grammarCompleted.length>=15},
  {id:"conv_5",icon:"🗨️",name:"5 Diálogos",check:s=>s.convCompleted.length>=5},
  {id:"conv_all",icon:"🎤",name:"Todo Papo",check:s=>s.convCompleted.length>=17},
  {id:"streak_3",icon:"🔥",name:"3 Dias",check:s=>s.streak>=3},
  {id:"streak_7",icon:"🔥",name:"7 Dias",check:s=>s.streak>=7},
  {id:"streak_30",icon:"🏆",name:"30 Dias",check:s=>s.streak>=30},
  {id:"xp_500",icon:"⭐",name:"500 XP",check:s=>s.xp>=500},
  {id:"xp_2000",icon:"💎",name:"2000 XP",check:s=>s.xp>=2000}
];

/* =========================================================
   ESTADO E PERSISTENCIA
========================================================= */
const STORAGE_KEY = "passaporte_ingles_v1";
const DAILY_XP_GOAL = 20;
let state = {
  vocabKnown:[], grammarStats:{correct:0,total:0}, convStats:{correct:0,total:0},
  grammarCompleted:[], convCompleted:[], vocabCatCompleted:[], xp:0, streak:0, lastActive:null, badges:[],
  vocabMistakes:[], grammarMistakes:[], dailyXP:0, dailyXPDate:null, lastWelcomeDate:null,
  xwordCompletedDayId:null, xwordStreak:0, xwordFilledDayId:null, xwordFilledLetters:{},
  wodRevealedDate:null, reduceMotion:false, darkMode:false, memoryBestTime:null
};
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ const parsed = JSON.parse(raw); state = Object.assign(state, parsed); }
  }catch(e){ /* ambiente sem localStorage disponível - segue só na sessão */ }
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  scheduleSync();
}
function vocabKnownSet(){ return new Set(state.vocabKnown); }
function getVocabPendingWords(catKey){
  if(!catKey || !VOCAB[catKey]) return [];
  const known = vocabKnownSet();
  return VOCAB[catKey].words
    .filter(w => !known.has(catKey+'-'+w[0]))
    .map(w => ({ en:w[0], pt:w[1], wid: catKey+'-'+w[0] }));
}
function checkVocabCategoryComplete(catKey){
  if(!catKey || !VOCAB[catKey]) return; // null quando está em modo revisão de erros
  const cat = VOCAB[catKey]; const known = vocabKnownSet();
  const allDone = cat.words.every(w=>known.has(catKey+'-'+w[0]));
  if(allDone && state.vocabCatCompleted.indexOf(catKey)===-1){
    state.vocabCatCompleted.push(catKey);
    showToast('✓ Categoria <b>'+cat.title+'</b> concluída! +10 XP');
    addXP(10);
    confettiBurst(30);
    saveState();
    setTimeout(()=>{ showPage('trilha'); }, 1500);
  }
}
function ensureDailyXPFresh(){
  const t = new Date().toISOString().slice(0,10);
  if(state.dailyXPDate !== t){ state.dailyXPDate = t; state.dailyXP = 0; }
}
function addXP(amount){
  state.xp += amount;
  ensureDailyXPFresh();
  const wasDone = state.dailyXP >= DAILY_XP_GOAL;
  state.dailyXP += amount;
  if(!wasDone && state.dailyXP >= DAILY_XP_GOAL){ showToast('🎯 Missão do dia concluída! +'+DAILY_XP_GOAL+' XP'); confettiBurst(30); }
  checkBadges();
  saveState();
  updateStats();
}
function updateStreak(){
  const today = new Date().toISOString().slice(0,10);
  if(!state.lastActive){ state.streak = 1; }
  else if(state.lastActive !== today){
    const last = new Date(state.lastActive); const now = new Date(today);
    const diffDays = Math.round((now-last)/86400000);
    state.streak = (diffDays===1) ? state.streak+1 : 1;
  }
  state.lastActive = today;
  checkBadges(); saveState();
}
function checkBadges(){
  BADGES.forEach(b=>{
    if(!state.badges.includes(b.id) && b.check(state)){
      state.badges.push(b.id);
      showToast("🎉 Conquista desbloqueada: <b>"+b.name+"</b>");
      confettiBurst(40);
    }
  });
}
function showToast(html){
  const t = document.getElementById('toast');
  t.innerHTML = html; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2600);
}
function levelInfo(){
  const per = 150;
  const level = Math.floor(state.xp/per)+1;
  const cur = state.xp % per;
  return {level, cur, per};
}

let curVocabCat = null, curVocabIdx = 0, curVocabMode = 'recognize', curVocabWords = [];
function addVocabMistake(wid,en,pt){
  if(!state.vocabMistakes.some(m=>m.wid===wid)) state.vocabMistakes.push({wid:wid,en:en,pt:pt});
  saveState();
}
function clearVocabMistake(wid){
  const i = state.vocabMistakes.findIndex(m=>m.wid===wid);
  if(i!==-1){ state.vocabMistakes.splice(i,1); saveState(); }
}
let curGrammarLesson = null;
let curHearts = 5;
const MAX_HEARTS = 5;
function mistakeKey(lessonId, qText){ return lessonId+'|'+qText; }
function addGrammarMistake(lessonId, lessonTitle, q){
  const key = mistakeKey(lessonId, q.q);
  if(!state.grammarMistakes.some(m=>mistakeKey(m.lessonId,m.q)===key)){
    state.grammarMistakes.push({lessonId:lessonId, lessonTitle:lessonTitle, q:q.q, opts:q.opts, correct:q.correct});
  }
  saveState();
}
function clearGrammarMistake(lessonId, qText){
  const key = mistakeKey(lessonId, qText);
  const i = state.grammarMistakes.findIndex(m=>mistakeKey(m.lessonId,m.q)===key);
  if(i!==-1){ state.grammarMistakes.splice(i,1); saveState(); }
}
function renderHeartsRow(){
  let html = '<div class="hearts-row">';
  for(let i=0;i<MAX_HEARTS;i++){ html += '<span'+(i<curHearts?'':' class="heart-lost"')+'>❤️</span>'; }
  html += '</div>';
  return html;
}
let curConvDialog = null;

/* =========================================================
   NAVEGACAO
========================================================= */
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.page===id ||
      (id.startsWith('vocab') && t.dataset.page==='vocab-menu') ||
      (id.startsWith('grammar') && t.dataset.page==='grammar-menu') ||
      (id.startsWith('conv') && t.dataset.page==='conv-menu'));
  });
  if(id!=='grammar-lesson'){ curHearts = MAX_HEARTS; document.getElementById('topbar-hearts').textContent = curHearts; }
  window.scrollTo(0,0);
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));
document.querySelectorAll('.menu-item[data-page]').forEach(m=>m.addEventListener('click',()=>showPage(m.dataset.page)));
document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.back)));
document.querySelectorAll('.fitem[data-page]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page)));
document.querySelectorAll('.fitem[data-nav]').forEach(b=>{
  b.addEventListener('click',()=>{
    const parts = b.dataset.nav.split(':'); const type = parts[0], key = parts[1];
    if(type==='vocab') openVocabCat(key);
    if(type==='grammar') openGrammarLesson(key);
    if(type==='conv') openConvDialog(key);
  });
});

function updateStats(){
  document.getElementById('stat-vocab').textContent = state.vocabKnown.length;
  document.getElementById('stat-grammar').textContent = state.grammarCompleted.length;
  document.getElementById('stat-conv').textContent = state.convCompleted.length;
  const li = levelInfo();
  const xpEl = document.getElementById('topbar-xp');
  const levelEl = document.getElementById('topbar-level');
  const streakEl = document.getElementById('topbar-streak');
  if(xpEl.textContent !== String(state.xp)) bumpEl(xpEl);
  const newLevelText = 'Nível '+li.level;
  if(levelEl.textContent !== newLevelText) bumpEl(levelEl);
  if(streakEl.textContent !== String(state.streak)) bumpEl(streakEl);
  levelEl.textContent = newLevelText;
  streakEl.textContent = state.streak;
  xpEl.textContent = state.xp;
  document.getElementById('topbar-hearts').textContent = curHearts;
  renderBadges();
  renderDailyMission();
  renderDesktopSidePanel();
  if(typeof renderPath === 'function') renderPath();
}
function renderDesktopSidePanel(){
  const fillEl = document.getElementById('dsp-mission-fill');
  if(!fillEl) return; // painel só é usado em telas largas, mas os elementos sempre existem no DOM
  const pct = Math.min(100, Math.round((state.dailyXP/DAILY_XP_GOAL)*100));
  fillEl.style.width = pct+'%';
  document.getElementById('dsp-mission-label').textContent = Math.min(state.dailyXP,DAILY_XP_GOAL)+' / '+DAILY_XP_GOAL+' XP';
  document.getElementById('dsp-streak-num').textContent = state.streak;
}
function renderBadges(){
  const wrap = document.getElementById('badge-row'); wrap.innerHTML='';
  BADGES.forEach(b=>{
    const unlocked = state.badges.includes(b.id);
    const div = document.createElement('div'); div.className='badge-chip';
    div.innerHTML = '<div class="badge-icon'+(unlocked?' unlocked':'')+'">'+b.icon+'</div><span class="bname">'+b.name+'</span>';
    wrap.appendChild(div);
  });
}
function showStamp(text){
  const layer = document.getElementById('stampLayer');
  document.getElementById('stampText1').textContent = text;
  layer.classList.remove('show'); void layer.offsetWidth; layer.classList.add('show');
  setTimeout(()=>layer.classList.remove('show'), 700);
}

/* Confete leve em CSS/JS puro — sem libs externas. Usado nos momentos de conquista:
   missão do dia concluída, badge desbloqueado, lição/diálogo concluído. */
const CONFETTI_COLORS = ['#58CC02','#FFC800','#1CB0F6','#FF4B4B','#CE82FF'];
function confettiBurst(count){
  count = count || 24;
  for(let i=0;i<count;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = 6 + Math.random()*6;
    piece.style.left = Math.random()*100+'vw';
    piece.style.width = size+'px';
    piece.style.height = (size*0.4)+'px';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random()*CONFETTI_COLORS.length)];
    piece.style.animationDuration = (1.6+Math.random()*1.2)+'s';
    piece.style.animationDelay = (Math.random()*0.25)+'s';
    piece.style.transform = 'rotate('+Math.floor(Math.random()*360)+'deg)';
    document.body.appendChild(piece);
    setTimeout(()=>piece.remove(), 3200);
  }
}
/* Faz um número "pular" (pop) quando muda — usado no XP/nível/streak do topo. */
function bumpEl(el){
  if(!el) return;
  el.classList.remove('stat-bump'); void el.offsetWidth; el.classList.add('stat-bump');
}

/* =========================================================
   VOCABULARIO
========================================================= */
function renderVocabMenu(){
  const list = document.getElementById('vocab-cat-list'); list.innerHTML = '';
  const known = vocabKnownSet();
  let totalWords = 0;
  if(state.vocabMistakes.length){
    const rdiv = document.createElement('div'); rdiv.className='cat-chip'; rdiv.style.background='#FCEBE9'; rdiv.style.borderColor='var(--coral)';
    rdiv.innerHTML = '<div><strong>🔁 Revisar palavras erradas</strong><br><span>'+state.vocabMistakes.length+' palavra(s) pra reforçar</span></div><span>›</span>';
    rdiv.addEventListener('click',openVocabReview);
    list.appendChild(rdiv);
  }
  Object.entries(VOCAB).forEach(([key,cat])=>{
    totalWords += cat.words.length;
    const knownCount = cat.words.filter(w=>known.has(key+'-'+w[0])).length;
    const div = document.createElement('div'); div.className='cat-chip';
    const doneMark = knownCount===cat.words.length ? '<span class="done-mark">✓ completo</span>' : ('<span>'+knownCount+'/'+cat.words.length+' ✓</span>');
    div.innerHTML = '<div><strong>'+cat.icon+' '+cat.title+'</strong><br><span>'+cat.words.length+' palavras</span></div>'+doneMark;
    div.addEventListener('click',()=>openVocabCat(key));
    list.appendChild(div);
  });
  document.getElementById('vocab-menu-count').textContent = Object.keys(VOCAB).length+' temas · '+totalWords+' palavras';
}
function openVocabCat(key){
  curVocabCat = key; curVocabIdx = 0; curVocabMode = 'recognize';
  curVocabWords = VOCAB[key].words.map(w=>({en:w[0],pt:w[1],wid:key+'-'+w[0]}));
  document.getElementById('mode-recognize').classList.add('active');
  document.getElementById('mode-produce').classList.remove('active');
  document.getElementById('recognize-mode').style.display='block';
  document.getElementById('produce-mode').style.display='none';
  document.getElementById('vocab-cat-title').textContent = VOCAB[key].icon+' '+VOCAB[key].title;
  showPage('vocab-cards'); renderCard();
}
function openVocabReview(){
  curVocabCat = null; curVocabIdx = 0; curVocabMode = 'recognize';
  curVocabWords = state.vocabMistakes.slice();
  document.getElementById('mode-recognize').classList.add('active');
  document.getElementById('mode-produce').classList.remove('active');
  document.getElementById('recognize-mode').style.display='block';
  document.getElementById('produce-mode').style.display='none';
  document.getElementById('vocab-cat-title').textContent = '🔁 Revisão de palavras erradas';
  showPage('vocab-cards'); renderCard();
}
document.getElementById('mode-recognize').addEventListener('click',()=>{
  curVocabMode='recognize'; curVocabIdx=0;
  document.getElementById('mode-recognize').classList.add('active');
  document.getElementById('mode-produce').classList.remove('active');
  document.getElementById('recognize-mode').style.display='block';
  document.getElementById('produce-mode').style.display='none';
  renderCard();
});
document.getElementById('mode-produce').addEventListener('click',()=>{
  curVocabMode='produce'; curVocabIdx=0;
  document.getElementById('mode-produce').classList.add('active');
  document.getElementById('mode-recognize').classList.remove('active');
  document.getElementById('produce-mode').style.display='block';
  document.getElementById('recognize-mode').style.display='none';
  renderCard();
});
function renderCard(){
  if(curVocabIdx >= curVocabWords.length){
    const pending = getVocabPendingWords(curVocabCat);
    const continueArea = document.getElementById('vocab-continue-area');
    if(curVocabMode==='recognize'){
      document.getElementById('fc-word').textContent = '✓';
      document.getElementById('fc-trans').textContent = pending.length ? 'Quase lá!' : 'Concluído!';
      document.getElementById('flashcard').classList.remove('flipped');
      document.querySelector('.recognize-typebox').style.display = 'none';
      document.querySelector('#recognize-mode .flash-actions').style.display = 'none';
      if(pending.length){
        document.getElementById('flash-progress').textContent = 'Faltam '+pending.length+' palavra(s) nesse tema';
        document.getElementById('fc-hint').textContent = '';
        continueArea.style.display = 'block';
        continueArea.innerHTML =
          '<div class="intro-note">Você já passou por todas as cartas, mas ainda faltam <b>'+pending.length+'</b> palavra(s) pra dominar esse tema.</div>'+
          '<button class="btn btn-primary" id="vocab-continue-btn" style="width:100%;margin-top:8px;">Praticar as que faltam →</button>';
        document.getElementById('vocab-continue-btn').addEventListener('click', ()=>{
          curVocabWords = pending; curVocabIdx = 0;
          document.querySelector('#recognize-mode .flash-actions').style.display = 'flex';
          renderCard();
        });
      } else {
        document.getElementById('flash-progress').textContent = 'Você concluiu este tema! 🎉';
        document.getElementById('fc-hint').textContent = 'Volte aos temas ou reveja este novamente.';
        continueArea.style.display = 'none';
        continueArea.innerHTML = '';
      }
    } else {
      document.getElementById('pr-input').style.display='none';
      document.getElementById('pr-check').style.display='none';
      document.getElementById('pr-skip').style.display='none';
      if(pending.length){
        document.getElementById('pr-word').textContent = 'Quase lá! Faltam '+pending.length+' palavra(s)';
        document.getElementById('pr-feedback').className = 'produce-feedback';
        document.getElementById('pr-feedback').innerHTML =
          '<button class="btn btn-primary" id="vocab-continue-btn-pr" style="width:100%;margin-top:8px;">Praticar as que faltam →</button>';
        document.getElementById('vocab-continue-btn-pr').addEventListener('click', ()=>{
          curVocabWords = pending; curVocabIdx = 0;
          document.getElementById('pr-input').style.display='block';
          document.getElementById('pr-check').style.display='block';
          document.getElementById('pr-skip').style.display='block';
          renderCard();
        });
      } else {
        document.getElementById('pr-word').textContent = '✓ Concluído!';
        document.getElementById('pr-feedback').innerHTML = '';
      }
    }
    return;
  }
  const w = curVocabWords[curVocabIdx]; const en = w.en, pt = w.pt;
  document.getElementById('flash-progress').textContent = 'Palavra '+(curVocabIdx+1)+' de '+curVocabWords.length;
  if(curVocabMode==='recognize'){
    document.getElementById('vocab-continue-area').style.display = 'none';
    document.querySelector('#recognize-mode .flash-actions').style.display = 'flex';
    document.querySelector('.recognize-typebox').style.display = 'block';
    document.getElementById('fc-word').textContent = en;
    document.getElementById('fc-trans').textContent = pt;
    document.getElementById('fc-hint').textContent = 'Em inglês: '+en;
    document.getElementById('flashcard').classList.remove('flipped');
    document.getElementById('rt-input').value = '';
    document.getElementById('rt-input').disabled = false;
    document.getElementById('rt-feedback').className = 'produce-feedback';
    document.getElementById('rt-feedback').textContent = '';
    document.getElementById('rt-check').textContent = 'Verificar';
    document.getElementById('rt-check').onclick = checkRecognizeGuess;
  } else {
    document.getElementById('pr-word').textContent = pt;
    document.getElementById('pr-input').style.display='block';
    document.getElementById('pr-check').style.display='block';
    document.getElementById('pr-skip').style.display='inline-block';
    document.getElementById('pr-input').value='';
    document.getElementById('pr-input').disabled=false;
    document.getElementById('pr-feedback').className='produce-feedback';
    document.getElementById('pr-feedback').textContent='';
    document.getElementById('pr-check').textContent='Verificar';
    document.getElementById('pr-check').onclick = checkProduce;
    document.getElementById('pr-input').focus();
  }
}
document.getElementById('flashcard').addEventListener('click',function(){ this.classList.toggle('flipped'); });
document.getElementById('btn-know').addEventListener('click',()=>{
  if(curVocabIdx < curVocabWords.length){
    const w = curVocabWords[curVocabIdx];
    if(state.vocabKnown.indexOf(w.wid)===-1){ state.vocabKnown.push(w.wid); addXP(8); }
    clearVocabMistake(w.wid);
    showStamp('KNOWN');
    checkVocabCategoryComplete(curVocabCat);
  }
  curVocabIdx++; renderCard();
});
function checkRecognizeGuess(){
  const w = curVocabWords[curVocabIdx]; const en = w.en, pt = w.pt, wid = w.wid;
  const userVal = document.getElementById('rt-input').value;
  if(!userVal.trim()) return;
  const correctVariants = pt.split(' / ').map(v=>normalizePt(v));
  const userNorm = normalizePt(userVal);
  const fb = document.getElementById('rt-feedback');
  document.getElementById('rt-input').disabled = true;
  if(correctVariants.indexOf(userNorm)!==-1){
    fb.className='produce-feedback ok'; fb.innerHTML = '✓ Correto! <b>'+pt+'</b>';
    if(state.vocabKnown.indexOf(wid)===-1){ state.vocabKnown.push(wid); addXP(8); }
    clearVocabMistake(wid);
    showStamp('CORRECT');
    checkVocabCategoryComplete(curVocabCat);
  } else {
    fb.className='produce-feedback bad'; fb.innerHTML = 'Significado certo: <b>'+pt+'</b><br>Você escreveu: "'+userVal+'"';
    addVocabMistake(wid, en, pt);
    saveState();
  }
  document.getElementById('rt-check').textContent = 'Próxima →';
  document.getElementById('rt-check').onclick = ()=>{ curVocabIdx++; renderCard(); };
}
document.getElementById('pr-skip').addEventListener('click',()=>{ curVocabIdx++; renderCard(); });

function normalizePt(str){
  return str.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // remove acentos (café -> cafe), pra ser tolerante
    .replace(/[.,!?]/g,'')
    .replace(/\s+/g,' ').trim();
}
function normalizeEn(str){
  const contractions = {"i'm":"i am","you're":"you are","he's":"he is","she's":"she is","they're":"they are",
    "we're":"we are","isn't":"is not","don't":"do not","doesn't":"does not","didn't":"did not","can't":"cannot",
    "won't":"will not","i'll":"i will","i've":"i have","let's":"let us"};
  let s = str.toLowerCase().trim().replace(/[.,!?]/g,'');
  Object.keys(contractions).forEach(k=>{ s = s.split(k).join(contractions[k]); });
  return s.replace(/\s+/g,' ').trim();
}
function checkProduce(){
  const w = curVocabWords[curVocabIdx]; const en = w.en, wid = w.wid;
  const userVal = document.getElementById('pr-input').value;
  if(!userVal.trim()) return;
  const correctVariants = en.split(' / ').map(v=>normalizeEn(v));
  const userNorm = normalizeEn(userVal);
  const fb = document.getElementById('pr-feedback');
  document.getElementById('pr-input').disabled = true;
  if(correctVariants.indexOf(userNorm)!==-1){
    fb.className='produce-feedback ok'; fb.innerHTML = '✓ Correto! <b>'+en+'</b>';
    if(state.vocabKnown.indexOf(wid)===-1){ state.vocabKnown.push(wid); addXP(12); } else { addXP(4); }
    clearVocabMistake(wid);
    showStamp('CORRECT');
    checkVocabCategoryComplete(curVocabCat);
  } else {
    fb.className='produce-feedback bad'; fb.innerHTML = 'Resposta certa: <b>'+en+'</b><br>Você escreveu: "'+userVal+'"';
    addVocabMistake(wid, w.en, w.pt);
    addXP(2);
  }
  document.getElementById('pr-check').textContent='Próxima →';
  document.getElementById('pr-check').onclick = ()=>{ curVocabIdx++; renderCard(); };
}

/* =========================================================
   GRAMATICA
========================================================= */
function renderGrammarMenu(){
  const list = document.getElementById('grammar-cat-list'); list.innerHTML = '';
  if(state.grammarMistakes.length){
    const rdiv = document.createElement('div'); rdiv.className='cat-chip'; rdiv.style.background='#FCEBE9'; rdiv.style.borderColor='var(--coral)';
    rdiv.innerHTML = '<div><strong>🔁 Revisar erros de gramática</strong><br><span>'+state.grammarMistakes.length+' pergunta(s) pra reforçar</span></div><span>›</span>';
    rdiv.addEventListener('click', openGrammarReview);
    list.appendChild(rdiv);
  }
  GRAMMAR.forEach(lesson=>{
    const done = state.grammarCompleted.indexOf(lesson.id)!==-1;
    const div = document.createElement('div'); div.className='cat-chip';
    const qCount = Math.min(6, lesson.quiz.length);
    div.innerHTML = '<div><strong>'+lesson.title+'</strong><br><span>'+qCount+' exercícios (banco de '+lesson.quiz.length+') + produção</span></div>'+(done?'<span class="done-mark">✓</span>':'<span>›</span>');
    div.addEventListener('click',()=>openGrammarLesson(lesson.id));
    list.appendChild(div);
  });
}
function shuffleArr(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function openGrammarLesson(id){
  curGrammarLesson = GRAMMAR.find(l=>l.id===id);
  document.getElementById('gl-title').textContent = curGrammarLesson.title;
  document.getElementById('gl-explain').innerHTML = curGrammarLesson.explain;
  renderGlExamples(); renderGlMisconceptions(); renderGlCompare();
  renderGrammarQuiz(); renderGrammarProduce(); showPage('grammar-lesson');
}
function openGrammarReview(){
  curGrammarLesson = {
    id:'__review__', title:'🔁 Revisão de erros de gramática',
    explain:'Estas são perguntas que você errou em lições diferentes. Acerte pra tirá-las da lista de revisão.',
    quiz: state.grammarMistakes.map(m=>({q:m.q, opts:m.opts, correct:m.correct, _lessonId:m.lessonId, _lessonTitle:m.lessonTitle})),
    produce: []
  };
  document.getElementById('gl-title').textContent = curGrammarLesson.title;
  document.getElementById('gl-explain').innerHTML = curGrammarLesson.explain;
  renderGlExamples(); renderGlMisconceptions(); renderGlCompare();
  renderGrammarQuiz(); renderGrammarProduce(); showPage('grammar-lesson');
}
function renderGlExamples(){
  const wrap = document.getElementById('gl-examples'); wrap.innerHTML='';
  if(!curGrammarLesson.examples || !curGrammarLesson.examples.length) return;
  wrap.innerHTML = '<h3 style="font-size:15px;color:var(--heading-text);margin-bottom:10px;">Exemplos</h3>';
  curGrammarLesson.examples.forEach(pair=>{
    const en=pair[0], pt=pair[1];
    const row = document.createElement('div'); row.className='ex-row';
    row.innerHTML = '<button class="ex-spk">🔊</button><div class="ex-txt"><span class="ex-en">'+en+'</span><span class="ex-pt">'+pt+'</span></div>';
    row.querySelector('.ex-spk').addEventListener('click',()=>speak(en));
    wrap.appendChild(row);
  });
}
function renderGlMisconceptions(){
  const wrap = document.getElementById('gl-misconceptions'); wrap.innerHTML='';
  if(!curGrammarLesson.misconceptions || !curGrammarLesson.misconceptions.length) return;
  const box = document.createElement('div'); box.className='misconception-box';
  let inner = '<h4>⚠️ Erros comuns de brasileiro</h4><ul>';
  curGrammarLesson.misconceptions.forEach(m=>{
    inner += '<li><span class="wrong-ex">'+m.wrong+'</span> → <span class="right-ex">'+m.right+'</span><br>'+m.note+'</li>';
  });
  inner += '</ul>';
  box.innerHTML = inner;
  wrap.appendChild(box);
}
function renderGlCompare(){
  const wrap = document.getElementById('gl-compare'); wrap.innerHTML='';
  if(!curGrammarLesson.compare) return;
  const c = curGrammarLesson.compare;
  let html = '<table class="compare-table"><tr>'+c.headers.map(h=>'<th>'+h+'</th>').join('')+'</tr>';
  c.rows.forEach(r=>{ html += '<tr>'+r.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>'; });
  html += '</table>';
  wrap.innerHTML = html;
}
function checkGrammarLessonComplete(){
  if(curGrammarLesson.id==='__review__') return; // sessão sintética, não conta como lição
  const quizAnswered = [...document.querySelectorAll('#gl-quiz .quiz-q')].every(q=>q.classList.contains('answered'));
  const produceAnswered = [...document.querySelectorAll('#gl-produce .produce-feedback')].every(f=>f.textContent.trim()!=='');
  if(quizAnswered && produceAnswered && state.grammarCompleted.indexOf(curGrammarLesson.id)===-1){
    state.grammarCompleted.push(curGrammarLesson.id);
    addXP(15);
    showToast('✓ Lição <b>'+curGrammarLesson.title+'</b> concluída! +15 XP');
    confettiBurst(30);
    setTimeout(()=>{ showPage('trilha'); }, 1500);
  }
  saveState(); updateStats();
}
function getGlobalPtPool(excludePt){
  const pool = [];
  GRAMMAR.forEach(l=>(l.examples||[]).forEach(e=>{ if(e[1]!==excludePt) pool.push(e[1]); }));
  return pool;
}
function buildActivityPool(lesson){
  const acts = [];
  (lesson.quiz||[]).forEach(q=>{
    acts.push(q.q.includes('___') ? {type:'blank', q:q} : {type:'mc', q:q});
  });
  (lesson.examples||[]).forEach(ex=>{
    const pool = shuffleArr(getGlobalPtPool(ex[1])).slice(0,2);
    const opts = shuffleArr([ex[1], ...pool]);
    acts.push({type:'audio', en:ex[0], pt:ex[1], opts:opts, correct:opts.indexOf(ex[1])});
  });
  (lesson.misconceptions||[]).forEach(m=>{
    const opts = shuffleArr([m.wrong, m.right]);
    acts.push({type:'discrim', opts:opts, correct:opts.indexOf(m.right), note:m.note});
  });
  return shuffleArr(acts);
}
function renderGrammarQuiz(){
  const wrap = document.getElementById('gl-quiz');
  const isReview = curGrammarLesson.id==='__review__';
  const picked = isReview ? curGrammarLesson.quiz.map(q=>({type:'mc', q:q})) : buildActivityPool(curGrammarLesson);
  curHearts = MAX_HEARTS;
  document.getElementById('topbar-hearts').textContent = curHearts;
  wrap.innerHTML = '';
  const toolbar = document.createElement('div'); toolbar.className='quiz-toolbar';
  toolbar.innerHTML = '<h3 style="font-size:15px;color:var(--heading-text);margin:0;">'+(isReview?'Revisão':'Pratique ('+picked.length+' atividades)')+'</h3>'+
    '<div style="display:flex;align-items:center;gap:8px;">'+renderHeartsRow()+(isReview?'':'<button class="retry-btn" id="gl-retry-quiz">🔀 Sortear de novo</button>')+'</div>';
  wrap.appendChild(toolbar);
  if(!isReview) document.getElementById('gl-retry-quiz').addEventListener('click', renderGrammarQuiz);
  if(picked.length===0){
    wrap.appendChild(Object.assign(document.createElement('div'),{className:'intro-note',innerHTML:'Nenhum erro pendente aqui — mandou bem! 🎉'}));
    return;
  }
  const gateBox = document.createElement('div'); gateBox.id='gl-quiz-gate'; gateBox.style.display='none';
  gateBox.className='misconception-box';
  gateBox.innerHTML = '<h4>💔 Sem vidas</h4><p style="font-family:\'Trebuchet MS\',sans-serif;font-size:12px;color:var(--text-dark);margin:0 0 8px;">Dá uma olhada de novo na explicação e nos erros comuns lá em cima antes de continuar.</p><button class="retry-btn" id="gl-hearts-reset">❤️ Recarregar vidas e continuar</button>';

  function lockIfOutOfHearts(){
    if(curHearts<=0){
      wrap.querySelectorAll('.quiz-q').forEach(qd=>{ if(!qd.classList.contains('answered')) qd.classList.add('locked'); });
      gateBox.style.display='block';
    }
  }
  function registerAnswer(qdiv, correct, mistakeQ){
    state.grammarStats.total++;
    qdiv.classList.add('answered');
    if(correct){
      state.grammarStats.correct++; showStamp('CORRECT'); addXP(5);
      if(isReview && mistakeQ) clearGrammarMistake(mistakeQ._lessonId, mistakeQ.q);
    } else {
      curHearts = Math.max(0, curHearts-1);
      document.getElementById('topbar-hearts').textContent = curHearts;
      toolbar.querySelector('.hearts-row').outerHTML = renderHeartsRow();
      addXP(1);
      if(!isReview && mistakeQ) addGrammarMistake(curGrammarLesson.id, curGrammarLesson.title, mistakeQ);
    }
    lockIfOutOfHearts();
    checkGrammarLessonComplete();
  }

  picked.forEach((act,qi)=>{
    const qdiv = document.createElement('div'); qdiv.className='quiz-q';
    if(act.type==='mc'){
      const q = act.q;
      qdiv.innerHTML = '<div class="qtext">'+(qi+1)+'. '+q.q+'</div>';
      q.opts.forEach((opt,oi)=>{
        const btn = document.createElement('button'); btn.className='opt'; btn.textContent = opt;
        btn.addEventListener('click',()=>{
          if(qdiv.classList.contains('answered') || qdiv.classList.contains('locked')) return;
          const allOpts = qdiv.querySelectorAll('.opt'); allOpts.forEach(o=>o.classList.add('disabled'));
          const ok = oi===q.correct;
          btn.classList.add(ok?'correct':'wrong'); if(!ok) allOpts[q.correct].classList.add('correct');
          registerAnswer(qdiv, ok, q);
        });
        qdiv.appendChild(btn);
      });
    } else if(act.type==='blank'){
      const q = act.q;
      const inputId='glb-input-'+qi, btnId='glb-btn-'+qi, fbId='glb-fb-'+qi;
      qdiv.innerHTML = '<div class="qtext">'+(qi+1)+'. ✏️ Complete a frase: '+q.q+'</div>'+
        '<input type="text" id="'+inputId+'" placeholder="Digite a palavra que falta..." autocomplete="off" autocapitalize="off" style="width:100%;padding:10px;border:2px solid var(--paper-line);border-radius:8px;font-family:\'Trebuchet MS\',sans-serif;font-size:13px;margin-bottom:8px;background:var(--paper);">'+
        '<div class="produce-feedback" id="'+fbId+'"></div>'+
        '<button class="btn btn-primary" id="'+btnId+'" style="width:100%;">Verificar</button>';
      wrap.appendChild(qdiv);
      document.getElementById(btnId).addEventListener('click',()=>{
        if(qdiv.classList.contains('answered') || qdiv.classList.contains('locked')) return;
        const inp = document.getElementById(inputId);
        if(!inp.value.trim()) return;
        const correctWord = q.opts[q.correct];
        const ok = normalizeEn(inp.value)===normalizeEn(correctWord);
        inp.disabled = true;
        const fb = document.getElementById(fbId);
        if(ok){ fb.className='produce-feedback ok'; fb.innerHTML='✓ Correto!'; }
        else { fb.className='produce-feedback bad'; fb.innerHTML='Resposta certa: <b>'+correctWord+'</b><br>Você escreveu: "'+inp.value+'"'; }
        registerAnswer(qdiv, ok, q);
      });
      return; // ja anexado ao wrap manualmente
    } else if(act.type==='audio'){
      const spkBtn = document.createElement('button'); spkBtn.className='retry-btn'; spkBtn.style.marginBottom='8px'; spkBtn.textContent='🔊 Ouvir a frase';
      qdiv.innerHTML = '<div class="qtext">'+(qi+1)+'. Ouça e escolha a tradução correta</div>';
      qdiv.appendChild(spkBtn);
      spkBtn.addEventListener('click',()=>speak(act.en));
      act.opts.forEach((opt,oi)=>{
        const btn = document.createElement('button'); btn.className='opt'; btn.textContent = opt;
        btn.addEventListener('click',()=>{
          if(qdiv.classList.contains('answered') || qdiv.classList.contains('locked')) return;
          const allOpts = qdiv.querySelectorAll('.opt'); allOpts.forEach(o=>o.classList.add('disabled'));
          const ok = oi===act.correct;
          btn.classList.add(ok?'correct':'wrong'); if(!ok) allOpts[act.correct].classList.add('correct');
          registerAnswer(qdiv, ok, null);
        });
        qdiv.appendChild(btn);
      });
    } else if(act.type==='discrim'){
      qdiv.innerHTML = '<div class="qtext">'+(qi+1)+'. Qual frase está correta?</div>';
      act.opts.forEach((opt,oi)=>{
        const btn = document.createElement('button'); btn.className='opt'; btn.textContent = opt;
        btn.addEventListener('click',()=>{
          if(qdiv.classList.contains('answered') || qdiv.classList.contains('locked')) return;
          const allOpts = qdiv.querySelectorAll('.opt'); allOpts.forEach(o=>o.classList.add('disabled'));
          const ok = oi===act.correct;
          btn.classList.add(ok?'correct':'wrong'); if(!ok) allOpts[act.correct].classList.add('correct');
          registerAnswer(qdiv, ok, null);
        });
        qdiv.appendChild(btn);
      });
    }
    wrap.appendChild(qdiv);
  });
  wrap.appendChild(gateBox);
  document.getElementById('gl-hearts-reset').addEventListener('click',()=>{
    curHearts = MAX_HEARTS;
    document.getElementById('topbar-hearts').textContent = curHearts;
    toolbar.querySelector('.hearts-row').outerHTML = renderHeartsRow();
    wrap.querySelectorAll('.quiz-q.locked').forEach(qd=>qd.classList.remove('locked'));
    gateBox.style.display='none';
  });
}
/* Diff palavra-a-palavra: mostra o que faltou/sobrou/bateu entre a resposta do usuário e a esperada */
function wordDiffHtml(userText, correctText){
  const userWords = normalizeEn(userText).split(' ').filter(Boolean);
  const correctWords = normalizeEn(correctText).split(' ').filter(Boolean);
  const maxLen = Math.max(userWords.length, correctWords.length);
  let out = '';
  for(let i=0;i<maxLen;i++){
    const uw = userWords[i], cw = correctWords[i];
    if(uw!==undefined && uw===cw){ out += '<span class="diff-word ok">'+cw+'</span>'; }
    else if(uw!==undefined && cw!==undefined){ out += '<span class="diff-word extra">'+uw+'</span><span class="diff-word miss">'+cw+'</span>'; }
    else if(cw!==undefined){ out += '<span class="diff-word miss">'+cw+'</span>'; }
    else if(uw!==undefined){ out += '<span class="diff-word extra">'+uw+'</span>'; }
  }
  return out;
}
function renderGrammarProduce(){
  const wrap = document.getElementById('gl-produce');
  wrap.innerHTML = '<h3 style="font-size:15px;color:var(--heading-text);margin:18px 0 10px;">Produza (digite a resposta)</h3>';
  curGrammarLesson.produce.forEach((ex,ei)=>{
    const box = document.createElement('div'); box.className='quiz-q';
    const inputId = 'glp-input-'+ei, fbId = 'glp-fb-'+ei, btnId='glp-btn-'+ei;
    box.innerHTML = '<div class="qtext">'+(ei+1)+'. '+ex.p+'</div>'+
      '<input type="text" id="'+inputId+'" placeholder="Digite em inglês..." autocomplete="off" autocapitalize="off" style="width:100%;padding:10px;border:2px solid var(--paper-line);border-radius:8px;font-family:\'Trebuchet MS\',sans-serif;font-size:13px;margin-bottom:8px;background:var(--paper);">'+
      '<div class="produce-feedback" id="'+fbId+'"></div>'+
      '<button class="btn btn-primary" id="'+btnId+'" style="width:100%;">Verificar</button>';
    wrap.appendChild(box);
    document.getElementById(btnId).addEventListener('click',()=>{
      const inp = document.getElementById(inputId);
      if(!inp.value.trim() || inp.disabled) return;
      const userNorm = normalizeEn(inp.value);
      const accepted = ex.a.map(a=>normalizeEn(a));
      const fb = document.getElementById(fbId);
      inp.disabled = true;
      if(accepted.indexOf(userNorm)!==-1){
        fb.className='produce-feedback ok'; fb.innerHTML='✓ Correto!'; showStamp('CORRECT'); addXP(10);
      } else {
        fb.className='produce-feedback bad';
        fb.innerHTML='Sugestão: <b>'+ex.a[0]+'</b><br>Você escreveu: "'+inp.value+'"'+
          '<div class="diff-line">'+wordDiffHtml(inp.value, ex.a[0])+'</div>'+
          '<div style="font-size:10.5px;color:var(--text-soft);margin-top:4px;">🟢 certo · 🔴 faltou · 🟠 sobrou/errado</div>';
        addXP(2);
      }
      checkGrammarLessonComplete();
    });
  });
}

/* =========================================================
   CONVERSACAO
========================================================= */
function renderConvMenu(){
  const list = document.getElementById('conv-cat-list'); list.innerHTML = '';
  CONVERSATION.forEach(d=>{
    const done = state.convCompleted.indexOf(d.id)!==-1;
    const div = document.createElement('div'); div.className='cat-chip';
    div.innerHTML = '<div><strong>'+d.icon+' '+d.title+'</strong><br><span>'+d.lines.length+' falas</span></div>'+(done?'<span class="done-mark">✓</span>':'<span>›</span>');
    div.addEventListener('click',()=>openConvDialog(d.id));
    list.appendChild(div);
  });
}
function openConvDialog(id){
  curConvDialog = CONVERSATION.find(d=>d.id===id);
  document.getElementById('cd-title').textContent = curConvDialog.icon+' '+curConvDialog.title;
  const linesWrap = document.getElementById('cd-lines'); linesWrap.innerHTML = '';
  curConvDialog.lines.forEach(line=>{
    const who = line[0], en = line[1], pt = line[2];
    const div = document.createElement('div'); div.className = 'dialog-line '+who;
    div.innerHTML = '<div class="bubble"><span class="en"></span><button class="spk-btn" style="margin-top:0;">🔊</button><div class="pt">'+pt+'</div></div><div class="tapline">toque no texto pra traduzir</div>';
    div.querySelector('.en').textContent = en;
    div.querySelector('.en').addEventListener('click',function(){ this.closest('.bubble').classList.toggle('show'); });
    div.querySelector('.spk-btn').addEventListener('click',(e)=>{ e.stopPropagation(); speak(en); });
    linesWrap.appendChild(div);
  });
  renderConvQuiz(); renderSuaVez(); showPage('conv-dialog');
}
function checkConvComplete(){
  const quizDone = [...document.querySelectorAll('#cd-quiz .quiz-q')].every(q=>q.querySelector('.opt.disabled'));
  if(quizDone && state.convCompleted.indexOf(curConvDialog.id)===-1){
    state.convCompleted.push(curConvDialog.id);
    addXP(15);
    showToast('✓ Diálogo <b>'+curConvDialog.title+'</b> concluído! +15 XP');
    confettiBurst(30);
    setTimeout(()=>{ showPage('trilha'); }, 1500);
  }
  saveState(); updateStats();
}
function renderConvQuiz(){
  const wrap = document.getElementById('cd-quiz');
  wrap.innerHTML = '<h3 style="font-size:15px;color:var(--heading-text);margin-bottom:10px;">Teste rápido</h3>';
  curConvDialog.quiz.forEach((q,qi)=>{
    const qdiv = document.createElement('div'); qdiv.className='quiz-q';
    qdiv.innerHTML = '<div class="qtext">'+(qi+1)+'. '+q.q+'</div>';
    q.opts.forEach((opt,oi)=>{
      const btn = document.createElement('button'); btn.className='opt'; btn.textContent = opt;
      btn.addEventListener('click',()=>{
        if(btn.classList.contains('answered')) return;
        const allOpts = qdiv.querySelectorAll('.opt');
        allOpts.forEach(o=>o.classList.add('disabled'));
        state.convStats.total++;
        if(oi===q.correct){ btn.classList.add('correct'); state.convStats.correct++; showStamp('WELL SAID'); addXP(5); }
        else { btn.classList.add('wrong'); allOpts[q.correct].classList.add('correct'); addXP(1); }
        qdiv.querySelectorAll('.opt').forEach(o=>o.classList.add('answered'));
        checkConvComplete();
      });
      qdiv.appendChild(btn);
    });
    wrap.appendChild(qdiv);
  });
}
function renderSuaVez(){
  const wrap = document.getElementById('cd-suavez'); wrap.innerHTML = '';
  if(!curConvDialog.suavez) return;
  const sv = curConvDialog.suavez;
  const box = document.createElement('div'); box.className='suavez-box';
  box.innerHTML = '<div class="svlabel">✍️ Sua vez — responda em inglês</div>'+
    '<div class="svprompt">'+sv.prompt+'</div>'+
    '<input type="text" id="sv-input" placeholder="Digite sua resposta em inglês..." autocomplete="off" style="width:100%;padding:11px;border:2px solid var(--paper-line);border-radius:8px;font-family:\'Trebuchet MS\',sans-serif;font-size:13px;margin-bottom:10px;background:var(--paper);">'+
    '<button class="btn btn-primary" id="sv-reveal" style="width:100%;">Ver sugestão e comparar</button>'+
    '<div id="sv-sample" style="display:none;margin-top:10px;">'+
      '<div class="produce-feedback ok" style="display:block;"><b>Sugestão:</b> '+sv.sample+'</div>'+
      '<div class="self-check">'+
        '<button class="btn btn-know" id="sv-ok">Fiquei perto ✓</button>'+
        '<button class="btn btn-dontknow" id="sv-bad">Preciso praticar mais</button>'+
      '</div></div>';
  wrap.appendChild(box);
  document.getElementById('sv-reveal').addEventListener('click',()=>{
    document.getElementById('sv-sample').style.display='block';
    document.getElementById('sv-reveal').style.display='none';
  });
  document.getElementById('sv-ok').addEventListener('click',()=>{
    addXP(10); showStamp('WELL SAID');
    document.getElementById('sv-ok').disabled=true; document.getElementById('sv-bad').disabled=true;
    document.getElementById('sv-ok').textContent='✓ Registrado!';
  });
  document.getElementById('sv-bad').addEventListener('click',()=>{
    addXP(3);
    document.getElementById('sv-ok').disabled=true; document.getElementById('sv-bad').disabled=true;
    document.getElementById('sv-bad').textContent='Beleza, bora praticar mais!';
  });
}

/* =========================================================
   MENU DE JOGOS (tela inicial da aba Extras > Jogos)
========================================================= */
function renderGamesMenu(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML = '<div id="games-menu-list"></div>';
  const list = document.getElementById('games-menu-list');

  const games = [
    { icon:'🤜🤛', title:'Braço de Ferro', desc:'1x1 online, em tempo real — melhor de 5', onOpen: renderArmGameSetup },
    { icon:'🧩', title:'Palavras Cruzadas', desc:'1 nova por dia — reseta às 18h', onOpen: renderCrosswordGame },
    { icon:'🎯', title:'Forca', desc:'Adivinhe a palavra em inglês antes de errar demais', onOpen: renderHangmanSetup },
    { icon:'🧠', title:'Jogo da Memória', desc:'Case a palavra em inglês com a tradução — bata seu recorde', onOpen: renderMemorySetup }
    // novos jogos entram aqui depois, no mesmo formato
  ];

  games.forEach(game=>{
    const div = document.createElement('div');
    div.className = 'menu-item';
    div.innerHTML = '<div class="icon">'+game.icon+'</div><div class="txt"><strong>'+game.title+'</strong><span>'+game.desc+'</span></div>';
    div.addEventListener('click', game.onOpen);
    list.appendChild(div);
  });
}

/* =========================================================
   JOGO: BRAÇO DE FERRO ONLINE (tempo real, via Socket.io)
========================================================= */
let armSocket = null;
let armMyIndex = null;
let armNames = ['Jogador 1','Jogador 2'];
let armStreak = 0;
let armStreakOwner = null;
let armWinStreak = 3;
let armMyName = '';

let armPendingQuestion = null;

function getArmSocket(){
  if(armSocket) return armSocket;
  const socketBase = API_BASE.replace(/\/api\/?$/, '');
  armSocket = io(socketBase + '/armgame', { transports:['websocket','polling'] });

  armSocket.on('start', (info)=>{
    armNames = info.names; armStreak = info.streak; armStreakOwner = info.streakOwner; armWinStreak = info.winStreak; armMyIndex = info.youIndex;
    armPendingQuestion = null;
    renderArmCountdown();
  });
  armSocket.on('question', (q)=>{
    // enquanto a contagem de 3s ainda tá na tela, guarda a pergunta pra mostrar assim que ela acabar
    if(document.getElementById('armgame-word')) renderArmQuestion(q);
    else armPendingQuestion = q;
  });
  armSocket.on('self-answered', (data)=>{ armApplySelfAnswer(data); });
  armSocket.on('round-result', (data)=>{ armApplyRoundResult(data); });
  armSocket.on('gameover', (data)=>{ armDeclareWinnerOnline(data); });
  armSocket.on('opponent-left', ()=>{ armShowOpponentLeft(); });
  armSocket.on('connect_error', ()=>{ armShowConnectError(); });
  return armSocket;
}

function renderArmCountdown(){
  const opponentName = armNames[1-armMyIndex];
  const wrap = document.getElementById('extras-games');
  let count = 3;
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div style="font-size:34px;">🤜🤛</div>'+
      '<div style="font-family:\'Nunito\',sans-serif;font-size:13px;color:var(--text-soft);margin:8px 0 4px;">Você vai jogar contra</div>'+
      '<div style="font-family:\'Baloo 2\',sans-serif;font-size:22px;color:var(--heading-text);font-weight:800;margin-bottom:16px;">'+opponentName+'</div>'+
      '<div class="armgame-countdown-num pop" id="armgame-countdown-num">'+count+'</div>'+
    '</div>';
  const timer = setInterval(()=>{
    count--;
    const numEl = document.getElementById('armgame-countdown-num');
    if(!numEl){ clearInterval(timer); return; } // saiu dessa tela nesse meio tempo (ex: adversario desconectou)
    if(count <= 0){
      clearInterval(timer);
      renderArmGamePlayShell();
      if(armPendingQuestion){ renderArmQuestion(armPendingQuestion); armPendingQuestion = null; }
    } else {
      numEl.textContent = count;
      numEl.classList.remove('pop'); void numEl.offsetWidth; numEl.classList.add('pop');
    }
  }, 1000);
}

function renderArmGameSetup(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<button class="back-btn" id="armgame-back-btn">← Jogos</button>'+
    '<div class="armgame-box armgame-setup">'+
      '<div style="font-size:40px;margin-bottom:6px;">🤜🤛</div>'+
      '<h3 style="font-family:\'Baloo 2\',sans-serif;color:var(--heading-text);margin:0 0 4px;">Braço de Ferro Online</h3>'+
      '<p style="font-family:\'Nunito\',sans-serif;font-size:12px;color:var(--text-soft);margin:0 0 16px;">Jogue em tempo real contra outra pessoa qualquer, em outro aparelho — os dois recebem a mesma pergunta e quem acertar mais rápido ganha a rodada. Mas cuidado: se o outro interromper sua sequência, ela zera! Quem acertar 3 seguidas primeiro, vence.</p>'+
      '<label>Seu nome</label>'+
      '<input type="text" id="armgame-myname" placeholder="Seu nome" maxlength="16">'+
      '<button class="btn btn-primary armgame-fight-btn" id="armgame-fight-btn">LUTAR 🤜🤛</button>'+
    '</div>';
  document.getElementById('armgame-back-btn').addEventListener('click', renderGamesMenu);
  document.getElementById('armgame-fight-btn').addEventListener('click', armFindMatch);
}

function armFindMatch(){
  armMyName = document.getElementById('armgame-myname').value.trim() || 'Jogador';
  const socket = getArmSocket();
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div style="font-size:34px;">🤜🤛</div>'+
      '<div class="armgame-spinner"></div>'+
      '<div style="font-family:\'Nunito\',sans-serif;font-size:13px;color:var(--text-soft);">Procurando um adversário...</div>'+
      '<button class="btn btn-outline" id="armgame-cancel-btn" style="width:100%;margin-top:16px;">Cancelar</button>'+
    '</div>';
  socket.emit('find-match', armMyName, (res)=>{
    if(!res || !res.ok){ armShowConnectError(); }
    // se ja casou (matched:true), o 'start' chega em seguida sozinho.
    // se nao (matched:false), fica nessa tela esperando ate alguem mais entrar na fila.
  });
  document.getElementById('armgame-cancel-btn').addEventListener('click', ()=>{
    if(armSocket) armSocket.emit('cancel-search');
    if(armSocket) armSocket.disconnect();
    armSocket = null;
    renderArmGameSetup();
  });
}

/* Barra de sequência: mostra quantas seguidas a pessoa que está "na frente" tem —
   se o outro interromper, a barra dele volta a zero e a do outro começa do 1. */
function armTugBarHtml(){
  let left = '', right = '';
  const leftFilled = armStreakOwner===0 ? armStreak : 0;
  const rightFilled = armStreakOwner===1 ? armStreak : 0;
  const EMPTY = '⚪\uFE0F'; // \uFE0F força apresentação em emoji colorido (sem isso, alguns navegadores de PC mostram só um circulozinho de texto quase invisível)
  for(let i=1;i<=armWinStreak;i++){ left += (i<=leftFilled) ? '🟢' : EMPTY; }
  for(let i=1;i<=armWinStreak;i++){ right += (i<=rightFilled) ? '🔴' : EMPTY; }
  return '<span style="letter-spacing:1px;">'+left+'</span> 🤝 <span style="letter-spacing:1px;">'+right+'</span>';
}

function renderArmGamePlayShell(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div class="armgame-score-row">'+
        '<div class="armgame-player"><div class="name">'+armNames[0]+(armMyIndex===0?' (você)':'')+'</div></div>'+
        '<div class="armgame-player"><div class="name">'+armNames[1]+(armMyIndex===1?' (você)':'')+'</div></div>'+
      '</div>'+
      '<div class="armgame-tugbar" id="armgame-tugbar" style="text-align:center;font-size:15px;margin-bottom:8px;">'+armTugBarHtml()+'</div>'+
      '<div class="armgame-arena"><div class="armgame-arms" id="armgame-arms" style="transform:rotate(0deg);">'+
        '<div class="armgame-arm" style="background:var(--teal);"></div><div class="armgame-fist">🤝</div><div class="armgame-arm" style="background:var(--coral);"></div>'+
      '</div></div>'+
      '<div class="armgame-turn" id="armgame-status">Prepare-se!</div>'+
      '<div class="armgame-word" id="armgame-word"></div>'+
      '<div class="armgame-opts" id="armgame-opts"></div>'+
    '</div>';
  armUpdateTilt();
}

function armUpdateTilt(){
  const arms = document.getElementById('armgame-arms');
  if(!arms) return;
  const signedStreak = armStreakOwner===0 ? armStreak : (armStreakOwner===1 ? -armStreak : 0);
  const tilt = Math.max(-24, Math.min(24, (signedStreak/armWinStreak) * 24));
  arms.style.transform = 'rotate('+tilt+'deg)';
}
function armUpdateTugUI(){
  const bar = document.getElementById('armgame-tugbar');
  if(bar) bar.innerHTML = armTugBarHtml();
  armUpdateTilt();
}

function renderArmQuestion(q){
  const wordEl = document.getElementById('armgame-word');
  const statusEl = document.getElementById('armgame-status');
  const optsWrap = document.getElementById('armgame-opts');
  if(!wordEl) return; // tela pode ter sido trocada nesse meio tempo
  statusEl.textContent = 'Responda!';
  wordEl.textContent = q.en;
  optsWrap.innerHTML = '';
  q.options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className = 'armgame-opt';
    btn.textContent = opt;
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.armgame-opt').forEach(b=>b.disabled=true);
      btn.dataset.selected = 'true';
      armSocket.emit('answer', opt);
      statusEl.textContent = 'Aguardando o outro jogador...';
    });
    optsWrap.appendChild(btn);
  });
}
function armApplySelfAnswer(data){
  const selectedBtn = document.querySelector('.armgame-opt[data-selected="true"]');
  if(selectedBtn) selectedBtn.classList.add(data.correct ? 'correct' : 'wrong');
}
function armApplyRoundResult(data){
  armStreak = data.streak; armStreakOwner = data.streakOwner;
  document.querySelectorAll('.armgame-opt').forEach(b=>{
    b.disabled = true;
    if(b.textContent===data.correctPt) b.classList.add('correct');
  });
  const statusEl = document.getElementById('armgame-status');
  if(statusEl){
    if(data.pusher===null){
      statusEl.textContent = 'Os dois erraram — a sequência continua igual.';
    } else if(data.pusher===armMyIndex){
      statusEl.textContent = armStreak>1 ? 'Você foi mais rápido! Sequência de '+armStreak+'. 🔥' : 'Você foi mais rápido! Interrompeu a sequência dele e começou a sua.';
    } else {
      statusEl.textContent = armStreak>1 ? 'O outro jogador emendou '+armStreak+' seguidas...' : 'O outro jogador interrompeu sua sequência e começou a dele.';
    }
  }
  armUpdateTugUI();
}

function armDeclareWinnerOnline(data){
  const wrap = document.getElementById('extras-games');
  const winnerName = data.names[data.winnerIndex];
  const iWon = data.winnerIndex === armMyIndex;
  const finalTilt = data.winnerIndex===0 ? 60 : -60;
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div class="armgame-arena"><div class="armgame-arms slammed" id="armgame-arms" style="transform:rotate(0deg);">'+
        '<div class="armgame-arm" style="background:var(--teal);"></div><div class="armgame-fist">🤝</div><div class="armgame-arm" style="background:var(--coral);"></div>'+
      '</div></div>'+
      '<div class="armgame-result">'+
        '<span class="armgame-trophy">'+(iWon?'🏆':'💪')+'</span>'+
        '<div class="armgame-winner-name">'+winnerName+' venceu no braço de ferro!</div>'+
        '<button class="btn btn-primary" id="armgame-again-btn" style="width:100%;">Jogar de novo</button>'+
      '</div>'+
    '</div>';
  requestAnimationFrame(()=>{
    document.getElementById('armgame-arms').style.transform = 'rotate('+finalTilt+'deg)';
  });
  if(iWon) confettiBurst(35);
  document.getElementById('armgame-again-btn').addEventListener('click', ()=>{
    if(armSocket) armSocket.disconnect();
    armSocket = null;
    renderArmGameSetup();
  });
}

function armShowOpponentLeft(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div style="font-size:34px;">😿</div>'+
      '<div class="armgame-opponent-left">O outro jogador saiu da partida.</div>'+
      '<button class="btn btn-primary" id="armgame-again-btn" style="width:100%;">Jogar de novo</button>'+
    '</div>';
  if(armSocket) armSocket.disconnect();
  armSocket = null;
  document.getElementById('armgame-again-btn').addEventListener('click', renderArmGameSetup);
}
function armShowConnectError(){
  const wrap = document.getElementById('extras-games');
  if(!wrap || !wrap.querySelector('.armgame-setup')) return; // só mostra se ainda tava tentando conectar
  wrap.innerHTML =
    '<div class="armgame-box">'+
      '<div style="font-size:34px;">📡</div>'+
      '<div class="armgame-opponent-left">Não foi possível conectar ao servidor do jogo agora.</div>'+
      '<button class="btn btn-primary" id="armgame-retry-btn" style="width:100%;">Tentar de novo</button>'+
    '</div>';
  armSocket = null;
  document.getElementById('armgame-retry-btn').addEventListener('click', renderArmGameSetup);
}

/* =========================================================
   JOGO: PALAVRAS CRUZADAS (sozinho, com o vocabulário do app)
========================================================= */
let xwordPuzzle = null; // { placed, gridW, gridH, minR, minC }
let xwordActiveWordIdx = null; // indice em xwordPuzzle.placed da palavra em destaque

/* ---- Palavra-cruzada do dia: mesma seed = mesmo jogo o dia todo, reseta às 18h ---- */
function xwordHashSeed(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
function xwordLocalDateStr(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function xwordPuzzleDayId(){
  const shifted = new Date(Date.now() - 18*60*60*1000); // o "dia" da cruzadinha vira as 18h, não à meia-noite
  return xwordLocalDateStr(shifted);
}
function xwordPrevDayId(dayId){
  const [y,m,d] = dayId.split('-').map(Number);
  return xwordLocalDateStr(new Date(y, m-1, d-1));
}
function xwordNextResetDate(){
  const now = new Date();
  const today18 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
  return now < today18 ? today18 : new Date(today18.getTime() + 24*60*60*1000);
}

function buildCrosswordWordPool(){
  const pool = [];
  Object.keys(VOCAB).forEach(catKey=>{
    VOCAB[catKey].words.forEach(w=>{
      const en = w[0].toUpperCase();
      if(/^[A-Z]{3,7}$/.test(en)){ pool.push([en, w[1]]); } // letras puras, 3-7 (palavras curtas encaixam mais apertado)
    });
  });
  return pool;
}
function xwordShuffle(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function xwordBoundsOf(placed){
  let minR=0,minC=0,maxR=0,maxC=0;
  placed.forEach(p=>{
    const endR = p.dir==='H'?p.row:p.row+p.word.length-1;
    const endC = p.dir==='H'?p.col+p.word.length-1:p.col;
    minR=Math.min(minR,p.row); minC=Math.min(minC,p.col);
    maxR=Math.max(maxR,endR); maxC=Math.max(maxC,endC);
  });
  return {minR,minC,maxR,maxC,w:maxC-minC+1,h:maxR-minR+1};
}
function xwordGenerateOneAttempt(basePool, targetCount, rng){
  const pool = xwordShuffle(basePool, rng).slice(0, 60).sort((a,b)=>b[0].length-a[0].length);
  const placed = [];
  const grid = new Map();
  const cellKey = (r,c)=> r+','+c;
  function scorePlacement(word, row, col, dir){
    // conta quantos cruzamentos de verdade essa posição teria, e rejeita se colar
    // sem querer numa palavra vizinha sem cruzar (letra encostada sem ser intersecção).
    let crossings = 0;
    for(let i=0;i<word.length;i++){
      const r = dir==='H' ? row : row+i;
      const c = dir==='H' ? col+i : col;
      const key = cellKey(r,c);
      if(grid.has(key)){
        if(grid.get(key) !== word[i]) return null;
        crossings++;
      } else {
        const n1 = dir==='H' ? cellKey(r-1,c) : cellKey(r,c-1);
        const n2 = dir==='H' ? cellKey(r+1,c) : cellKey(r,c+1);
        if(grid.has(n1) || grid.has(n2)) return null;
      }
    }
    const beforeR = dir==='H' ? row : row-1, beforeC = dir==='H' ? col-1 : col;
    const afterR = dir==='H' ? row : row+word.length, afterC = dir==='H' ? col+word.length : col;
    if(grid.has(cellKey(beforeR,beforeC)) || grid.has(cellKey(afterR,afterC))) return null;
    if(crossings === 0) return null; // toda palavra nova precisa cruzar com alguma já existente
    return crossings;
  }
  function place(word, clue, row, col, dir){
    for(let i=0;i<word.length;i++){
      const r = dir==='H' ? row : row+i;
      const c = dir==='H' ? col+i : col;
      grid.set(cellKey(r,c), word[i]);
    }
    placed.push({word, clue, row, col, dir});
  }
  if(!pool.length) return [];
  place(pool[0][0], pool[0][1], 0, 0, 'H');
  for(let wi=1; wi<pool.length && placed.length<targetCount; wi++){
    const [word, clue] = pool[wi];
    if(placed.some(p=>p.word===word)) continue; // evita palavra duplicada
    let best = null;
    const curBounds = xwordBoundsOf(placed);
    // testa TODAS as posições possíveis de cruzamento e guarda a que cruza mais vezes,
    // penalizando forte quando a posição deixaria o grid grande OU torto (muito mais
    // largo que alto, ou vice-versa) — isso evita aquele efeito "puxado pra um lado".
    for(const existing of placed){
      for(let ei=0; ei<existing.word.length; ei++){
        const letter = existing.word[ei];
        for(let ni=0; ni<word.length; ni++){
          if(word[ni] !== letter) continue;
          const cr = existing.dir==='H' ? existing.row : existing.row+ei;
          const cc = existing.dir==='H' ? existing.col+ei : existing.col;
          const newDir = existing.dir==='H' ? 'V' : 'H';
          const row = newDir==='H' ? cr : cr-ni;
          const col = newDir==='H' ? cc-ni : cc;
          const crossings = scorePlacement(word, row, col, newDir);
          if(crossings === null) continue;
          const newEndR = newDir==='H'?row:row+word.length-1;
          const newEndC = newDir==='H'?col+word.length-1:col;
          const nMinR=Math.min(curBounds.minR,row), nMinC=Math.min(curBounds.minC,col);
          const nMaxR=Math.max(curBounds.maxR,newEndR), nMaxC=Math.max(curBounds.maxC,newEndC);
          const nW = nMaxC-nMinC+1, nH = nMaxR-nMinR+1;
          const area = nW*nH;
          const aspect = Math.max(nW,nH)/Math.min(nW,nH);
          const score = crossings*2000 - area*3 - Math.max(0, aspect-1.6)*300;
          if(!best || score > best.score){ best = {row, col, dir:newDir, score}; }
        }
      }
    }
    if(best) place(word, clue, best.row, best.col, best.dir);
  }
  return placed;
}
function xwordMetrics(placed){
  const b = xwordBoundsOf(placed);
  const cellCount = new Map();
  placed.forEach(p=>{
    for(let i=0;i<p.word.length;i++){
      const r = p.dir==='H'?p.row:p.row+i, c = p.dir==='H'?p.col+i:p.col;
      const k = r+','+c;
      cellCount.set(k, (cellCount.get(k)||0)+1);
    }
  });
  const crossings = [...cellCount.values()].filter(v=>v>1).length;
  const area = b.w*b.h;
  const aspect = Math.max(b.w,b.h)/Math.min(b.w,b.h);
  return { crossings, area, aspect };
}
function generateCrosswordPuzzle(targetCount, daySeed){
  const basePool = buildCrosswordWordPool();
  // gera VARIAS tentativas (deterministicamente, a partir da mesma seed do dia) e escolhe
  // a mais densa/compacta E com proporção mais equilibrada — isso é o que faz a
  // cruzadinha parecer "de jornal" de verdade, sem ficar puxada pra um lado.
  let bestPlaced = null, bestScore = -Infinity;
  for(let a=0; a<25; a++){
    const rng = xwordHashSeed(daySeed+'-attempt-'+a);
    const placed = xwordGenerateOneAttempt(basePool, targetCount, rng);
    const m = xwordMetrics(placed);
    const score = placed.length*100000 + m.crossings*20 - m.area*2 - Math.max(0,m.aspect-1.6)*400;
    if(score > bestScore){ bestScore = score; bestPlaced = placed; }
  }
  const placed = bestPlaced || [];
  if(!placed.length) return null;

  // normaliza coordenadas pra começar em 0,0
  let minR=0, minC=0, maxR=0, maxC=0;
  placed.forEach(p=>{
    const endR = p.dir==='H' ? p.row : p.row+p.word.length-1;
    const endC = p.dir==='H' ? p.col+p.word.length-1 : p.col;
    minR = Math.min(minR, p.row); minC = Math.min(minC, p.col);
    maxR = Math.max(maxR, endR); maxC = Math.max(maxC, endC);
  });
  placed.forEach(p=>{ p.row -= minR; p.col -= minC; });
  const gridW = maxC-minC+1, gridH = maxR-minR+1;

  // numeracao: ordena os inicios de palavra em ordem de leitura, numera posicoes distintas
  const starts = [];
  placed.forEach(p=>{
    if(!starts.some(s=>s.row===p.row && s.col===p.col)) starts.push({row:p.row, col:p.col});
  });
  starts.sort((a,b)=> a.row-b.row || a.col-b.col);
  starts.forEach((s,i)=>{ s.num = i+1; });
  placed.forEach(p=>{
    const match = starts.find(s=>s.row===p.row && s.col===p.col);
    p.num = match.num;
  });

  return { placed, gridW, gridH };
}
function getTodaysCrossword(){
  const dayId = xwordPuzzleDayId();
  return { puzzle: generateCrosswordPuzzle(10, 'xword-'+dayId), dayId };
}

let xwordCountdownTimer = null;
function xwordFormatCountdown(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const h = String(Math.floor(total/3600)).padStart(2,'0');
  const m = String(Math.floor((total%3600)/60)).padStart(2,'0');
  const s = String(total%60).padStart(2,'0');
  return h+':'+m+':'+s;
}
function xwordStartCountdown(elId){
  clearInterval(xwordCountdownTimer);
  const tick = ()=>{
    const el = document.getElementById(elId);
    if(!el){ clearInterval(xwordCountdownTimer); return; }
    const diff = xwordNextResetDate().getTime() - Date.now();
    if(diff <= 0){ renderCrosswordGame(); return; } // passou das 18h - libera a proxima sozinho
    el.textContent = xwordFormatCountdown(diff);
  };
  tick();
  xwordCountdownTimer = setInterval(tick, 1000);
}

function renderCrosswordLocked(dayId){
  clearInterval(xwordCountdownTimer);
  const wrap = document.getElementById('extras-games');
  const streak = state.xwordStreak || 0;
  wrap.innerHTML =
    '<button class="back-btn" id="xword-back-btn">← Jogos</button>'+
    '<div class="xword-box" style="text-align:center;">'+
      '<div style="font-size:40px;margin-bottom:6px;">🧩✅</div>'+
      '<h3 style="font-family:\'Baloo 2\',sans-serif;color:var(--heading-text);margin:0 0 6px;">Cruzadinha de hoje concluída!</h3>'+
      (streak>1 ? '<p style="font-family:\'Nunito\',sans-serif;font-size:13px;color:var(--mustard-dark);font-weight:800;margin:0 0 10px;">🔥 '+streak+' dias seguidos</p>' : '')+
      '<p style="font-family:\'Nunito\',sans-serif;font-size:12px;color:var(--text-soft);margin:0 0 14px;">Só tem uma por dia — a próxima libera em:</p>'+
      '<div class="armgame-countdown-num" id="xword-countdown" style="font-size:32px;">--:--:--</div>'+
    '</div>';
  document.getElementById('xword-back-btn').addEventListener('click', renderGamesMenu);
  xwordStartCountdown('xword-countdown');
}

function renderCrosswordGame(){
  const dayId = xwordPuzzleDayId();

  if(state.xwordCompletedDayId === dayId){
    renderCrosswordLocked(dayId);
    return;
  }

  const { puzzle } = getTodaysCrossword();
  xwordPuzzle = puzzle;
  xwordActiveWordIdx = xwordPuzzle && xwordPuzzle.placed.length ? 0 : null;
  const wrap = document.getElementById('extras-games');
  if(!xwordPuzzle || !xwordPuzzle.placed.length){
    wrap.innerHTML = '<button class="back-btn" id="xword-back-btn">← Jogos</button><div class="intro-note">Não foi possível montar a cruzadinha de hoje. Tenta de novo mais tarde.</div>';
    document.getElementById('xword-back-btn').addEventListener('click', renderGamesMenu);
    return;
  }
  wrap.innerHTML =
    '<button class="back-btn" id="xword-back-btn">← Jogos</button>'+
    '<div class="xword-box">'+
      '<div class="xword-toolbar">'+
        '<button class="btn btn-primary" id="xword-check-btn" style="width:100%;">Verificar</button>'+
      '</div>'+
      '<div class="xword-clue-nav">'+
        '<button class="xword-nav-arrow" id="xword-prev-btn">‹</button>'+
        '<div class="xword-clue-current" id="xword-status">Toque numa célula pra começar.</div>'+
        '<button class="xword-nav-arrow" id="xword-next-btn">›</button>'+
      '</div>'+
      '<div class="xword-scroll"><div class="xword-grid" id="xword-grid"></div></div>'+
      '<button class="xword-toggle-clues" id="xword-toggle-clues-btn">Ver todas as pistas ▾</button>'+
      '<div class="xword-clues" id="xword-clues" style="display:none;"></div>'+
    '</div>';
  document.getElementById('xword-back-btn').addEventListener('click', renderGamesMenu);
  document.getElementById('xword-check-btn').addEventListener('click', xwordCheck);
  document.getElementById('xword-prev-btn').addEventListener('click', ()=>xwordGoRelative(-1));
  document.getElementById('xword-next-btn').addEventListener('click', ()=>xwordGoRelative(1));
  document.getElementById('xword-toggle-clues-btn').addEventListener('click', xwordToggleCluesList);
  xwordRenderGrid();
  xwordRenderClues();
  xwordRestoreProgress(dayId);
  xwordHighlightWord(0);
}

function xwordToggleCluesList(){
  const list = document.getElementById('xword-clues');
  const btn = document.getElementById('xword-toggle-clues-btn');
  const showing = list.style.display !== 'none';
  list.style.display = showing ? 'none' : 'flex';
  btn.textContent = showing ? 'Ver todas as pistas ▾' : 'Esconder lista de pistas ▴';
}
function xwordOrderedWords(){
  return xwordPuzzle.placed
    .map((p,idx)=>({p,idx}))
    .sort((a,b)=> a.p.num-b.p.num || (a.p.dir===b.p.dir ? 0 : (a.p.dir==='H' ? -1 : 1)));
}
function xwordGoRelative(delta){
  const ordered = xwordOrderedWords();
  const curPos = Math.max(0, ordered.findIndex(o=>o.idx===xwordActiveWordIdx));
  const nextPos = (curPos + delta + ordered.length) % ordered.length;
  const idx = ordered[nextPos].idx;
  xwordHighlightWord(idx);
  const p = xwordPuzzle.placed[idx];
  const firstInput = document.getElementById('xw-cell-'+p.row+'-'+p.col);
  if(firstInput) firstInput.focus();
}

function xwordCellLetter(row, col){
  for(const p of xwordPuzzle.placed){
    for(let i=0;i<p.word.length;i++){
      const r = p.dir==='H'?p.row:p.row+i, c = p.dir==='H'?p.col+i:p.col;
      if(r===row && c===col) return p.word[i];
    }
  }
  return null;
}
function xwordWordsAt(row, col){
  return xwordPuzzle.placed.map((p,idx)=>({p,idx})).filter(({p})=>{
    for(let i=0;i<p.word.length;i++){
      const r = p.dir==='H'?p.row:p.row+i, c = p.dir==='H'?p.col+i:p.col;
      if(r===row && c===col) return true;
    }
    return false;
  });
}
function xwordComputeCellSize(){
  const scrollWrap = document.querySelector('.xword-scroll');
  if(!scrollWrap || !xwordPuzzle) return 28;
  const availableWidth = scrollWrap.clientWidth - 4; // -4 pelo padding do grid (2px de cada lado)
  const gapTotal = (xwordPuzzle.gridW - 1) * 2; // 2px de gap entre células
  const raw = (availableWidth - gapTotal) / xwordPuzzle.gridW;
  return Math.max(20, Math.min(32, Math.floor(raw))); // nunca menor que 20px (legível) nem maior que 32px
}
function xwordApplyResponsiveSizing(){
  const gridEl = document.getElementById('xword-grid');
  if(!gridEl || !xwordPuzzle) return;
  const cellSize = xwordComputeCellSize();
  gridEl.style.setProperty('--xw-cell', cellSize+'px');
  gridEl.style.gridTemplateColumns = 'repeat('+xwordPuzzle.gridW+', var(--xw-cell))';
}
window.addEventListener('resize', ()=>{ if(xwordPuzzle) xwordApplyResponsiveSizing(); });

function xwordRenderGrid(){
  const gridEl = document.getElementById('xword-grid');
  gridEl.innerHTML = '';
  for(let r=0;r<xwordPuzzle.gridH;r++){
    for(let c=0;c<xwordPuzzle.gridW;c++){
      const letter = xwordCellLetter(r,c);
      const cell = document.createElement('div');
      cell.className = 'xword-cell';
      if(letter===null){ cell.classList.add('blocked'); gridEl.appendChild(cell); continue; }
      const startHere = xwordPuzzle.placed.find(p=>p.row===r && p.col===c);
      if(startHere){ const numEl = document.createElement('span'); numEl.className='xword-num'; numEl.textContent=startHere.num; cell.appendChild(numEl); }
      const input = document.createElement('input');
      input.maxLength = 1;
      input.dataset.row = r; input.dataset.col = c;
      input.autocomplete = 'off'; input.autocapitalize = 'characters'; input.spellcheck = false;
      input.id = 'xw-cell-'+r+'-'+c;
      input.addEventListener('focus', ()=> xwordOnCellFocus(r,c));
      input.addEventListener('keydown', (e)=> xwordOnKeyDown(e,r,c));
      input.addEventListener('input', (e)=> xwordOnInput(e,r,c));
      cell.appendChild(input);
      gridEl.appendChild(cell);
    }
  }
  xwordApplyResponsiveSizing();
}
function xwordRenderClues(){
  const wrap = document.getElementById('xword-clues');
  const across = xwordPuzzle.placed.filter(p=>p.dir==='H').sort((a,b)=>a.num-b.num);
  const down = xwordPuzzle.placed.filter(p=>p.dir==='V').sort((a,b)=>a.num-b.num);
  function groupHtml(title, list){
    return '<div class="xword-clue-group"><h4>'+title+'</h4>'+
      list.map(p=>'<div class="xword-clue" data-word="'+p.word+'" data-dir="'+p.dir+'"><b>'+p.num+'.</b> <span>'+p.clue+'</span></div>').join('')+
    '</div>';
  }
  wrap.innerHTML = groupHtml('➡️ Horizontal', across) + groupHtml('⬇️ Vertical', down);
  wrap.querySelectorAll('.xword-clue').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = xwordPuzzle.placed.findIndex(p=>p.word===el.dataset.word && p.dir===el.dataset.dir);
      if(idx===-1) return;
      xwordHighlightWord(idx);
      const p = xwordPuzzle.placed[idx];
      const firstInput = document.getElementById('xw-cell-'+p.row+'-'+p.col);
      if(firstInput) firstInput.focus();
    });
  });
}
function xwordHighlightWord(idx){
  xwordActiveWordIdx = idx;
  document.querySelectorAll('.xword-cell input').forEach(inp=>inp.classList.remove('xw-active-word'));
  document.querySelectorAll('.xword-clue').forEach(el=>el.classList.remove('xw-active'));
  if(idx===null) return;
  const p = xwordPuzzle.placed[idx];
  for(let i=0;i<p.word.length;i++){
    const r = p.dir==='H'?p.row:p.row+i, c = p.dir==='H'?p.col+i:p.col;
    const inp = document.getElementById('xw-cell-'+r+'-'+c);
    if(inp) inp.classList.add('xw-active-word');
  }
  const clueEl = document.querySelector('.xword-clue[data-word="'+p.word+'"][data-dir="'+p.dir+'"]');
  if(clueEl){ clueEl.classList.add('xw-active'); }
  document.getElementById('xword-status').innerHTML = '<b>'+p.num+(p.dir==='H'?'→':'↓')+'</b> '+p.clue;
}
function xwordOnCellFocus(row,col){
  const words = xwordWordsAt(row,col);
  if(!words.length) return;
  // se a palavra ja ativa passa por essa celula, mantem; senao escolhe a primeira disponivel
  const stillValid = xwordActiveWordIdx!==null && words.some(w=>w.idx===xwordActiveWordIdx);
  xwordHighlightWord(stillValid ? xwordActiveWordIdx : words[0].idx);
}
function xwordOnInput(e,row,col){
  const val = e.target.value.toUpperCase().replace(/[^A-Z]/g,'');
  e.target.value = val;
  e.target.classList.remove('xw-correct','xw-wrong');
  const dayId = xwordPuzzleDayId();
  if(state.xwordFilledDayId !== dayId){ state.xwordFilledLetters = {}; state.xwordFilledDayId = dayId; }
  if(val) state.xwordFilledLetters[row+','+col] = val; else delete state.xwordFilledLetters[row+','+col];
  saveState();
  if(!val) return;
  // avanca pra proxima celula da palavra ativa
  const p = xwordPuzzle.placed[xwordActiveWordIdx];
  if(!p) return;
  const idxInWord = p.dir==='H' ? col-p.col : row-p.row;
  const nextR = p.dir==='H' ? row : row+1;
  const nextC = p.dir==='H' ? col+1 : col;
  if(idxInWord < p.word.length-1){
    const nextInput = document.getElementById('xw-cell-'+nextR+'-'+nextC);
    if(nextInput) nextInput.focus();
  }
}
function xwordRestoreProgress(dayId){
  if(state.xwordFilledDayId !== dayId){
    state.xwordFilledLetters = {};
    state.xwordFilledDayId = dayId;
    saveState();
    return;
  }
  Object.keys(state.xwordFilledLetters).forEach(key=>{
    const [r,c] = key.split(',');
    const input = document.getElementById('xw-cell-'+r+'-'+c);
    if(input) input.value = state.xwordFilledLetters[key];
  });
}
function xwordOnKeyDown(e,row,col){
  if(e.key==='Backspace' && !e.target.value){
    const p = xwordPuzzle.placed[xwordActiveWordIdx];
    if(!p) return;
    const idxInWord = p.dir==='H' ? col-p.col : row-p.row;
    if(idxInWord > 0){
      const prevR = p.dir==='H' ? row : row-1;
      const prevC = p.dir==='H' ? col-1 : col;
      const prevInput = document.getElementById('xw-cell-'+prevR+'-'+prevC);
      if(prevInput){ prevInput.focus(); }
    }
  } else if(e.key==='ArrowRight'){ const i=document.getElementById('xw-cell-'+row+'-'+(col+1)); if(i){e.preventDefault();i.focus();} }
  else if(e.key==='ArrowLeft'){ const i=document.getElementById('xw-cell-'+row+'-'+(col-1)); if(i){e.preventDefault();i.focus();} }
  else if(e.key==='ArrowDown'){ const i=document.getElementById('xw-cell-'+(row+1)+'-'+col); if(i){e.preventDefault();i.focus();} }
  else if(e.key==='ArrowUp'){ const i=document.getElementById('xw-cell-'+(row-1)+'-'+col); if(i){e.preventDefault();i.focus();} }
}
function xwordCheck(){
  let total=0, correct=0;
  document.querySelectorAll('.xword-cell input').forEach(inp=>{
    const r = +inp.dataset.row, c = +inp.dataset.col;
    const answer = xwordCellLetter(r,c);
    total++;
    inp.classList.remove('xw-correct','xw-wrong');
    if(!inp.value) return;
    if(inp.value===answer){ inp.classList.add('xw-correct'); correct++; }
    else { inp.classList.add('xw-wrong'); }
  });
  const statusEl = document.getElementById('xword-status');
  if(correct===total){
    statusEl.textContent = '🎉 Tudo certo! Você completou a palavra-cruzada de hoje!';
    confettiBurst(35);
    addXP(15);
    const dayId = xwordPuzzleDayId();
    const prevDay = xwordPrevDayId(dayId);
    state.xwordStreak = (state.xwordCompletedDayId === prevDay) ? (state.xwordStreak||0)+1 : 1;
    state.xwordCompletedDayId = dayId;
    saveState();
    setTimeout(()=>renderCrosswordLocked(dayId), 1600);
  } else {
    statusEl.textContent = correct+' de '+total+' letras certas até agora. Continue!';
  }
}

/* =========================================================
   JOGO: FORCA
========================================================= */
let hangGame = null; // { word, clue, guessed:Set, wrongCount, maxWrong }

function buildHangmanWordPool(){
  const pool = [];
  Object.values(VOCAB).forEach(cat=>{
    cat.words.forEach(w=>{
      const en = w[0].toUpperCase();
      if(/^[A-Z ]{3,14}$/.test(en)) pool.push({en, pt:w[1]}); // letras e espaço só (frases curtas tambem valem)
    });
  });
  return pool;
}

function renderHangmanSetup(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<button class="back-btn" id="hang-back-btn">← Jogos</button>'+
    '<div class="hang-box hang-setup">'+
      '<div style="font-size:40px;margin-bottom:6px;">🎯</div>'+
      '<h3 style="font-family:\'Baloo 2\',sans-serif;color:var(--heading-text);margin:0 0 4px;">Forca</h3>'+
      '<p style="font-family:\'Nunito\',sans-serif;font-size:12px;color:var(--text-soft);margin:0 0 16px;">Adivinhe a palavra em inglês letra por letra. Você tem 6 chances antes de errar demais.</p>'+
      '<button class="btn btn-primary" id="hang-start-btn" style="width:100%;">Jogar 🎯</button>'+
    '</div>';
  document.getElementById('hang-back-btn').addEventListener('click', renderGamesMenu);
  document.getElementById('hang-start-btn').addEventListener('click', hangNewGame);
}

function hangNewGame(){
  const pool = buildHangmanWordPool();
  const pick = pool[Math.floor(Math.random()*pool.length)];
  hangGame = { word: pick.en, clue: pick.pt, guessed: new Set(), wrongCount: 0, maxWrong: 6, finished:false, clueRevealed:false };
  renderHangmanGame();
}

function hangWordDisplay(){
  return hangGame.word.split('').map(ch=>{
    if(ch===' ') return ' ';
    return hangGame.guessed.has(ch) ? ch : '_';
  }).join(' ');
}
function hangIsWon(){
  return hangGame.word.split('').every(ch => ch===' ' || hangGame.guessed.has(ch));
}
function hangHeartsHtml(){
  const remaining = hangGame.maxWrong - hangGame.wrongCount;
  return '❤️'.repeat(Math.max(0,remaining)) + '🖤'.repeat(hangGame.maxWrong - Math.max(0,remaining));
}
function renderHangmanGame(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<button class="back-btn" id="hang-back-btn">← Jogos</button>'+
    '<div class="hang-box">'+
      '<div class="hang-hearts" id="hang-hearts">'+hangHeartsHtml()+'</div>'+
      '<div class="hang-clue" id="hang-clue">🔒 A dica libera quando sobrar 1 vida</div>'+
      '<div class="hang-word" id="hang-word">'+hangWordDisplay()+'</div>'+
      '<div class="hang-status" id="hang-status">&nbsp;</div>'+
      '<div class="hang-keyboard" id="hang-keyboard"></div>'+
    '</div>';
  document.getElementById('hang-back-btn').addEventListener('click', renderHangmanSetup);
  const kb = document.getElementById('hang-keyboard');
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter=>{
    const btn = document.createElement('button');
    btn.className = 'hang-key';
    btn.textContent = letter;
    btn.addEventListener('click', ()=>hangGuess(letter, btn));
    kb.appendChild(btn);
  });
}
function hangGuess(letter, btnEl){
  if(hangGame.finished || hangGame.guessed.has(letter)) return;
  hangGame.guessed.add(letter);
  btnEl.disabled = true;
  const isCorrect = hangGame.word.includes(letter);
  btnEl.classList.add(isCorrect ? 'hang-key-correct' : 'hang-key-wrong');
  if(!isCorrect) hangGame.wrongCount++;

  document.getElementById('hang-word').textContent = hangWordDisplay();
  document.getElementById('hang-hearts').textContent = hangHeartsHtml();

  const livesLeft = hangGame.maxWrong - hangGame.wrongCount;
  if(!hangGame.clueRevealed && livesLeft <= 1 && livesLeft > 0){
    hangGame.clueRevealed = true;
    document.getElementById('hang-clue').textContent = '💡 '+hangGame.clue;
  }

  if(hangIsWon()){
    hangGame.finished = true;
    document.getElementById('hang-status').innerHTML = '🎉 Você acertou! <b>'+hangGame.word+'</b>';
    confettiBurst(30);
    addXP(10);
    document.querySelectorAll('.hang-key').forEach(b=>b.disabled=true);
    hangShowPlayAgain();
  } else if(hangGame.wrongCount >= hangGame.maxWrong){
    hangGame.finished = true;
    document.getElementById('hang-status').innerHTML = '💀 Não foi essa vez... a palavra era <b>'+hangGame.word+'</b>';
    document.querySelectorAll('.hang-key').forEach(b=>b.disabled=true);
    hangShowPlayAgain();
  }
}
function hangShowPlayAgain(){
  const box = document.querySelector('.hang-box');
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.style.width = '100%'; btn.style.marginTop = '14px';
  btn.textContent = 'Jogar de novo';
  btn.id = 'hang-again-btn';
  btn.addEventListener('click', hangNewGame);
  box.appendChild(btn);
}

/* =========================================================
   JOGO: MEMÓRIA
========================================================= */
let memGame = null;
let memTimerInterval = null;

function buildMemoryWordPool(){
  const pool = [];
  Object.values(VOCAB).forEach(cat=>{
    cat.words.forEach(w=>{ if(w[0].length<=10) pool.push({en:w[0], pt:w[1]}); }); // evita palavra gigante que nao cabe no cartao
  });
  return pool;
}
function memShuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function memFormatTime(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
function renderMemorySetup(){
  clearInterval(memTimerInterval);
  const wrap = document.getElementById('extras-games');
  const best = state.memoryBestTime;
  wrap.innerHTML =
    '<button class="back-btn" id="mem-back-btn">← Jogos</button>'+
    '<div class="hang-box mem-setup">'+
      '<div style="font-size:40px;margin-bottom:6px;">🧠</div>'+
      '<h3 style="font-family:\'Baloo 2\',sans-serif;color:var(--heading-text);margin:0 0 4px;">Jogo da Memória</h3>'+
      '<p style="font-family:\'Nunito\',sans-serif;font-size:12px;color:var(--text-soft);margin:0 0 10px;">Vire duas cartas por vez e ache os 6 pares (palavra em inglês + tradução). Quanto mais rápido, melhor!</p>'+
      (best ? '<div class="mem-best">🏆 Seu recorde: '+memFormatTime(best)+'</div>' : '')+
      '<button class="btn btn-primary" id="mem-start-btn" style="width:100%;margin-top:10px;">Jogar 🧠</button>'+
    '</div>';
  document.getElementById('mem-back-btn').addEventListener('click', renderGamesMenu);
  document.getElementById('mem-start-btn').addEventListener('click', memNewGame);
}
function memNewGame(){
  const pool = memShuffle(buildMemoryWordPool()).slice(0,6);
  const cards = [];
  pool.forEach((pair,idx)=>{
    cards.push({ id:'en'+idx, type:'en', text:pair.en, pairId:idx, matched:false });
    cards.push({ id:'pt'+idx, type:'pt', text:pair.pt, pairId:idx, matched:false });
  });
  memGame = { cards: memShuffle(cards), flippedIds:[], matchedCount:0, totalPairs:pool.length, seconds:0, locked:false };
  clearInterval(memTimerInterval);
  memTimerInterval = setInterval(()=>{
    memGame.seconds++;
    const t = document.getElementById('mem-timer');
    if(t) t.textContent = memFormatTime(memGame.seconds);
  }, 1000);
  renderMemoryGame();
}
function renderMemoryGame(){
  const wrap = document.getElementById('extras-games');
  wrap.innerHTML =
    '<button class="back-btn" id="mem-back-btn">← Jogos</button>'+
    '<div class="hang-box">'+
      '<div class="mem-timer" id="mem-timer">'+memFormatTime(memGame.seconds)+'</div>'+
      '<div class="mem-grid" id="mem-grid"></div>'+
    '</div>';
  document.getElementById('mem-back-btn').addEventListener('click', ()=>{ clearInterval(memTimerInterval); renderGamesMenu(); });
  const grid = document.getElementById('mem-grid');
  memGame.cards.forEach(card=>{
    const el = document.createElement('button');
    el.className = 'mem-card';
    el.id = 'mem-card-'+card.id;
    el.innerHTML = '<span class="mem-card-back">🐾</span><span class="mem-card-front">'+card.text+'</span>';
    el.addEventListener('click', ()=>memFlip(card.id));
    grid.appendChild(el);
  });
}
function memFlip(cardId){
  if(memGame.locked) return;
  const card = memGame.cards.find(c=>c.id===cardId);
  if(!card || card.matched || memGame.flippedIds.includes(cardId)) return;
  memGame.flippedIds.push(cardId);
  document.getElementById('mem-card-'+cardId).classList.add('mem-flipped');

  if(memGame.flippedIds.length===2){
    memGame.locked = true;
    const [id1,id2] = memGame.flippedIds;
    const c1 = memGame.cards.find(c=>c.id===id1), c2 = memGame.cards.find(c=>c.id===id2);
    if(c1.pairId===c2.pairId && c1.type!==c2.type){
      c1.matched = true; c2.matched = true;
      document.getElementById('mem-card-'+id1).classList.add('mem-matched');
      document.getElementById('mem-card-'+id2).classList.add('mem-matched');
      memGame.matchedCount++;
      memGame.flippedIds = [];
      memGame.locked = false;
      if(memGame.matchedCount===memGame.totalPairs) memFinish();
    } else {
      setTimeout(()=>{
        const el1 = document.getElementById('mem-card-'+id1), el2 = document.getElementById('mem-card-'+id2);
        if(el1) el1.classList.remove('mem-flipped');
        if(el2) el2.classList.remove('mem-flipped');
        memGame.flippedIds = [];
        memGame.locked = false;
      }, 900);
    }
  }
}
function memFinish(){
  clearInterval(memTimerInterval);
  const isNewBest = !state.memoryBestTime || memGame.seconds < state.memoryBestTime;
  if(isNewBest){ state.memoryBestTime = memGame.seconds; saveState(); }
  confettiBurst(30);
  addXP(12);
  const box = document.querySelector('.hang-box');
  const msg = document.createElement('div');
  msg.className = 'mem-finish';
  msg.innerHTML = '🎉 Terminou em <b>'+memFormatTime(memGame.seconds)+'</b>'+(isNewBest?' — novo recorde! 🏆':'');
  box.appendChild(msg);
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.style.width = '100%'; btn.style.marginTop = '10px';
  btn.textContent = 'Jogar de novo';
  btn.addEventListener('click', memNewGame);
  box.appendChild(btn);
}

/* =========================================================
   INIT
========================================================= */
function startApp(){
  loadState();
  applyMotionPref();
  applyDarkMode();
  updateStreak();
  renderVocabMenu();
  renderGrammarMenu();
  renderConvMenu();
  renderPath();
  renderGamesMenu();
  renderWordOfDay();
  updateStats();
  updateAccountPill();
  maybeShowWelcomeBack();
}

/* =========================================================
   PALAVRA DO DIA
========================================================= */
function wodDayId(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function wodPickWord(dayId){
  const pool = [];
  Object.values(VOCAB).forEach(cat=>{ cat.words.forEach(w=>pool.push({en:w[0], pt:w[1]})); });
  const rng = xwordHashSeed('wod-'+dayId);
  const idx = Math.floor(rng()*pool.length);
  return pool[idx];
}
function renderWordOfDay(){
  const card = document.getElementById('word-of-day-card');
  if(!card) return;
  const dayId = wodDayId();
  const word = wodPickWord(dayId);
  const alreadyRevealed = state.wodRevealedDate === dayId;

  card.innerHTML =
    '<div class="wod-card">'+
      '<div class="wod-label">📌 Palavra do dia</div>'+
      '<div class="wod-row">'+
        '<div class="wod-word">'+word.en+'</div>'+
        '<button class="wod-spk" id="wod-spk-btn">🔊</button>'+
      '</div>'+
      '<div class="wod-reveal-area" id="wod-reveal-area">'+
        (alreadyRevealed
          ? '<div class="wod-meaning">Significado: <b>'+word.pt+'</b></div><div class="wod-done-tag">✓ Já vista hoje</div>'
          : '<button class="wod-reveal-btn" id="wod-reveal-btn">Revelar significado (+5 XP)</button>')+
      '</div>'+
    '</div>';

  document.getElementById('wod-spk-btn').addEventListener('click', ()=>speak(word.en));
  const revealBtn = document.getElementById('wod-reveal-btn');
  if(revealBtn){
    revealBtn.addEventListener('click', ()=>{
      document.getElementById('wod-reveal-area').innerHTML = '<div class="wod-meaning">Significado: <b>'+word.pt+'</b></div>';
      if(state.wodRevealedDate !== dayId){
        state.wodRevealedDate = dayId;
        addXP(5);
        saveState();
      }
    });
  }
}

function maybeShowWelcomeBack(){
  const now = Date.now();
  const last = state.lastOpenAt || 0;
  const HOURS_24 = 24 * 60 * 60 * 1000;
  const shouldShow = (now - last) >= HOURS_24;
  state.lastOpenAt = now; // sempre atualiza — o próximo aviso só sai depois de 24h A PARTIR DESTA abertura
  saveState();

  if(!shouldShow) return;

  const titleEl = document.getElementById('welcome-title');
  const subEl = document.getElementById('welcome-sub');
  if(state.streak > 1){
    titleEl.textContent = 'Confere só quem voltou!';
    subEl.innerHTML = '🔥 Sequência de <b>'+state.streak+' dias</b>! Continue assim.';
  } else if(state.xp > 0){
    titleEl.textContent = 'Bem-vindo de volta!';
    subEl.textContent = 'Bora continuar de onde você parou.';
  } else {
    titleEl.textContent = 'Vamos começar?';
    subEl.textContent = 'Sua trilha de inglês está esperando.';
  }

  const overlay = document.getElementById('welcome-overlay');
  overlay.style.display = 'flex';
  document.getElementById('welcome-go-btn').onclick = ()=>{ overlay.style.display = 'none'; };
}

(async function initAuthGate(){
  if(getAuthToken()){
    // Já tem sessão salva: mostra a tela de carregamento (com o gato) em vez do
    // formulário de login, enquanto busca o progresso — assim não fica dando aquele
    // "flash" do formulário pra quem já tá logado.
    document.getElementById('auth-box').style.display = 'none';
    document.getElementById('auth-loading').style.display = 'block';
    try{
      await fetchRemoteProgress();
      // Também atualiza o perfil em cache (nome/foto), caso tenha mudado em outro aparelho.
      try{
        const accData = await apiRequest('/account');
        if(accData && accData.user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(accData.user));
      }catch(e){ /* falha silenciosa - segue com o que já está em cache local */ }

      revealAppWithFade();
    }catch(e){
      // Token inválido/expirado ou servidor fora do ar: cai pra tela de login.
      clearAuth();
      document.getElementById('auth-loading').style.display = 'none';
      document.getElementById('auth-box').style.display = 'block';
      document.getElementById('auth-error').textContent = 'Sua sessão expirou ou o servidor está indisponível. Entre novamente ou continue sem conta.';
      document.getElementById('auth-error').classList.add('show');
    }
  }
  // Sem token: fica na tela de login/cadastro até o usuário entrar ou tocar em "Continuar sem conta".
})();