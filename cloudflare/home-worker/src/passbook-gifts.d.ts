export function giftAccess(db:D1Database,h:string,user:string):Promise<{guardian:boolean;sender:boolean;pending:number}>;
export function giftsRoute(request:Request,env:Env,h:string,user:string,readBody:(r:Request)=>Promise<Record<string,unknown>>):Promise<unknown>;
export function giftNotificationCheck(request:Request,env:Env):Promise<Response>;
export function deliverGiftNotifications(env:Env,household?:string|null,recipient?:string|null):Promise<void>;
