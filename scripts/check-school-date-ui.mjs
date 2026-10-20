// Synthetic fixtures only; no production requests or personal information.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.WAGAYA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.WAGAYA_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']});
const root=new URL('../cloudflare/home-worker/public/apps/school-prep/',import.meta.url);
try{
 const page=await browser.newPage();let admin=false;const calls=[],errors=[],checks=new Map();
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://school.test/**',async route=>{
  const req=route.request(),u=new URL(req.url()),day=u.searchParams.get('day')||'2026-10-21';
  if(u.pathname.includes('/api/school-prep')){
   const body=req.method()==='POST'?req.postDataJSON():null;calls.push({day,body,path:u.pathname});
   if(body)checks.set(day,body.done);
   const data=body?{ok:true}:{admin,groups:[{id:'h',name:'テスト家庭'}],household_id:'h',children:[{id:'c',display_name:'テストの子'}],selected:'c',today:'2026-10-21',next_school_day:'2026-10-22',day,checkable_phases:day<'2026-10-21'?['homework','night','morning']:day==='2026-10-21'?['homework','morning']:day==='2026-10-22'?['night']:[],plan:{revision:1,is_school_day:1,tasks:[{id:'hw',kind:'homework',text:'前の日の宿題'},{id:'bag',kind:'belonging',text:'水筒'}]},checks:checks.get(day)?[{task_id:'hw',phase:'homework',done:1}]:[],days:[],summary:{school_days:2,completed:0},notifications:[],template:{labels:[],revision:0}};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;
  }
  const name=u.pathname.split('/').at(-1)||'index.html';await route.fulfill({contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:await readFile(new URL(name,root),'utf8')});
 });
 for(const width of [390,768,1280]){
  await page.setViewportSize({width,height:844});await page.goto('https://school.test/wagaya/apps/school-prep/');
  await page.getByRole('heading',{name:'きょうの宿題',exact:true}).waitFor();
  assert.equal(await page.locator('textarea, details').count(),0);
  await page.getByRole('button',{name:'前の日',exact:true}).click();
  await page.getByRole('heading',{name:'この日の宿題',exact:true}).waitFor();
  assert.equal(await page.getByLabel('見る日',{exact:true}).inputValue(),'2026-10-20');
  await page.locator('.task button').click();await page.locator('.stamp').waitFor();
  assert.equal(calls.filter(c=>c.body).at(-1).day,'2026-10-20');
  await page.getByRole('button',{name:'夜のじゅんび',exact:true}).click();
  await page.getByRole('heading',{name:'この日のもちもの（夜）',exact:true}).waitFor();
  assert.equal(await page.getByLabel('見る日',{exact:true}).inputValue(),'2026-10-20');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.getByRole('heading',{name:'この日のもちもの（夜）',exact:true}).waitFor();
  await page.getByRole('button',{name:'宿題',exact:true}).click();await page.locator('.stamp').waitFor();
  await page.locator('.stamp').click();await page.locator('.task button[aria-pressed=false]').waitFor();
  assert.equal(calls.filter(c=>c.body).at(-1).body.done,false);
  await page.getByLabel('見る日',{exact:true}).fill('2026-10-22');
  await page.waitForFunction(()=>document.querySelector('.task button')?.disabled);
  await page.getByRole('button',{name:'今日',exact:true}).click();
  await page.getByRole('heading',{name:'きょうの宿題',exact:true}).waitFor();
  assert.ok(await page.locator('.task button').isEnabled());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const box=await page.getByRole('button',{name:'前の日',exact:true}).boundingBox();assert.ok(box.height>=44);
 }
 admin=true;await page.reload();await page.getByText('内容を登録・変更（保護者）',{exact:true}).waitFor();
 assert.ok(await page.locator('.task button').isDisabled());
 assert.deepEqual(errors,[]);
 console.log('PASS: child date picker, previous/today/next, past completion/undo, phase/background date persistence, future guard, guardian controls and 390/768/1280 layouts.');
}finally{await browser.close();}
