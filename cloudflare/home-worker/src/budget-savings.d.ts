export function savingsCalendarItems(state: unknown): {
 key: string;
 id: string;
 kind: 'saving';
 date: string;
 name: string;
 amount: number;
 account: string | null;
 status: 'planned' | 'confirmed';
 description: string;
}[];
