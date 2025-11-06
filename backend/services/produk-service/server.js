const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produk (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS gudang (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mutasi (id SERIAL PRIMARY KEY, source TEXT, target TEXT);
    CREATE TABLE IF NOT EXISTS posisi (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rak (id SERIAL PRIMARY KEY, code TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS recommendations (product_id INTEGER, score NUMERIC, PRIMARY KEY(product_id));
    CREATE TABLE IF NOT EXISTS maintenance (id SERIAL PRIMARY KEY, asset_id INTEGER, status TEXT);
    CREATE TABLE IF NOT EXISTS assets (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS category_asset (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS category_produk (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pembelian (id SERIAL PRIMARY KEY, supplier TEXT);
  `);
  // Ensure required columns exist (idempotent)
  await pool.query(`
    ALTER TABLE IF EXISTS category_asset
      ADD COLUMN IF NOT EXISTS deskripsi TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS maintenance BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS category_produk
      ADD COLUMN IF NOT EXISTS deskripsi TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS assets
      ADD COLUMN IF NOT EXISTS category_id INTEGER,
      ADD COLUMN IF NOT EXISTS code TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS purchase_date DATE,
      ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS need_maintenance BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS maintenance
      ADD COLUMN IF NOT EXISTS requested_by INTEGER,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER,
      ADD COLUMN IF NOT EXISTS issue_description TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS maintenance_date DATE,
      ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
  `);
  const { rows: pcount } = await pool.query('SELECT COUNT(*)::int AS c FROM produk');
  if (pcount[0].c === 0) {
    await pool.query(`INSERT INTO produk(name) VALUES ($1)`, ['Produk A']);
  }
  const tablesSeed = [
    ['gudang', 'name', 'Gudang Utama'],
    ['posisi', 'name', 'Lantai 2'],
    ['rak', 'code', 'R-01'],
    ['assets', 'name', 'Laptop'],
    ['category_asset', 'name', 'Elektronik'],
    ['category_produk', 'name', 'Minuman'],
    ['pembelian', 'supplier', 'PT Supplier']
  ];
  for (const [table, col, val] of tablesSeed) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    if (rows[0].c === 0) {
      await pool.query(`INSERT INTO ${table}(${col}) VALUES ($1)`, [val]);
    }
  }
  await pool.query(`INSERT INTO recommendations(product_id, score)
    SELECT 1, 0.9
    ON CONFLICT (product_id) DO NOTHING`);
  const { rows: mcount } = await pool.query('SELECT COUNT(*)::int AS c FROM mutasi');
  if (mcount[0].c === 0) {
    await pool.query(`INSERT INTO mutasi(source, target) VALUES ($1, $2)`, ['Gudang', 'Toko']);
  }
  const { rows: maintCount } = await pool.query('SELECT COUNT(*)::int AS c FROM maintenance');
  if (maintCount[0].c === 0) {
    await pool.query(`INSERT INTO maintenance(asset_id, status) VALUES ($1, $2)`, [1, 'scheduled']);
  }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'produk-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/produk', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM produk ORDER BY id'); res.json({ data: rows }); });
app.post('/produk', async (req, res) => { const { name } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const { rows } = await pool.query('INSERT INTO produk(name) VALUES ($1) RETURNING id, name', [name]); res.status(201).json({ data: rows[0] }); });
app.put('/produk/:id', async (req, res) => { const id = Number(req.params.id); const { name } = req.body || {}; const { rows } = await pool.query('UPDATE produk SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json({ data: rows[0] }); });
app.delete('/produk/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM produk WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/gudang', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM gudang ORDER BY id'); res.json({ data: rows }); });
app.post('/gudang', async (req, res) => { const { name } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const { rows } = await pool.query('INSERT INTO gudang(name) VALUES ($1) RETURNING id, name', [name]); res.status(201).json({ data: rows[0] }); });
app.put('/gudang/:id', async (req, res) => { const id = Number(req.params.id); const { name } = req.body || {}; const { rows } = await pool.query('UPDATE gudang SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json({ data: rows[0] }); });
app.delete('/gudang/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM gudang WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/mutasi', async (req, res) => { const { rows } = await pool.query('SELECT id, source AS from, target AS to FROM mutasi ORDER BY id'); res.json({ data: rows }); });
app.get('/posisi', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM posisi ORDER BY id'); res.json({ data: rows }); });
app.get('/rak', async (req, res) => { const { rows } = await pool.query('SELECT id, code FROM rak ORDER BY id'); res.json({ data: rows }); });
app.get('/recommendations', async (req, res) => { const { rows } = await pool.query('SELECT product_id AS "productId", score FROM recommendations'); res.json({ data: rows }); });
// Maintenance CRUD
app.get('/maintenance', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = '';
  if (q) { params.push(`%${q}%`); where = 'WHERE m.issue_description ILIKE $1 OR a.name ILIKE $1 OR a.code ILIKE $1'; }
  const { rows } = await pool.query(
    `SELECT m.id, m.asset_id, a.name AS asset_name, a.code AS asset_code, m.requested_by, m.approved_by,
            m.status, m.issue_description, m.maintenance_date, m.cost, m.note, m.created_at, m.updated_at
     FROM maintenance m LEFT JOIN assets a ON a.id = m.asset_id ${where} ORDER BY m.id`, params);
  res.json({ data: rows });
});
app.post('/maintenance', async (req, res) => {
  const { asset_id, requested_by, approved_by, status, issue_description, maintenance_date, cost, note } = req.body || {};
  if (!asset_id) return res.status(400).json({ error: 'asset_id required' });
  const { rows } = await pool.query(
    `INSERT INTO maintenance(asset_id, requested_by, approved_by, status, issue_description, maintenance_date, cost, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, asset_id, requested_by, approved_by, status, issue_description, maintenance_date, cost, note, created_at, updated_at`,
    [asset_id || null, requested_by || null, approved_by || null, status || 'requested', issue_description || '', maintenance_date || null, cost || 0, note || '']
  );
  res.status(201).json({ data: rows[0] });
});
app.put('/maintenance/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { asset_id, requested_by, approved_by, status, issue_description, maintenance_date, cost, note } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE maintenance SET
       asset_id = COALESCE($1, asset_id),
       requested_by = $2,
       approved_by = $3,
       status = COALESCE($4, status),
       issue_description = COALESCE($5, issue_description),
       maintenance_date = $6,
       cost = COALESCE($7, cost),
       note = COALESCE($8, note),
       updated_at = NOW()
     WHERE id = $9
     RETURNING id, asset_id, requested_by, approved_by, status, issue_description, maintenance_date, cost, note, created_at, updated_at`,
    [asset_id || null, requested_by || null, approved_by || null, status || null, issue_description || null, maintenance_date || null, cost || null, note || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ data: rows[0] });
});
app.delete('/maintenance/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM maintenance WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
// Assets CRUD
app.get('/assets', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = '';
  if (q) { params.push(`%${q}%`); where = 'WHERE a.name ILIKE $1 OR a.code ILIKE $1 OR a.description ILIKE $1'; }
  const { rows } = await pool.query(
    `SELECT a.id, a.category_id, c.name AS category_nama, a.name, a.code, a.description, a.purchase_date, a.value, a.location, a.status, a.need_maintenance, a.created_at, a.updated_at
     FROM assets a LEFT JOIN category_asset c ON c.id = a.category_id ${where} ORDER BY a.id`, params);
  res.json({ data: rows });
});
app.post('/assets', async (req, res) => {
  const { category_id, name, code, description, purchase_date, value, location, status, need_maintenance } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    `INSERT INTO assets(category_id, name, code, description, purchase_date, value, location, status, need_maintenance)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, category_id, name, code, description, purchase_date, value, location, status, need_maintenance, created_at, updated_at`,
    [category_id || null, name, code || '', description || '', purchase_date || null, value || 0, location || '', status || 'active', !!need_maintenance]
  );
  res.status(201).json({ data: rows[0] });
});
app.put('/assets/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { category_id, name, code, description, purchase_date, value, location, status, need_maintenance } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE assets SET
       category_id = $1,
       name = COALESCE($2, name),
       code = COALESCE($3, code),
       description = COALESCE($4, description),
       purchase_date = $5,
       value = COALESCE($6, value),
       location = COALESCE($7, location),
       status = COALESCE($8, status),
       need_maintenance = COALESCE($9, need_maintenance),
       updated_at = NOW()
     WHERE id = $10
     RETURNING id, category_id, name, code, description, purchase_date, value, location, status, need_maintenance, created_at, updated_at`,
    [category_id || null, name || null, code || null, description || null, purchase_date || null, value || null, location || null, status || null, typeof need_maintenance === 'boolean' ? need_maintenance : null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ data: rows[0] });
});
app.delete('/assets/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM assets WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
// Category Asset CRUD
app.get('/category-asset', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = '';
  if (q) { params.push(`%${q}%`); where = 'WHERE name ILIKE $1 OR deskripsi ILIKE $1'; }
  const { rows } = await pool.query(`SELECT id, name AS nama, deskripsi, maintenance, created_at, updated_at FROM category_asset ${where} ORDER BY id`, params);
  res.json({ data: rows });
});
app.post('/category-asset', async (req, res) => {
  const { nama, deskripsi, maintenance } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'nama required' });
  const { rows } = await pool.query(
    `INSERT INTO category_asset(name, deskripsi, maintenance)
     VALUES ($1,$2,$3)
     RETURNING id, name AS nama, deskripsi, maintenance, created_at, updated_at`,
    [nama, deskripsi || '', !!maintenance]
  );
  res.status(201).json({ data: rows[0] });
});
app.put('/category-asset/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nama, deskripsi, maintenance } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE category_asset SET
       name = COALESCE($1, name),
       deskripsi = COALESCE($2, deskripsi),
       maintenance = COALESCE($3, maintenance),
       updated_at = NOW()
     WHERE id = $4
     RETURNING id, name AS nama, deskripsi, maintenance, created_at, updated_at`,
    [nama || null, deskripsi || null, typeof maintenance === 'boolean' ? maintenance : null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ data: rows[0] });
});
app.delete('/category-asset/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM category_asset WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
// Alias for plural path used by frontend
app.get('/category-assets', async (req, res) => {
  req.url = req.url.replace('/category-assets', '/category-asset');
  app._router.handle(req, res);
});
app.post('/category-assets', async (req, res) => {
  req.url = req.url.replace('/category-assets', '/category-asset');
  app._router.handle(req, res);
});
app.put('/category-assets/:id', async (req, res) => {
  req.url = req.url.replace('/category-assets', '/category-asset');
  app._router.handle(req, res);
});
app.delete('/category-assets/:id', async (req, res) => {
  req.url = req.url.replace('/category-assets', '/category-asset');
  app._router.handle(req, res);
});
// Category Produk CRUD
app.get('/category-produk', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = [];
  let where = '';
  if (q) { params.push(`%${q}%`); where = 'WHERE name ILIKE $1 OR deskripsi ILIKE $1'; }
  const { rows } = await pool.query(`SELECT id, name AS nama, deskripsi, created_at, updated_at FROM category_produk ${where} ORDER BY id`, params);
  res.json({ data: rows });
});
app.post('/category-produk', async (req, res) => {
  const { nama, deskripsi } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'nama required' });
  const { rows } = await pool.query(
    `INSERT INTO category_produk(name, deskripsi)
     VALUES ($1,$2)
     RETURNING id, name AS nama, deskripsi, created_at, updated_at`,
    [nama, deskripsi || '']
  );
  res.status(201).json({ data: rows[0] });
});
app.put('/category-produk/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nama, deskripsi } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE category_produk SET
       name = COALESCE($1, name),
       deskripsi = COALESCE($2, deskripsi),
       updated_at = NOW()
     WHERE id = $3
     RETURNING id, name AS nama, deskripsi, created_at, updated_at`,
    [nama || null, deskripsi || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ data: rows[0] });
});
app.delete('/category-produk/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM category_produk WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
// Alias for alt path used by gateway rewrite
app.get('/category-products', async (req, res) => {
  req.url = req.url.replace('/category-products', '/category-produk');
  app._router.handle(req, res);
});
app.post('/category-products', async (req, res) => {
  req.url = req.url.replace('/category-products', '/category-produk');
  app._router.handle(req, res);
});
app.put('/category-products/:id', async (req, res) => {
  req.url = req.url.replace('/category-products', '/category-produk');
  app._router.handle(req, res);
});
app.delete('/category-products/:id', async (req, res) => {
  req.url = req.url.replace('/category-products', '/category-produk');
  app._router.handle(req, res);
});
// Pembelian
app.get('/pembelian', async (req, res) => { const { rows } = await pool.query('SELECT id, supplier FROM pembelian ORDER BY id'); res.json({ data: rows }); });

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`produk-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });