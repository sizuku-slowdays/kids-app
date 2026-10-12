import test from 'node:test';import assert from 'node:assert/strict';import {relationLabel,treeLayout} from '../public/apps/family-tree/kinship.js';
test('relationship labels follow the logged-in person without assuming missing birthdays or generations',()=>{
 const people=[{id:'mom',gender:'female',birth_date:'1980-01-01'},{id:'older',gender:'female',birth_date:'2014-02-01'},{id:'younger',gender:'female',birth_date:'2016-02-01'},{id:'dad',gender:'male'},{id:'newdad',gender:'male'}];const relations=[{from_person:'mom',to_person:'older',kind:'biological_parent'},{from_person:'mom',to_person:'younger',kind:'adoptive_parent'},{from_person:'mom',to_person:'dad',kind:'marriage',status:'divorced'},{from_person:'mom',to_person:'newdad',kind:'marriage',status:'current'}];
 assert.equal(relationLabel(people,relations,'mom','older'),'子ども');assert.equal(relationLabel(people,relations,'older','mom'),'お母さん');assert.equal(relationLabel(people,relations,'older','younger'),'妹');assert.equal(relationLabel(people,relations,'younger','older'),'お姉ちゃん');assert.equal(relationLabel(people.map(p=>({...p,birth_date:''})),relations,'older','younger'),'きょうだい');assert.equal(relationLabel(people,relations,'mom','dad'),'元夫');assert.equal(relationLabel(people,relations,'older','newdad'),'親のパートナー');
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

test('aunts and uncles use kanji with readings and distinguish older relatives from younger ones',async()=>{
 const {relationLabel}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'child'},{id:'mom',gender:'female',birth_order:3},{id:'older-man',gender:'male',birth_order:1},{id:'older-woman',gender:'female',birth_order:2},{id:'younger-man',gender:'male',birth_order:4},{id:'younger-woman',gender:'female',birth_order:5},{id:'unknown',gender:'male'},{id:'wife',gender:'female'}];
 const relations=[{from_person:'mom',to_person:'child',kind:'biological_parent'},...people.slice(2,7).map(p=>({from_person:'mom',to_person:p.id,kind:'sibling'})),{from_person:'older-man',to_person:'wife',kind:'marriage',status:'current'}];
 for(const [id,want]of [['older-man','伯父（おじ）'],['older-woman','伯母（おば）'],['younger-man','叔父（おじ）'],['younger-woman','叔母（おば）'],['unknown','おじ（年上・年下は未設定）'],['wife','伯母（おば）']])assert.equal(relationLabel(people,relations,'child',id),want);
 const dated=people.map(p=>({...p,birth_order:null,birth_date:p.id==='mom'?'1984-09-01':p.id==='older-man'?'1980-01-01':p.id==='younger-man'?'1987-01-01':''}));
 assert.equal(relationLabel(dated,relations,'child','older-man'),'伯父（おじ）');assert.equal(relationLabel(dated,relations,'child','younger-man'),'叔父（おじ）');
});

test('marriages show husband or wife and sibling spouses use in-law labels',async()=>{
 const {relationLabel}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'me',birth_order:2},{id:'sister',gender:'female',birth_order:3},{id:'sister-husband',gender:'male'},{id:'brother',gender:'male',birth_order:1},{id:'brother-wife',gender:'female'}];
 const relations=[{from_person:'me',to_person:'sister',kind:'sibling'},{from_person:'me',to_person:'brother',kind:'sibling'},{from_person:'sister',to_person:'sister-husband',kind:'marriage',status:'current'},{from_person:'brother',to_person:'brother-wife',kind:'marriage',status:'current'}];
 assert.equal(relationLabel(people,relations,'sister','sister-husband'),'夫');
 assert.equal(relationLabel(people,relations,'sister-husband','sister'),'妻');
 assert.equal(relationLabel(people,relations,'me','sister-husband'),'義弟（ぎてい）');
 assert.equal(relationLabel(people,relations,'me','brother-wife'),'義姉（ぎし）');
 const partners=relations.map(r=>r.kind==='marriage'?{...r,kind:'partnership'}:r);assert.equal(relationLabel(people,partners,'sister','sister-husband'),'パートナー');
 const divorced=relations.map(r=>({...r,status:'divorced'}));assert.equal(relationLabel(people,divorced,'sister','sister-husband'),'元夫');
});

test('editing parents cannot move older siblings behind their spouses',async()=>{
 const {treeLayout,sortSiblingPeople}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'brother',birth_order:1},{id:'mom',birth_order:2},{id:'sister',birth_order:3},{id:'brother-wife'},{id:'mom-husband'},{id:'sister-husband'},{id:'grandpa'},{id:'grandma'}];
 const byId=new Map(people.map(p=>[p.id,p]));
 const relations=[...['brother','mom','sister'].flatMap(id=>['grandpa','grandma'].map(parent=>({from_person:parent,to_person:id,kind:'biological_parent'}))),...['brother','mom','sister'].map((id,i)=>({from_person:id,to_person:['brother-wife','mom-husband','sister-husband'][i],kind:'marriage',status:'current'}))];
 const want=['brother','brother-wife','mom','mom-husband','sister','sister-husband'];
 const inputs=[want,[...want].reverse(),['mom-husband','sister-husband','brother-wife','mom','sister','brother'],['sister','mom','brother-wife','mom-husband','sister-husband','brother']];
 for(const ids of inputs){const row=ids.map(id=>byId.get(id));assert.deepEqual(sortSiblingPeople(row,relations).map(p=>p.id),want);const layout=treeLayout([...row,byId.get('grandpa'),byId.get('grandma')],relations,'mom');const level=layout.nodes.find(p=>p.id==='mom').y;assert.deepEqual(layout.nodes.filter(p=>p.y===level).sort((a,b)=>a.x-b.x).map(p=>p.id),want);}
});


