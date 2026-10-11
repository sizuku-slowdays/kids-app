export function relationLabel(people, relations, basisId, targetId) {
 relations=familyRelations(relations);
 if(basisId===targetId)return 'わたし';
 const byId=new Map(people.map(p=>[p.id,p])),basis=byId.get(basisId),target=byId.get(targetId);if(!basis||!target)return '親せき';
 const parents=id=>relations.filter(r=>['biological_parent','adoptive_parent'].includes(r.kind)&&r.to_person===id).map(r=>r.from_person);
 const older=()=>Number.isInteger(basis.birth_order)&&Number.isInteger(target.birth_order)&&basis.birth_order!==target.birth_order?(target.birth_order<basis.birth_order?'older':'younger'):/^\d{4}-\d{2}-\d{2}$/.test(basis.birth_date)&&/^\d{4}-\d{2}-\d{2}$/.test(target.birth_date)&&basis.birth_date!==target.birth_date?(target.birth_date<basis.birth_date?'older':'younger'):null;
 const sibling=()=>{const age=older();if(!age)return 'きょうだい';return target.gender==='female'?(age==='older'?'お姉ちゃん':'妹'):target.gender==='male'?(age==='older'?'お兄ちゃん':'弟'):(age==='older'?'年上のきょうだい':'年下のきょうだい');};
 if(relations.some(r=>r.kind==='sibling'&&[r.from_person,r.to_person].includes(basisId)&&[r.from_person,r.to_person].includes(targetId))||parents(basisId).some(p=>parents(targetId).includes(p)))return sibling();
 const parentPeople=parents(basisId).map(id=>byId.get(id)).filter(Boolean);
 const isSibling=(a,b)=>a!==b&&(relations.some(r=>r.kind==='sibling'&&[r.from_person,r.to_person].includes(a)&&[r.from_person,r.to_person].includes(b))||parents(a).some(id=>parents(b).includes(id)));
 const auntUncle=(relative,gender)=>{const parent=parentPeople.find(p=>isSibling(p.id,relative.id));if(!parent)return null;const order=compareBirthOrder(parent,relative);const read=gender==='female'?'おば':gender==='male'?'おじ':null;if(!read)return '親のきょうだい';if(order===null)return read+'（年上・年下は未設定）';return (order<0?(gender==='female'?'伯母':'伯父'):(gender==='female'?'叔母':'叔父'))+'（'+read+'）';};
 const bloodAuntUncle=auntUncle(target,target.gender);if(bloodAuntUncle)return bloodAuntUncle;
 for(const r of relations)if(['marriage','partnership'].includes(r.kind)&&r.status==='current'&&[r.from_person,r.to_person].includes(targetId)){const partner=byId.get(r.from_person===targetId?r.to_person:r.from_person);const label=partner&&auntUncle(partner,target.gender);if(label)return label;}
 const direct=relations.find(r=>['marriage','partnership'].includes(r.kind)&&[r.from_person,r.to_person].includes(basisId)&&[r.from_person,r.to_person].includes(targetId));if(direct){if(direct.kind==='partnership')return direct.status==='current'?'パートナー':'以前のパートナー';const title=target.gender==='male'?'夫':target.gender==='female'?'妻':'配偶者';return direct.status==='current'?title:direct.status==='divorced'?'元'+title:'以前の'+title;}
 for(const r of relations)if(r.kind==='marriage'&&r.status==='current'&&[r.from_person,r.to_person].includes(targetId)){const partner=byId.get(r.from_person===targetId?r.to_person:r.from_person);if(partner&&isSibling(basisId,partner.id)){const order=compareBirthOrder(basis,partner);if(order===null)return target.gender==='male'?'きょうだいの夫':target.gender==='female'?'きょうだいの妻':'きょうだいの配偶者';if(target.gender==='male')return order<0?'義兄（ぎけい）':'義弟（ぎてい）';if(target.gender==='female')return order<0?'義姉（ぎし）':'義妹（ぎまい）';return 'きょうだいの配偶者';}}
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
export function treeLayout(people,relations,centerId,radius=4){
 relations=familyRelations(relations);
 const adjacent=new Map();const edge=(a,b,delta)=>adjacent.set(a,[...(adjacent.get(a)||[]),{id:b,delta}]);
 for(const r of relations){const parent=['biological_parent','adoptive_parent','guardian'].includes(r.kind);edge(r.from_person,r.to_person,parent?1:0);edge(r.to_person,r.from_person,parent?-1:0);}
 const levels=new Map([[centerId,0]]),dist=new Map([[centerId,0]]),queue=[centerId];while(queue.length){const id=queue.shift();for(const next of adjacent.get(id)||[])if(!levels.has(next.id)&&dist.get(id)<radius){levels.set(next.id,levels.get(id)+next.delta);dist.set(next.id,dist.get(id)+1);queue.push(next.id);}}
 if(radius===Infinity)for(const p of people)if(!levels.has(p.id))levels.set(p.id,0);
 const groups=new Map();for(const p of people)if(levels.has(p.id))groups.set(levels.get(p.id),[...(groups.get(levels.get(p.id))||[]),p]);const lowest=Math.min(0,...groups.keys());
 const visible=new Set(people.filter(p=>levels.has(p.id)).map(p=>p.id)),positions=new Map(),nodes=[];
 const descendants=id=>[...new Set(relations.filter(r=>['biological_parent','adoptive_parent','guardian'].includes(r.kind)&&r.from_person===id&&visible.has(r.to_person)).map(r=>r.to_person))];
 const span=(id,seen=new Set())=>{if(seen.has(id))return 180;const next=new Set([...seen,id]),kids=descendants(id);return Math.max(180,kids.reduce((total,k)=>total+span(k,next),0)+Math.max(0,kids.length-1)*36);};
 for(const level of [...groups.keys()].sort((a,b)=>a-b)){
 const list=sortSiblingPeople(groups.get(level),relations),roots=new Map(list.map(p=>[p.id,p.id]));
 const root=id=>{while(roots.get(id)!==id)id=roots.get(id);return id;},join=(a,b)=>{if(roots.has(a)&&roots.has(b))roots.set(root(b),root(a));},firstChild=new Map();
 for(const r of relations){if(r.kind==='sibling'||['marriage','partnership'].includes(r.kind)&&r.status==='current')join(r.from_person,r.to_person);if(['biological_parent','adoptive_parent','guardian'].includes(r.kind)&&roots.has(r.to_person)){const old=firstChild.get(r.from_person);if(old)join(old,r.to_person);else firstChild.set(r.from_person,r.to_person);}}
 const units=new Map();for(const p of list){const key=root(p.id);if(!units.has(key))units.set(key,[]);units.get(key).push(p);}
 const ordered=[...units.values()].map(members=>{const parents=[...new Set(relations.filter(r=>['biological_parent','adoptive_parent','guardian'].includes(r.kind)&&members.some(p=>p.id===r.to_person)&&positions.has(r.from_person)).map(r=>r.from_person))];const anchor=parents.length?parents.reduce((s,id)=>s+positions.get(id),0)/parents.length:null;return {members,anchor};}).sort((a,b)=>(a.anchor??Infinity)-(b.anchor??Infinity));
 let cursor=30;
 for(const {members,anchor}of ordered){const sizes=members.map(p=>span(p.id)),total=sizes.reduce((a,b)=>a+b,0)+(members.length-1)*36;let left=Math.max(cursor,anchor===null?cursor:anchor-total/2);for(let i=0;i<members.length;i++){const p=members[i],x=left+sizes[i]/2;positions.set(p.id,x);nodes.push({...p,x,y:60+(level-lowest)*170});left+=sizes[i]+36;}cursor=left+84;}
 }
 const width=Math.max(650,...nodes.map(p=>p.x+110));return {nodes,width,height:(Math.max(0,...groups.keys())-lowest+1)*170+80};
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
 const result=[...people];for(const group of groups.values()){const sorted=group.map(x=>x.p).sort((a,b)=>{const ao=Number.isInteger(a.birth_order)?a.birth_order:null,bo=Number.isInteger(b.birth_order)?b.birth_order:null;if(ao!==null&&bo!==null&&ao!==bo)return ao-bo;const ad=/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(a.birth_date||'')?a.birth_date:null,bd=/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(b.birth_date||'')?b.birth_date:null;if(ad&&bd&&ad!==bd)return ad.localeCompare(bd);return 0;});group.forEach((x,i)=>result[x.i]=sorted[i]);}return coupleOrder(result,relations);
}

export function familyRelations(relations){
 const siblingRoots=new Map();const root=id=>{if(!siblingRoots.has(id))siblingRoots.set(id,id);while(siblingRoots.get(id)!==id)id=siblingRoots.get(id);return id;};
 for(const r of relations)if(r.kind==='sibling')siblingRoots.set(root(r.to_person),root(r.from_person));
 const siblings=new Map();for(const id of siblingRoots.keys()){const key=root(id);if(!siblings.has(key))siblings.set(key,[]);siblings.get(key).push(id);}
 const result=[...relations],keys=new Set(relations.map(r=>r.kind+':'+r.from_person+':'+r.to_person));
 for(const r of relations)if(['biological_parent','adoptive_parent'].includes(r.kind)&&siblingRoots.has(r.to_person)){for(const child of siblings.get(root(r.to_person))||[]){const key=r.kind+':'+r.from_person+':'+child;if(child!==r.from_person&&!keys.has(key)){keys.add(key);result.push({...r,id:'inferred-'+r.id+'-'+child,to_person:child,inferred:true});}}}
 return result;
}

export function coupleOrder(people,relations){
 const byId=new Map(people.map(p=>[p.id,p])),partners=new Map();
 for(const r of relations)if(['marriage','partnership'].includes(r.kind)&&r.status==='current'&&byId.has(r.from_person)&&byId.has(r.to_person)){partners.set(r.from_person,[...(partners.get(r.from_person)||[]),r.to_person]);partners.set(r.to_person,[...(partners.get(r.to_person)||[]),r.from_person]);}
 const added=new Set(),result=[];for(const p of people){if(added.has(p.id))continue;result.push(p);added.add(p.id);for(const id of partners.get(p.id)||[])if(!added.has(id)){result.push(byId.get(id));added.add(id);}}
 return result;
}

export function compareBirthOrder(reference,target){
 if(Number.isInteger(reference.birth_order)&&Number.isInteger(target.birth_order)&&reference.birth_order!==target.birth_order)return target.birth_order-reference.birth_order;
 const a=reference.birth_date||'',b=target.birth_date||'';
 if(/^\d{4}/.test(a)&&/^\d{4}/.test(b)&&a.slice(0,4)!==b.slice(0,4))return b.slice(0,4)<a.slice(0,4)?-1:1;
 if(/^\d{4}-\d{2}-\d{2}$/.test(a)&&/^\d{4}-\d{2}-\d{2}$/.test(b)&&a!==b)return b<a?-1:1;
 return null;
}
