export function fingerprint(card:string,row:any):Promise<string>;
export function parseRakutenCsv(text:string):any[];
export function decodeCardCsv(buffer:ArrayBuffer):{text:string;encoding:string};
export function csvCandidates(state:any,card:string,row:any):any[];
export function merchantKey(value:string):string;
export function suggestCategory(state:any,merchant:string):{category:string;middle?:string;person?:string;source:string;review?:boolean;ambiguous?:boolean;candidates?:Array<{category:string;middle?:string;person?:string}>};
