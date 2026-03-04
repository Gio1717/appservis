/**
 * AC EURO / Progresklima – servisní systém
 * Express + SQLite + WebSocket + vlastní auth
 * Port: 3001 (3000 je obsazený Ivovou aplikací)
 */

'use strict';

const express      = require('express');
const cookieParser = require('cookie-parser');
const bcrypt       = require('bcryptjs');
const Database     = require('better-sqlite3');
const { WebSocketServer } = require('ws');
const multer       = require('multer');
const { v4: uuidv4 } = require('uuid');
const path         = require('path');
const fs           = require('fs');
const http         = require('http');

// ── Konfigurace ────────────────────────────────────────────────────
const PORT        = process.env.PORT || 3001;
const DB_FILE     = path.join(__dirname, 'servis.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dní v ms

// Vytvoř složku pro uploady pokud neexistuje
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Databáze ───────────────────────────────────────────────────────
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schéma
db.exec(`
  -- Uživatelé
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    displayName TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'technik',
    firma       TEXT NOT NULL DEFAULT 'ac',
    approved    INTEGER NOT NULL DEFAULT 0,
    createdAt   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Sessions
  CREATE TABLE IF NOT EXISTS sessions (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Zakázky
  CREATE TABLE IF NOT EXISTS zakazky (
    id          TEXT PRIMARY KEY,
    nazev       TEXT NOT NULL DEFAULT '',
    cislo       TEXT NOT NULL DEFAULT '',
    zakaznik    TEXT NOT NULL DEFAULT '',
    zakaznikId  TEXT NOT NULL DEFAULT '',
    adresa      TEXT NOT NULL DEFAULT '',
    ico         TEXT NOT NULL DEFAULT '',
    dic         TEXT NOT NULL DEFAULT '',
    firma       TEXT NOT NULL DEFAULT 'ac',
    technik     TEXT NOT NULL DEFAULT '',
    technikUid  TEXT NOT NULL DEFAULT '',
    technikEmail TEXT NOT NULL DEFAULT '',
    technici    TEXT NOT NULL DEFAULT '[]',
    termin      TEXT NOT NULL DEFAULT '',
    prace       TEXT NOT NULL DEFAULT '',
    pozn        TEXT NOT NULL DEFAULT '',
    komentar    TEXT NOT NULL DEFAULT '',
    duzp        TEXT NOT NULL DEFAULT '',
    rows        TEXT NOT NULL DEFAULT '[]',
    exts        TEXT NOT NULL DEFAULT '[]',
    cena        TEXT NOT NULL DEFAULT '',
    pricesSkipped INTEGER NOT NULL DEFAULT 1,
    sig1        TEXT NOT NULL DEFAULT '',
    sig2        TEXT NOT NULL DEFAULT '',
    sd1         TEXT NOT NULL DEFAULT '',
    sd2         TEXT NOT NULL DEFAULT '',
    photos      TEXT NOT NULL DEFAULT '[]',
    stav        TEXT NOT NULL DEFAULT 'nová',
    source      TEXT NOT NULL DEFAULT 'kancelar',
    hodnoceni   INTEGER,
    hodnoceniText TEXT NOT NULL DEFAULT '',
    km          TEXT NOT NULL DEFAULT '',
    hodiny      TEXT NOT NULL DEFAULT '',
    gpsLat      REAL,
    gpsLng      REAL,
    poradi      INTEGER NOT NULL DEFAULT 0,
    createdAt   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Audit log (subkolekce zakázky)
  CREATE TABLE IF NOT EXISTS audit (
    id        TEXT PRIMARY KEY,
    zakazkaId TEXT NOT NULL REFERENCES zakazky(id) ON DELETE CASCADE,
    action    TEXT NOT NULL DEFAULT '',
    value     TEXT NOT NULL DEFAULT '',
    note      TEXT NOT NULL DEFAULT '',
    uid       TEXT NOT NULL DEFAULT '',
    author    TEXT NOT NULL DEFAULT '',
    role      TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Chat (subkolekce zakázky)
  CREATE TABLE IF NOT EXISTS chat (
    id        TEXT PRIMARY KEY,
    zakazkaId TEXT NOT NULL REFERENCES zakazky(id) ON DELETE CASCADE,
    text      TEXT NOT NULL DEFAULT '',
    uid       TEXT NOT NULL DEFAULT '',
    author    TEXT NOT NULL DEFAULT '',
    role      TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Zákazníci
  CREATE TABLE IF NOT EXISTS zakaznici (
    id        TEXT PRIMARY KEY,
    nazev     TEXT NOT NULL DEFAULT '',
    ico       TEXT NOT NULL DEFAULT '',
    dic       TEXT NOT NULL DEFAULT '',
    adresa    TEXT NOT NULL DEFAULT '',
    tel       TEXT NOT NULL DEFAULT '',
    email     TEXT NOT NULL DEFAULT '',
    kontakt   TEXT NOT NULL DEFAULT '',
    typ       TEXT NOT NULL DEFAULT 'firma',
    pozn      TEXT NOT NULL DEFAULT '',
    protokol  TEXT NOT NULL DEFAULT '',
    smlouva   TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Sklad
  CREATE TABLE IF NOT EXISTS sklad (
    id        TEXT PRIMARY KEY,
    nazev     TEXT NOT NULL DEFAULT '',
    kategorie TEXT NOT NULL DEFAULT '',
    kod       TEXT NOT NULL DEFAULT '',
    qty       INTEGER NOT NULL DEFAULT 0,
    minQty    INTEGER NOT NULL DEFAULT 0,
    cenaks    REAL NOT NULL DEFAULT 0,
    pozn      TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Ceník
  CREATE TABLE IF NOT EXISTS cenik (
    id        TEXT PRIMARY KEY,
    nazev     TEXT NOT NULL DEFAULT '',
    kategorie TEXT NOT NULL DEFAULT '',
    jednotka  TEXT NOT NULL DEFAULT 'ks',
    cena      REAL NOT NULL DEFAULT 0,
    dph       INTEGER NOT NULL DEFAULT 21,
    pozn      TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Šablony
  CREATE TABLE IF NOT EXISTS sablony (
    id        TEXT PRIMARY KEY,
    nazev     TEXT NOT NULL DEFAULT '',
    typ       TEXT NOT NULL DEFAULT '',
    firma     TEXT NOT NULL DEFAULT 'ac',
    prace     TEXT NOT NULL DEFAULT '',
    zadani    TEXT NOT NULL DEFAULT '',
    rows      TEXT NOT NULL DEFAULT '[]',
    zakaznik  TEXT NOT NULL DEFAULT '',
    adresa    TEXT NOT NULL DEFAULT '',
    termin    TEXT NOT NULL DEFAULT '',
    active    INTEGER NOT NULL DEFAULT 1,
    interval  TEXT NOT NULL DEFAULT '',
    nextDate  TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Zakázky typy
  CREATE TABLE IF NOT EXISTS zakazky_typy (
    id        TEXT PRIMARY KEY,
    nazev     TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Hodnocení
  CREATE TABLE IF NOT EXISTS hodnoceni (
    id        TEXT PRIMARY KEY,
    zakazkaId TEXT NOT NULL,
    hvezdicky INTEGER NOT NULL DEFAULT 0,
    text      TEXT NOT NULL DEFAULT '',
    jmeno     TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Výkazy práce
  CREATE TABLE IF NOT EXISTS vykazy (
    id      TEXT PRIMARY KEY,
    technik TEXT NOT NULL DEFAULT '',
    uid     TEXT NOT NULL DEFAULT '',
    od      TEXT NOT NULL DEFAULT '',
    doo     TEXT NOT NULL DEFAULT '',
    stav    TEXT NOT NULL DEFAULT 'odeslan',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Místa (subkolekce zakázky)
  CREATE TABLE IF NOT EXISTS mista (
    id        TEXT PRIMARY KEY,
    zakazkaId TEXT NOT NULL REFERENCES zakazky(id) ON DELETE CASCADE,
    nazev     TEXT NOT NULL DEFAULT '',
    adresa    TEXT NOT NULL DEFAULT '',
    poznamka  TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Klimatizace (subkolekce místa)
  CREATE TABLE IF NOT EXISTS klimatizace (
    id              TEXT PRIMARY KEY,
    mistaId         TEXT NOT NULL REFERENCES mista(id) ON DELETE CASCADE,
    zakazkaId       TEXT NOT NULL,
    model           TEXT NOT NULL DEFAULT '',
    seriove_cislo   TEXT NOT NULL DEFAULT '',
    umisteni        TEXT NOT NULL DEFAULT '',
    poznamka        TEXT NOT NULL DEFAULT '',
    prace           TEXT NOT NULL DEFAULT '',
    stav            TEXT NOT NULL DEFAULT 'nova',
    photos          TEXT NOT NULL DEFAULT '[]',
    zkontrolovano   INTEGER NOT NULL DEFAULT 0,
    datum_kontroly  TEXT NOT NULL DEFAULT '',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  -- Indexy pro výkon
  CREATE INDEX IF NOT EXISTS idx_zakazky_firma   ON zakazky(firma);
  CREATE INDEX IF NOT EXISTS idx_zakazky_stav    ON zakazky(stav);
  CREATE INDEX IF NOT EXISTS idx_zakazky_termin  ON zakazky(termin);
  CREATE INDEX IF NOT EXISTS idx_audit_zakazka   ON audit(zakazkaId);
  CREATE INDEX IF NOT EXISTS idx_chat_zakazka    ON chat(zakazkaId);
  CREATE INDEX IF NOT EXISTS idx_mista_zakazka   ON mista(zakazkaId);
  CREATE INDEX IF NOT EXISTS idx_klim_misto      ON klimatizace(mistaId);
  CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(userId);
  CREATE INDEX IF NOT EXISTS idx_sessions_exp    ON sessions(expiresAt);
`);

// Výchozí admin účet (pokud neexistuje)
const adminExists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare(`
    INSERT INTO users (id, email, password, displayName, role, firma, approved)
    VALUES (?, ?, ?, ?, 'admin', 'ac', 1)
  `).run(uuidv4(), 'admin@servis.local', hash, 'Administrátor');
  console.log('✓ Výchozí admin: admin@servis.local / admin — IHNED ZMĚŇTE HESLO!');
}

