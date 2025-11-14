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
  // Ensure base tables exist with richer schemas compatible with frontend needs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment (
      id SERIAL PRIMARY KEY,
      amount NUMERIC
    );

    CREATE TABLE IF NOT EXISTS kas (
      id SERIAL PRIMARY KEY,
      saldo NUMERIC
    );

    CREATE TABLE IF NOT EXISTS arus (
      id SERIAL PRIMARY KEY,
      tanggal TIMESTAMP,
      tipe TEXT,
      jumlah NUMERIC
    );

    CREATE TABLE IF NOT EXISTS keluar (
      id SERIAL PRIMARY KEY,
      tanggal TIMESTAMP DEFAULT NOW(),
      jumlah NUMERIC,
      keterangan TEXT,
      rekening_id INT
    );

    CREATE TABLE IF NOT EXISTS masuk (
      id SERIAL PRIMARY KEY,
      tanggal TIMESTAMP DEFAULT NOW(),
      jumlah NUMERIC,
      keterangan TEXT,
      rekening_id INT
    );

    CREATE TABLE IF NOT EXISTS rekening (
      id SERIAL PRIMARY KEY,
      bank TEXT,
      nomor TEXT,
      kode TEXT,
      jenis TEXT,
      atas_nama TEXT,
      saldo NUMERIC DEFAULT 0
    );
  `);

  // Add missing columns if the tables were created previously with simpler schemas
  await pool.query(`ALTER TABLE IF EXISTS keluar ADD COLUMN IF NOT EXISTS tanggal TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE IF EXISTS keluar ADD COLUMN IF NOT EXISTS keterangan TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS keluar ADD COLUMN IF NOT EXISTS rekening_id INT;`);
  await pool.query(`ALTER TABLE IF EXISTS masuk ADD COLUMN IF NOT EXISTS tanggal TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE IF EXISTS masuk ADD COLUMN IF NOT EXISTS keterangan TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS masuk ADD COLUMN IF NOT EXISTS rekening_id INT;`);
  await pool.query(`ALTER TABLE IF EXISTS rekening ADD COLUMN IF NOT EXISTS kode TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS rekening ADD COLUMN IF NOT EXISTS jenis TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS rekening ADD COLUMN IF NOT EXISTS atas_nama TEXT;`);
  await pool.query(`ALTER TABLE IF EXISTS rekening ADD COLUMN IF NOT EXISTS saldo NUMERIC DEFAULT 0;`);

  // Seed minimal demo data if empty
  const seeds = [
    ['payment', 'amount', 100000],
    ['kas', 'saldo', 500000],
    ['arus', ['tanggal', 'tipe', 'jumlah'], [new Date().toISOString(), 'masuk', 100000]],
    ['keluar', ['jumlah', 'keterangan'], [50000, 'Pengeluaran awal']],
    ['masuk', ['jumlah', 'keterangan'], [150000, 'Pemasukan awal']],
    ['rekening', ['kode','bank','jenis','nomor','atas_nama','saldo'], ['REK-001','BCA','BANK','123-456','Demo User', 0]]
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
// Kas ledger: combine MASUK & KELUAR with pagination and optional search
app.get('/kas', async (req, res) => {
  try {
    const jenis = (req.query.jenis || '').toString().toUpperCase();
    const page = Math.max(1, parseInt((req.query.page || '1').toString(), 10));
    const limit = Math.max(1, parseInt((req.query.limit || '10').toString(), 10));
    const q = (req.query.q || '').toString().trim();

    let rows = [];
    if (jenis === 'MASUK') {
      const r = await pool.query('SELECT id, tanggal, jumlah, COALESCE(keterangan, \'\') AS keterangan, COALESCE(rekening_id, NULL) AS rekening_id FROM masuk ORDER BY tanggal DESC, id DESC');
      rows = r.rows.map(x => ({ ...x, jenis: 'MASUK' }));
    } else if (jenis === 'KELUAR') {
      const r = await pool.query('SELECT id, tanggal, jumlah, COALESCE(keterangan, \'\') AS keterangan, COALESCE(rekening_id, NULL) AS rekening_id FROM keluar ORDER BY tanggal DESC, id DESC');
      rows = r.rows.map(x => ({ ...x, jenis: 'KELUAR' }));
    } else {
      const rMasuk = await pool.query('SELECT id, tanggal, jumlah, COALESCE(keterangan, \'\') AS keterangan, COALESCE(rekening_id, NULL) AS rekening_id FROM masuk');
      const rKeluar = await pool.query('SELECT id, tanggal, jumlah, COALESCE(keterangan, \'\') AS keterangan, COALESCE(rekening_id, NULL) AS rekening_id FROM keluar');
      rows = [
        ...rMasuk.rows.map(x => ({ ...x, jenis: 'MASUK' })),
        ...rKeluar.rows.map(x => ({ ...x, jenis: 'KELUAR' })),
      ].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime() || b.id - a.id);
    }

    // simple search by keterangan
    if (q) {
      const qLower = q.toLowerCase();
      rows = rows.filter(x => (x.keterangan || '').toLowerCase().includes(qLower));
    }

    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);
    res.json({ data, meta: { total, pages, page, limit } });
  } catch (e) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});
app.get('/arus', async (req, res) => { const { rows } = await pool.query('SELECT tanggal, tipe, jumlah FROM arus ORDER BY tanggal'); res.json(rows); });
app.get('/keluar', async (req, res) => { const { rows } = await pool.query('SELECT id, jumlah FROM keluar ORDER BY id'); res.json(rows); });
app.get('/masuk', async (req, res) => { const { rows } = await pool.query('SELECT id, jumlah FROM masuk ORDER BY id'); res.json(rows); });
app.get('/rekening', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT 
      id,
      COALESCE(kode,'') AS kode,
      COALESCE(bank,'') AS nama,
      COALESCE(jenis,'') AS jenis,
      COALESCE(nomor,'') AS nomor,
      COALESCE(atas_nama,'') AS atas_nama,
      COALESCE(saldo,0) AS saldo
    FROM rekening ORDER BY id`
  );
  res.json(rows);
});

app.post('/rekening', async (req, res) => {
  const { kode, nama, bank, jenis, nomor, atas_nama, saldo } = req.body || {};
  const name = (nama || bank || '').toString().trim();
  const number = (nomor || '').toString().trim();
  if (!name || !number) return res.status(400).json({ error: 'nama/bank and nomor required' });
  const j = (jenis || '').toString().trim() || null;
  const an = (atas_nama || '').toString().trim() || null;
  const sVal = Number(saldo);
  const s = Number.isFinite(sVal) ? sVal : 0;
  const { rows } = await pool.query(
    `INSERT INTO rekening(kode, bank, jenis, nomor, atas_nama, saldo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
       COALESCE(kode,'') AS kode,
       COALESCE(bank,'') AS nama,
       COALESCE(jenis,'') AS jenis,
       COALESCE(nomor,'') AS nomor,
       COALESCE(atas_nama,'') AS atas_nama,
       COALESCE(saldo,0) AS saldo`,
    [kode || null, name, j, number, an, s]
  );
  res.status(201).json(rows[0]);
});

app.put('/rekening/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { kode, nama, bank, jenis, nomor, atas_nama, saldo } = req.body || {};
  const name = (nama || bank || null);
  const sVal = Number(saldo);
  const s = Number.isFinite(sVal) ? sVal : null;
  const { rows } = await pool.query(
    `UPDATE rekening SET 
      kode=COALESCE($1, kode),
      bank=COALESCE($2, bank),
      jenis=COALESCE($3, jenis),
      nomor=COALESCE($4, nomor),
      atas_nama=COALESCE($5, atas_nama),
      saldo=COALESCE($6, saldo)
     WHERE id=$7
     RETURNING id,
       COALESCE(kode,'') AS kode,
       COALESCE(bank,'') AS nama,
       COALESCE(jenis,'') AS jenis,
       COALESCE(nomor,'') AS nomor,
       COALESCE(atas_nama,'') AS atas_nama,
       COALESCE(saldo,0) AS saldo`,
    [kode || null, name, jenis || null, nomor || null, atas_nama || null, s, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/rekening/:id', async (req, res) => { const id = Number(req.params.id); const { rowCount } = await pool.query('DELETE FROM rekening WHERE id=$1', [id]); if (!rowCount) return res.status(404).json({ error: 'not found' }); res.json({ ok: true }); });

// Create ledger entries via unified /kas endpoint
app.post('/kas', async (req, res) => {
  try {
    const { jenis, tanggal, jumlah, keterangan, rekening_id } = req.body || {};
    const j = (jenis || '').toString().toUpperCase();
    if (!['MASUK','KELUAR'].includes(j)) return res.status(400).json({ error: 'jenis must be MASUK or KELUAR' });
    const amt = Number(jumlah);
    if (!isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'jumlah must be a positive number' });
    const t = tanggal ? new Date(tanggal) : new Date();
    const table = j === 'MASUK' ? 'masuk' : 'keluar';
    const { rows } = await pool.query(
      `INSERT INTO ${table} (tanggal, jumlah, keterangan, rekening_id) VALUES ($1, $2, $3, $4) RETURNING id, tanggal, jumlah, COALESCE(keterangan,'') AS keterangan, COALESCE(rekening_id,NULL) AS rekening_id`,
      [t.toISOString(), amt, keterangan || null, typeof rekening_id === 'number' ? rekening_id : null]
    );
    const out = rows[0];
    res.status(201).json({ ...out, jenis: j });
  } catch (e) {
    res.status(500).json({ error: e.message || 'server_error' });
  }
});

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`keuangan-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });