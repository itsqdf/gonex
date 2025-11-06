const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// ensure uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadsDir));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      theme TEXT NOT NULL,
      language TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      label TEXT,
      license_number TEXT,
      ceo TEXT,
      since DATE,
      logo_url TEXT,
      signature_url TEXT,
      stamp_url TEXT
    );
    CREATE TABLE IF NOT EXISTS jabatan (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  // Unique index to prevent duplicate jabatan names (case-insensitive)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_jabatan_name_unique'
      ) THEN
        CREATE UNIQUE INDEX idx_jabatan_name_unique ON jabatan (lower(name));
      END IF;
    END
    $$;
  `);
  // Ensure columns exist for older databases
  await pool.query(`
    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS label TEXT,
      ADD COLUMN IF NOT EXISTS license_number TEXT,
      ADD COLUMN IF NOT EXISTS ceo TEXT,
      ADD COLUMN IF NOT EXISTS since DATE,
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS signature_url TEXT,
      ADD COLUMN IF NOT EXISTS stamp_url TEXT;
  `);
  const { rows: setCount } = await pool.query('SELECT COUNT(*)::int AS c FROM settings');
  if (setCount[0].c === 0) {
    await pool.query(`INSERT INTO settings(theme, language) VALUES ($1, $2)`, ['dark', 'id']);
  }
  const { rows: compCount } = await pool.query('SELECT COUNT(*)::int AS c FROM companies');
  if (compCount[0].c === 0) {
    await pool.query(`INSERT INTO companies(name) VALUES ($1)`, ['PT Gonex']);
  }
  const { rows: jabCount } = await pool.query('SELECT COUNT(*)::int AS c FROM jabatan');
  if (jabCount[0].c === 0) {
    await pool.query(`INSERT INTO jabatan(name) VALUES ($1), ($2)`, ['Manager', 'Staff']);
  }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'setting-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/setting', async (req, res) => {
  const { rows } = await pool.query('SELECT theme, language FROM settings ORDER BY id LIMIT 1');
  res.json(rows[0] || {});
});

app.get('/companies', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url FROM companies ORDER BY id');
  res.json(rows);
});
app.get('/companies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await pool.query('SELECT id, name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url FROM companies WHERE id=$1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
// create company with optional uploads
app.post('/companies', upload.fields([{ name: 'logo' }, { name: 'signature' }, { name: 'stamp' }]), async (req, res) => {
  const body = req.body || {};
  const name = (body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const address = body.address || null;
  const label = body.label || null;
  const license_number = body.license_number || null;
  const ceo = body.ceo || null;
  const since = body.since || null; // expect YYYY-MM-DD
  const logo_url = (req.files && req.files['logo'] && req.files['logo'][0]) ? `/uploads/${req.files['logo'][0].filename}` : null;
  const signature_url = (req.files && req.files['signature'] && req.files['signature'][0]) ? `/uploads/${req.files['signature'][0].filename}` : null;
  const stamp_url = (req.files && req.files['stamp'] && req.files['stamp'][0]) ? `/uploads/${req.files['stamp'][0].filename}` : null;
  const { rows } = await pool.query(
    'INSERT INTO companies(name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url',
    [name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url]
  );
  res.status(201).json(rows[0]);
});
// update company with optional uploads
app.put('/companies/:id', upload.fields([{ name: 'logo' }, { name: 'signature' }, { name: 'stamp' }]), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const name = body.name || null;
  const address = body.address || null;
  const label = body.label || null;
  const license_number = body.license_number || null;
  const ceo = body.ceo || null;
  const since = body.since || null;
  const logo_url = (req.files && req.files['logo'] && req.files['logo'][0]) ? `/uploads/${req.files['logo'][0].filename}` : null;
  const signature_url = (req.files && req.files['signature'] && req.files['signature'][0]) ? `/uploads/${req.files['signature'][0].filename}` : null;
  const stamp_url = (req.files && req.files['stamp'] && req.files['stamp'][0]) ? `/uploads/${req.files['stamp'][0].filename}` : null;
  const { rows } = await pool.query(
    'UPDATE companies SET name=COALESCE($1,name), address=COALESCE($2,address), label=COALESCE($3,label), license_number=COALESCE($4,license_number), ceo=COALESCE($5,ceo), since=COALESCE($6,since), logo_url=COALESCE($7,logo_url), signature_url=COALESCE($8,signature_url), stamp_url=COALESCE($9,stamp_url) WHERE id=$10 RETURNING id, name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url',
    [name, address, label, license_number, ceo, since, logo_url, signature_url, stamp_url, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/companies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM companies WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

app.get('/jabatan', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM jabatan ORDER BY id');
  res.json(rows);
});
app.post('/jabatan', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    // Check duplicate (case-insensitive)
    const { rows: exists } = await pool.query('SELECT id FROM jabatan WHERE lower(name)=lower($1) LIMIT 1', [name]);
    if (exists[0]) return res.status(409).json({ error: 'Nama Jabatan sudah ada' });
    const { rows } = await pool.query('INSERT INTO jabatan(name) VALUES ($1) RETURNING id, name', [name]);
    return res.status(201).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'internal error' });
  }
});
app.put('/jabatan/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  try {
    if (name && name.trim()) {
      const { rows: exists } = await pool.query('SELECT id FROM jabatan WHERE lower(name)=lower($1) AND id<>$2 LIMIT 1', [name, id]);
      if (exists[0]) return res.status(409).json({ error: 'Nama Jabatan sudah ada' });
    }
    const { rows } = await pool.query('UPDATE jabatan SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'internal error' });
  }
});
app.delete('/jabatan/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM jabatan WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`setting-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });