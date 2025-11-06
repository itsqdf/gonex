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

app.get('/produk', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM produk ORDER BY id'); res.json(rows); });
app.post('/produk', async (req, res) => { const { name } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const { rows } = await pool.query('INSERT INTO produk(name) VALUES ($1) RETURNING id, name', [name]); res.status(201).json(rows[0]); });
app.put('/produk/:id', async (req, res) => { const id = Number(req.params.id); const { name } = req.body || {}; const { rows } = await pool.query('UPDATE produk SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/produk/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM produk WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/gudang', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM gudang ORDER BY id'); res.json(rows); });
app.post('/gudang', async (req, res) => { const { name } = req.body || {}; if (!name) return res.status(400).json({ error: 'name required' }); const { rows } = await pool.query('INSERT INTO gudang(name) VALUES ($1) RETURNING id, name', [name]); res.status(201).json(rows[0]); });
app.put('/gudang/:id', async (req, res) => { const id = Number(req.params.id); const { name } = req.body || {}; const { rows } = await pool.query('UPDATE gudang SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/gudang/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM gudang WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/mutasi', async (req, res) => { const { rows } = await pool.query('SELECT id, source AS from, target AS to FROM mutasi ORDER BY id'); res.json(rows); });
app.get('/posisi', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM posisi ORDER BY id'); res.json(rows); });
app.get('/rak', async (req, res) => { const { rows } = await pool.query('SELECT id, code FROM rak ORDER BY id'); res.json(rows); });
app.get('/recommendations', async (req, res) => { const { rows } = await pool.query('SELECT product_id AS "productId", score FROM recommendations'); res.json(rows); });
app.get('/maintenance', async (req, res) => { const { rows } = await pool.query('SELECT id, asset_id AS "assetId", status FROM maintenance ORDER BY id'); res.json(rows); });
app.get('/assets', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM assets ORDER BY id'); res.json(rows); });
app.get('/category-asset', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM category_asset ORDER BY id'); res.json(rows); });
app.get('/category-produk', async (req, res) => { const { rows } = await pool.query('SELECT id, name FROM category_produk ORDER BY id'); res.json(rows); });
app.get('/pembelian', async (req, res) => { const { rows } = await pool.query('SELECT id, supplier FROM pembelian ORDER BY id'); res.json(rows); });

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`produk-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });