export function detectPhaseMismatch(phase, probe) {
  const blocked = probe.robotsBlocked || probe.metaNoindex || probe.basicAuth;
  if (phase === 'pre' && !blocked) {
    return 'This site looks live (indexable and no basic auth). Pre-launch expects a dev/staging site. Use post-launch-check, or continue anyway.';
  }
  if (phase === 'post' && blocked) {
    const why = [probe.basicAuth && 'basic auth', probe.metaNoindex && 'noindex meta', probe.robotsBlocked && 'robots.txt disallow'].filter(Boolean).join(', ');
    return `This site looks like staging (${why}). Post-launch expects the live site. Use pre-launch-check, or continue anyway.`;
  }
  return null;
}
