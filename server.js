const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'state.json');
const CODE = process.env.ROOM_CODE || '';
fs.mkdirSync(DIR, { recursive: true });

function read() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { names: [], events: [] }; }
}
function write(d) {
  try { fs.writeFileSync(FILE, JSON.stringify(d)); } catch (e) { console.error('write fail', e); }
}
function auth(req, res, next) {
  if (CODE && req.get('X-Room-Code') !== CODE) return res.status(401).json({ error: 'code' });
  next();
}

app.get('/api/state', auth, (req, res) => res.json(read()));

app.post('/api/events', auth, (req, res) => {
  const d = read();
  const ids = new Set(d.events.map(e => e.id));
  for (const ev of (req.body.events || [])) {
    if (ev && ev.id && !ids.has(ev.id)) { d.events.push(ev); ids.add(ev.id); }
  }
  write(d);
  res.json({ ok: true, count: d.events.length });
});

app.post('/api/names', auth, (req, res) => {
  const d = read();
  const n = req.body.names || [];
  d.names = [String(n[0] || '').slice(0, 14), String(n[1] || '').slice(0, 14)];
  write(d);
  res.json({ ok: true });
});

app.post('/api/reset', auth, (req, res) => {
  write({ names: read().names, events: [] });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VOLNA server on :' + PORT + (CODE ? ' (code protected)' : ' (open)')));
