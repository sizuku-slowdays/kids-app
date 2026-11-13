export const budgetCategories: Record<string,string[]>;
export const budgetPeople: string[];
export const spendingKinds: string[];
export const savingsKinds: string[];
export function classificationSettings(state:any):any;
export function migrateClassification(state:any,merchants?:Record<string,string>):any;
export function budgetClassificationPreview(state:any):any;
export function outstandingAdvance(state:any,entry:any):number;
