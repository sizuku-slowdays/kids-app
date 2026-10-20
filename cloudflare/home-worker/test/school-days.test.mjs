import test from 'node:test';
import assert from 'node:assert/strict';
import {nextSchoolDay,schoolCheckDayAllowed} from '../src/school-core.js';
test('school days: weekends, explicit classes and holidays',()=>{
 assert.equal(nextSchoolDay('2026-10-16'),'2026-10-19');
 assert.equal(nextSchoolDay('2026-10-17'),'2026-10-19');
 assert.equal(nextSchoolDay('2026-10-19'),'2026-10-20');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-17',is_school_day:1}]),'2026-10-17');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-19',is_school_day:0}]),'2026-10-20');
 assert.equal(nextSchoolDay('2026-10-16',[{school_day:'2026-10-22',is_school_day:1}]),'2026-10-19');
});

test('school checks: past days allowed; current and future phase limits remain',()=>{
 for(const phase of ['homework','morning','night'])assert.equal(schoolCheckDayAllowed('2026-10-20',phase,'2026-10-21','2026-10-22'),true);
 assert.equal(schoolCheckDayAllowed('2026-10-21','homework','2026-10-21','2026-10-22'),true);
 assert.equal(schoolCheckDayAllowed('2026-10-21','night','2026-10-21','2026-10-22'),false);
 assert.equal(schoolCheckDayAllowed('2026-10-22','night','2026-10-21','2026-10-22'),true);
 for(const phase of ['homework','morning'])assert.equal(schoolCheckDayAllowed('2026-10-22',phase,'2026-10-21','2026-10-22'),false);
 assert.equal(schoolCheckDayAllowed('2026-10-23','night','2026-10-21','2026-10-22'),false);
 assert.equal(schoolCheckDayAllowed('2026-02-30','homework','2026-10-21','2026-10-22'),false);
});
