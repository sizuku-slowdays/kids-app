const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function createOshaberiTicket(userId:string,displayName:string,secret:string,nonce:string,challenge:string,now=Date.now()){
 const encoder=new TextEncoder();
 const payload=b64(encoder.encode(JSON.stringify({aud:'oshaberi-home-v1',sub:userId,name:displayName,nonce,challenge,exp:now+120000})));
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return payload+'.'+b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload))));
}
