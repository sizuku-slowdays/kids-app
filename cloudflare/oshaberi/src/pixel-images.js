import {ensure} from './security.js';
// Fixed, non-executable pixel envelope. No original JPEG/PNG/SVG bytes are stored.
export const PIXEL_MIME='application/x-oshaberi-rgba';
const MAGIC=new Uint8Array([79,83,82,71,66,65,49,0]);
export const MAX_PIXEL_BYTES=12+384*384*4;
const crcTable=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTable[i]=c;}
function crc(bytes,from,to){let c=0xffffffff;for(let i=from;i<to;i++)c=crcTable[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function adler(bytes){let a=1,b=0;for(let i=0;i<bytes.length;){const end=Math.min(i+5552,bytes.length);for(;i<end;i++){a+=bytes[i];b+=a;}a%=65521;b%=65521;}return ((b<<16)|a)>>>0;}
export function packPixels(width,height,pixels){const bytes=new Uint8Array(12+pixels.length);bytes.set(MAGIC);const v=new DataView(bytes.buffer);v.setUint16(8,width);v.setUint16(10,height);bytes.set(pixels,12);return bytes;}
export function pixelsToPng(packet,kind){
 ensure(['photo','stamp'].includes(kind),'画像の種類を確認してください');
 ensure(packet instanceof Uint8Array&&packet.length>=16&&packet.length<=MAX_PIXEL_BYTES,'画像の容量を確認してください',413);
 ensure(MAGIC.every((v,i)=>packet[i]===v),'写真を選び直してください。画像の入力形式が違います');
 const input=new DataView(packet.buffer,packet.byteOffset,packet.byteLength),width=input.getUint16(8),height=input.getUint16(10),edge=kind==='stamp'?256:384;
 ensure(width>0&&height>0&&width<=edge&&height<=edge&&packet.length===12+width*height*4,'写真は384、スタンプは256ピクセルまでです');
 // The browser flattens on white; reject hidden RGB in transparent attacker pixels.
 for(let i=15;i<packet.length;i+=4)if(packet[i]!==255)ensure(false,'透明画像は白い背景にして選び直してください');
 // PNG scanlines use only filter 0. Deflate uses stored blocks, never an attacker-supplied compressed stream.
 const stride=width*4,scan=new Uint8Array((stride+1)*height);
 for(let y=0;y<height;y++)scan.set(packet.subarray(12+y*stride,12+(y+1)*stride),y*(stride+1)+1);
 const blocks=Math.ceil(scan.length/65535),zlen=2+scan.length+5*blocks+4;
 const out=new Uint8Array(8+25+12+zlen+12),view=new DataView(out.buffer);out.set([137,80,78,71,13,10,26,10]);let pos=8;
 function begin(type,length){view.setUint32(pos,length);pos+=4;const start=pos;for(let i=0;i<4;i++)out[pos++]=type.charCodeAt(i);return start;}
 function end(start){view.setUint32(pos,crc(out,start,pos));pos+=4;}
 let start=begin('IHDR',13);view.setUint32(pos,width);view.setUint32(pos+4,height);out[pos+8]=8;out[pos+9]=6;pos+=13;end(start);
 start=begin('IDAT',zlen);out[pos++]=0x78;out[pos++]=0x01;
 for(let offset=0;offset<scan.length;){const n=Math.min(65535,scan.length-offset);out[pos++]=offset+n===scan.length?1:0;view.setUint16(pos,n,true);view.setUint16(pos+2,(~n)&65535,true);pos+=4;out.set(scan.subarray(offset,offset+n),pos);pos+=n;offset+=n;}
 view.setUint32(pos,adler(scan));pos+=4;end(start);start=begin('IEND',0);end(start);
 ensure(pos===out.length,'画像を組み立てられませんでした',500);
 return {bytes:out,width,height,mime:'image/png',extension:'png'};
}
