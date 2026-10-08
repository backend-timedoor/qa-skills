export const ok = (reason = '') => ({ status: 'pass', reason, pages: [] });
export const bad = (reason, pages = []) => ({ status: 'fail', reason, pages });
export const review = (reason) => ({ status: 'review-needed', reason, pages: [] });
export const na = (reason = '') => ({ status: 'n/a', reason, pages: [] });
export const verdict = (offenders, label) =>
  offenders.length ? bad(`${offenders.length} ${label}`, [...new Set(offenders)]) : ok();