// ── Helpers ────────────────────────────────────────────────────────
const now = () => Date.now();
const newId = () => uuidv4();

function getSession(req) {
  const sid = req.cookies?.sid;
  if (!sid) return null;
  const session = db.prepare(
    'SELECT s.*, u.id as userId, u.email, u.displayName, u.role, u.firma, u.approved FROM sessions s JOIN users u ON u.id=s.userId WHERE s.id=? AND s.expiresAt>?'
  ).get(sid, now());
  return session || null;
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Nepřihlášen' });
  if (!session.approved) return res.status(403).json({ error: 'Účet čeká na schválení' });
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Nedostatečná oprávnění' });
    next();
  });
}

// Broadcast WebSocket zprávu všem připojeným klientům
function broadcast(type, payload, firma) {
  const msg = JSON.stringify({ type, payload, firma, ts: now() });
  for (const [ws, info] of wsClients) {
    if (ws.readyState === 1 && (!firma || info.firma === firma)) {
      ws.send(msg);
    }
  }
}

// Pomocník pro převod SQLite řádku — JSON pole zpět na JS
function parseRow(row) {
  if (!row) return null;
  const jsonFields = ['rows','exts','photos','technici'];
  const out = { ...row };
  for (const f of jsonFields) {
    if (typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f]); } catch { out[f] = []; }
    }
  }
  // Timestamp na ISO string pro kompatibilitu s frontendem
  if (out.createdAt && typeof out.createdAt === 'number') {
    out._createdAt = out.createdAt;
  }
  if (out.updatedAt && typeof out.updatedAt === 'number') {
    out._updatedAt = out.updatedAt;
  }
  return out;
}

function parseRows(rows) {
  return rows.map(parseRow);
}

// ── Express setup ──────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Statické soubory — firebase-compat.js a ostatní JS soubory
app.use(express.static(__dirname));

// Statické soubory — uploads (fotky)
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer pro nahrávání fotek
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.session?.userId || 'anon');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}_${uuidv4().slice(0,8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Pouze obrázky'));
  }
});

// ── Frontend ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── AUTH ROUTES ────────────────────────────────────────────────────

// Přihlášení
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Chybí email nebo heslo' });

  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Nesprávný email nebo heslo' });
  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Nesprávný email nebo heslo' });
  if (!user.approved) return res.status(403).json({ error: 'Účet čeká na schválení administrátorem' });

  // Vytvoř session
  const sid = uuidv4();
  db.prepare('INSERT INTO sessions (id, userId, expiresAt) VALUES (?,?,?)').run(sid, user.id, now() + SESSION_TTL);

  res.cookie('sid', sid, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL,
    path: '/'
  });

  res.json({
    uid: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    firma: user.firma,
    approved: !!user.approved
  });
});

// Registrace
app.post('/api/auth/register', (req, res) => {
  const { email, password, displayName, firma } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Chybí email nebo heslo' });
  if (password.length < 6) return res.status(400).json({ error: 'Heslo musí mít alespoň 6 znaků' });

  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (exists) return res.status(409).json({ error: 'Email je již registrován' });

  const hash = bcrypt.hashSync(password, 10);
  const id = newId();

  // První uživatel = admin (approved), ostatní čekají na schválení
  const isFirst = !db.prepare('SELECT id FROM users LIMIT 1').get();
  db.prepare(`
    INSERT INTO users (id, email, password, displayName, role, firma, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase().trim(), hash,
    displayName || email.split('@')[0], isFirst ? 'admin' : 'technik',
    firma || 'ac', isFirst ? 1 : 0);

  if (isFirst) {
    // Přihlásit rovnou
    const sid = uuidv4();
    db.prepare('INSERT INTO sessions (id, userId, expiresAt) VALUES (?,?,?)').run(sid, id, now() + SESSION_TTL);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_TTL, path: '/' });
    res.json({ uid: id, email, displayName: displayName || email.split('@')[0], role: 'admin', firma: firma||'ac', approved: true });
  } else {
    res.json({ pending: true, message: 'Registrace proběhla, čeká na schválení administrátorem' });
  }
});

// Odhlášení
app.post('/api/auth/logout', (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) db.prepare('DELETE FROM sessions WHERE id=?').run(sid);
  res.clearCookie('sid');
  res.json({ ok: true });
});

// Aktuální uživatel
app.get('/api/auth/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Nepřihlášen' });
  res.json({
    uid: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    firma: session.firma,
    approved: !!session.approved
  });
});

// Změna hesla
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.userId);
  if (!bcrypt.compareSync(oldPassword, user.password))
    return res.status(400).json({ error: 'Nesprávné stávající heslo' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password=?, updatedAt=? WHERE id=?').run(hash, now(), req.session.userId);
  res.json({ ok: true });
});

// ── USERS ROUTES ───────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, email, displayName, role, firma, approved, createdAt FROM users ORDER BY displayName').all();
  res.json(users.map(u => ({ ...u, approved: !!u.approved })));
});

// Získej jednotlivého uživatele podle ID (potřebné pro role routing)
app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, displayName, role, firma, approved FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Uživatel nenalezen' });
  res.json({ ...user, approved: !!user.approved });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { displayName, role, firma, approved } = req.body;
  db.prepare('UPDATE users SET displayName=?, role=?, firma=?, approved=?, updatedAt=? WHERE id=?')
    .run(displayName, role, firma, approved ? 1 : 0, now(), req.params.id);
  broadcast('users_changed', {}, null);
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Reset hesla (admin)
app.post('/api/users/:id/reset-password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  const hash = bcrypt.hashSync(newPassword || 'heslo123', 10);
  db.prepare('UPDATE users SET password=?, updatedAt=? WHERE id=?').run(hash, now(), req.params.id);
  res.json({ ok: true });
});

// ── GENERIC COLLECTION CRUD ─────────────────────────────────────────
// Pomocník pro jednoduché kolekce (zakaznici, sklad, cenik, sablony, zakazky_typy, vykazy, hodnoceni)

function collectionRouter(tableName, jsonFields = [], orderCol = 'createdAt') {
  const router = express.Router();

  // GET all
  router.get('/', requireAuth, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${tableName} ORDER BY ${orderCol}`).all();
    res.json(rows.map(r => {
      const out = { ...r, id: r.id };
      for (const f of jsonFields) {
        if (typeof out[f] === 'string') try { out[f] = JSON.parse(out[f]); } catch {}
      }
      return out;
    }));
  });

  // GET one
  router.get('/:id', requireAuth, (req, res) => {
    const row = db.prepare(`SELECT * FROM ${tableName} WHERE id=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Nenalezeno' });
    const out = { ...row };
    for (const f of jsonFields) {
      if (typeof out[f] === 'string') try { out[f] = JSON.parse(out[f]); } catch {}
    }
    res.json(out);
  });

  // POST (create)
  router.post('/', requireAuth, (req, res) => {
    const data = { ...req.body };
    const id = data.id || newId();
    const ts = now();

    // JSON pole na string
    for (const f of jsonFields) {
      if (data[f] !== undefined && typeof data[f] !== 'string') {
        data[f] = JSON.stringify(data[f]);
      }
    }
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    // Dynamický INSERT
    const cols = Object.keys(data);
    const placeholders = cols.map(() => '?').join(',');
    const values = cols.map(c => data[c]);

    try {
      db.prepare(`INSERT INTO ${tableName} (id, ${cols.join(',')}, createdAt, updatedAt) VALUES (?, ${placeholders}, ?, ?)`)
        .run(id, ...values, ts, ts);
      broadcast(`${tableName}_changed`, { id }, null);
      res.json({ id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // PUT (update)
  router.put('/:id', requireAuth, (req, res) => {
    const data = { ...req.body };
    delete data.id;
    delete data.createdAt;

    for (const f of jsonFields) {
      if (data[f] !== undefined && typeof data[f] !== 'string') {
        data[f] = JSON.stringify(data[f]);
      }
    }

    const cols = Object.keys(data);
    const sets = cols.map(c => `${c}=?`).join(',');
    const values = cols.map(c => data[c]);

    db.prepare(`UPDATE ${tableName} SET ${sets}, updatedAt=? WHERE id=?`)
      .run(...values, now(), req.params.id);
    broadcast(`${tableName}_changed`, { id: req.params.id }, null);
    res.json({ ok: true });
  });

  // DELETE
  router.delete('/:id', requireAuth, (req, res) => {
    db.prepare(`DELETE FROM ${tableName} WHERE id=?`).run(req.params.id);
    broadcast(`${tableName}_changed`, { id: req.params.id, deleted: true }, null);
    res.json({ ok: true });
  });

  return router;
}

// ── ZAKÁZKY (hlavní kolekce) ───────────────────────────────────────
app.get('/api/zakazky', requireAuth, (req, res) => {
  const { firma } = req.query;
  let q = 'SELECT * FROM zakazky';
  const params = [];
  if (firma) { q += ' WHERE firma=?'; params.push(firma); }
  q += ' ORDER BY createdAt DESC';
  const rows = db.prepare(q).all(...params);
  res.json(parseRows(rows));
});

app.get('/api/zakazky/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM zakazky WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Nenalezeno' });
  res.json(parseRow(row));
});

app.post('/api/zakazky', requireAuth, (req, res) => {
  const d = req.body;
  const id = d.id || newId();
  const ts = now();

  db.prepare(`
    INSERT INTO zakazky (id,nazev,cislo,zakaznik,zakaznikId,adresa,ico,dic,firma,
      technik,technikUid,technikEmail,technici,termin,prace,pozn,komentar,duzp,
      rows,exts,cena,pricesSkipped,sig1,sig2,sd1,sd2,sig1name,sig2name,photos,stav,source,
      hodnoceni,hodnoceniText,km,hodiny,gpsLat,gpsLng,poradi,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, d.nazev||'', d.cislo||'', d.zakaznik||'', d.zakaznikId||'',
    d.adresa||'', d.ico||'', d.dic||'', d.firma||'ac',
    d.technik||'', d.technikUid||'', d.technikEmail||'',
    JSON.stringify(d.technici||[]),
    d.termin||'', d.prace||'', d.pozn||'', d.komentar||'', d.duzp||'',
    JSON.stringify(d.rows||[]), JSON.stringify(d.exts||[]),
    d.cena||'', d.pricesSkipped?1:0,
    d.sig1||'', d.sig2||'', d.sd1||'', d.sd2||'',
    d.sig1name||'', d.sig2name||'',
    JSON.stringify(d.photos||[]),
    d.stav||'nová', d.source||'kancelar',
    d.hodnoceni||null, d.hodnoceniText||'',
    d.km||'', d.hodiny||'', d.gpsLat||null, d.gpsLng||null,
    d.poradi||0, ts, ts
  );

  broadcast('zakazky_changed', { id, action: 'add' }, d.firma);
  res.json({ id });
});

app.put('/api/zakazky/:id', requireAuth, (req, res) => {
  const d = req.body;
  const ts = now();

  // Serializuj JSON pole
  if (d.rows && typeof d.rows !== 'string') d.rows = JSON.stringify(d.rows);
  if (d.exts && typeof d.exts !== 'string') d.exts = JSON.stringify(d.exts);
  if (d.photos && typeof d.photos !== 'string') d.photos = JSON.stringify(d.photos);
  if (d.technici && typeof d.technici !== 'string') d.technici = JSON.stringify(d.technici);

  // Dynamický UPDATE — jen pole která přišla
  delete d.id;
  delete d.createdAt;
  const cols = Object.keys(d).filter(k => k !== 'updatedAt');
  if (!cols.length) return res.json({ ok: true });

  const sets = cols.map(c => `${c}=?`).join(',');
  const vals = cols.map(c => d[c] !== undefined ? d[c] : null);

  db.prepare(`UPDATE zakazky SET ${sets}, updatedAt=? WHERE id=?`).run(...vals, ts, req.params.id);
  broadcast('zakazky_changed', { id: req.params.id, action: 'update' }, d.firma);
  res.json({ ok: true });
});

app.delete('/api/zakazky/:id', requireAuth, (req, res) => {
  const z = db.prepare('SELECT firma FROM zakazky WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM zakazky WHERE id=?').run(req.params.id);
  broadcast('zakazky_changed', { id: req.params.id, action: 'delete' }, z?.firma);
  res.json({ ok: true });
});

// ── AUDIT & CHAT (subkolekce zakázky) ─────────────────────────────
app.get('/api/zakazky/:zid/audit', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM audit WHERE zakazkaId=? ORDER BY createdAt ASC').all(req.params.zid);
  res.json(rows);
});

