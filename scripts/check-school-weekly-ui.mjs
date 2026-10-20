// Synthetic browser QA only. No requests reach the live HOME or Cloudflare.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.WAGAYA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.WAGAYA_CHROMIUM_EXECUTABLE?{executablePath:process.env.WAGAYA_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}: {})});
const root=new URL('../cloudflare/home-worker/public/apps/school-prep/',import.meta.url);
try{
 const page=await browser.newPage();const errors=[],saved=[],templates=[];let labels=[],revision=0,admin=true;
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
 const days=dates.map((day,i)=>({day,revision:i===0?1:0,is_school_day:true,dismissal:null,tasks:i===0?[{id:'existing',kind:'homework',text:'登録済み'}]:[],checks:i===0?[{task_id:'existing',phase:'homework',done:1}]:[]}));
 await page.route('https://test.invalid/**',async route=>{
  const req=route.request(),u=new URL(req.url());let data;
  if(u.pathname.includes('/api/school-prep')){
   if(u.pathname.endsWith('/template')&&req.method()==='PUT'){const b=req.postDataJSON();labels=b.labels.map(s=>s.replace(/[：:]$/,''));revision++;templates.push(b);data={ok:true,labels,revision};}
   else if(u.pathname.endsWith('/week')){if(req.method()==='POST'){saved.push(req.postDataJSON());data={ok:true,saved_days:2};}else data={week:dates[0],days,template:{labels,revision}};}
   else data={admin,groups:[{id:'h',name:'テスト家庭'}],household_id:'h',children:admin?[{id:'c',display_name:'テストの子'},{id:'c2',display_name:'別の子'}]:[{id:'c',display_name:'テストの子'}],selected:u.searchParams.get('child')||'c',today:dates[1],next_school_day:dates[2],day:u.searchParams.get('day')||dates[1],plan:null,checks:[],days:[],summary:{completed:0,school_days:0},notifications:[],notify_enabled:false,template:{labels,revision}};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;
  }
  if(u.pathname==='/wagaya/timetable.html'){await route.fulfill({contentType:'text/html',body:'<main><div class="week-tabs"></div><section class="card">legacy timetable image stays here</section></main><script type="module" src="/wagaya/apps/school-prep/timetable-link.js"></script>'});return;}
  const name=u.pathname.split('/').at(-1)||'index.html';
  await route.fulfill({contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body:await readFile(new URL(name,root),'utf8')});
 });
 const url='https://test.invalid/wagaya/apps/school-prep/?household=h&child=c&day=2026-10-20';
 await page.goto(url);await page.getByText('テストの子',{exact:true}).first().waitFor({state:'attached'});
 assert.equal(await page.locator('[data-daily-homework]').inputValue(),'','no hardcoded shared template');
 const template=page.locator('details').filter({has:page.locator('summary', {hasText:'宿題テンプレート'})});await template.locator('summary').click();
 for(const value of ['音読','かん字','さんすう']){await template.getByRole('button',{name:'＋ 項目を追加',exact:true}).click();await template.locator('input').last().fill(value);}
 await template.getByRole('button',{name:'項目 3 を上へ',exact:true}).click();await template.getByRole('button',{name:'テンプレートを保存',exact:true}).click();
 await page.getByText('この子のテンプレートを保存しました。次の新規入力から使います。',{exact:true}).waitFor();assert.deepEqual(templates[0].labels,['音読','さんすう','かん字']);
 await page.reload();await page.locator('[data-daily-homework]').waitFor();assert.equal(await page.locator('[data-daily-homework]').inputValue(),'音読：\nさんすう：\nかん字：');
 await page.locator('[data-daily-homework]').fill('音読：当日のみ');assert.deepEqual(labels,['音読','さんすう','かん字']);
 const weekly=page.locator('details').filter({has:page.locator('summary',{hasText:'1週間分の宿題をまとめて登録'})});await weekly.locator('summary').click();
 await weekly.getByLabel('文字起こしした1週間分の文章',{exact:true}).fill('連絡事項は未分類\n月曜日（19日）\n漢字：10ページ\n火曜日（20日）\n音読：教科書');await weekly.getByRole('button',{name:'曜日に分けて確認する',exact:true}).click();await weekly.locator('.week-day').last().waitFor();
 assert.equal(await weekly.locator('.week-day select').first().inputValue(),'skip');assert.equal(await weekly.getByLabel('未分類（ここに残した文章は保存しません）',{exact:true}).inputValue(),'連絡事項は未分類');
 await weekly.locator('.week-day select').first().selectOption('append');await weekly.getByRole('button',{name:'確認した日をまとめて保存',exact:true}).click();await page.getByText('未分類の文章を日別欄へ移すか、登録しないことを確認してください',{exact:true}).waitFor();assert.equal(saved.length,0);
 await weekly.getByLabel('残った未分類の文章は登録しないことを確認しました',{exact:true}).check();await weekly.getByRole('button',{name:'確認した日をまとめて保存',exact:true}).click();await page.getByText('週まとめ登録：2日分を保存しました。変更のない日はそのままです。',{exact:true}).waitFor();
 assert.equal(saved.length,1);assert.equal(saved[0].days[0].action,'append');assert.equal(saved[0].days[1].day,'2026-10-20');assert.deepEqual(saved[0].days[1].homework,['音読：教科書']);
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:844});await page.reload();await page.locator('[data-daily-homework]').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');}
 admin=false;await page.reload();await page.getByRole('heading',{name:'きょうの宿題',exact:true}).waitFor();assert.equal(await page.getByText('別の子',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'テンプレートを保存',exact:true}).count(),0);assert.equal(await page.getByText('1週間分の宿題をまとめて登録',{exact:true}).count(),0);
 await page.goto('https://test.invalid/wagaya/timetable.html?household=h&child=c&day=2026-10-20');await page.getByRole('heading',{name:'🎒 この週の宿題',exact:true}).waitFor();assert.ok(await page.getByText('legacy timetable image stays here',{exact:true}).isVisible());const link=await page.getByRole('link',{name:'学校じゅんびで確認・チェックする',exact:true}).getAttribute('href');assert.match(link,/child=c/);assert.match(link,/day=2026-10-20/);
 assert.deepEqual(errors,[]);console.log('PASS: per-child template editing/order, daily isolation, weekly preview/diff/unclassified gate, explicit save, child controls, timetable context and 390/768/1280 layouts. Synthetic data only.');
}finally{await browser.close();}
