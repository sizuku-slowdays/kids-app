/* Fixed expense templates are independent of spending categories. */
window.KakeiboFixed = {
  merge(a,b){
    const items=new Map();
    [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])].forEach(item=>{
      if(!item || !item.id)return;
      const old=items.get(item.id);
      if(!old || String(item.updatedAt||'')>=String(old.updatedAt||''))items.set(item.id,item);
    });
    return [...items.values()];
  },
  deleted(a,b){
    const items=new Map();
    [...(a||[]),...(b||[])].forEach(raw=>{
      const d=typeof raw==='string'?{id:raw,deletedAt:''}:raw;
      if(!d?.id)return;
      const old=items.get(d.id);
      if(!old||String(d.deletedAt||'')>=String(old.deletedAt||''))items.set(d.id,d);
    });
    return [...items.values()];
  },
  entries(cloud,local,deleted){
    const removed=new Set((deleted||[]).map(d=>typeof d==='string'?d:d.id));
    const items=new Map();
    [...(cloud||[]),...(local||[])].forEach(e=>{
      if(!e?.id||removed.has(e.id))return;
      const old=items.get(e.id);
      if(!old||(Date.parse(e.updatedAt||e.createdAt)||0)>=(Date.parse(old.updatedAt||old.createdAt)||0))items.set(e.id,e);
    });
    return [...items.values()];
  },
  plan(cloud,local){
    return {...(cloud||local||{}),fixedExpenses:this.merge(cloud?.fixedExpenses,local?.fixedExpenses)};
  },
  date(rule,base){
    if(rule.dateMode!=='monthly')return base;
    const [y,m]=base.split('-').map(Number);
    const day=Math.min(Math.max(1,Number(rule.day)||1),new Date(y,m,0).getDate());
    return base.slice(0,7)+'-'+String(day).padStart(2,'0');
  },
  entry(rule,base,stamp){
    const date=this.date(rule,base),month=date.slice(0,7);
    const credit=/pink|visa/i.test(rule.payment);
    const [y,m]=month.split('-').map(Number);
    const settle=new Date(y,m-1+(credit?1:0),1);
    return {id:'fixed-'+rule.id+'-'+month,fixedRuleId:rule.id,fixedMonth:month,
      date,type:'expense',amount:rule.amount,payment:rule.payment,category:rule.category,
      memo:rule.name,settleMonth:settle.getFullYear()+'-'+String(settle.getMonth()+1).padStart(2,'0'),
      createdAt:stamp,updatedAt:stamp};
  }
};
