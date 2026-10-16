const {createRequire}=require('node:module'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=createRequire(process.env.SCHOOL_DOM_PACKAGE||path.join(__dirname,'../cloudflare/home-worker/package.json'))('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../cloudflare/home-worker/public/apps/passbook/app.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,30));
async function run(role){
 const dom=new JSDOM('<main id="app"></main><dialog id="sheet"></dialog>',{url:'https://home-worker.sslowdayss.workers.dev/apps/passbook/',runScripts:'outside-only'}),w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.confirm=()=>true;
 const calls=[];let saved=false,status='pending';const guardian=role==='mom',sender=role==='grandma';
 const request={id:'gift-1',sender_id:'grandma',sender_name:'Family adult',child_id:'a',child_name:'Child-A',reason:'<img src=x onerror=alert(1)>',kind:'points',amount:10,requested_at:1,status,can_resolve:guardian};
 w.fetch=async(input,options={})=>{const url=new URL(input,w.location.href),p=url.pathname,body=options.body&&JSON.parse(options.body);calls.push({p,body});let value;
 if(p.endsWith('/households'))value=[{id:'h',name:'Home'}];
 else if(p==='/api/passbook')value={household:{name:'Home'},admin:guardian,active:true,gift:{sender,guardian},gift_only:sender,own_child_id:role==='kid'?'a':null,accounts:[],children:[],sibling_points_visible:false};
 else if(p.endsWith('/gifts')&&body){saved=true;value={ok:true};}
 else if(p.endsWith('/gifts/gift-1')&&body){status=body.status;value={ok:true};}
 else if(p.endsWith('/gifts'))value={access:{sender,guardian,pending:guardian&&status==='pending'?1:0},targets:sender?[{id:'a',display_name:'Child-A',codes:'cash,chores'}]:[],records:(!sender||saved)?[{...request,status}]:[],notifications:[],next_before:null};
 else if(p.endsWith('/gifts/permissions'))value={children:[{id:'a',display_name:'Child-A'}],senders:[{id:'grandma',display_name:'Family adult'}],permissions:[]};
 else if(p.endsWith('/finance'))value={accounts:[],plans:[],policies:[],interest:[],logs:[],attempts:[]};
 else if(p.endsWith('/chores'))value={people:[],chores:[],done:[],today:'2026-10-16'};
 else value=[];
 return {status:200,ok:true,json:async()=>value};};
 w.eval(source);await tick();
 const find=t=>Array.from(w.document.querySelectorAll('button')).find(b=>b.textContent.includes(t));
 if(sender){assert.equal(calls.some(c=>c.p.endsWith('/finance')),false);assert.equal(calls.some(c=>c.p.endsWith('/chores')),false);find('ごほうびをプレゼント').click();await tick();assert.equal(w.document.querySelector('select[name=gift_kind]').options.length,2);w.document.querySelector('#field-gift_amount').value=10;w.document.querySelector('textarea').value='Great help';const f=w.document.querySelector('form');f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();const payload=calls.find(c=>c.p.endsWith('/gifts')&&c.body).body;assert.equal(payload.child_id,'a');assert.equal(payload.amount,10);assert.ok(payload.event_id);assert.equal(payload.sender_id,undefined);assert.ok(w.document.body.textContent.includes('承認待ち'));}
 else if(guardian){assert.ok(find('プレゼント承認待ち'));find('プレゼント承認待ち').click();await tick();find('確認する').click();await tick();find('承認する').click();await tick();assert.equal(calls.find(c=>c.p.endsWith('/gifts/gift-1')).body.status,'approved');}
 else {assert.ok(find('もらったプレゼント'));assert.equal(find('ごほうびをプレゼント'),undefined);find('もらったプレゼント').click();await tick();}
 assert.equal(w.document.querySelectorAll('.gift-record img').length,0,'reasons remain text');
 dom.window.close();
}
(async()=>{await run('grandma');await run('mom');await run('kid');console.log('PASS: gift sender form, guardian decisions, child view, safe reason and no extra balances requested');})().catch(e=>{console.error(e);process.exitCode=1;});
