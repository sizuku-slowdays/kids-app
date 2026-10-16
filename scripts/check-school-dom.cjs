const {createRequire}=require('node:module'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=createRequire(process.env.SCHOOL_DOM_PACKAGE||path.join(__dirname,'../cloudflare/home-worker/package.json'))('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../cloudflare/home-worker/public/apps/school-prep/app.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
async function run(admin){
 const dom=new JSDOM('<div id="status"></div><div id="people"></div><nav id="tabs"></nav><div id="content"></div><button id="reload"></button>',{url:'https://cetus.fun/wagaya/apps/school-prep/',runScripts:'outside-only'}),w=dom.window;
 const calls=[],checked=[],today='2026-10-16',tomorrow='2026-10-19';let prefs=false,revision=1;
 const tasks=[{id:'a',kind:'homework',text:'<img src=x onerror=alert(1)>'},{id:'b',kind:'belonging',text:'水筒'}];
 w.confirm=()=>true;
 w.fetch=async(input,options={})=>{const u=new URL(input);assert.equal(u.pathname.startsWith('/wagaya/api/school-prep'),true);assert.equal(u.pathname.includes('/wagaya/wagaya/'),false);const body=options.body&&JSON.parse(options.body);calls.push({u,body});
 if(u.pathname.endsWith('/check'))checked.push({task_id:body.task_id,phase:body.phase,done:body.done?1:0});
 if(u.pathname.endsWith('/preferences'))prefs=body.notify_enabled;
 if(u.pathname.endsWith('/confirm'))revision++;
 return {status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>body?{ok:true}:{admin,groups:[{id:'h',name:'家庭'}],household_id:'h',children:admin?[{id:'child',display_name:'HOME-A'},{id:'other',display_name:'HOME-B'}]:[{id:'child',display_name:'HOME-A'}],selected:'child',today,day:u.searchParams.get('day')||today,plan:{revision,is_school_day:1,dismissal:'14:30',tasks},checks:checked,days:[{school_day:tomorrow,is_school_day:1},{school_day:today,is_school_day:1}],summary:{school_days:1,completed:0},notify_enabled:prefs,notifications:[]}};
 };
 w.eval(source);await tick();
 assert.ok(w.document.body.textContent.includes('HOME-A'));assert.equal(w.document.querySelectorAll('img').length,0);
 if(admin){
  assert.equal(w.document.querySelector('select[aria-label="子ども"]').options.length,2);
  assert.ok(Array.from(w.document.querySelectorAll('.task button')).every(b=>b.disabled));
  const checkbox=w.document.querySelector('details input[type=checkbox]:last-of-type');
  const notification=Array.from(w.document.querySelectorAll('details')).find(d=>d.textContent.includes('自分への完了通知')).querySelector('input');notification.checked=true;notification.dispatchEvent(new w.Event('change'));await tick();assert.equal(prefs,true);
  w.document.querySelector('textarea').value='音読\n漢字';
  const save=Array.from(w.document.querySelectorAll('button')).find(b=>b.textContent==='確認して確定する');save.click();await tick();
  const confirmed=calls.find(c=>c.u.pathname.endsWith('/confirm'));assert.equal(confirmed.body.tasks.filter(t=>t.kind==='homework').length,2);assert.equal(confirmed.body.expected_revision,1);
 }else{
  assert.equal(w.document.querySelector('select[aria-label="子ども"]'),null);assert.equal(w.document.body.textContent.includes('HOME-B'),false);
  w.document.querySelector('.task button').click();await tick();assert.ok(w.document.querySelector('.stamp'));assert.ok(w.document.body.textContent.includes('ぜんぶできたね'));
  w.document.querySelectorAll('#tabs button')[1].click();await tick();assert.equal(calls.at(-1).u.searchParams.get('day'),tomorrow);
  w.document.querySelector('.task button').click();await tick();assert.equal(calls.filter(c=>c.u.pathname.endsWith('/check')).at(-1).body.phase,'night');
  assert.equal(calls.filter(c=>c.u.pathname.endsWith('/check')).at(-1).u.searchParams.get('day'),tomorrow);
 }
 dom.window.close();
}
(async()=>{await run(false);await run(true);console.log('PASS: school child/guardian controls, safe text, mounted URL, next-school-day night checks, persistence requests and stamps');})().catch(e=>{console.error(e);process.exitCode=1;});
