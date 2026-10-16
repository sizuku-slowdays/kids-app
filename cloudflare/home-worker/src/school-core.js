export function check(ok, message, status=400) { if(!ok) throw Object.assign(new Error(message),{status}); }
export function jstDay(now=new Date()) { return new Date(now.getTime()+32400000).toISOString().slice(0,10); }
export function validDay(s) {
 return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
}
export function id(s) { return typeof s==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(s); }
export function validatePlan(b) {
 check(validDay(b.day)&&Number.isInteger(b.expected_revision)&&b.expected_revision>=0,'日付・版を確認してください');
 check(typeof b.is_school_day==='boolean','登校日か確認してください');
 check(b.dismissal===null || (typeof b.dismissal==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(b.dismissal)),'下校時刻を確認してください');
 check(Array.isArray(b.tasks)&&b.tasks.length<=80,'項目は80件までです');
 const seen=new Set();
 return b.tasks.map(t=>{
  check(id(t.id)&&!seen.has(t.id),'項目IDを確認してください');seen.add(t.id);
  check(['homework','belonging'].includes(t.kind),'項目の種類を確認してください');
  check(typeof t.text==='string'&&t.text.trim().length>0&&t.text.length<=200,'項目名は1〜200文字です');
  return {id:t.id,kind:t.kind,text:t.text.trim()};
 });
}
export function taskPhaseAllowed(task,phase) {return task.kind==='homework'?phase==='homework':['night','morning'].includes(phase);}
