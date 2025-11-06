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
    CREATE TABLE IF NOT EXISTS payment (id SERIAL PRIMARY KEY, amount NUMERIC);
    CREATE TABLE IF NOT EXISTS kas (id SERIAL PRIMARY KEY, saldo NUMERIC);
    CREATE TABLE IF NOT EXISTS arus (id SERIAL PRIMARY KEY, tanggal DATE, tipe TEXT, jumlah NUMERIC);
    CREATE TABLE IF NOT EXISTS keluar (id SERIAL PRIMARY KEY, jumlah NUMERIC);
    CREATE TABLE IF NOT EXISTS masuk (id SERIAL PRIMARY KEY, jumlah NUMERIC);
    CREATE TABLE IF NOT EXISTS rekening (id SERIAL PRIMARY KEY, bank TEXT, nomor TEXT);
  `);
  const seeds = [
    ['payment', 'amount', 100000],
    ['kas', 'saldo', 500000],
    ['arus', ['tanggal', 'tipe', 'jumlah'], ['2024-01-01', 'masuk', 100000]],
    ['keluar', 'jumlah', 50000],
    ['masuk', 'jumlah', 150000],
    ['rekening', ['bank', 'nomor'], ['BCA', '123-456']]
  ];
  for (const s of seeds) {
    const table = s[0];
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    if (rows[0].c === 0) {
      if (Array.isArray(s[1])) {
        const cols = s[1]; const vals = s[2];
        const placeholders = vals.map((_, i) => `$${i+1}`).join(',');
        await pool.query(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${placeholders})`, vals);
      } else {
        await pool.query(`INSERT INTO ${table}(${s[1]}) VALUES ($1)`, [s[2]]);
      }
    }
  }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'keuangan-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/payment', async (req, res) => { const { rows } = await pool.query('SELECT id, amount FROM payment ORDER BY id'); res.json(rows); });
app.post('/payment', async (req, res) => { const { amount } = req.body || {}; if (amount == null) return res.status(400).json({ error: 'amount required' }); const { rows } = await pool.query('INSERT INTO payment(amount) VALUES ($1) RETURNING id, amount', [amount]); res.status(201).json(rows[0]); });
app.put('/payment/:id', async (req, res) => { const id = Number(req.params.id); const { amount } = req.body || {}; const { rows } = await pool.query('UPDATE payment SET amount=COALESCE($1,amount) WHERE id=$2 RETURNING id, amount', [amount, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/payment/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM payment WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/kas', async (req, res) => { const { rows } = await pool.query('SELECT id, saldo FROM kas ORDER BY id'); res.json(rows); });
app.get('/arus', async (req, res) => { const { rows } = await pool.query('SELECT tanggal, tipe, jumlah FROM arus ORDER BY tanggal'); res.json(rows); });
app.get('/keluar', async (req, res) => { const { rows } = await pool.query('SELECT id, jumlah FROM keluar ORDER BY id'); res.json(rows); });
app.get('/masuk', async (req, res) => { const { rows } = await pool.query('SELECT id, jumlah FROM masuk ORDER BY id'); res.json(rows); });
app.get('/rekening', async (req, res) => { const { rows } = await pool.query('SELECT id, bank, nomor FROM rekening ORDER BY id'); res.json(rows); });
app.post('/rekening', async (req, res) => { const { bank, nomor } = req.body || {}; if (!bank || !nomor) return res.status(400).json({ error: 'bank and nomor required' }); const { rows } = await pool.query('INSERT INTO rekening(bank, nomor) VALUES ($1, $2) RETURNING id, bank, nomor', [bank, nomor]); res.status(201).json(rows[0]); });
app.put('/rekening/:id', async (req, res) => { const id = Number(req.params.id); const { bank, nomor } = req.body || {}; const { rows } = await pool.query('UPDATE rekening SET bank=COALESCE($1,bank), nomor=COALESCE($2,nomor) WHERE id=$3 RETURNING id, bank, nomor', [bank, nomor, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/rekening/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM rekening WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`keuangan-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });