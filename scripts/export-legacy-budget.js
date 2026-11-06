// Run manually ONLY in the authenticated old app after a successful cloud refresh.
// Cache-only export: does not fetch, submit, erase, deploy or read cloud passwords.
(()=>{
 if(location.origin!=='https://cetus.fun'||!/^\/kanriapp\/kakeibo-(input|app|cashflow|plan|fixed-master)\.html$/.test(location.pathname))throw Error('利用中の旧家計簿で実行してください');
 const read=(key,fallback)=>JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));
 const entries=read('kakeibo-app-stable-v3',[]);if(!Array.isArray(entries))throw Error('旧取引データを確認してください');
 const snapshot={app:'kakeibo-app',version:6,entries,deletedIds:read('kakeibo-deleted-ids-v1',[]),plan:read('kakeibo-plan-v1',{}),categories:read('kakeibo-category-tree-v1',{}),exportInfo:{source:'local-cache-only',exportedAt:new Date().toISOString(),requiresCloudFreshnessConfirmation:true}};
 const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='kakeibo-migration-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);console.info('旧キャッシュの確認用JSONを保存しました。クラウドとの最新一致を確認してから取り込んでください。');
})();
