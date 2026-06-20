const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DIR, 'state.json');
const CODE = process.env.ROOM_CODE || '';
fs.mkdirSync(DIR, { recursive: true });

// --- resolve the public folder robustly (handles nested repo layouts) ---
const CANDIDATES = [
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public'),
  path.join(__dirname, 'volna-server', 'public'),
  path.join(process.cwd(), 'volna-server', 'public'),
];
const PUB = CANDIDATES.find(p => { try { return fs.existsSync(path.join(p, 'index.html')); } catch (e) { return false; } });
console.log('[VOLNA] __dirname =', __dirname);
console.log('[VOLNA] cwd       =', process.cwd());
console.log('[VOLNA] public    =', PUB || 'NOT FOUND');
if (!PUB) console.log('[VOLNA] checked:', CANDIDATES);

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

app.post('/api/delete', auth, (req, res) => {
  const d = read();
  const id = req.body.id;
  d.events = (d.events || []).filter(e => e.id !== id);
  write(d);
  res.json({ ok: true, count: d.events.length });
});

// --- serve the frontend ---
if (PUB) {
  app.use(express.static(PUB));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
    res.sendFile(path.join(PUB, 'index.html'));
  });
} else {
  app.get('*', (req, res) => res.status(500).send(
    'Папка public/index.html не найдена на сервере. ' +
    'Проверь, что папка public с файлом index.html попала в репозиторий, ' +
    'и что Root Directory в Railway указывает на папку, где лежит server.js.'
  ));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('[VOLNA] server on :' + PORT + (CODE ? ' (code protected)' : ' (open)')));
