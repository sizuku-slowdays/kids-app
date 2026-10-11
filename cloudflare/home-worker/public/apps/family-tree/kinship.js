export function relationLabel(people, relations, basisId, targetId) {
 if(basisId===targetId)return 'わたし';
 const byId=new Map(people.map(p=>[p.id,p])),basis=byId.get(basisId),target=byId.get(targetId);if(!basis||!target)return '親せき';
 const parents=id=>relations.filter(r=>['biological_parent','adoptive_parent'].includes(r.kind)&&r.to_person===id).map(r=>r.from_person);
 const older=()=>Number.isInteger(basis.birth_order)&&Number.isInteger(target.birth_order)&&basis.birth_order!==target.birth_order?(target.birth_order<basis.birth_order?'older':'younger'):/^\d{4}-\d{2}-\d{2}$/.test(basis.birth_date)&&/^\d{4}-\d{2}-\d{2}$/.test(target.birth_date)&&basis.birth_date!==target.birth_date?(target.birth_date<basis.birth_date?'older':'younger'):null;
 const sibling=()=>{const age=older();if(!age)return 'きょうだい';return target.gender==='female'?(age==='older'?'お姉ちゃん':'妹'):target.gender==='male'?(age==='older'?'お兄ちゃん':'弟'):(age==='older'?'年上のきょうだい':'年下のきょうだい');};
 if(relations.some(r=>r.kind==='sibling'&&[r.from_person,r.to_person].includes(basisId)&&[r.from_person,r.to_person].includes(targetId))||parents(basisId).some(p=>parents(targetId).includes(p)))return sibling();
 const direct=relations.find(r=>['marriage','partnership'].includes(r.kind)&&[r.from_person,r.to_person].includes(basisId)&&[r.from_person,r.to_person].includes(targetId));if(direct)return direct.status==='current'?'パートナー':'以前のパートナー';
 const graph=new Map();const add=(a,b,code)=>graph.set(a,[...(graph.get(a)||[]),{id:b,code}]);
 for(const r of relations)if(['biological_parent','adoptive_parent'].includes(r.kind)){add(r.from_person,r.to_person,'D');add(r.to_person,r.from_person,'U');}
 const seen=new Set([basisId]),queue=[{id:basisId,path:''}];let route='';
 while(queue.length){const step=queue.shift();if(step.id===targetId){route=step.path;break;}for(const n of graph.get(step.id)||[])if(!seen.has(n.id)){seen.add(n.id);queue.push({id:n.id,path:step.path+n.code});}}
 const female=target.gender==='female',male=target.gender==='male';
 if(route==='U')return female?'お母さん':male?'お父さん':'親';
 if(route==='D')return '子ども';
 if(route==='UD')return sibling();
 if(route==='UU')return female?'おばあちゃん':male?'おじいちゃん':'祖父母';
 if(route==='DD')return 'まご';
 if(route==='UUD')return female?'おば':male?'おじ':'親のきょうだい';
 if(route==='UDD')return female?'めい':male?'おい':'きょうだいの子';
 if(route==='UUDD')return 'いとこ';
 if(/^U{3,}$/.test(route))return `${route.length}世代上の親せき`;
 if(/^D{3,}$/.test(route))return `${route.length}世代下の親せき`;
 if(relations.some(r=>r.kind==='guardian'&&r.from_person===targetId&&r.to_person===basisId))return '育ててくれる人';
 if(relations.some(r=>['marriage','partnership'].includes(r.kind)&&r.status==='current'&&parents(basisId).includes(r.from_person)&&r.to_person===targetId||['marriage','partnership'].includes(r.kind)&&r.status==='current'&&parents(basisId).includes(r.to_person)&&r.from_person===targetId))return '親のパートナー';
 return '親せき';
}
export function treeLayout(people,relations,centerId,radius=2){
 const adjacent=new Map();const edge=(a,b,delta)=>adjacent.set(a,[...(adjacent.get(a)||[]),{id:b,delta}]);
 for(const r of relations){const parent=['biological_parent','adoptive_parent','guardian'].includes(r.kind);edge(r.from_person,r.to_person,parent?1:0);edge(r.to_person,r.from_person,parent?-1:0);}
 const levels=new Map([[centerId,0]]),dist=new Map([[centerId,0]]),queue=[centerId];while(queue.length){const id=queue.shift();for(const next of adjacent.get(id)||[])if(!levels.has(next.id)&&dist.get(id)<radius){levels.set(next.id,levels.get(id)+next.delta);dist.set(next.id,dist.get(id)+1);queue.push(next.id);}}
 if(radius===Infinity)for(const p of people)if(!levels.has(p.id))levels.set(p.id,0);
 const groups=new Map();for(const p of people)if(levels.has(p.id))groups.set(levels.get(p.id),[...(groups.get(levels.get(p.id))||[]),p]);const lowest=Math.min(0,...groups.keys()),widest=Math.max(1,...[...groups.values()].map(g=>g.length));const width=Math.max(650,widest*180+60);
 const nodes=[];for(const [level,list]of groups)sortSiblingPeople(list,relations).forEach((p,i)=>nodes.push({...p,x:width/2+(i-(list.length-1)/2)*180,y:60+(level-lowest)*160}));return {nodes,width,height:(Math.max(0,...groups.keys())-lowest+1)*160+80};
}

export function ageLabel(person, today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(person.birth_date||''))return '';
 const end=person.death_date||today;if(!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<person.birth_date)return '';
 const age=Number(end.slice(0,4))-Number(person.birth_date.slice(0,4))-(end.slice(5)<person.birth_date.slice(5)?1:0);
 return (person.death_date?'亡くなったとき ':'')+age+'歳';
}
export function sortSiblingPeople(people,relations){
 const roots=new Map(people.map(p=>[p.id,p.id]));const root=id=>{while(roots.get(id)!==id)id=roots.get(id);return id;};
 const join=(a,b)=>{if(roots.has(a)&&roots.has(b))roots.set(root(b),root(a));};const children=new Map();
 for(const r of relations){if(r.kind==='sibling')join(r.from_person,r.to_person);if(['biological_parent','adoptive_parent'].includes(r.kind)){const prior=children.get(r.from_person);if(prior)join(prior,r.to_person);else children.set(r.from_person,r.to_person);}}
 const groups=new Map();people.forEach((p,i)=>{const key=root(p.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({p,i});});
 const result=[...people];for(const group of groups.values()){const sorted=group.map(x=>x.p).sort((a,b)=>{const ao=Number.isInteger(a.birth_order)?a.birth_order:null,bo=Number.isInteger(b.birth_order)?b.birth_order:null;if(ao!==null&&bo!==null&&ao!==bo)return ao-bo;const ad=/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(a.birth_date||'')?a.birth_date:null,bd=/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(b.birth_date||'')?b.birth_date:null;if(ad&&bd&&ad!==bd)return ad.localeCompare(bd);return 0;});group.forEach((x,i)=>result[x.i]=sorted[i]);}return result;
}
