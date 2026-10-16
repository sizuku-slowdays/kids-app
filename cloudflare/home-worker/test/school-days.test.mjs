import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSchoolDay} from '../src/school-core.js';
test('school days: weekends, explicit classes and holidays',()=>{
 assert.equal(nextSchoolDay('2026-10-16'),'2026-10-19');
 assert.equal(nextSchoolDay('2026-10-17'),'2026-10-19');
 assert.equal(nextSchoolDay('2026-10-19'),'2026-10-20');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-17',is_school_day:1}]),'2026-10-17');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-19',is_school_day:0}]),'2026-10-20');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-22',is_school_day:1}]),'2026-10-19');
});
