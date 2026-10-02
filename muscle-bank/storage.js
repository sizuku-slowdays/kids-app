import {initialState,validateState} from './model.js';
import {config} from './config.js';
let revision=0;
async function api(path,options={}){const r=await fetch(config.apiBase+path,{credentials:'same-origin',cache:'no-store',...options});if(!r.ok)throw Error(r.status===401?'HOMEでログインしてください。':r.status===403?'このアプリの利用権限がありません。':r.status===409?'別の端末で更新されています。再読み込みしてください。':'同期できませんでした。');return r.json()}
let db;
export async function openStore(){db=await new Promise((resolve,reject)=>{const r=indexedDB.open('muscle-bank-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return db;}
export async function readState(){if(config.apiBase){const data=await api('/state');revision=data.revision;return data.state?validateState(data.state):initialState()}const state=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return state?validateState(state):initialState()}
export async function writeState(s){validateState(s);if(config.apiBase){const result=await api('/state',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify(s)});revision=result.revision;return;}await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(s,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
