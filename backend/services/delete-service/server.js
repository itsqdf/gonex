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
    CREATE TABLE IF NOT EXISTS deletion_logs (
      id SERIAL PRIMARY KEY,
      resource TEXT,
      ref_id INTEGER,
      actor TEXT,
      at TIMESTAMP
    );
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM deletion_logs');
  if (rows[0].c === 0) {
    await pool.query(`INSERT INTO deletion_logs(resource, ref_id, actor, at) VALUES
      ($1, $2, $3, $4),
      ($5, $6, $7, $8)`,
      ['asset', 1, 'admin', '2024-01-01T10:00:00Z', 'produk', 2, 'user', '2024-01-02T11:00:00Z']
    );
  }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'delete-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/deletion-logs', async (req, res) => {
  const { rows } = await pool.query('SELECT id, resource, ref_id AS "refId", actor AS "by", at FROM deletion_logs ORDER BY id');
  res.json(rows);
});
app.post('/deletion-logs', async (req, res) => {
  const { resource, refId, by, at } = req.body || {};
  if (!resource || refId == null || !by) return res.status(400).json({ error: 'resource, refId, by required' });
  const ts = at ? new Date(at) : new Date();
  const { rows } = await pool.query('INSERT INTO deletion_logs(resource, ref_id, actor, at) VALUES ($1, $2, $3, $4) RETURNING id, resource, ref_id AS "refId", actor AS "by", at', [resource, refId, by, ts]);
  res.status(201).json(rows[0]);
});
app.delete('/deletion-logs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM deletion_logs WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`delete-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });