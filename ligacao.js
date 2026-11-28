/* Tarefas PROAGE: ligação ao Supabase.
   Imita a API de base de dados do claude.ai (db.collection/doc, onSnapshot, set, delete) para que a app não precise de mudar.
   Entrada com nome + password, verificada no servidor. A chave abaixo é pública por natureza: sem sessão válida não lê nem grava nada. */
(()=>{
const U='https://hbwzqerhmoitjcgpntwh.supabase.co',K='sb_publishable_CMKn_KuypX1iPhkYLR0goA_aEFrJAD-',LS='tarefas_proage_sessao';
let tok=null;try{tok=localStorage.getItem(LS)}catch(e){}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function rpc(fn,args){const r=await fetch(U+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:K,'Content-Type':'application/json'},body:JSON.stringify(args||{})});
 if(!r.ok)throw new Error('Sem ligação ('+r.status+')');const t=await r.text();return t?JSON.parse(t):null}
let EU=null,DOCS=new Map(),first=false,ok;const sessao=new Promise(r=>ok=r);
const subs=[],clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function colDocs(col){if(col==='membros')return EU.membros.map(id=>({id,data:{p:id}}));if(col==='pedidos')return[];
 const out=[];for(const [p,d] of DOCS){const i=p.lastIndexOf('/');if(p.slice(0,i)===col)out.push({id:p.slice(i+1),data:d})}return out}
function snap(s){if(s.kind==='col'){const ds=colDocs(s.key);return{_k:JSON.stringify(ds),docs:ds.map(x=>({id:x.id,exists:true,data:()=>clone(x.data)})),metadata:{fromCache:false}}}
 const d=DOCS.get(s.key);return{_k:JSON.stringify(d||null),id:s.key.split('/').pop(),exists:!!d,data:()=>clone(d)}}
function emit(){for(const s of subs.slice()){const n=snap(s);if(n._k!==s.last){s.last=n._k;try{s.cb(n)}catch(e){console.error(e)}}}}
let fails=0,busy=false;
async function pull(){if(busy||!tok)return;busy=true;try{const r=await rpc('docs_todos',{p_token:tok});
 if(r&&r.erro==='sessao'){busy=false;return fim()}if(r&&r.erro==='trocar'){busy=false;return location.reload()}DOCS=new Map(((r&&r.docs)||[]).map(d=>[d.path,d.data]));fails=0;first=true;emit()}
 catch(e){if(++fails===3)subs.forEach(s=>s.err&&s.err(e))}busy=false}
setInterval(()=>{if(EU&&!document.hidden)pull()},5000);
document.addEventListener('visibilitychange',()=>{if(EU&&!document.hidden)pull()});
async function write(path,data){DOCS.set(path,clone(data));emit();const r=await rpc('doc_gravar',{p_token:tok,p_path:path,p_data:data});if(r&&r.erro){pull();throw new Error(r.erro)}}
async function remove(path){DOCS.delete(path);emit();const r=await rpc('doc_apagar',{p_token:tok,p_path:path});if(r&&r.erro){pull();throw new Error(r.erro)}}
function sub(kind,key,cb,err){const s={kind,key,cb,err,last:undefined};subs.push(s);if(first)setTimeout(emit,0);return()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}
const db={collection:c=>({onSnapshot:(cb,err)=>sub('col',c,cb,err)}),
 doc:p=>({onSnapshot:(cb,err)=>sub('doc',p,cb,err),set:d=>write(p,d),delete:()=>remove(p),get:async()=>snap({kind:'doc',key:p})})};
