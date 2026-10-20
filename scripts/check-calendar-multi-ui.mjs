// Synthetic data only; no requests reach production.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.WAGAYA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.WAGAYA_CHROMIUM_EXECUTABLE?{executablePath:process.env.WAGAYA_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}: {})});
try{
 const page=await browser.newPage(),errors=[],saved=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const users=[{id:'mom',name:'テスト保護者',age_kind:'adult'},{id:'child',name:'テストの子',age_kind:'child'},{id:'peer',name:'テスト家族',age_kind:'adult'}];
 const calendar={id:'c',name:'テスト共有',is_shared:1,owner_google_id:'home:mom',can_post:true,participants:users,notification_users:users,notification_protocol:'home-v1',event_options_protocol:'multi-v1'};
 const groups=[{id:'h',name:'テスト家庭',kind:'household',role:'owner'}];
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());let data;
  if(u.pathname==='/api/calendar/home/status')data={profile:{google_id:'home:mom'},user:{id:'mom',display_name:'テスト保護者'},groups,admin:false,household_id:'h',privacy_version:'20261005-owner-ics',acl_version:'20261011-participants-v1',notification_protocol:'home-v1',event_options_protocol:'multi-v1'};
  else if(u.pathname==='/api/calendar/family/me')data={google_id:'home:mom',display_name:'テスト保護者',role:'member'};
  else if(u.pathname==='/api/calendar/sharing')data={groups,users};
  else if(u.pathname==='/api/calendar/calendars')data=[calendar];
  else if(u.pathname.startsWith('/api/calendar/events')&&['POST','PUT'].includes(req.method())){saved.push(req.postDataJSON());data={id:'new'};}
  else if(u.pathname.startsWith('/api/calendar/'))data=[];
  if(data!==undefined){await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;}
  if(u.pathname==='/calendar.html')await route.fulfill({contentType:'text/html',body:await readFile(new URL('../cloudflare/home-worker/public/calendar.html',import.meta.url),'utf8')});else await route.fulfill({body:''});
 });
 for(const width of [390,768,1280]){
  await page.setViewportSize({width,height:900});await page.goto('https://test.invalid/calendar.html');await page.locator('#app').waitFor({state:'visible'});await page.waitForFunction(()=>typeof calendars!=='undefined'&&calendars.length===1);
  await page.evaluate(()=>openEvModal(null,'2026-11-02'));
  await page.locator('#ev-title').fill('テストの予定');await page.locator('#ev-notify input[data-minutes="30"]').check();await page.locator('#ev-notify input[data-minutes="1440"]').check();
  assert.equal(await page.locator('#ev-notify-none').isChecked(),false);
  await page.locator('#ev-subject input[value="mom"]').check();await page.locator('#ev-subject input[value="child"]').check();await page.locator('#ev-audience').selectOption('members');await page.evaluate(()=>toggleAudience());await page.locator('#ev-members input[value="mom"]').check();
  assert.equal(await page.locator('#ev-notify-recipient option[value="home:child"]').count(),0,'subject selection must not expand viewers or recipients');
  const before=saved.length;await page.evaluate(()=>saveEvent());await page.waitForFunction(()=>!document.getElementById('ev-overlay').classList.contains('open'));
  assert.equal(saved.length,before+1);assert.deepEqual(saved.at(-1).notify_befores,[30,1440]);assert.deepEqual(saved.at(-1).visibility.subject_user_ids,['mom','child']);assert.deepEqual(saved.at(-1).visibility.members,['mom']);
  await page.evaluate(()=>openEvModal({id:'old',title:'既存の単一設定',calendar_id:'c',notify_before:5,notification_recipient:'home-all',start_datetime:'2026-11-02T09:00',end_datetime:'2026-11-02T10:00',visibility:{audience:'inherit',members:[],subject_user_id:'peer'}},null));
  assert.equal(await page.locator('#ev-notify input[data-minutes="5"]').isChecked(),true);assert.equal(await page.locator('#ev-subject input[value="peer"]').isChecked(),true);assert.equal(await page.locator('#ev-subject input:checked').count(),1);
  await page.locator('#ev-notify-none').check();assert.equal(await page.locator('#ev-notify input[data-minutes]:checked').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal page overflow');
  const targets=await page.locator('#ev-notify label,#ev-subject label').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));assert.ok(targets.every(h=>h>=44),'touch targets at least 44px');
 }
 assert.deepEqual(errors,[]);console.log('PASS: multiple timings and subjects, visibility separation, legacy edit, clear notifications, 44px choices and 390/768/1280 layouts.');
}finally{await browser.close();}
