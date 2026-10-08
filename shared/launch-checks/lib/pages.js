export const livePages = (evidence) => evidence.pages.filter(p => !p.error && p.status < 400);
