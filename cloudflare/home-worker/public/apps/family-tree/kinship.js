export function relationLabel(people, relations, basisId, targetId) {
 if(basisId===targetId)return 'わたし';
 const byId=new Map(people.map(p=>[p.id,p])),basis=byId.get(basisId),target=byId.get(targetId);if(!basis||!target)return '親せき';
 const parents=id=>relations.filter(r=>['biological_parent','adoptive_parent'].includes(r.kind)&&r.to_person===id).map(r=>r.from_person);
 const older=()=>/^\d{4}-\d{2}-\d{2}$/.test(basis.birth_date)&&/^\d{4}-\d{2}-\d{2}$/.test(target.birth_date)&&basis.birth_date!==target.birth_date?(target.birth_date<basis.birth_date?'older':'younger'):null;
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
 const nodes=[];for(const [level,list]of groups)list.forEach((p,i)=>nodes.push({...p,x:width/2+(i-(list.length-1)/2)*180,y:60+(level-lowest)*160}));return {nodes,width,height:(Math.max(0,...groups.keys())-lowest+1)*160+80};
}