test('couples stay close when three grown children have households of different sizes',()=>{
 const people=[{id:'grandpa'},{id:'grandma'},{id:'brother',birth_order:1},{id:'mom',birth_order:2},{id:'sister',birth_order:3},{id:'brother-wife'},{id:'mom-husband'},{id:'sister-husband'}];
 const relations=[{from_person:'grandpa',to_person:'grandma',kind:'marriage',status:'current'}];
 for(const [adult,partner,count] of [['brother','brother-wife',1],['mom','mom-husband',2],['sister','sister-husband',3]]){
  for(const parent of ['grandpa','grandma'])relations.push({from_person:parent,to_person:adult,kind:'biological_parent'});
  relations.push({from_person:adult,to_person:partner,kind:'marriage',status:'current'});
  for(let i=0;i<count;i++){const id=adult+'-child-'+i;people.push({id,birth_order:i+1});for(const parent of [adult,partner])relations.push({from_person:parent,to_person:id,kind:'biological_parent'});}
 }
 const snapshot=JSON.stringify({people,relations});
 for(const input of [people,[...people].reverse()])for(const basis of ['grandpa','grandma','mom','brother','sister','mom-child-0']){
  const layout=treeLayout(input,relations,basis,Infinity),nodes=new Map(layout.nodes.map(n=>[n.id,n]));
  assert.equal(nodes.size,people.length);
  for(const [a,b]of [['grandpa','grandma'],['brother','brother-wife'],['mom','mom-husband'],['sister','sister-husband']]){
   assert.equal(nodes.get(a).y,nodes.get(b).y);const gap=Math.abs(nodes.get(a).x-nodes.get(b).x);assert.ok(gap>=150&&gap<=216,'couple '+a+' gap '+gap);
  }
  assert.ok(nodes.get('brother').x<nodes.get('mom').x);assert.ok(nodes.get('mom').x<nodes.get('sister').x);
  for(const y of new Set(layout.nodes.map(n=>n.y))){const row=layout.nodes.filter(n=>n.y===y).sort((a,b)=>a.x-b.x);for(let i=1;i<row.length;i++)assert.ok(row[i].x-row[i-1].x>=150);}
  assert.ok(nodes.get('brother-child-0').x<nodes.get('mom-child-0').x);assert.ok(nodes.get('mom-child-1').x<nodes.get('sister-child-0').x);
 }
 assert.equal(JSON.stringify({people,relations}),snapshot);
});



test('registered co-parents share descendant space without assuming or adding a marriage',async()=>{
 const {parentLayoutPairs}=await import('../public/apps/family-tree/kinship.js');
 const people=[{id:'gp'},{id:'gm'},{id:'old',birth_order:1},{id:'middle',birth_order:2},{id:'young',birth_order:3}];
 const relations=[];
 for(const [id,count]of [['old',1],['middle',2],['young',3]]){
  people.push({id:id+'-spouse'});relations.push({from_person:id,to_person:id+'-spouse',kind:'marriage',status:'current'});
  for(const parent of ['gp','gm'])relations.push({from_person:parent,to_person:id,kind:'biological_parent'});
  for(let i=0;i<count;i++){people.push({id:id+'-kid-'+i,birth_order:i+1});for(const parent of [id,id+'-spouse'])relations.push({from_person:parent,to_person:id+'-kid-'+i,kind:'biological_parent'});}
 }
 const original=JSON.stringify({people,relations});
 assert.ok(parentLayoutPairs(people,relations).some(pair=>pair.includes('gp')&&pair.includes('gm')));
 for(const input of [people,[...people].reverse()])for(const basis of ['gp','gm','old','middle','young','middle-kid-0']){
  const layout=treeLayout(input,relations,basis,Infinity),byId=new Map(layout.nodes.map(p=>[p.id,p]));
  assert.equal(Math.abs(byId.get('gp').x-byId.get('gm').x),180);assert.equal(byId.get('gp').y,byId.get('gm').y);
  assert.ok(byId.get('old').x<byId.get('middle').x&&byId.get('middle').x<byId.get('young').x);
  for(const y of new Set(layout.nodes.map(n=>n.y))){const row=layout.nodes.filter(n=>n.y===y).sort((a,b)=>a.x-b.x);for(let i=1;i<row.length;i++)assert.ok(row[i].x-row[i-1].x>=150);}
 }
 assert.equal(JSON.stringify({people,relations}),original);
 const divorced=[...relations,{from_person:'gp',to_person:'gm',kind:'marriage',status:'divorced'}];assert.equal(parentLayoutPairs(people,divorced).some(p=>p.includes('gp')),false);
 const remarried=[...relations,{from_person:'gp',to_person:'old-spouse',kind:'marriage',status:'current'}];assert.equal(parentLayoutPairs(people,remarried).some(p=>p.includes('gp')),false);
 const ambiguous=[...people,{id:'third-parent'}],three=[...relations,...['old','middle','young'].map(id=>({from_person:'third-parent',to_person:id,kind:'adoptive_parent'}))];assert.equal(parentLayoutPairs(ambiguous,three).some(p=>p.includes('gp')),false);
 assert.deepEqual(parentLayoutPairs([{id:'a'},{id:'b'},{id:'c'}],[{from_person:'a',to_person:'c',kind:'guardian'},{from_person:'b',to_person:'c',kind:'guardian'}]),[]);
});
