import http from 'node:http';

const page = (title, h1, extra = '') => `<!doctype html><html><head><title>${title}</title>
<meta name="description" content="About ${title}">${extra}</head><body>
<h1>${h1}</h1><h2>Section</h2><a href="/about">About</a> <a href="/missing">Missing</a>
<footer>Copyright Acme.</footer></body></html>`;

export function startServer(variant, { auth } = {}) {
  const robotsMeta = variant === 'pre' ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';
  const server = http.createServer((req, res) => {
    if (auth && req.headers.authorization !== 'Basic ' + Buffer.from(`${auth.user}:${auth.password}`).toString('base64')) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="dev"' });
      return res.end('auth required');
    }
    const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type }); res.end(body); };
    if (req.url === '/robots.txt') return send(200, 'text/plain', variant === 'pre' ? 'User-agent: *\nDisallow: /' : 'User-agent: *\nDisallow:');
    if (req.url === '/') return send(200, 'text/html', page('Home', 'Welcome', robotsMeta));
    if (req.url === '/about') return send(200, 'text/html', page('About', 'About us', robotsMeta));
    return send(404, 'text/html', '<h1>Not found</h1>');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(r => server.close(r)) });
  }));
}