const user={id:async()=>EU.id,canEdit:async()=>!!EU.gestao,isOwner:()=>false,profiles:async()=>({}),me:async()=>({id:EU.id})};
/* ---------- avisos com a app fechada ---------- */
const FN=U+'/functions/v1/avisar';
const b64u=x=>{const p='='.repeat((4-x.length%4)%4),r=atob((x+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(r,c=>c.charCodeAt(0))};
const push={suportado:()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window,
 async ativo(){if(!push.suportado())return false;try{const r=await navigator.serviceWorker.getRegistration();return !!(r&&await r.pushManager.getSubscription())}catch(e){return false}},
 async ligar(){if(!push.suportado())throw new Error('Este aparelho não recebe avisos com a app fechada.');
  const reg=await navigator.serviceWorker.ready;let s=await reg.pushManager.getSubscription();
  if(!s){const r=await fetch(FN);const j=await r.json();if(!j.chave)throw new Error('Avisos ainda não configurados.');
   s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(j.chave)})}
  const r=await rpc('push_registar',{p_token:tok,p_sub:s.toJSON()});if(r&&r.erro)throw new Error(r.erro);return true}};
async function pushSair(){try{const r=await navigator.serviceWorker?.getRegistration();const s=r&&await r.pushManager.getSubscription();
 if(s){await rpc('push_remover',{p_token:tok,p_endpoint:s.endpoint});await s.unsubscribe()}}catch(e){}}
/* ---------- mensagens de voz ---------- */
const FA=U+'/functions/v1/audio';
const audio={async enviar(blob){const r=await fetch(FA+'?acao=enviar',{method:'POST',headers:{'x-token':tok,'Content-Type':(blob.type||'audio/webm').split(';')[0]},body:blob});
  let j={};try{j=await r.json()}catch(e){}if(!r.ok||!j.path)throw new Error(j.erro||'Não foi possível enviar o áudio');return j.path},
 async url(path){const r=await fetch(FA+'?acao=ouvir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:tok,path})});
  let j={};try{j=await r.json()}catch(e){}if(!j.url)throw new Error(j.erro||'indisponível');return j.url}};
window.claude={use:async n=>{await sessao;return n==='db'?db:n==='user'?user:n==='push'?push:n==='audio'?audio:null}};

/* ---------- sair ---------- */
async function fim(){if(tok)await pushSair();try{if(tok)await rpc('sair',{p_token:tok})}catch(e){}try{localStorage.removeItem(LS)}catch(e){}location.reload()}

/* ---------- ecrã de entrada ---------- */
const css=`#lg{position:fixed;inset:0;z-index:200;background:#fbf7f1;display:grid;grid-template-columns:minmax(320px,42%) 1fr;overflow:auto;color:#2a2420;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif}
#lg .lgside{background:#2a2420;color:#efe6da;display:flex;flex-direction:column;justify-content:space-between;padding:calc(48px + env(safe-area-inset-top,0px)) 56px 40px;position:relative;overflow:hidden}
#lg .lgside::after{content:"";position:absolute;right:-120px;bottom:-120px;width:380px;height:380px;border-radius:50%;border:1px solid rgba(215,185,138,.25);box-shadow:0 0 0 60px rgba(215,185,138,.05),0 0 0 140px rgba(215,185,138,.03)}
#lg .lgbrand{font-family:Fraunces,Georgia,serif;font-size:40px;letter-spacing:7px;color:#d7b98a;line-height:1}
#lg .lgbrand small{display:block;font-family:Inter,system-ui,sans-serif;font-size:12px;letter-spacing:4px;color:#bfae9a;margin-top:12px;font-weight:600}
#lg .lgquote{font-family:Fraunces,Georgia,serif;font-size:30px;line-height:1.25;max-width:14ch;color:#f6efe4;margin:0;position:relative;z-index:1}
#lg .lgquote em{color:#d7b98a;font-style:italic}
#lg .lgfoot{font-size:12.5px;color:#bfae9a;position:relative;z-index:1}
#lg .lgmain{display:flex;align-items:center;justify-content:center;padding:48px 40px calc(40px + env(safe-area-inset-bottom,0px))}
#lg .bx{width:100%;max-width:620px;display:flex;flex-direction:column;gap:14px}
#lg .kk{font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#b08d57;margin:0}
#lg h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:40px;line-height:1.1;margin:0}
#lg p{margin:0;color:#7d7066;font-size:16px;line-height:1.5}
#lg .ns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:10px}
#lg .ns button{display:flex;align-items:center;gap:14px;border:1px solid #e6dccf;background:#fff;border-radius:16px;padding:16px 18px;text-align:left;cursor:pointer;color:#2a2420;min-height:76px;box-shadow:0 1px 2px rgba(42,36,32,.04);transition:border-color .15s,transform .15s,box-shadow .15s}
#lg .ns button:hover,#lg .ns button:focus-visible{border-color:#b08d57;transform:translateY(-1px);box-shadow:0 8px 20px rgba(42,36,32,.08);outline:none}
#lg .ns b{display:block;font-size:17px;font-weight:600}#lg .ns small{display:block;font-size:13px;color:#7d7066;margin-top:2px}
#lg .ns .arr{margin-left:auto;color:#b08d57;font-weight:700;font-size:18px}
#lg .av{flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:17px}
#lg .av.big{width:72px;height:72px;font-size:26px}
#lg form.bx{max-width:440px}
#lg input{width:100%;box-sizing:border-box;border:1px solid #e6dccf;border-radius:14px;padding:15px 16px;font-size:17px;background:#fff;color:#2a2420;outline:none}
#lg input:focus{border-color:#b08d57;box-shadow:0 0 0 3px rgba(176,141,87,.18)}
#lg .go{border:0;border-radius:14px;padding:16px;font-weight:700;font-size:16px;background:#2a2420;color:#fbf7f1;cursor:pointer;margin-top:4px}#lg .go:disabled{opacity:.5}
#lg .bk{background:none;border:0;color:#7d7066;text-decoration:underline;font-size:14px;align-self:flex-start;padding:4px 0;cursor:pointer}
#lg .er{color:#d6453a;font-size:14px;font-weight:600;background:#fdecea;border-radius:10px;padding:10px 12px}
@media (max-width:860px){#lg{display:block}
 #lg .lgside{padding:calc(28px + env(safe-area-inset-top,0px)) 24px 26px;gap:14px}#lg .lgside::after{width:220px;height:220px;right:-90px;bottom:-110px}
 #lg .lgbrand{font-size:30px;letter-spacing:5px}#lg .lgquote,#lg .lgfoot{display:none}
 #lg .lgmain{align-items:flex-start;padding:26px 18px calc(28px + env(safe-area-inset-bottom,0px))}
 #lg h2{font-size:30px}#lg p{font-size:15px}}
@media (max-width:520px){#lg .ns{grid-template-columns:1fr}#lg .ns button{min-height:68px;padding:12px 14px}}
#ac{position:fixed;inset:0;z-index:150;background:rgba(20,16,12,.45);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:6vh 16px}
#ac .bx{width:100%;max-width:560px;background:var(--card,#fff);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px}
#ac h2{font-family:var(--serif,Georgia,serif);margin:0;font-size:20px}#ac p{margin:0;color:var(--soft,#7a6e62);font-size:13px}
#ac .r{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--line,#e6dccf);padding-top:10px}#ac .r b{min-width:110px}#ac .r small{color:var(--soft,#7a6e62);flex:1;min-width:150px}
#ac .r button{border:1px solid var(--line,#e6dccf);background:var(--card,#fff);border-radius:8px;padding:5px 10px;font-weight:600;font-size:12.5px;cursor:pointer;color:var(--ink,#2a2420)}#ac .r button.w{border-color:var(--red,#c0392b);color:var(--red,#c0392b)}
#ac .x{align-self:flex-end;border:0;background:none;font-size:22px;cursor:pointer;color:var(--soft,#7a6e62)}
#lg .lb{font-size:13px;font-weight:700;color:#5b4f45;margin:6px 0 -6px}
#lg .pwf{position:relative}#lg .pwf input{padding-right:52px}
#lg .eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:10px;background:none;color:#9b8e82;cursor:pointer;display:grid;place-items:center}
#lg .eye:hover,#lg .eye.on{color:#b08d57;background:#f6efe4}
#lg .hint{font-size:13.5px;color:#9b8e82;margin-top:4px}
#lg .forca{display:flex;align-items:center;gap:10px;font-size:12.5px;color:#7d7066;min-height:18px}
#lg .forca i{flex:1;height:6px;border-radius:3px;background:#eee4d6;position:relative;overflow:hidden}
#lg .forca i::after{content:"";position:absolute;inset:0;width:0;background:#d6453a;border-radius:3px;transition:width .2s,background .2s}
#lg .forca[data-n="1"] i::after{width:25%}#lg .forca[data-n="2"] i::after{width:50%;background:#d79a3a}#lg .forca[data-n="3"] i::after{width:75%;background:#7aa35b}#lg .forca[data-n="4"] i::after{width:100%;background:#3f8a5c}
#lg .forca span{min-width:80px;text-align:right}
#ac .r{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 10px}
#ac .rn{display:flex;flex-direction:column;gap:2px;min-width:0}#ac .rn small{flex:none;min-width:0}
#ac .ra{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#ac .lgn{border:0 !important;background:none !important;padding:0 !important;font-weight:400 !important;color:var(--soft,#7a6e62) !important;text-align:left;font-size:12.5px !important}
#ac .lgn b{color:var(--ink,#2a2420)}
#ac .lgf{display:flex;gap:6px}#ac .lgf input{border:1px solid var(--line,#e6dccf);border-radius:8px;padding:5px 8px;font-size:13px;width:140px}
#ac .sp{grid-column:1/-1;background:#f6efe4;border:1px solid #e6d3b3;border-radius:12px;padding:12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
#ac .sp span{font-size:12.5px;font-weight:700;color:#8a6a3d;width:100%}
#ac .sp code{font-size:20px;font-weight:700;letter-spacing:1px;color:#2a2420;background:#fff;border-radius:8px;padding:6px 12px;user-select:all}
#ac .sp small{width:100%;color:#7a6e62;font-size:12px}
#ac form.bx input{border:1px solid var(--line,#e6dccf);border-radius:10px;padding:11px 12px;font-size:15px}
#ac .go2{border:0;border-radius:10px;padding:12px;font-weight:700;background:var(--ink,#2a2420);color:var(--paper,#fbf7f1);cursor:pointer}
#ac .erm{color:#d6453a !important;font-weight:600}#ac .okm{color:#3f8a5c !important;font-weight:600;font-size:14px !important}
@media (max-width:520px){#ac .r{grid-template-columns:1fr}#ac .ra{justify-content:flex-start}}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
let L=null,msg='',bz=false,stage='nome',NOME='',TROCA=null;
function box(){if(!L){L=document.createElement('div');L.id='lg';document.body.appendChild(L)}return L}
const side=`<aside class="lgside"><div class="lgbrand">PROAGE<small>TAREFAS DA EQUIPA</small></div><p class="lgquote">Nós promovemos <em>felicidade</em>.</p><div class="lgfoot">Proage Clinic · Porto</div></aside>`;
const EYE='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const pw=(id,ph,ac)=>`<div class="pwf"><input type="password" id="${id}" autocomplete="${ac}" placeholder="${ph}" required><button type="button" class="eye" data-eye="${id}" aria-label="Mostrar a senha">${EYE}</button></div>`;
function draw(){const b=box();const h=new Date().getHours(),ola=h<13?'Bom dia':h<20?'Boa tarde':'Boa noite';
 const er=msg?`<div class="er" role="alert">${esc(msg)}</div>`:'';
 if(stage==='trocar'){b.innerHTML=`${side}<main class="lgmain"><form class="bx" data-lg="trocar" autocomplete="on"><p class="kk">Primeira entrada</p><h2>Cria a tua senha</h2><p>A senha que recebeste era provisória. Escolhe agora uma só tua, com pelo menos 8 caracteres. É com ela que entras daqui para a frente.</p>
 <input type="text" name="username" autocomplete="username" value="${esc(NOME)}" hidden>${pw('pw','Nova senha','new-password')}${pw('pw2','Repete a nova senha','new-password')}
 <div class="forca" id="forca"><i></i><span></span></div>${er}<button class="go" ${bz?'disabled':''}>${bz?'A guardar…':'Guardar e entrar'}</button><button type="button" class="bk" data-lgsair>Sair</button></form></main>`;
  setTimeout(()=>{const i=document.getElementById('pw');i&&i.focus()},0);return}
 b.innerHTML=`${side}<main class="lgmain"><form class="bx" data-lg="entrar" autocomplete="on"><p class="kk">${ola}</p><h2>Entrar nas Tarefas</h2><p>Escreve o teu nome e a tua senha.</p>
 <label class="lb" for="nm">Nome</label><input type="text" id="nm" name="username" autocomplete="username" autocapitalize="words" spellcheck="false" placeholder="Ex.: Brenda" value="${esc(NOME)}" required>
 <label class="lb" for="pw">Senha</label>${pw('pw','A tua senha','current-password')}
 ${er}<button class="go" ${bz?'disabled':''}>${bz?'A entrar…':'Entrar'}</button>
 <p class="hint">Primeira vez ou esqueceste-te da senha? Pede à gestão uma senha provisória. Na primeira entrada crias a tua.</p></form></main>`;
 setTimeout(()=>{const i=document.getElementById(NOME?'pw':'nm');i&&i.focus()},0)}
function abrir(){stage='nome';draw()}
const forca=v=>{let n=0;if(v.length>=8)n++;if(v.length>=12)n++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))n++;if(/\d/.test(v))n++;if(/[^A-Za-z0-9]/.test(v))n++;return Math.min(4,n)};
document.addEventListener('input',e=>{if(!L||e.target.id!=='pw'||stage!=='trocar')return;const f=document.getElementById('forca');if(!f)return;const v=e.target.value,n=v?forca(v):0;
 f.dataset.n=n;f.querySelector('span').textContent=!v?'':v.length<8?'Curta demais':['Fraca','Fraca','Razoável','Boa','Muito boa'][n]});
document.addEventListener('click',e=>{if(!L||!L.contains(e.target))return;const y=e.target.closest('[data-eye]');if(y){const i=document.getElementById(y.dataset.eye);if(i){i.type=i.type==='password'?'text':'password';y.classList.toggle('on',i.type==='text')}return}
 if(e.target.closest('[data-lgsair]')){fim()}});
document.addEventListener('submit',async e=>{if(!L||!L.contains(e.target))return;e.preventDefault();e.stopPropagation();if(bz)return;
 if(stage==='trocar'){const a=document.getElementById('pw').value,b2=document.getElementById('pw2').value;
  if(a.length<8){msg='A senha tem de ter pelo menos 8 caracteres.';draw();return}if(a!==b2){msg='As duas senhas não são iguais.';draw();return}
  bz=true;msg='';draw();try{const r=await rpc('senha_trocar',{p_token:tok,p_atual:'',p_nova:a});bz=false;if(!r||r.erro){msg=(r&&r.erro)||'Não foi possível guardar.';draw();return}
   await iniciar()}catch(err){bz=false;msg='Sem ligação. Tenta outra vez.';draw()}return}
 NOME=document.getElementById('nm').value.trim();const a=document.getElementById('pw').value;if(!NOME||!a)return;
 bz=true;msg='';draw();try{const r=await rpc('entrar_nome',{p_nome:NOME,p_senha:a});bz=false;
  if(!r||r.erro){msg=(r&&r.erro)||'Não foi possível entrar.';draw();const i=document.getElementById('pw');if(i)i.value='';return}
  tok=r.token;try{localStorage.setItem(LS,tok)}catch(e){}await iniciar()}catch(err){bz=false;msg='Sem ligação. Tenta outra vez.';draw()}},true);
async function iniciar(){const r=await rpc('eu',{p_token:tok});if(!r){try{localStorage.removeItem(LS)}catch(e){}tok=null;return abrir()}
 if(r.trocar){NOME=r.nome||NOME;stage='trocar';msg='';draw();return}
 EU=r;await pull();if(L){L.remove();L=null}ok()}

/* ---------- mudar a própria senha ---------- */
let MS=null,msMsg='',msOk=false;
function mudarSenha(){if(!MS){MS=document.createElement('div');MS.id='ac';document.body.appendChild(MS)}
 MS.innerHTML=`<form class="bx" data-ms><button type="button" class="x" data-msx aria-label="Fechar">×</button><h2>Mudar a minha senha</h2>
 ${msOk?'<p class="okm">Senha mudada. As outras sessões foram fechadas.</p><button type="button" class="go2" data-msx>Fechar</button>':`<p>Pelo menos 8 caracteres.</p>
 <input type="password" id="ms0" autocomplete="current-password" placeholder="Senha atual" required><input type="password" id="ms1" autocomplete="new-password" placeholder="Nova senha" required><input type="password" id="ms2" autocomplete="new-password" placeholder="Repete a nova senha" required>
 ${msMsg?`<p class="erm">${esc(msMsg)}</p>`:''}<button class="go2">Guardar</button>`}</form>`;
 setTimeout(()=>{const i=document.getElementById('ms0');i&&i.focus()},0)}
document.addEventListener('submit',async e=>{if(!MS||!MS.contains(e.target))return;e.preventDefault();e.stopPropagation();
 const a=document.getElementById('ms0').value,n=document.getElementById('ms1').value,n2=document.getElementById('ms2').value;
 if(n.length<8){msMsg='A nova senha tem de ter pelo menos 8 caracteres.';return mudarSenha()}if(n!==n2){msMsg='As duas senhas não são iguais.';return mudarSenha()}
 try{const r=await rpc('senha_trocar',{p_token:tok,p_atual:a,p_nova:n});if(!r||r.erro){msMsg=(r&&r.erro)||'Não foi possível mudar.';return mudarSenha()}msOk=true;msMsg='';mudarSenha()}catch(err){msMsg='Sem ligação. Tenta outra vez.';mudarSenha()}},true);

/* ---------- acessos da equipa (gestão) ---------- */
let AC=null,arm=null,NOVA=null,LOGED=null,acMsg='';
const quando=t=>{if(!t)return'';const d=new Date(t);return d.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})+' às '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})};
async function acessos(){if(!AC){AC=document.createElement('div');AC.id='ac';document.body.appendChild(AC)}
 let L2=[];try{L2=await rpc('acessos',{p_token:tok})}catch(e){}if(!Array.isArray(L2)){AC.innerHTML='<div class="bx"><p>Não foi possível abrir os acessos.</p><button class="x" data-acx>×</button></div>';return}
 AC.innerHTML=`<div class="bx"><button class="x" data-acx aria-label="Fechar">×</button><h2>Acessos da equipa</h2>
 <p>Cada pessoa entra com o <b>nome de entrada</b> e a senha dela. Para dar acesso, ou se alguém se esqueceu da senha, gera uma <b>senha provisória</b> e envia-lha. Na primeira entrada a pessoa cria a sua.</p>
 ${acMsg?`<p class="erm">${esc(acMsg)}</p>`:''}
 ${L2.map(x=>{const est=!x.ativo?'Desligada':!x.tem_password?'Sem acesso':x.provisoria?'Com senha provisória, ainda não entrou':(x.ultimo_acesso?'Ativa · última entrada '+quando(x.ultimo_acesso):'Ativa');
  const nova=NOVA&&NOVA.id===x.id;const k1=x.id+'|provisoria';
  const b1=x.ativo?`<button class="${x.tem_password?'w':''}" data-ac="${k1}">${arm===k1?'Confirmar?':x.tem_password?'Nova senha provisória':'Dar acesso'}</button>`:'';
  const k2=x.id+'|'+(x.ativo?'desligar':'ligar');const b2=x.id===EU.id?'':`<button class="${x.ativo?'w':''}" data-ac="${k2}">${arm===k2?'Confirmar?':x.ativo?'Desligar':'Ligar'}</button>`;
  const lg=LOGED===x.id?`<form class="lgf" data-login="${esc(x.id)}"><input id="lgv" value="${esc(x.login||'')}" aria-label="Nome de entrada"><button>Guardar</button></form>`:`<button class="lgn" data-loged="${esc(x.id)}" title="Mudar o nome de entrada">entra como <b>${esc(x.login||'?')}</b> ✎</button>`;
  return `<div class="r"><div class="rn"><b>${esc(x.nome)}${x.gestao?' · gestão':''}</b>${lg}<small>${esc(est)}</small></div><div class="ra">${b1}${b2}</div>
  ${nova?`<div class="sp"><span>Senha provisória de ${esc(x.nome)}</span><code id="spv">${esc(NOVA.senha)}</code><button data-spcopy>Copiar</button><small>Envia-lha por mensagem. Só aparece agora: se fechares, gera outra.</small></div>`:''}</div>`}).join('')}</div>`}
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-sair]')){e.preventDefault();e.stopPropagation();fim();return}
 if(e.target.closest('[data-acessos]')){e.preventDefault();e.stopPropagation();arm=null;NOVA=null;LOGED=null;acMsg='';acessos();return}
 if(e.target.closest('[data-mudarsenha]')){e.preventDefault();e.stopPropagation();msMsg='';msOk=false;mudarSenha();return}
 if(MS&&MS.contains(e.target)){if(e.target.closest('[data-msx]')||e.target===MS){MS.remove();MS=null}return}
 if(!AC||!AC.contains(e.target))return;
 if(e.target.closest('[data-acx]')||e.target===AC){AC.remove();AC=null;NOVA=null;return}
 if(e.target.closest('[data-spcopy]')){try{await navigator.clipboard.writeText(NOVA.senha);e.target.textContent='Copiada ✓'}catch(x){const c=document.getElementById('spv');if(c){const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r)}}return}
 const le=e.target.closest('[data-loged]');if(le){LOGED=le.dataset.loged;await acessos();const i=document.getElementById('lgv');if(i){i.focus();i.select()}return}
 const b=e.target.closest('[data-ac]');if(!b)return;const k=b.dataset.ac,[id,ac]=k.split('|');
 if(b.classList.contains('w')&&arm!==k){arm=k;return acessos()}
 arm=null;acMsg='';try{const r=await rpc('acesso_mudar',{p_token:tok,p_id:id,p_acao:ac});if(r&&r.erro)acMsg=r.erro;else if(r&&r.senha)NOVA={id,senha:r.senha}}catch(err){acMsg='Sem ligação. Tenta outra vez.'}acessos()},true);
document.addEventListener('submit',async e=>{const f=e.target.closest&&e.target.closest('[data-login]');if(!f||!AC||!AC.contains(f))return;e.preventDefault();e.stopPropagation();
 const v=document.getElementById('lgv').value;acMsg='';try{const r=await rpc('acesso_mudar',{p_token:tok,p_id:f.dataset.login,p_acao:'login:'+v});if(r&&r.erro)acMsg=r.erro;else LOGED=null}catch(err){acMsg='Sem ligação.'}acessos()},true);

/* ---------- arranque ---------- */
const go=()=>{if(tok)iniciar().catch(()=>{msg='Sem ligação à base de dados. Verifica a internet e recarrega a página.';abrir()});else abrir()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
