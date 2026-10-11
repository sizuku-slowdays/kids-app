import test from 'node:test';import assert from 'node:assert/strict';import {relationLabel,treeLayout} from '../public/apps/family-tree/kinship.js';
test('relationship labels follow the logged-in person without assuming missing birthdays or generations',()=>{
 const people=[{id:'mom',gender:'female',birth_date:'1980-01-01'},{id:'older',gender:'female',birth_date:'2014-02-01'},{id:'younger',gender:'female',birth_date:'2016-02-01'},{id:'dad',gender:'male'},{id:'newdad',gender:'male'}];const relations=[{from_person:'mom',to_person:'older',kind:'biological_parent'},{from_person:'mom',to_person:'younger',kind:'adoptive_parent'},{from_person:'mom',to_person:'dad',kind:'marriage',status:'divorced'},{from_person:'mom',to_person:'newdad',kind:'marriage',status:'current'}];
 assert.equal(relationLabel(people,relations,'mom','older'),'子ども');assert.equal(relationLabel(people,relations,'older','mom'),'お母さん');assert.equal(relationLabel(people,relations,'older','younger'),'妹');assert.equal(relationLabel(people,relations,'younger','older'),'お姉ちゃん');assert.equal(relationLabel(people.map(p=>({...p,birth_date:''})),relations,'older','younger'),'きょうだい');assert.equal(relationLabel(people,relations,'mom','dad'),'以前のパートナー');assert.equal(relationLabel(people,relations,'older','newdad'),'親のパートナー');
 const many=Array.from({length:20},(_,i)=>({id:'p'+i})),edges=many.slice(1).map((p,i)=>({from_person:many[i].id,to_person:p.id,kind:'biological_parent'}));assert.equal(treeLayout(many,edges,'p0',Infinity).nodes.length,20);assert.equal(treeLayout(many,edges,'p0',2).nodes.length,3);
});

test('ages change on the birthday and siblings sort by age or explicit order',async()=>{
 const {ageLabel,sortSiblingPeople}=await import('../public/apps/family-tree/kinship.js');
 assert.equal(ageLabel({birth_date:'2015-10-12'},'2026-10-11'),'10歳');
 assert.equal(ageLabel({birth_date:'2015-10-12'},'2026-10-12'),'11歳');
 assert.equal(ageLabel({birth_date:'2015'},'2026-10-12'),'');
 assert.equal(ageLabel({birth_date:'1950-01-01',death_date:'2020-01-01'},'2026-10-12'),'亡くなったとき 70歳');
 const siblings=[{id:'me',birth_date:'1984-09-01'},{id:'brother',birth_date:'1980-01-01'}];
 const relations=[{from_person:'parent',to_person:'me',kind:'biological_parent'},{from_person:'parent',to_person:'brother',kind:'biological_parent'}];
 assert.deepEqual(sortSiblingPeople(siblings,relations).map(p=>p.id),['brother','me']);
 assert.deepEqual(sortSiblingPeople([{id:'me',birth_order:2},{id:'brother',birth_order:1}],relations).map(p=>p.id),['brother','me']);
 assert.deepEqual(sortSiblingPeople(siblings,[]).map(p=>p.id),['me','brother']);
});

test('cousins remain visible and families have separate child branches from every viewpoint',async()=>{
 const {relationLabel,treeLayout,familyRelations}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'mom',gender:'female',birth_date:'1984-09-01'},{id:'brother',gender:'male',birth_date:'1980-01-01'},{id:'older',gender:'female',birth_date:'2015-01-01'},{id:'younger',gender:'female',birth_date:'2017-01-01'},{id:'cousin',birth_date:'2016-01-01'},{id:'grandma',gender:'female'},{id:'dad',gender:'male'}];
 const relations=[{id:'s',from_person:'mom',to_person:'brother',kind:'sibling',status:'current'},{id:'a',from_person:'mom',to_person:'older',kind:'biological_parent',status:'current'},{id:'b',from_person:'mom',to_person:'younger',kind:'biological_parent',status:'current'},{id:'c',from_person:'brother',to_person:'cousin',kind:'biological_parent',status:'current'},{id:'d',from_person:'grandma',to_person:'mom',kind:'biological_parent',status:'current'},{id:'e',from_person:'dad',to_person:'older',kind:'biological_parent',status:'current'},{id:'f',from_person:'dad',to_person:'younger',kind:'biological_parent',status:'current'}];
 assert.equal(relationLabel(people,relations,'older','cousin'),'いとこ');
 assert.equal(relationLabel(people,relations,'younger','cousin'),'いとこ');
 assert.equal(relationLabel(people,relations,'brother','grandma'),'お母さん');
 const source=JSON.stringify(relations);assert.ok(familyRelations(relations).some(r=>r.from_person==='grandma'&&r.to_person==='brother'&&r.inferred));assert.equal(JSON.stringify(relations),source);
 for(const basis of ['mom','older','younger','brother']){
  const layout=treeLayout(people,relations,basis);const nodes=new Map(layout.nodes.map(p=>[p.id,p]));
  assert.ok(nodes.has('cousin'));assert.ok(nodes.get('brother').x<nodes.get('mom').x);
  assert.ok(nodes.get('cousin').x<nodes.get('older').x);
  assert.ok(nodes.get('older').x<nodes.get('younger').x);
  assert.ok(nodes.get('older').x-nodes.get('cousin').x>180);
 }
});

test('current partners stay beside their sibling partners while divorced relations do not pair',async()=>{
 const {treeLayout,sortSiblingPeople}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'me',birth_order:1},{id:'sister',birth_order:2},{id:'husband'},{id:'sister-husband'}];
 const relations=[{id:'s',from_person:'me',to_person:'sister',kind:'sibling',status:'current'},{id:'m',from_person:'me',to_person:'husband',kind:'marriage',status:'current'},{id:'n',from_person:'sister',to_person:'sister-husband',kind:'marriage',status:'current'}];
 assert.deepEqual(sortSiblingPeople(people,relations).map(p=>p.id),['me','husband','sister','sister-husband']);
 for(const basis of ['me','sister','husband'])assert.deepEqual(treeLayout(people,relations,basis).nodes.sort((a,b)=>a.x-b.x).map(p=>p.id),['me','husband','sister','sister-husband']);
 const changed=relations.map(r=>r.id==='m'?{...r,status:'divorced'}:r);
 assert.deepEqual(sortSiblingPeople(people,changed).map(p=>p.id),['me','sister','sister-husband','husband']);
});
