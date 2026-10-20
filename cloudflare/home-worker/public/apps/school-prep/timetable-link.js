// Authenticated school data only; the legacy timetable image/store is untouched.
const params=new URL(location.href).searchParams,base=new URL('./',import.meta.url),apiBase=new URL('../../api/school-prep',base);
const panel=document.createElement('section');panel.className='card';panel.style.margin='14px 0';panel.setAttribute('aria-label','学校じゅんび');
const anchor=document.querySelector('.week-tabs');if(anchor)anchor.after(panel);else document.querySelector('main')?.append(panel);
let household=params.get('household')||'',child=params.get('child')||'',day=params.get('day')||new Date(Date.now()+32400000).toISOString().slice(0,10),generation=0;
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function monday(d){const v=new Date(d+'T12:00:00Z');v.setUTCDate(v.getUTCDate()-(v.getUTCDay()+6)%7);return v.toISOString().slice(0,10);}
async function request(week){const url=new URL(apiBase);if(week){url.pathname+='/week';url.searchParams.set('week',week);}for(const [k,v] of Object.entries({household,child,day}))if(v)url.searchParams.set(k,v);const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error(r.status===401?'HOMEにログインすると宿題を確認できます。':'このアカウントでは学校じゅんびを利用できません。');if(!(r.headers.get('Content-Type')||'').includes('application/json'))throw Error('HOMEから開き直してください。');return r.json();}
async function render(){const token=++generation;panel.replaceChildren(node('h2','🎒 学校じゅんび'),node('p','宿題をよみこみ中…'));try{
 const state=await request();if(token!==generation)return;household=state.household_id;child=state.selected||'';day=state.day;
 if(!child){panel.replaceChildren(node('p','HOMEで子どものアカウントを連携してください。'));return;}
 const week=await request(monday(day));if(token!==generation)return;
 panel.replaceChildren(node('h2','🎒 この週の宿題'));
 const controls=node('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:10px;align-items:center';
 function picker(items,value,label,onchange){const select=node('select');select.setAttribute('aria-label',label);select.style.cssText='font:inherit;min-height:44px;max-width:100%;padding:8px';for(const item of items){const o=node('option',item.name);o.value=item.id;select.append(o);}select.value=value;select.onchange=()=>onchange(select.value);controls.append(select);}
 if(state.groups.length>1)picker(state.groups,household,'家庭',value=>{household=value;child='';render();});
 picker(state.children.map(c=>({id:c.id,name:c.display_name})),child,'子ども',value=>{child=value;render();});
 const input=node('input');input.type='date';input.value=day;input.setAttribute('aria-label','宿題の対象日');input.style.cssText='font:inherit;min-height:44px;max-width:100%';input.onchange=()=>{if(input.value){day=input.value;render();}};controls.append(input);panel.append(controls);
 panel.append(node('p','宿題の対象週：'+week.week+'〜'+week.days.at(-1).day+'（画像の週・学年とは別にご確認ください）'));
 for(const item of week.days){const box=node('details'),summary=node('summary',new Date(item.day+'T12:00:00Z').toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'})+(item.revision&&!item.is_school_day?'・お休み':''));summary.style.cssText='min-height:44px;line-height:44px;cursor:pointer';box.append(summary);box.open=item.day===day;
 const tasks=item.tasks.filter(t=>t.kind==='homework');if(!tasks.length)box.append(node('p',item.revision?'宿題の登録なし':'まだ登録されていません'));
 for(const task of tasks)box.append(node('p',(item.checks.some(c=>c.task_id===task.id&&c.phase==='homework'&&c.done)?'✓ ':'・')+task.text));panel.append(box);}
 const target=new URL('./',base);for(const [k,v] of Object.entries({household,child,day}))target.searchParams.set(k,v);const link=node('a',state.admin?'学校じゅんびで入力・週まとめ登録をする':'学校じゅんびで確認・チェックする');link.href=target.href;link.style.cssText='display:inline-block;min-height:44px;padding:12px 0';panel.append(link);
 }catch(e){if(token!==generation)return;panel.replaceChildren(node('p',e.message));const a=node('a','我が家HOMEへ');a.href=new URL('../../',base).href;panel.append(a);}}
render();
