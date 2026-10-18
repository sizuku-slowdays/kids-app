let currentUserId=null;const register=document.getElementById('register');
try{const r=await fetch('/api/me',{cache:'no-store'});if(!r.ok){location.replace('/login');}else{const me=await r.json();currentUserId=me.user.id;document.getElementById('person').textContent=me.user.display_name+' さんの通知';register.disabled=false;}}catch{document.getElementById('status').textContent='接続できませんでした。開き直してください';}
register.onclick=async()=>{register.disabled=true;try{await connectCalendarNotifications();}finally{register.disabled=false;}};
async function connectCalendarNotifications(){
 const message=document.getElementById('status');
 try{
  message.textContent='通知の登録を開始しています…';
  if(!('PushManager' in window)||!('serviceWorker' in navigator))throw new Error('iPhoneではHOMEをホーム画面に追加して開いてください');
  if(await Notification.requestPermission()!=='granted')throw new Error('この端末の通知を許可してください');
  const keyResponse=await fetch('/api/notifications/vapid-public-key');const config=await keyResponse.json();if(!keyResponse.ok)throw new Error((config.error||'通知の接続を確認してください')+'（通知キー取得・HTTP '+keyResponse.status+'）');
  if(config.user.id!==currentUserId)throw new Error('HOMEの利用者が変わりました。開き直してください');
  const mounted=location.pathname.startsWith('/wagaya/');const reg=await navigator.serviceWorker.register(mounted?'/wagaya/sw.js':'/apps/calendar/notify-sw.js',{scope:mounted?'/wagaya/':'/apps/calendar/' ,updateViaCache:'none'});
  message.textContent='通知の準備をしています…';
  if(!reg.active){const pending=reg.installing||reg.waiting;if(!pending)throw new Error('通知の準備ができません。開き直してください');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('通知の準備に時間がかかっています。開き直して再登録してください')),15000);const check=()=>{if(pending.state==='activated'){clearTimeout(timer);pending.removeEventListener('statechange',check);resolve();}else if(pending.state==='redundant'){clearTimeout(timer);pending.removeEventListener('statechange',check);reject(new Error('通知用ファイルを更新できませんでした'));}};pending.addEventListener('statechange',check);check();});}
  const raw=atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/'));const key=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});const data=sub.toJSON();
  message.textContent='この端末を登録しています…';
  const result=await fetch('/api/notifications/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,p256dh:data.keys.p256dh,auth:data.keys.auth})});const saved=await result.json();if(!result.ok)throw new Error((saved.error||'通知の登録に失敗しました')+'（端末登録・HTTP '+result.status+'）');
  message.textContent=saved.user.display_name+'として登録しました';
 }catch(e){message.textContent=e.message;}
}