app.post('/api/zakazky/:zid/audit', requireAuth, (req, res) => {
  const d = req.body;
  const id = newId();
  db.prepare('INSERT INTO audit (id,zakazkaId,action,value,note,uid,author,role,createdAt) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, req.params.zid, d.action||'', d.value||'', d.note||'', d.uid||'', d.author||'', d.role||'', now());
  res.json({ id });
});

app.get('/api/zakazky/:zid/chat', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM chat WHERE zakazkaId=? ORDER BY createdAt ASC').all(req.params.zid);
  res.json(rows);
});

app.post('/api/zakazky/:zid/chat', requireAuth, (req, res) => {
  const d = req.body;
  const id = newId();
  const ts = now();
  db.prepare('INSERT INTO chat (id,zakazkaId,text,uid,author,role,createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.params.zid, d.text||'', d.uid||'', d.author||'', d.role||'', ts);
  broadcast('chat_message', { zakazkaId: req.params.zid, id, text: d.text, author: d.author, createdAt: ts }, null);
  res.json({ id });
});

// ── MÍSTA & KLIMATIZACE ─────────────────────────────────────────────
app.get('/api/zakazky/:zid/mista', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM mista WHERE zakazkaId=? ORDER BY nazev').all(req.params.zid);
  res.json(rows);
});

app.post('/api/zakazky/:zid/mista', requireAuth, (req, res) => {
  const d = req.body;
  const id = d.id || newId();
  const ts = now();
  db.prepare('INSERT INTO mista (id,zakazkaId,nazev,adresa,poznamka,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.params.zid, d.nazev||'', d.adresa||'', d.poznamka||'', ts, ts);
  broadcast('mista_changed', { zakazkaId: req.params.zid, id }, null);
  res.json({ id });
});

app.put('/api/zakazky/:zid/mista/:id', requireAuth, (req, res) => {
  const d = req.body;
  db.prepare('UPDATE mista SET nazev=?, adresa=?, poznamka=?, updatedAt=? WHERE id=? AND zakazkaId=?')
    .run(d.nazev||'', d.adresa||'', d.poznamka||'', now(), req.params.id, req.params.zid);
  broadcast('mista_changed', { zakazkaId: req.params.zid, id: req.params.id }, null);
  res.json({ ok: true });
});

app.delete('/api/zakazky/:zid/mista/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM mista WHERE id=? AND zakazkaId=?').run(req.params.id, req.params.zid);
  broadcast('mista_changed', { zakazkaId: req.params.zid, id: req.params.id, deleted: true }, null);
  res.json({ ok: true });
});

// Klimatizace
app.get('/api/zakazky/:zid/mista/:mid/klimatizace', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM klimatizace WHERE mistaId=? ORDER BY model').all(req.params.mid);
  res.json(rows.map(r => ({ ...r, photos: JSON.parse(r.photos||'[]'), zkontrolovano: !!r.zkontrolovano })));
});

app.post('/api/zakazky/:zid/mista/:mid/klimatizace', requireAuth, (req, res) => {
  const d = req.body;
  const id = d.id || newId();
  const ts = now();
  db.prepare(`INSERT INTO klimatizace (id,mistaId,zakazkaId,model,seriove_cislo,umisteni,poznamka,prace,stav,photos,zkontrolovano,datum_kontroly,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.params.mid, req.params.zid, d.model||'', d.seriove_cislo||'', d.umisteni||'',
      d.poznamka||'', d.prace||'', d.stav||'nova', JSON.stringify(d.photos||[]),
      d.zkontrolovano?1:0, d.datum_kontroly||'', ts, ts);
  broadcast('klim_changed', { zakazkaId: req.params.zid, mistaId: req.params.mid, id }, null);
  res.json({ id });
});

app.put('/api/zakazky/:zid/mista/:mid/klimatizace/:id', requireAuth, (req, res) => {
  const d = req.body;
  const photos = typeof d.photos === 'string' ? d.photos : JSON.stringify(d.photos||[]);
  db.prepare(`UPDATE klimatizace SET model=?,seriove_cislo=?,umisteni=?,poznamka=?,prace=?,stav=?,photos=?,zkontrolovano=?,datum_kontroly=?,updatedAt=?
    WHERE id=? AND mistaId=?`)
    .run(d.model||'', d.seriove_cislo||'', d.umisteni||'', d.poznamka||'', d.prace||'',
      d.stav||'nova', photos, d.zkontrolovano?1:0, d.datum_kontroly||'', now(),
      req.params.id, req.params.mid);
  broadcast('klim_changed', { zakazkaId: req.params.zid, mistaId: req.params.mid, id: req.params.id }, null);
  res.json({ ok: true });
});

app.delete('/api/zakazky/:zid/mista/:mid/klimatizace/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM klimatizace WHERE id=? AND mistaId=?').run(req.params.id, req.params.mid);
  res.json({ ok: true });
});

// ── FOTO UPLOAD ────────────────────────────────────────────────────
app.post('/api/upload', requireAuth, upload.array('photos', 20), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Žádné soubory' });
  const urls = req.files.map(f => `/uploads/${req.session.userId}/${f.filename}`);
  res.json({ urls });
});

// Upload base64 (pro offline sync a stávající frontend)
app.post('/api/upload/base64', requireAuth, (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Chybi dataUrl' });
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return res.status(400).json({ error: 'Neplatny format' });
    const prefix = dataUrl.substring(0, commaIdx);
    const b64data = dataUrl.substring(commaIdx + 1);
    let ext = 'jpg';
    const mimeMatch = prefix.match(/data:image\/([a-zA-Z0-9]+)/);
    if (mimeMatch) ext = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
    else if (filename) {
      const fe = filename.split('.').pop().toLowerCase();
      if (['jpg','jpeg','png','webp'].includes(fe)) ext = fe === 'jpeg' ? 'jpg' : fe;
    }
    const data = Buffer.from(b64data, 'base64');
    if (data.length === 0) return res.status(400).json({ error: 'Prazdna data' });
    const userId = req.session.userId || 'anon';
    const dir = path.join(UPLOADS_DIR, userId);
    fs.mkdirSync(dir, { recursive: true });
    const fname = Date.now() + '_' + uuidv4().slice(0,8) + '.' + ext;
    fs.writeFileSync(path.join(dir, fname), data);
    res.json({ url: '/uploads/' + userId + '/' + fname });
  } catch(err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── OSTATNÍ KOLEKCE ────────────────────────────────────────────────
app.use('/api/zakaznici',  collectionRouter('zakaznici',  [], 'nazev'));
app.use('/api/sklad',      collectionRouter('sklad',      [], 'nazev'));
app.use('/api/cenik',      collectionRouter('cenik',      [], 'nazev'));
app.use('/api/sablony',    collectionRouter('sablony',    ['rows'], 'nazev'));
app.use('/api/zakazky_typy', collectionRouter('zakazky_typy', [], 'nazev'));
app.use('/api/vykazy',     collectionRouter('vykazy',     [], 'createdAt'));
app.use('/api/hodnoceni',  collectionRouter('hodnoceni',  [], 'createdAt'));

// ── ZÁLOHA ─────────────────────────────────────────────────────────
app.get('/api/backup', requireAdmin, (req, res) => {
  const backupPath = path.join(__dirname, `backup_${new Date().toISOString().slice(0,10)}.db`);
  db.backup(backupPath).then(() => {
    res.download(backupPath, `servis_backup_${new Date().toISOString().slice(0,10)}.db`, () => {
      fs.unlinkSync(backupPath);
    });
  }).catch(e => res.status(500).json({ error: e.message }));
});

// ── WebSocket ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const wsClients = new Map(); // ws → { userId, firma }

wss.on('connection', (ws, req) => {
  // Ověř session z cookie
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v || '');
  });
  const sid = cookies.sid;
  const session = sid ? db.prepare('SELECT s.*, u.firma FROM sessions s JOIN users u ON u.id=s.userId WHERE s.id=? AND s.expiresAt>?').get(sid, now()) : null;

  if (!session) { ws.close(4001, 'Nepřihlášen'); return; }

  wsClients.set(ws, { userId: session.userId, firma: session.firma });

  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));

  // Ping/pong keep-alive
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Ping všechny klienty každých 30s
setInterval(() => {
  for (const [ws] of wsClients) {
    if (!ws.isAlive) { ws.terminate(); wsClients.delete(ws); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

// ── START ──────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  AC EURO Servisní systém');
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  Databáze: ${DB_FILE}`);
  console.log(`  Přihlášení: admin@servis.local / admin`);
  console.log('  !! ZMĚŇTE HESLO po prvním přihlášení !!');
  console.log('========================================');
  console.log('');
});

process.on('SIGINT', () => { db.close(); process.exit(); });
process.on('SIGTERM', () => { db.close(); process.exit(); });
