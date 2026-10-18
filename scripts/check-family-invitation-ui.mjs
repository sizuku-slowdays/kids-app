// Optional browser QA: install Playwright, or set WAGAYA_PLAYWRIGHT_MODULE to its module path.
// All names, invitations, sessions and registrations in this test are synthetic.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.WAGAYA_PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.WAGAYA_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process']}: {})});
try{
 const page=await browser.newPage();const errors=[],registrations=[];let logged=true,logoutStatus=200,accepted=0,logouts=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://test.invalid/**',async route=>{
  const u=new URL(route.request().url());let data;
  if(u.pathname==='/api/me'){
   if(!logged){await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'ログインしてください'})});return;}
   data={user:{display_name:'テストの既存利用者'},groups:[]};
  }else if(u.pathname==='/api/logout'){
   logouts++;if(logoutStatus<500)logged=false;
   await route.fulfill({status:logoutStatus,contentType:'application/json',body:JSON.stringify(logoutStatus===200?{ok:true}:{error:'テスト用の失敗'})});return;
  }else if(u.pathname==='/api/families/preview')data={purpose:'create_family',expires_at:9999999999};
  else if(u.pathname==='/api/families/inspect')data={purpose:'create_family',group:null};
  else if(u.pathname==='/api/families/accept'){accepted++;data={group_id:'test-group'};}
  else if(u.pathname==='/api/register-family'){registrations.push(route.request().postDataJSON());data={ok:true};}
  else if(u.pathname==='/api/families')data={groups:[],ready:false,can_create_family_invite:false};
  else if(u.pathname==='/api/families/invitations')data=[];
  if(data!==undefined){await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});return;}
  const file=u.pathname.endsWith('.js')?'app.js':u.pathname.endsWith('.css')?'style.css':'index.html';
  await route.fulfill({contentType:file.endsWith('js')?'application/javascript':file.endsWith('css')?'text/css':'text/html',body:await readFile(new URL('../cloudflare/home-worker/public/'+file,import.meta.url),'utf8')});
 });
 const token='a'.repeat(64),url='https://test.invalid/join#'+token;
 const open=async()=>{await page.goto(url);await page.reload();};
 for(const width of [390,768,1280]){
  logged=true;logoutStatus=200;await page.setViewportSize({width,height:844});await open();
  await page.getByText('テストの既存利用者 さんとして参加します。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'別のアカウントで登録・ログイン',exact:true}).click();
  await page.getByRole('heading',{name:'アカウントがない方：新しく登録',exact:true}).waitFor();
  assert.equal(page.url(),url,'invitation remains in fragment');assert.equal(accepted,0,'switching never consumes invitation');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'width '+width);
  const ids=await page.locator('input').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(new Set(ids).size,ids.length,'login and registration fields have distinct IDs');
  assert.ok((await page.getByRole('heading',{name:'アカウントがない方：新しく登録',exact:true}).boundingBox()).y<(await page.getByRole('heading',{name:'アカウントをお持ちの方',exact:true}).boundingBox()).y);
 }
 // An expired session must still reveal registration without navigating away from the invitation.
 logged=true;logoutStatus=401;await open();await page.getByRole('button',{name:'別のアカウントで登録・ログイン',exact:true}).click();await page.getByRole('button',{name:'登録して参加する',exact:true}).waitFor();assert.equal(page.url(),url);
 // A failed logout must never pretend that a different account is in use.
 logged=true;logoutStatus=500;await open();await page.getByRole('button',{name:'別のアカウントで登録・ログイン',exact:true}).click();await page.getByText('ログアウトできませんでした。もう一度お試しください',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'登録して参加する',exact:true}).count(),0);assert.equal(accepted,0);
 // New registration submits only the new person's values and the same invitation.
 logged=false;logoutStatus=200;await open();
 await page.getByLabel('表示する名前',{exact:true}).fill('テスト新規利用者');
 await page.getByLabel('ログインID（英数字・_・-、3〜40文字）',{exact:true}).fill('new-person');
 await page.getByLabel('パスワード（10文字以上）',{exact:true}).fill('test-password-123');
 await page.getByLabel('新しいファミリー名',{exact:true}).fill('テスト家庭');
 await page.getByLabel('招待を受けてアカウントを作成します',{exact:true}).check();
 await page.getByRole('button',{name:'登録して参加する',exact:true}).click();await page.waitForURL('https://test.invalid/groups');
 assert.equal(registrations.length,1);assert.equal(registrations[0].invitation,token);assert.equal(registrations[0].login_name,'new-person');assert.equal(registrations[0].display_name,'テスト新規利用者');assert.equal(accepted,0);assert.equal(logouts,5);assert.deepEqual(errors,[]);
 console.log('PASS: signed-in account switch, expired/failed logout, preserved invitation, distinct form labels, new registration and 390/768/1280 widths. Synthetic data only.');
}finally{await browser.close();}
