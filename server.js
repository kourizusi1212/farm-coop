const express = require('express'), http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');
const N = 12, DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const CROPS = { wheat: { cost: 2, sell: 6, t: 20 }, carrot: { cost: 4, sell: 12, t: 35 }, pumpkin: { cost: 8, sell: 28, t: 60 } };
const rooms = new Map();
const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const file = c => path.join(DATA, c + '.json');
const newWorld = () => ({ coins: 20, tiles: Array.from({ length: N * N }, () => ({ s: 0, c: '', g: 0, w: 0 })) });
const valid = w => w && Array.isArray(w.tiles) && w.tiles.length === N * N && Number.isFinite(w.coins);
const sane = w => ({ coins: Math.max(0, Math.floor(w.coins)), tiles: w.tiles.map(t => ({ s: [0, 1, 2].includes(t.s) ? t.s : 0, c: CROPS[t.c] ? t.c : '', g: +t.g || 0, w: +t.w || 0 })) });
const exists = c => rooms.has(c) || fs.existsSync(file(c));
function openRoom(code, save) {
  let r = rooms.get(code); if (r) return r;
  let w = save;
  if (!w && fs.existsSync(file(code))) { try { w = JSON.parse(fs.readFileSync(file(code), 'utf8')); } catch {} }
  r = { code, world: sane(valid(w) ? w : newWorld()), clients: new Set(), dirty: true };
  rooms.set(code, r); return r;
}
const saveRoom = r => { fs.writeFileSync(file(r.code), JSON.stringify({ code: r.code, ...r.world, savedAt: Date.now() })); r.dirty = false; };
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
const bcast = (r, m) => r.clients.forEach(c => send(c, m));
const world = r => ({ t: 'world', coins: r.world.coins, tiles: r.world.tiles });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
let nextId = 1;
wss.on('connection', ws => {
  ws.id = nextId++; ws.room = null; ws.name = 'Player'; ws.pos = [0, 0, 8]; ws.rot = 0;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create' || m.t === 'join') {
      if (ws.room) return;
      ws.name = String(m.name || 'Player').slice(0, 12);
      let code = clean(m.code);
      if (m.t === 'create') {
        if (!code) do { code = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (exists(code));
        else if (code.length < 3) return send(ws, { t: 'err', m: 'コードは3文字以上にしてください' });
        else if (exists(code)) return send(ws, { t: 'err', m: 'そのコードは既に使われています' });
        if (m.save && !valid(m.save)) return send(ws, { t: 'err', m: 'セーブデータが不正です' });
        ws.room = openRoom(code, m.save);
      } else {
        if (!exists(code)) return send(ws, { t: 'err', m: '部屋が見つかりません' });
        ws.room = openRoom(code);
      }
      ws.room.clients.add(ws);
      send(ws, { t: 'joined', code, id: ws.id });
      send(ws, world(ws.room));
      return;
    }
    const r = ws.room; if (!r) return;
    if (m.t === 'move' && Array.isArray(m.p)) { ws.pos = m.p.map(Number); ws.rot = +m.r || 0; }
    else if (m.t === 'save') { saveRoom(r); send(ws, { t: 'saved' }); }
    else if (m.t === 'export') send(ws, { t: 'export', data: { code: r.code, ...r.world, savedAt: Date.now() } });
    else if (m.t === 'act') {
      const tile = r.world.tiles[m.i | 0]; if (!tile) return;
      const w = r.world; let ok = false;
      if (m.tool === 'hoe' && tile.s === 0) { tile.s = 1; ok = true; }
      else if (CROPS[m.tool] && tile.s === 1 && w.coins >= CROPS[m.tool].cost) { w.coins -= CROPS[m.tool].cost; Object.assign(tile, { s: 2, c: m.tool, g: 0, w: 0 }); ok = true; }
      else if (m.tool === 'water' && tile.s === 2) { tile.w = 20; ok = true; }
      else if (m.tool === 'harvest' && tile.s === 2 && tile.g >= CROPS[tile.c].t) { w.coins += CROPS[tile.c].sell; Object.assign(tile, { s: 1, c: '', g: 0, w: 0 }); ok = true; }
      if (ok) { r.dirty = true; bcast(r, world(r)); }
    }
  });
  ws.on('close', () => {
    const r = ws.room; if (!r) return;
    r.clients.delete(ws);
    if (!r.clients.size) { saveRoom(r); rooms.delete(r.code); }
  });
});
setInterval(() => rooms.forEach(r => {
  let ch = false;
  r.world.tiles.forEach(t => { if (t.s === 2 && t.w > 0) { t.w--; if (t.g < CROPS[t.c].t) t.g++; ch = true; } });
  if (ch) { r.dirty = true; bcast(r, world(r)); }
}), 1000);
setInterval(() => rooms.forEach(r => r.dirty && saveRoom(r)), 10000);
setInterval(() => rooms.forEach(r => bcast(r, { t: 'players', list: [...r.clients].map(c => ({ id: c.id, name: c.name, p: c.pos, r: c.rot })) })), 100);
server.listen(process.env.PORT || 3000, () => console.log('listening'));
