const byId = id => document.getElementById(id);
const message = byId('message');
const embedded = Boolean(document.getElementById('osekkai-center'));
const selectedEvent = new URL(location.href).searchParams.get('event');
let recipientKey = '';
let editing = null;

function node(tag, value, cls) {
  const element = document.createElement(tag);
  if (value != null) element.textContent = value;
  if (cls) element.className = cls;
  return element;
}
function link(label, href) {
  const a = node('a',label);
  a.href = href;
  return a;
}
function action(label, run) {
  const control = node('button',label);
  control.type = 'button';
  control.onclick = async () => {
    control.disabled = true;
    message.textContent = '';
    try { await run(); }
    catch (e) { message.textContent = e.message; }
    finally { control.disabled = false; }
  };
  return control;
}
async function request(suffix = '', method = 'GET', data) {
  const response = await fetch('/api/osekkai'+suffix,{
    method,cache:'no-store',
    ...(data && {headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),
  });
  if(response.status===401) throw new Error('我が家の保護者アカウントでログインしてください。');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '接続を確認してください');
  return result;
}
function speaker(face,name,character) {
  const content = node('p',null,'speaker');
  const kind=character||({'ぴよまる':'chick','ぷんすけ':'ogre','ねむりぐも':'cloud','ぷるりん':'slime'}[name])||'chick';
  const mood=/🎉/.test(face)?'celebrate':/♨️/.test(face)?'steam':/💢/.test(face)?'angry':/👺/.test(face)?'impatient':'calm';
  const portrait = node('span',null,'face face-'+kind+' mood-'+mood);
  portrait.setAttribute('aria-hidden','true');
  for(const part of ['eyes','mouth','accent','steam'])portrait.append(node('span',null,'portrait-'+part));
  content.append(portrait,node('strong',name));
  return content;
}
function invitation(e) {
  const card = node('article',null,'invitation');
  const details = e.day+' ・ '+e.label+(e.test?' ・ テスト':'');
  card.append(speaker(e.face,e.name,e.character),node('small',details),node('p',e.text,'bubble'));
  if (e.reply) card.append(speaker(e.reply.face,e.reply.name),node('p',e.reply.text,'bubble'));
  if (e.status !== 'open') {
    card.append(node('small',{done:'できた！',declined:'今日はおしまい',old:'報告なし'}[e.status]));
    return card;
  }
  const buttons = node('div',null,'action-row');
  const respond = (label,value) => action(label,async()=>{
    const medicationConfirmed=e.medication && value==='done';
    if(medicationConfirmed&&!confirm('お薬を飲んだことを確認しましたか？'))return;
    await request('/respond','POST',{id:e.id,action:value,medication_confirmed:medicationConfirmed});
    await render();
    if (value === 'later') message.textContent = 'あとでまた声をかけるね。';
  });
  if(e.canOpen) buttons.append(link('する','/apps/osekkai/open?event='+e.id));
  buttons.append(respond('あとで','later'));
  if(e.canDecline) buttons.append(respond('しない','decline'));
  buttons.append(respond(e.medication?'服薬を確認した':'できた！','done'));
  card.append(buttons);
  return card;
}
function select(options,value) {
  const field = node('select');
  for(const [key,label] of options) field.append(Object.assign(node('option',label),{value:key}));
  field.value = String(value);
  return field;
}
function labeled(container,title,input) {
  const label = node('label',null,input.type==='checkbox'?'osekkai-check':'osekkai-field');
  label.append(node('span',title),input);
  container.append(label);
  return input;
}
const charactersByTarget = {homework:'ogre',medicine:'slime',bedtime:'cloud'};
function formFor(data,people,rule) {
  const person=people[0];
  const form = node('form',null,'osekkai-rule-form');
  form.append(node('h3',rule?person.name+'の通知を編集':people.length>1?'姉妹ふたりに通知を追加':'通知を追加'));
  const target = labeled(form,'HOMEアプリ',select(data.targets.map(x=>[x.id,x.label]),rule?.target||'homework'));
  const actor = labeled(form,'キャラクター',select(data.actors.map(x=>[x.id,x.face+' '+x.name]),rule?.character||'ogre'));
  const start = labeled(form,'通知時刻（日本時間）',Object.assign(node('input'),{type:'time',required:true,value:rule?.time||'19:00'}));
  const days = node('fieldset'), dayList=node('div',null,'days');
  const weekdays = rule?JSON.parse(rule.weekdays):[1,2,3,4,5];
  const checks = [...'日月火水木金土'].map((name,id)=>labeled(dayList,name,Object.assign(node('input'),{type:'checkbox',value:id,checked:weekdays.includes(id)})));
  days.append(node('legend','曜日'),dayList);form.append(days);
  const intensity = labeled(form,'おせっかい度',select([[0,'ひかえめ'],[1,'ふつう'],[2,'うざいｗ']],rule?.intensity??1));
  const retries = labeled(form,'再通知の回数',select([[0,'0回'],[1,'1回'],[2,'2回'],[3,'3回']],rule?.retries??1));
  const interval = labeled(form,'再通知の間隔（分）',Object.assign(node('input'),{type:'number',min:10,max:120,required:true,value:rule?.interval_min??15}));
  const mode = labeled(form,'完了条件',select([['report','「できた！」で報告'],['medication','本人が服薬を確認して報告']],rule?.confirmation||'report'));
  const challenge = labeled(form,'お題・難易度（通知用）',Object.assign(node('input'),{type:'text',maxLength:30,value:rule?.challenge??'',placeholder:'例：7の段'}));
  const enabled = labeled(form,'通知を有効にする',Object.assign(node('input'),{type:'checkbox',checked:rule?!!rule.enabled:true}));
  const guardian = labeled(form,'最後まで報告がなければ、自分の端末に通知する',Object.assign(node('input'),{type:'checkbox',checked:!!rule?.guardian_id}));
  const preview = node('div',null,'osekkai-preview');
  function showPreview() {
    const character = data.actors.find(c=>c.id===actor.value);
    const app = data.targets.find(t=>t.id===target.value);
    const isMedicine = target.value==='medicine';
    guardian.parentElement.hidden = target.value!=='homework';
    mode.options[1].disabled = !isMedicine;
    if (!isMedicine) mode.value='report';
    challenge.parentElement.hidden = !['kuku','words','mental','five'].includes(target.value);
    preview.replaceChildren(speaker(character.face,character.name,character.id),node('p',app.label+'のお知らせ'+(challenge.parentElement.hidden||!challenge.value?'':' ・ '+challenge.value),'bubble'));
  }
  target.onchange = ()=>{
    actor.value=charactersByTarget[target.value]||'chick';
    if(!rule&&target.value==='bedtime'){start.value='19:45';retries.value='0';}
    showPreview();
  };
  actor.onchange=challenge.oninput=showPreview;
  showPreview();
  const save = node('button','保存');
  const formActions=node('div',null,'osekkai-form-actions');
  form.append(preview);
  formActions.append(action('セリフをプレビュー',async()=>{
    const sample=await request('/preview','POST',{household_id:person.household_id,target:target.value,character:actor.value,
      challenge:challenge.value,confirmation:mode.value});
    preview.replaceChildren(speaker(sample.face,sample.name,actor.value),node('p',sample.text,'bubble'));
  }),save);
  form.append(formActions);
  if (rule) formActions.append(action('編集を閉じる',async()=>{editing=null;await render();}));
  form.onsubmit = async event=>{
    event.preventDefault();
    save.disabled=true;
    try {
      const selected = checks.filter(x=>x.checked).map(x=>Number(x.value));
      if (!selected.length) throw new Error('曜日を1つ以上選んでください。');
      await request('/rules','POST',{
        id:rule?.id,household_id:person.household_id,recipient_id:person.id,...(!rule&&people.length>1?{recipient_ids:people.map(p=>p.id)}:{}),
        target:target.value,character:actor.value,time:start.value,weekdays:selected,
        intensity:Number(intensity.value),retries:Number(retries.value),interval_min:Number(interval.value),
        confirmation:mode.value,challenge:challenge.parentElement.hidden?'':challenge.value,enabled:enabled.checked,notify_guardian:!guardian.parentElement.hidden&&guardian.checked,
      });
      editing=null;await render();message.textContent=people.length>1?'選んだ子ども全員に保存しました。':'保存しました。';
    }catch(e){message.textContent=e.message;}finally{save.disabled=false;}
  };
  return form;
}
function guardianSettings(data) {
  const section=node('section');
  section.append(node('h2','保護者の通知設定'));
  const key = p=>p.household_id+'/'+p.id;
  const choices=data.recipients.map(p=>({key:key(p),label:p.name,people:[p]}));
  for(const house of new Set(data.recipients.map(p=>p.household_id))){
    const people=data.recipients.filter(p=>p.household_id===house);
    if(people.length===2) choices.push({key:'both:'+house,label:'👭 姉妹ふたり',people});
  }
  if(!choices.some(c=>c.key===recipientKey)) recipientKey=choices[0].key;
  const selected=choices.find(c=>c.key===recipientKey);
  const receiver=node('div',null,'osekkai-recipient-picker');
  receiver.append(node('strong','だれに送る？'));
  const buttons=node('div',null,'osekkai-recipient-buttons');
  for(const choice of choices){
    const icon=choice.people.length===1?(choice.label.includes('長女')?'🐒 ':choice.label.includes('次女')?'🦄 ':'👤 '):'';
    const button=action(icon+choice.label,async()=>{recipientKey=choice.key;editing=null;section.replaceWith(guardianSettings(data));});
    button.setAttribute('aria-pressed',String(choice.key===recipientKey));buttons.append(button);
  }
  receiver.append(buttons);section.append(receiver);
  const own=data.rules.filter(r=>selected.people.some(p=>p.id===r.recipient_id&&p.household_id===r.household_id));
  for(const r of own) {
    const person=selected.people.find(p=>p.id===r.recipient_id&&p.household_id===r.household_id);
    const card=node('article',null,'invitation');
    const app=data.targets.find(t=>t.id===r.target);
    const char=data.actors.find(c=>c.id===r.character);
    card.append(node('h3',char.face+' '+app.label+' ・ '+r.time),node('small',person.name+' ・ '+(r.enabled?'通知中':'一時停止中')));
    const controls=node('div',null,'action-row');
    const ids={id:r.id,recipient_id:person.id,household_id:person.household_id};
    controls.append(action('編集',async()=>{editing=r.id;await render();}),action(r.enabled?'一時停止':'再開',async()=>{
      await request('/rules','POST',{...r,weekdays:JSON.parse(r.weekdays),enabled:!r.enabled,notify_guardian:!!r.guardian_id});await render();
    }),action('テスト通知',async()=>{
      await request('/rules','POST',{...ids,test:true});message.textContent='テスト通知を予約しました。届かない場合は子どものHOMEで確認できます。';
    }),action('削除',async()=>{
      if(!confirm('この通知設定を削除しますか？'))return;
      await request('/rules','DELETE',ids);editing=null;await render();
    }));
    card.append(controls);section.append(card);
  }
  const editRule=own.find(r=>r.id===editing);
  section.append(formFor(data,editRule?selected.people.filter(p=>p.id===editRule.recipient_id&&p.household_id===editRule.household_id):selected.people,editRule));
  return section;
}
async function render() {
  const data=await request();
  const invitations=byId('invitations'), settings=byId('settings');
  invitations.replaceChildren();settings.replaceChildren();
  if (data.child) {
    const section=node('section');
    const open=data.events.filter(e=>e.status==='open');
    const history=data.events.filter(e=>e.status!=='open');
    section.append(node('h2','いまのお誘い'));
    if(selectedEvent&&!data.events.some(e=>e.id===selectedEvent)) section.append(node('p','この通知は見られません。通知を受け取ったアカウントで開いてください。'));
    if(!open.length) section.append(node('p','いまはお誘いがないよ。'));
    open.sort((a,b)=>Number(b.id===selectedEvent)-Number(a.id===selectedEvent)).forEach(e=>section.append(invitation(e)));
    const past=node('details');past.append(node('summary','通知の履歴'));
    history.forEach(e=>past.append(invitation(e)));
    section.append(past);
    const state = !('Notification' in window)?'このブラウザーは通知に対応していません':{granted:'通知の許可あり',denied:'ブラウザーで通知がブロックされています',default:'通知の許可が未設定'}[Notification.permission];
    section.append(node('p',state),link('この端末の通知を登録・解除','/apps/notification/'));
    invitations.append(section);
  }
  if(data.recipients.length) settings.append(guardianSettings(data));
  if(embedded&&!data.child&&!data.recipients.length) invitations.append(node('p','設定するには我が家の保護者アカウントでログインしてください。'));
  else if(!data.child&&!data.recipients.length) invitations.append(node('p','このアカウント向けのお知らせはありません。'));
}
if(embedded && location.hash==='#osekkai-center') document.getElementById('osekkai-center').open=true;
render().then(()=>{if(embedded) message.textContent='';}).catch(error=>message.textContent=error.message);
