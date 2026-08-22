const express = require('express');
const app = express();
const c = express.Router();
c.use((req, res, next) => { console.log('CHILD MW ran for', req.url); res.status(401).send('cauth'); });
c.get('/child-route', (_, res) => res.send('CH'));
app.use('/', c);
app.get('/geo/nearby', (_, res) => res.send('OK'));
app.listen(4001, () => {
  const http = require('http');
  ['/geo/nearby', '/child-route'].forEach((p) => {
    http.get('http://localhost:4001' + p, (r) => {
      let b = ''; r.on('data', (d) => b += d); r.on('end', () => { console.log(p, r.statusCode, b); if (p === '/child-route') process.exit(0); });
    });
  });
});
