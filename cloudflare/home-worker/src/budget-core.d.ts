export class BudgetError extends Error {constructor(message:string,status?:number);status:number;}
export type BudgetState = Record<string, any>;
export function newBudget():BudgetState;
export function applyBudgetCommand(state:BudgetState,command:{type:string;data?:any},context:{today:string;eventId:string;importHash?:string}):BudgetState;
export function budgetSummary(state:BudgetState,today:string,month?:string,basis?:string):any;
export function importPreview(input:any):any;
export function legacyExport(state:BudgetState):any;
export function businessDate(date:string,holidays?:string[]):string;
export function monthDate(month:string,day:number):string;
export function cardDue(card:any,date:string,holidays?:string[]):string|null;
