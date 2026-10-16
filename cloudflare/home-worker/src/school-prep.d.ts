export function schoolRoute(request: Request, env: Env & {NOTIFICATION_SERVICE?: Fetcher}, user: string, readBody: (request: Request) => Promise<Record<string, unknown>>): Promise<Response>;
export function schoolNotificationCheck(request: Request, env: Env): Promise<Response>;
