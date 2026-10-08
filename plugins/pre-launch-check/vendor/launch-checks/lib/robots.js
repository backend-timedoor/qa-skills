export function robotsBlocksAll(text) {
  let inStar = false;
  let prevWasAgent = false;
  for (const raw of (text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) { prevWasAgent = false; continue; }
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      inStar = prevWasAgent ? (inStar || val === '*') : val === '*';
      prevWasAgent = true;
      continue;
    }
    prevWasAgent = false;
    if (inStar && key === 'disallow' && val === '/') return true;
  }
  return false;
}
