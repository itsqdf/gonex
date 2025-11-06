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
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      theme TEXT NOT NULL,
      language TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jabatan (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
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

app.get('/companies', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM companies ORDER BY id');
  res.json(rows);
});
app.post('/companies', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query('INSERT INTO companies(name) VALUES ($1) RETURNING id, name', [name]);
  res.status(201).json(rows[0]);
});
app.put('/companies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  const { rows } = await pool.query('UPDATE companies SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]);
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
  const { rows } = await pool.query('INSERT INTO jabatan(name) VALUES ($1) RETURNING id, name', [name]);
  res.status(201).json(rows[0]);
});
app.put('/jabatan/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  const { rows } = await pool.query('UPDATE jabatan SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
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