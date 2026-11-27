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
 if(r&&r.erro==='sessao'){busy=false;return fim()}DOCS=new Map(((r&&r.docs)||[]).map(d=>[d.path,d.data]));fails=0;first=true;emit()}
 catch(e){if(++fails===3)subs.forEach(s=>s.err&&s.err(e))}busy=false}
setInterval(()=>{if(EU&&!document.hidden)pull()},5000);
document.addEventListener('visibilitychange',()=>{if(EU&&!document.hidden)pull()});
async function write(path,data){DOCS.set(path,clone(data));emit();const r=await rpc('doc_gravar',{p_token:tok,p_path:path,p_data:data});if(r&&r.erro){pull();throw new Error(r.erro)}}
async function remove(path){DOCS.delete(path);emit();const r=await rpc('doc_apagar',{p_token:tok,p_path:path});if(r&&r.erro){pull();throw new Error(r.erro)}}
function sub(kind,key,cb,err){const s={kind,key,cb,err,last:undefined};subs.push(s);if(first)setTimeout(emit,0);return()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}
const db={collection:c=>({onSnapshot:(cb,err)=>sub('col',c,cb,err)}),
 doc:p=>({onSnapshot:(cb,err)=>sub('doc',p,cb,err),set:d=>write(p,d),delete:()=>remove(p),get:async()=>snap({kind:'doc',key:p})})};
const user={id:async()=>EU.id,canEdit:async()=>!!EU.gestao,isOwner:()=>false,profiles:async()=>({}),me:async()=>({id:EU.id})};
window.claude={use:async n=>{await sessao;return n==='db'?db:n==='user'?user:null}};

/* ---------- sair ---------- */
async function fim(){try{if(tok)await rpc('sair',{p_token:tok})}catch(e){}try{localStorage.removeItem(LS)}catch(e){}location.reload()}

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
#ac .x{align-self:flex-end;border:0;background:none;font-size:22px;cursor:pointer;color:var(--soft,#7a6e62)}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
let L=null,P0=[],sel=null,msg='',bz=false;
function box(){if(!L){L=document.createElement('div');L.id='lg';document.body.appendChild(L)}return L}
const COR={joana:'#2a2420',jhennyfer:'#8a6a3d',flavia:'#b0563f',brenda:'#4f7a5c',mariana:'#a86e8f',eduarda:'#3f6b8f',luz:'#7b5ea7'};
const FUN={joana:'CEO',jhennyfer:'Gestão',flavia:'Leads e marcações',brenda:'Receção e stock',mariana:'Felicidade',eduarda:'Estratégia',luz:'Marketing, Meta e CRM'};
const ini=n=>String(n||'?').replace(/^Dra?\.\s*/,'').trim().slice(0,1).toUpperCase();
const avL=(x,c)=>`<span class="av${c?' '+c:''}" style="background:${COR[x.id]||'#8a6a3d'}" aria-hidden="true">${esc(ini(x.nome))}</span>`;
const side=`<aside class="lgside"><div class="lgbrand">PROAGE<small>TAREFAS DA EQUIPA</small></div><p class="lgquote">Nós promovemos <em>felicidade</em>.</p><div class="lgfoot">Proage Clinic · Porto</div></aside>`;
function draw(){const b=box();const p=P0.find(x=>x.id===sel);
 const h=new Date().getHours(),ola=h<13?'Bom dia':h<20?'Boa tarde':'Boa noite';
 if(!p){b.innerHTML=`${side}<main class="lgmain"><div class="bx"><p class="kk">${ola}</p><h2>Quem és?</h2><p>Toca no teu nome para entrar.</p>${msg?`<div class="er">${esc(msg)}</div>`:''}<div class="ns">${P0.map(x=>`<button data-p="${esc(x.id)}">${avL(x)}<span><b>${esc(x.nome)}</b><small>${esc(FUN[x.id]||'')}</small></span><span class="arr" aria-hidden="true">→</span></button>`).join('')}</div></div></main>`;return}
 const nova=!p.tem_password;
 if(nova&&!p.aberta){b.innerHTML=`${side}<main class="lgmain"><div class="bx" style="max-width:440px">${avL(p,'big')}<h2>Olá, ${esc(p.nome)}</h2><p>Ainda não tens acesso. Pede à gestão (Dra. Joana, Eduarda, Mariana ou Jhennyfer) para abrir o teu acesso nas Tarefas. Depois voltas aqui e crias a tua password.</p><button class="bk" data-bk>← Voltar</button></div></main>`;return}
 b.innerHTML=`${side}<main class="lgmain"><form class="bx" autocomplete="on">${avL(p,'big')}<h2>Olá, ${esc(p.nome)}</h2><p>${nova?'Primeira vez: cria a tua password, com pelo menos 8 caracteres. Guarda-a bem, é só tua.':'Escreve a tua password.'}</p>
 <input type="text" name="username" autocomplete="username" value="${esc(p.id)}" hidden>
 <input type="password" id="pw" autocomplete="${nova?'new-password':'current-password'}" placeholder="Password" required minlength="${nova?8:1}">
 ${nova?'<input type="password" id="pw2" autocomplete="new-password" placeholder="Repete a password" required minlength="8">':''}
 ${msg?`<div class="er">${esc(msg)}</div>`:''}<button class="go" ${bz?'disabled':''}>${bz?'A entrar…':'Entrar'}</button><button type="button" class="bk" data-bk>← Não sou ${esc(p.nome)}</button></form></main>`;
 setTimeout(()=>{const i=document.getElementById('pw');i&&i.focus()},0)}
async function abrir(){try{P0=await rpc('entrada_pessoas')||[]}catch(e){msg='Sem ligação à base de dados. Verifica a internet e recarrega a página.'}draw()}
document.addEventListener('click',e=>{if(!L||!L.contains(e.target))return;const b=e.target.closest('[data-p]');if(b){sel=b.dataset.p;msg='';draw();return}
 if(e.target.closest('[data-bk]')){sel=null;msg='';draw()}});
document.addEventListener('submit',async e=>{if(!L||!L.contains(e.target))return;e.preventDefault();e.stopPropagation();const p=P0.find(x=>x.id===sel);if(!p||bz)return;
 const a=document.getElementById('pw').value,b2=document.getElementById('pw2');
 if(b2&&a!==b2.value){msg='As duas passwords não são iguais.';draw();return}
 if(b2&&a.length<8){msg='A password tem de ter pelo menos 8 caracteres.';draw();return}
 bz=true;msg='';draw();try{const r=await rpc('entrar',{p_id:p.id,p_senha:a});bz=false;
  if(!r||r.erro){msg=(r&&r.erro)||'Não foi possível entrar.';if(r&&/acesso|gestão/.test(r.erro))P0=await rpc('entrada_pessoas');draw();return}
  tok=r.token;try{localStorage.setItem(LS,tok)}catch(e){}await iniciar()}catch(err){bz=false;msg='Sem ligação. Tenta outra vez.';draw()}},true);
async function iniciar(){const r=await rpc('eu',{p_token:tok});if(!r){try{localStorage.removeItem(LS)}catch(e){}tok=null;return abrir()}
 EU=r;await pull();if(L){L.remove();L=null}ok()}

/* ---------- acessos da equipa (gestão) ---------- */
let AC=null,arm=null;
const quando=t=>{if(!t)return'';const d=new Date(t);return d.toLocaleDateString('pt-PT',{day:'2-digit',month:'2-digit'})+' às '+d.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'})};
async function acessos(){if(!AC){AC=document.createElement('div');AC.id='ac';document.body.appendChild(AC)}AC.innerHTML='<div class="bx"><p>A carregar…</p></div>';
 let L2=[];try{L2=await rpc('acessos',{p_token:tok})}catch(e){}if(!Array.isArray(L2)){AC.innerHTML='<div class="bx"><p>Não foi possível abrir os acessos.</p><button class="x" data-acx>×</button></div>';return}
 AC.innerHTML=`<div class="bx"><button class="x" data-acx aria-label="Fechar">×</button><h2>Acessos da equipa</h2><p>«Abrir acesso» deixa a pessoa criar a sua password na próxima entrada. «Repor password» faz o mesmo para quem se esqueceu e termina as sessões dela.</p>
 ${L2.map(x=>{const est=!x.ativo?'Desligada':x.tem_password?(x.ultimo_acesso?'Ativa · última entrada '+quando(x.ultimo_acesso):'Ativa'):x.aberta?'À espera de criar password':'Sem acesso';
  const a1=x.tem_password?['abrir','Repor password',true]:x.aberta?null:['abrir','Abrir acesso',false];
  const a2=x.id===EU.id?null:x.ativo?['desligar','Desligar',true]:['ligar','Ligar',false];
  const bt=a=>a?`<button class="${a[2]?'w':''}" data-ac="${esc(x.id)}|${a[0]}">${arm===x.id+'|'+a[0]?'Confirmar?':a[1]}</button>`:'';
  return `<div class="r"><b>${esc(x.nome)}${x.gestao?' · gestão':''}</b><small>${esc(est)}</small>${bt(a1)}${bt(a2)}</div>`}).join('')}</div>`}
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-sair]')){e.preventDefault();e.stopPropagation();fim();return}
 if(e.target.closest('[data-acessos]')){e.preventDefault();e.stopPropagation();arm=null;acessos();return}
 if(!AC||!AC.contains(e.target))return;
 if(e.target.closest('[data-acx]')||e.target===AC){AC.remove();AC=null;return}
 const b=e.target.closest('[data-ac]');if(!b)return;const k=b.dataset.ac,[id,ac]=k.split('|');
 if(b.classList.contains('w')&&arm!==k){arm=k;return acessos()}
 arm=null;try{const r=await rpc('acesso_mudar',{p_token:tok,p_id:id,p_acao:ac});if(r&&r.erro)console.warn(r.erro)}catch(err){}acessos()},true);

/* ---------- arranque ---------- */
const go=()=>{if(tok)iniciar().catch(()=>{msg='Sem ligação à base de dados. Verifica a internet e recarrega a página.';abrir()});else abrir()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else go();
})();
