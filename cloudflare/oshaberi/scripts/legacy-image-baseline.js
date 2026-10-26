import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {ensure} from '../src/security.js';
// Re-encode decoded pixels; never copy EXIF, PNG text chunks or original bytes to R2.
export function sanitizeImage(bytes,kind){
 ensure(bytes.length<=2*1024*1024,'画像は2MBまでです',413);
 let decoded;try{
  if(bytes[0]===0xff&&bytes[1]===0xd8)decoded=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:2,maxMemoryUsageInMB:48,tolerantDecoding:false});
  else{
   ensure(bytes.length>24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),'JPEGかPNGの写真を選んでください');
   const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=dv.getUint32(16),h=dv.getUint32(20);
   ensure(w>0&&h>0&&w*h<=1500000&&w<=1600&&h<=1600,'画像の大きさは1600ピクセル・150万画素までです');
   decoded=PNG.sync.read(Buffer.from(bytes),{checkCRC:true});
  }
 }catch{ensure(false,'画像を読み取れません。JPEGかPNGで小さくして選び直してください');}
 const {width,height,data}=decoded;const edge=kind==='stamp'?512:1600;
 ensure(width>0&&height>0&&width<=edge&&height<=edge&&width*height<=1500000,'写真は1600、スタンプは512ピクセルまでです');
 for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;for(let j=0;j<3;j++)data[i+j]=Math.round(data[i+j]*a+255*(1-a));data[i+3]=255;}
 return {bytes:new Uint8Array(jpeg.encode({width,height,data},80).data),width,height};
}
