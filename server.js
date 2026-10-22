// Payslip proxy for Farnek Workforce.
// Apps Script cannot send a GET request with a JSON body, which is exactly what
// Infinigent's getprofiledatalistExt requires. This tiny service accepts a POST from
// the app and forwards it as a GET-with-body to Infinigent, returning the JSON.
//
// Security: set PROXY_KEY (an env var). The app must call ...?k=<PROXY_KEY>.
const http  = require('http');
const https = require('https');
const { URL } = require('url');

const TARGET = 'https://Infinigent.app/InfExtAppAPI/getprofiledatalistExt';
const KEY = process.env.PROXY_KEY || '';

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method !== 'POST') { res.writeHead(405); return res.end('POST only'); }
  if (KEY && u.searchParams.get('k') !== KEY) { res.writeHead(403); return res.end('forbidden'); }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);                 // {client_secret, module, monthyear, empid}
    const t = new URL(TARGET);
    const opts = {
      hostname: t.hostname, path: t.pathname, method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        'Authorization': req.headers['authorization'] || '',
        'Accept': 'application/json'
      }
    };
    const preq = https.request(opts, pres => {
      const out = [];
      pres.on('data', d => out.push(d));
      pres.on('end', () => {
        res.writeHead(pres.statusCode || 502, { 'Content-Type': 'application/json' });
        res.end(Buffer.concat(out));
      });
    });
    preq.on('error', e => { res.writeHead(502); res.end(JSON.stringify({ error: String(e) })); });
    preq.write(body);     // GET carrying the JSON body (Node allows this)
    preq.end();
  });
});
server.listen(process.env.PORT || 3000, () => console.log('payslip proxy listening'));
