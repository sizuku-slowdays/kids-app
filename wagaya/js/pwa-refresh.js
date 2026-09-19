(() => {
  const button=document.getElementById('refreshApp');
  const status=document.getElementById('refreshStatus');
  if(!button)return;
  button.addEventListener('click',async()=>{
    button.disabled=true;
    if(status)status.textContent='最新版を確認しています…';
    try{
      if('serviceWorker' in navigator){
        const regs=await navigator.serviceWorker.getRegistrations();
        for(const reg of regs){
          if(reg.scope.includes('/wagaya/')){try{await reg.update()}catch(e){}}
        }
      }
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('wagaya-shell-')).map(k=>caches.delete(k)));
      if(status)status.textContent='更新しました。画面を読み直します…';
      location.reload();
    }catch(e){
      button.disabled=false;
      if(status)status.textContent='更新できませんでした。もう一度押してみてください。';
    }
  });
})();