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
