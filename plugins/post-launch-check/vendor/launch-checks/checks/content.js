import { verdict, na } from '../lib/result.js';
import { livePages } from '../lib/pages.js';

const MONTHS = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const INVALID_DATES = [
  new RegExp(`\\b\\d{1,2} ${MONTHS}\\.? \\d{4}\\b`, 'i'),
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(?:1[3-9]|2\d|3[01])\/(?:0?[1-9]|1[0-2])\/\d{4}\b/,
];

export default {
  'UI-008': (ev) => verdict(
    livePages(ev).filter(p => /lorem ipsum|dolor sit amet/i.test(p.bodyText)).map(p => p.url),
    'page(s) contain lorem ipsum text'),

  'UI-019': (ev, ctx) => {
    if (ctx.language !== 'en') return na('Only English pages are checked');
    return verdict(
      livePages(ev).filter(p => INVALID_DATES.some(re => re.test(p.bodyText))).map(p => p.url),
      'page(s) use a date format other than MM/DD/YYYY or Month Date, Year');
  },
};
