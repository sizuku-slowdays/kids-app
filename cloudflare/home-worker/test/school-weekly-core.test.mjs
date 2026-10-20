import test from 'node:test';
import assert from 'node:assert/strict';
import {mondayOf,weekDays,parseWeekText,homeworkLines,reconcileTasks} from '../public/apps/school-prep/weekly-core.js';
test('weekday parser: prose, markdown, dates, ambiguous dates and weekends',()=>{
 const week='2026-10-19';assert.equal(mondayOf('2026-10-23'),week);assert.equal(weekDays('2026-12-28')[4],'2027-01-01');
 const a=parseWeekText('連絡事項\n## 月曜日\n漢字：p10\n計算：p2\n火曜：音読\n（水） 宿題3\n木：算数\n金\n音読\n土曜：割り当てない',week);
 assert.equal(a.days[0].text,'漢字：p10\n計算：p2');assert.equal(a.days[1].text,'音読');assert.equal(a.days[2].text,'宿題3');assert.equal(a.days[3].text,'算数');assert.equal(a.days[4].text,'音読');assert.match(a.unclassified,/連絡事項/);assert.match(a.unclassified,/割り当てない/);
 const b=parseWeekText('| 曜日 | 宿題 |\n|---|---|\n| 月 | 国語 |\n| 火 | 算数 |',week);assert.equal(b.days[0].text,'国語');assert.equal(b.days[1].text,'算数');
 const c=parseWeekText('10/19(月)：合っている\n10/20(月)：日付矛盾\n後続も未分類\n10/21\n勝手に水曜にしない\n10/23(金)：金曜',week);assert.equal(c.days[0].text,'合っている');assert.equal(c.days[4].text,'金曜');assert.match(c.unclassified,/後続も未分類/);assert.match(c.unclassified,/勝手に/);
 assert.equal(parseWeekText('2025/10/19(月)：別年',week).days[0].text,'');
 assert.deepEqual(homeworkLines('自由課題：\n自由課題：工作\nかん字：\n音読',['自由課題','かん字']),['自由課題：工作','音読']);
});
test('task reconciliation preserves stable IDs, belongings and duplicate occurrence counts',()=>{
 const old=[{id:'a',kind:'homework',text:'A'},{id:'b',kind:'homework',text:'B'},{id:'bag',kind:'belonging',text:'bag'}];let id=0;
 assert.deepEqual(reconcileTasks(old,['A','B'],'append',()=>String(id++)),old);
 const replace=reconcileTasks(old,['B','C'],'replace',()=>String(id++));assert.equal(replace[0].id,'b');assert.equal(replace[2].id,'bag');assert.notEqual(replace[1].id,'a');
 assert.equal(reconcileTasks(old,['A','A'],'append',()=>String(id++)).length,4);
});
