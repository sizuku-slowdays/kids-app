import test from 'node:test';
import assert from 'node:assert/strict';
import {randomFillSync} from 'node:crypto';
import {PNG} from 'pngjs';
import {packPixels,pixelsToPng,MAX_PIXEL_BYTES} from '../src/pixel-images.js';
test('fixed pixel input becomes independently decodable PNG with no metadata chunks',()=>{
 for(const [w,h] of [[1,1],[2,3],[255,256],[384,384],[383,17],[1,384]]){
  const pixels=randomFillSync(Buffer.alloc(w*h*4));for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
  const result=pixelsToPng(packPixels(w,h,pixels),'photo');
  const decoded=PNG.sync.read(Buffer.from(result.bytes));
  assert.equal(decoded.width,w);assert.equal(decoded.height,h);assert.deepEqual(decoded.data,pixels);
  const chunks=[];const b=Buffer.from(result.bytes);for(let pos=8;pos<b.length;){const length=b.readUInt32BE(pos);chunks.push(b.toString('ascii',pos+4,pos+8));pos+=12+length;}assert.deepEqual(chunks,['IHDR','IDAT','IEND']);
 }
});
test('pixel envelope rejects malformed, executable, oversized and compressed input',()=>{
 const good=packPixels(1,1,new Uint8Array([0,0,0,255]));
 for(const input of [Buffer.from('<svg onload="alert(1)"/>'),Buffer.from('<html>'),new Uint8Array(0),new Uint8Array(MAX_PIXEL_BYTES+1),good.slice(0,-1),new Uint8Array([...good,0]),packPixels(0,1,new Uint8Array(4)),packPixels(513,1,new Uint8Array(513*4)),PNG.sync.write({width:1,height:1,data:Buffer.alloc(4)})])assert.throws(()=>pixelsToPng(input,'photo'));
 assert.throws(()=>pixelsToPng(packPixels(257,1,new Uint8Array(257*4)),'stamp'));
 assert.throws(()=>pixelsToPng(good,'video'));
 assert.throws(()=>pixelsToPng(packPixels(1,1,new Uint8Array([255,0,0,0])),'photo'),'reject invisible color payloads');
 const bad=good.slice();bad[7]=1;assert.throws(()=>pixelsToPng(bad,'photo'));
 const offset=new Uint8Array(20);offset.set(good,4);assert.equal(PNG.sync.read(Buffer.from(pixelsToPng(offset.subarray(4),'photo').bytes)).width,1);
});
