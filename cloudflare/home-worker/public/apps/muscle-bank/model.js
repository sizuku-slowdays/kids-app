export const PARTS=['😊 顔・首','💪 腕・肩','🫃 お腹・腰','🍑 お尻','🦵 脚','🦶 足首','🧘 全身'];
export const TAGS=['座ったまま','立ったまま','寝ながら','1分以内','静かにできる','停車中にできる'];
export const dayKey=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const totalPoints=s=>s.records.reduce((n,r)=>n+r.points,0);
export const monthStats=(s,month)=>{const rs=s.records.filter(r=>r.day.startsWith(month));return {days:new Set(rs.map(r=>r.day)).size,points:rs.reduce((n,r)=>n+r.points,0),total:totalPoints(s)}};
export const rewardStatus=(s,r)=>({muscle:totalPoints(s)>=r.required,money:r.price===null?null:s.fund.balance>=r.price});
export const initialState=()=>({version:1,exercises:[],records:[],changes:[],rewards:[{id:'game-fund-goal',name:'Switch 2＋ゲーム同梱版',image:'',price:null,required:500,desire:'とてもほしい',memo:'ゲーム基金の目標。発売予定は自分で確認して追記。',release:''}],fund:{start:'2026-09',initial:2013,balance:2013,target:2000},updatedAt:new Date().toISOString()});
export function validateState(s){
 const num=(v)=>Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
 const str=(v,max=2000)=>typeof v==='string'&&v.length<=max;
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&dayKey(new Date(v+'T03:00:00Z'))===v;
 const image=v=>str(v,2200000)&&(!v||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v));
 if(!s||s.version!==1||!['exercises','records','changes','rewards'].every(k=>Array.isArray(s[k])&&s[k].length<=10000))throw Error('筋肉貯金のバックアップファイルではありません。');
 for(const k of ['exercises','records','changes','rewards']){const ids=new Set();for(const x of s[k]){if(!x||!str(x.id,100)||ids.has(x.id))throw Error('記録IDが不正です。');ids.add(x.id)}}
 if(!s.fund||!['initial','balance','target'].every(k=>num(s.fund[k]))||!/^\d{4}-(0[1-9]|1[0-2])$/.test(s.fund.start))throw Error('資金の設定が不正です。');
 if(s.todayShuffle!==undefined&&(!s.todayShuffle||!date(s.todayShuffle.day)||!num(s.todayShuffle.round)))throw Error('今日の運動の設定が不正です。');
 for(const e of s.exercises)if(!str(e.name,100)||!e.name.trim()||!str(e.description)||!str(e.dose,100)||!num(e.points)||!PARTS.includes(e.part)||!Array.isArray(e.tags)||!e.tags.every(t=>TAGS.includes(t))||!str(e.url,2000)||!(!e.url||/^https?:\/\//.test(e.url))||!image(e.image)||(e.images!==undefined&&(!Array.isArray(e.images)||e.images.length>10||!e.images.every(v=>image(v)&&v)))||typeof e.today!=='boolean'||typeof e.learned!=='boolean')throw Error('運動データが不正です。');
 for(const r of s.records)if(!date(r.day)||!num(r.points)||!str(r.name,100)||!str(r.exerciseId,100)||!str(r.dose,100)||!str(r.createdAt,100))throw Error('運動記録が不正です。');
 for(const r of s.rewards)if(!str(r.name,100)||!r.name.trim()||!num(r.required)||!(r.price===null||num(r.price))||!image(r.image)||!str(r.memo)||!str(r.desire,100)||!(r.release===''||date(r.release)))throw Error('ごほうびデータが不正です。');
 for(const c of s.changes)if(!date(c.day)||!str(c.memo)||!str(c.waist,100)||!str(c.weight,100)||!image(c.image))throw Error('変化の記録が不正です。');
 return s;
}

// A stable daily draw keeps the menu unchanged while recording or reopening the app.
// Cycling the daily shuffled deck guarantees a different selection when there are >3.
export function todayExercises(state,day=dayKey()){
 const deck=state.exercises.slice().sort((a,b)=>a.id.localeCompare(b.id));
 let seed=2166136261;for(const c of day+'|'+deck.map(e=>e.id).join('|'))seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
 const offset=state.todayShuffle?.day===day?state.todayShuffle.round%Math.max(1,deck.length):0;
 return deck.slice(offset).concat(deck.slice(0,offset)).slice(0,3);
}
