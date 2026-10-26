// LOCAL CPU measurements only: these are not Cloudflare billable CPU metrics.
import {randomFillSync} from 'node:crypto';
import jpeg from 'jpeg-js';
import {sanitizeImage} from './legacy-image-baseline.js';
import {packPixels,pixelsToPng} from '../src/pixel-images.js';
function bench(name,fn,n){const wall=[],cpu=[];let result;for(let i=0;i<n;i++){const c=process.cpuUsage(),s=performance.now();result=fn();wall.push(performance.now()-s);const e=process.cpuUsage(c);cpu.push((e.user+e.system)/1000);}const p=(a,q)=>a.slice().sort((a,b)=>a-b)[Math.ceil(a.length*q)-1];return {name,runs:n,first_wall_ms:+wall[0].toFixed(2),wall_p50_ms:+p(wall,.5).toFixed(2),wall_p95_ms:+p(wall,.95).toFixed(2),cpu_p95_ms:+p(cpu,.95).toFixed(2),output_bytes:result.bytes.length};}
const raw=randomFillSync(Buffer.alloc(384*384*4));for(let i=3;i<raw.length;i+=4)raw[i]=255;const packet=packPixels(384,384,raw);
const old=jpeg.encode({width:384,height:384,data:raw},80).data;
console.log(JSON.stringify({warning:'Local Node only; Free Worker acceptance still requires Cloudflare CPU measurement including auth, rate limit, R2 and DB.',results:[bench('new PNG pixels 384x384 noise',()=>pixelsToPng(packet,'photo'),50),bench('old JPEG decode/re-encode 384x384 noise',()=>sanitizeImage(old,'photo'),5)]},null,2));
