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
    CREATE TABLE IF NOT EXISTS presensi (id SERIAL PRIMARY KEY, status TEXT);
    CREATE TABLE IF NOT EXISTS absences (id SERIAL PRIMARY KEY, date DATE);
    CREATE TABLE IF NOT EXISTS activities (id SERIAL PRIMARY KEY, activity TEXT);
    CREATE TABLE IF NOT EXISTS checkins (id SERIAL PRIMARY KEY, ts TIMESTAMP);
    CREATE TABLE IF NOT EXISTS setting_presensi (id SERIAL PRIMARY KEY, timezone TEXT, latitude NUMERIC, longitude NUMERIC);
  `);
  const seeds = [
    ['presensi', 'status', 'present'],
    ['absences', 'date', '2024-01-02'],
    ['activities', 'activity', 'Check-in']
  ];
  for (const [table, col, val] of seeds) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    if (rows[0].c === 0) {
      await pool.query(`INSERT INTO ${table}(${col}) VALUES ($1)`, [val]);
    }
  }
  const { rows: spcount } = await pool.query('SELECT COUNT(*)::int AS c FROM setting_presensi');
  if (spcount[0].c === 0) {
    await pool.query(`INSERT INTO setting_presensi(timezone, latitude, longitude) VALUES ($1, $2, $3)`, ['Asia/Jakarta', -6.2, 106.8]);
  }
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'client-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

app.get('/presensi', async (req, res) => { const { rows } = await pool.query('SELECT id, status FROM presensi ORDER BY id'); res.json(rows); });
app.post('/presensi', async (req, res) => { const { status } = req.body || {}; if (!status) return res.status(400).json({ error: 'status required' }); const { rows } = await pool.query('INSERT INTO presensi(status) VALUES ($1) RETURNING id, status', [status]); res.status(201).json(rows[0]); });
app.put('/presensi/:id', async (req, res) => { const id = Number(req.params.id); const { status } = req.body || {}; const { rows } = await pool.query('UPDATE presensi SET status=COALESCE($1,status) WHERE id=$2 RETURNING id, status', [status, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/presensi/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM presensi WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/absences', async (req, res) => { const { rows } = await pool.query('SELECT id, date FROM absences ORDER BY id'); res.json(rows); });
app.get('/activities', async (req, res) => { const { rows } = await pool.query('SELECT id, activity FROM activities ORDER BY id'); res.json(rows); });
app.post('/activities', async (req, res) => { const { activity } = req.body || {}; if (!activity) return res.status(400).json({ error: 'activity required' }); const { rows } = await pool.query('INSERT INTO activities(activity) VALUES ($1) RETURNING id, activity', [activity]); res.status(201).json(rows[0]); });
app.put('/activities/:id', async (req, res) => { const id = Number(req.params.id); const { activity } = req.body || {}; const { rows } = await pool.query('UPDATE activities SET activity=COALESCE($1,activity) WHERE id=$2 RETURNING id, activity', [activity, id]); if (!rows[0]) return res.status(404).json({ error: 'not found' }); res.json(rows[0]); });
app.delete('/activities/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM activities WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });
app.get('/check-in', async (req, res) => { const now = new Date(); await pool.query('INSERT INTO checkins(ts) VALUES ($1)', [now]); res.json({ ok: true, timestamp: now.toISOString() }); });
app.get('/setting-presensi', async (req, res) => { const { rows } = await pool.query('SELECT timezone, latitude, longitude FROM setting_presensi ORDER BY id LIMIT 1'); res.json(rows[0] || {}); });

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`client-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });