import test from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {sanitizeImage} from '../src/images.js';
import {timeAllowed,validateSchedule,same,passwordHash} from '../src/security.js';
test('server-side JPEG/PNG decoding removes metadata and rejects unsafe files and dimensions',()=>{
 const raw=jpeg.encode({width:2,height:2,data:Buffer.alloc(16,255)},80).data;
 const metadata=Buffer.from('Exif\0\0private GPS and school location'),segment=Buffer.alloc(metadata.length+4);segment[0]=255;segment[1]=225;segment.writeUInt16BE(metadata.length+2,2);metadata.copy(segment,4);
 const malicious=Buffer.concat([raw.subarray(0,2),segment,raw.subarray(2),Buffer.from('<script>secret</script>')]);const normalized=sanitizeImage(malicious,'photo');assert.equal(normalized.width,2);assert.ok(!Buffer.from(normalized.bytes).includes(Buffer.from('private GPS')));assert.ok(!Buffer.from(normalized.bytes).includes(Buffer.from('<script>')));
 const png=PNG.sync.write({width:2,height:2,data:Buffer.alloc(16,100)});const p=sanitizeImage(png,'stamp');assert.equal(p.bytes[0],255);assert.equal(jpeg.decode(p.bytes).height,2);
 for(const bad of [Buffer.from('<svg onload="alert(1)"></svg>'),Buffer.from('GIF89a'),Buffer.from('not an image'),Buffer.alloc(2*1024*1024+1)])assert.throws(()=>sanitizeImage(bad,'photo'));
 const huge=Buffer.from(png);huge.writeUInt32BE(100000,16);assert.throws(()=>sanitizeImage(huge,'photo'));
 const wide=jpeg.encode({width:513,height:1,data:Buffer.alloc(513*4,255)},80).data;assert.throws(()=>sanitizeImage(wide,'stamp'));
});
test('weekday schedules use server timezone and deny default/paused/invalid intervals',async()=>{
 const schedule=Array.from({length:7},()=>[]);schedule[1]=[[900,960]];const s={schedule_json:JSON.stringify(schedule),timezone:'Asia/Tokyo',paused:0};
 assert.equal(timeAllowed(s,new Date('2026-10-26T06:30:00Z')),true);assert.equal(timeAllowed(s,new Date('2026-10-26T07:00:00Z')),false);assert.equal(timeAllowed({...s,paused:1},new Date('2026-10-26T06:30:00Z')),false);
 assert.throws(()=>validateSchedule([[[5,1]]]));assert.throws(()=>validateSchedule(Array.from({length:7},()=>[[100,10]])));
 assert.equal(same('abc','abc'),true);assert.equal(same('abc','abd'),false);assert.notEqual(await passwordHash('test-long-password','salt-a'),await passwordHash('test-long-password','salt-b'));
});
