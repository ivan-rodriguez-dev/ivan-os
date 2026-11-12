// Tiny API gateway for the local stack: one origin, Supabase-style paths.
//   /auth/v1/* -> GoTrue      /rest/v1/* -> PostgREST
import http from 'node:http';

const port = Number(process.env.API_PORT ?? 54321);
const routes = [
  { prefix: '/auth/v1', port: Number(process.env.AUTH_PORT ?? 54326) },
  { prefix: '/rest/v1', port: Number(process.env.REST_PORT ?? 54323) },
];

const cors = (req) => ({
  'access-control-allow-origin': req.headers.origin ?? '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
  'access-control-expose-headers': 'content-range,range,x-total-count,x-sb-error-code,x-supabase-api-version',
  'access-control-max-age': '600',
});

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors(req)).end();
      return;
    }
    const route = routes.find((r) => req.url === r.prefix || req.url.startsWith(r.prefix + '/') || req.url.startsWith(r.prefix + '?'));
    if (!route) {
      res.writeHead(404, { 'content-type': 'application/json', ...cors(req) }).end('{"message":"not found"}');
      return;
    }
    const path = req.url.slice(route.prefix.length) || '/';
    const headers = { ...req.headers, host: `127.0.0.1:${route.port}` };
    // PostgREST only reads the JWT from Authorization; fall back to the apikey like Supabase does.
    if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
    const upstream = http.request({ host: '127.0.0.1', port: route.port, path, method: req.method, headers }, (up) => {
      const out = { ...up.headers };
      for (const k of Object.keys(out)) if (k.startsWith('access-control-')) delete out[k];
      res.writeHead(up.statusCode ?? 502, { ...out, ...cors(req) });
      up.pipe(res);
    });
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json', ...cors(req) }).end(JSON.stringify({ message: `upstream unavailable: ${err.message}` }));
    });
    req.pipe(upstream);
  })
  .listen(port, '127.0.0.1', () => console.log(`gateway listening on http://127.0.0.1:${port}`));
