const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Simple permission middleware using headers: x-role, x-permissions (comma-separated)
function requirePerm(perm) {
  return (req, res, next) => {
    const role = String(req.headers['x-role'] || '').toLowerCase();
    const permsHeader = String(req.headers['x-permissions'] || '');
    const perms = new Set(permsHeader.split(',').map(p => p.trim()).filter(Boolean));
    const auth = String(req.headers['authorization'] || '');
    // In dev, allow any authenticated request to pass (Bearer token present)
    if (auth.startsWith('Bearer ')) return next();
    if (role === 'admin' || perms.has(perm)) return next();
    return res.status(403).json({ error: 'forbidden', required: perm });
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jenjang (
      id SERIAL PRIMARY KEY,
      kode TEXT,
      name TEXT NOT NULL,
      company_id INT,
      company_name TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tahun_pelajaran (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      kurikulum TEXT,
      tahun TEXT,
      active BOOLEAN DEFAULT TRUE,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mata_pelajaran (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN DEFAULT TRUE,
      company_id INT,
      company_name TEXT,
      jenjang_id INT,
      jenjang_name TEXT,
      hours INT DEFAULT 2,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kelas (
      kode TEXT,
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      kategori TEXT CHECK (kategori IN ('Laki-Laki','Perempuan','Gabungan')),
      wali_kelas_user_id INT,
      wali_kelas_name TEXT,
      nuptk TEXT,
      nip TEXT,
      niy TEXT,
      signature_url TEXT,
      jumlah_kelas INT,
      jenjang_id INT,
      jenjang_name TEXT,
      active BOOLEAN DEFAULT TRUE,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    -- Ensure kode column exists for legacy databases
    ALTER TABLE kelas ADD COLUMN IF NOT EXISTS kode TEXT;
    CREATE TABLE IF NOT EXISTS time_slot (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company_id INT,
      company_name TEXT,
      hari TEXT CHECK (hari IN ('Senin','Selasa','Rabu','Kamis','Jumat')),
      start_hour TEXT,
      end_hour TEXT,
      break_male_start TEXT,
      break_male_end TEXT,
      break_female_start TEXT,
      break_female_end TEXT,
      break_mixed_start TEXT,
      break_mixed_end TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS guru (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL,
      user_name TEXT,
      max_hours INT DEFAULT 20,
      allowed_categories TEXT, -- comma-separated: Laki-Laki,Perempuan,Gabungan
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS guru_subject (
      guru_id INT NOT NULL,
      subject_id INT NOT NULL,
      PRIMARY KEY (guru_id, subject_id)
    );
    CREATE TABLE IF NOT EXISTS jadwal_pembelajaran (
      id SERIAL PRIMARY KEY,
      company_id INT,
      company_name TEXT,
      kelas_id INT,
      kelas_name TEXT,
      hari TEXT,
      start_hour TEXT,
      end_hour TEXT,
      subject_id INT,
      subject_name TEXT,
      guru_id INT,
      guru_name TEXT,
      status TEXT DEFAULT 'scheduled',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'teacher-service' }); }
  catch (e) { res.status(500).json({ status: 'error', error: e.message }); }
});

// Jenjang CRUD
app.get('/akademik/jenjang', requirePerm('akademik.jenjang.read'), async (req, res) => {
  const { rows } = await pool.query('SELECT id, kode, name, company_id, company_name, note, created_at, updated_at FROM jenjang ORDER BY id');
  res.json({ items: rows });
});
app.post('/akademik/jenjang', requirePerm('akademik.jenjang.create'), async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    'INSERT INTO jenjang(kode, name, company_id, company_name, note) VALUES ($1,$2,$3,$4,$5) RETURNING id, kode, name, company_id, company_name, note, created_at, updated_at',
    [b.kode || null, name, Number(b.company_id) || null, b.company_name || null, b.note || null]
  );
  res.status(201).json(rows[0]);
});
app.put('/akademik/jenjang/:id', requirePerm('akademik.jenjang.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const { rows } = await pool.query(
    'UPDATE jenjang SET kode=COALESCE($1,kode), name=COALESCE($2,name), company_id=$3, company_name=$4, note=COALESCE($5,note), updated_at=NOW() WHERE id=$6 RETURNING id, kode, name, company_id, company_name, note, created_at, updated_at',
    [b.kode || null, b.name || null, Number(b.company_id) || null, b.company_name || null, b.note || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/akademik/jenjang/:id', requirePerm('akademik.jenjang.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM mata_pelajaran WHERE jenjang_id=$1 LIMIT 1', [id]);
  const used2 = await pool.query('SELECT 1 FROM kelas WHERE jenjang_id=$1 LIMIT 1', [id]);
  if (used.rows.length || used2.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  const { rowCount } = await pool.query('DELETE FROM jenjang WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Kelas CRUD
app.get('/akademik/kelas', requirePerm('akademik.kelas.read'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, kode, name, kategori, wali_kelas_user_id, wali_kelas_name, nuptk, nip, niy, signature_url, jumlah_kelas, jenjang_id, jenjang_name, active, note, created_at, updated_at FROM kelas ORDER BY id');
  res.json({ items: rows });
});
app.post('/akademik/kelas', requirePerm('akademik.kelas.create'), async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const kategori = b.kategori || null;
  if (kategori && !['Laki-Laki','Perempuan','Gabungan'].includes(kategori)) return res.status(400).json({ error: 'invalid kategori' });
  const { rows } = await pool.query(
    `INSERT INTO kelas(kode, name, kategori, wali_kelas_user_id, wali_kelas_name, nuptk, nip, niy, signature_url, jumlah_kelas, jenjang_id, jenjang_name, active, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id, kode, name, kategori, wali_kelas_user_id, wali_kelas_name, nuptk, nip, niy, signature_url, jumlah_kelas, jenjang_id, jenjang_name, active, note, created_at, updated_at`,
    [b.kode || null, name, kategori, Number(b.wali_kelas_user_id) || null, b.wali_kelas_name || null, b.nuptk || null, b.nip || null, b.niy || null, b.signature_url || null, Number(b.jumlah_kelas) || null, Number(b.jenjang_id) || null, b.jenjang_name || null, b.active !== false, b.note || null]
  );
  res.status(201).json(rows[0]);
});
app.put('/akademik/kelas/:id', requirePerm('akademik.kelas.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE kelas SET
      kode=COALESCE($1,kode),
      name=COALESCE($2,name),
      kategori=COALESCE($3,kategori),
      wali_kelas_user_id=$4,
      wali_kelas_name=$5,
      nuptk=COALESCE($6,nuptk),
      nip=COALESCE($7,nip),
      niy=COALESCE($8,niy),
      signature_url=COALESCE($9,signature_url),
      jumlah_kelas=$10,
      jenjang_id=$11,
      jenjang_name=$12,
      active=COALESCE($13,active),
      note=COALESCE($14,note),
      updated_at=NOW()
     WHERE id=$15
     RETURNING id, kode, name, kategori, wali_kelas_user_id, wali_kelas_name, nuptk, nip, niy, signature_url, jumlah_kelas, jenjang_id, jenjang_name, active, note, created_at, updated_at`,
    [b.kode || null, b.name || null, b.kategori || null, Number(b.wali_kelas_user_id) || null, b.wali_kelas_name || null, b.nuptk || null, b.nip || null, b.niy || null, b.signature_url || null, Number(b.jumlah_kelas) || null, Number(b.jenjang_id) || null, b.jenjang_name || null, typeof b.active === 'boolean' ? b.active : null, b.note || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/akademik/kelas/:id', requirePerm('akademik.kelas.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM jadwal_pembelajaran WHERE kelas_id=$1 LIMIT 1', [id]);
  if (used.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  const { rowCount } = await pool.query('DELETE FROM kelas WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Time Slot CRUD
app.get('/akademik/time', requirePerm('akademik.time.read'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, company_id, company_name, hari, start_hour, end_hour, break_male_start, break_male_end, break_female_start, break_female_end, break_mixed_start, break_mixed_end, created_at, updated_at FROM time_slot ORDER BY id');
  res.json({ items: rows });
});
app.post('/akademik/time', requirePerm('akademik.time.create'), async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  if (b.hari && !['Senin','Selasa','Rabu','Kamis','Jumat'].includes(b.hari)) return res.status(400).json({ error: 'invalid hari' });
  const { rows } = await pool.query(
    `INSERT INTO time_slot(name, company_id, company_name, hari, start_hour, end_hour, break_male_start, break_male_end, break_female_start, break_female_end, break_mixed_start, break_mixed_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, name, company_id, company_name, hari, start_hour, end_hour, break_male_start, break_male_end, break_female_start, break_female_end, break_mixed_start, break_mixed_end, created_at, updated_at`,
    [name, Number(b.company_id) || null, b.company_name || null, b.hari || null, b.start_hour || null, b.end_hour || null, b.break_male_start || null, b.break_male_end || null, b.break_female_start || null, b.break_female_end || null, b.break_mixed_start || null, b.break_mixed_end || null]
  );
  res.status(201).json(rows[0]);
});
app.put('/akademik/time/:id', requirePerm('akademik.time.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE time_slot SET name=COALESCE($1,name), company_id=$2, company_name=$3, hari=COALESCE($4,hari), start_hour=COALESCE($5,start_hour), end_hour=COALESCE($6,end_hour),
      break_male_start=COALESCE($7,break_male_start), break_male_end=COALESCE($8,break_male_end), break_female_start=COALESCE($9,break_female_start), break_female_end=COALESCE($10,break_female_end), break_mixed_start=COALESCE($11,break_mixed_start), break_mixed_end=COALESCE($12,break_mixed_end), updated_at=NOW()
      WHERE id=$13
      RETURNING id, name, company_id, company_name, hari, start_hour, end_hour, break_male_start, break_male_end, break_female_start, break_female_end, break_mixed_start, break_mixed_end, created_at, updated_at`,
    [b.name || null, Number(b.company_id) || null, b.company_name || null, b.hari || null, b.start_hour || null, b.end_hour || null, b.break_male_start || null, b.break_male_end || null, b.break_female_start || null, b.break_female_end || null, b.break_mixed_start || null, b.break_mixed_end || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/akademik/time/:id', requirePerm('akademik.time.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM jadwal_pembelajaran WHERE company_id=$1 LIMIT 1', [id]);
  // Note: using company_id here may not match time-slot usage; keep conservative to avoid deleting if possibly referenced
  if (used.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  const { rowCount } = await pool.query('DELETE FROM time_slot WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Tahun Pelajaran CRUD
app.get('/akademik/tahun', requirePerm('akademik.tahun.read'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, kurikulum, tahun, active, note, created_at, updated_at FROM tahun_pelajaran ORDER BY id');
  res.json({ items: rows });
});
app.post('/akademik/tahun', requirePerm('akademik.tahun.create'), async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    'INSERT INTO tahun_pelajaran(name, kurikulum, tahun, active, note) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, kurikulum, tahun, active, note, created_at, updated_at',
    [name, b.kurikulum || null, b.tahun || null, b.active !== false, b.note || null]
  );
  res.status(201).json(rows[0]);
});
app.put('/akademik/tahun/:id', requirePerm('akademik.tahun.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const { rows } = await pool.query(
    'UPDATE tahun_pelajaran SET name=COALESCE($1,name), kurikulum=COALESCE($2,kurikulum), tahun=COALESCE($3,tahun), active=COALESCE($4,active), note=COALESCE($5,note), updated_at=NOW() WHERE id=$6 RETURNING id, name, kurikulum, tahun, active, note, created_at, updated_at',
    [b.name || null, b.kurikulum || null, b.tahun || null, typeof b.active === 'boolean' ? b.active : null, b.note || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/akademik/tahun/:id', requirePerm('akademik.tahun.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM jadwal_pembelajaran WHERE company_id IS NOT NULL LIMIT 1');
  if (used.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  const { rowCount } = await pool.query('DELETE FROM tahun_pelajaran WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Mata Pelajaran CRUD
app.get('/akademik/mapel', requirePerm('akademik.mapel.read'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, active, company_id, company_name, jenjang_id, jenjang_name, hours, note, created_at, updated_at FROM mata_pelajaran ORDER BY id');
  res.json({ items: rows });
});
app.post('/akademik/mapel', requirePerm('akademik.mapel.create'), async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const hours = Number(b.hours || 2);
  const { rows } = await pool.query(
    'INSERT INTO mata_pelajaran(name, active, company_id, company_name, jenjang_id, jenjang_name, hours, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, name, active, company_id, company_name, jenjang_id, jenjang_name, hours, note, created_at, updated_at',
    [name, b.active !== false, Number(b.company_id) || null, b.company_name || null, Number(b.jenjang_id) || null, b.jenjang_name || null, hours, b.note || null]
  );
  res.status(201).json(rows[0]);
});
app.put('/akademik/mapel/:id', requirePerm('akademik.mapel.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const hours = b.hours !== undefined ? Number(b.hours) : null;
  const { rows } = await pool.query(
    'UPDATE mata_pelajaran SET name=COALESCE($1,name), active=COALESCE($2,active), company_id=$3, company_name=$4, jenjang_id=$5, jenjang_name=$6, hours=COALESCE($7,hours), note=COALESCE($8,note), updated_at=NOW() WHERE id=$9 RETURNING id, name, active, company_id, company_name, jenjang_id, jenjang_name, hours, note, created_at, updated_at',
    [b.name || null, typeof b.active === 'boolean' ? b.active : null, Number(b.company_id) || null, b.company_name || null, Number(b.jenjang_id) || null, b.jenjang_name || null, hours, b.note || null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.delete('/akademik/mapel/:id', requirePerm('akademik.mapel.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM guru_subject WHERE subject_id=$1 LIMIT 1', [id]);
  const used2 = await pool.query('SELECT 1 FROM jadwal_pembelajaran WHERE subject_id=$1 LIMIT 1', [id]);
  if (used.rows.length || used2.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  const { rowCount } = await pool.query('DELETE FROM mata_pelajaran WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Data Guru CRUD
app.get('/akademik/guru', requirePerm('akademik.guru.read'), async (_req, res) => {
  const { rows } = await pool.query('SELECT id, user_id, user_name, max_hours, allowed_categories, active, created_at, updated_at FROM guru ORDER BY id');
  const subjects = await pool.query('SELECT guru_id, subject_id FROM guru_subject');
  const byGuru = new Map();
  for (const r of subjects.rows) {
    const arr = byGuru.get(r.guru_id) || [];
    arr.push(r.subject_id);
    byGuru.set(r.guru_id, arr);
  }
  const items = rows.map(r => ({ ...r, subject_ids: byGuru.get(r.id) || [] }));
  res.json({ items });
});
app.post('/akademik/guru', requirePerm('akademik.guru.create'), async (req, res) => {
  const b = req.body || {};
  const uid = Number(b.user_id);
  if (!uid) return res.status(400).json({ error: 'user_id required' });
  const { rows } = await pool.query(
    'INSERT INTO guru(user_id, user_name, max_hours, allowed_categories, active) VALUES ($1,$2,$3,$4,$5) RETURNING id, user_id, user_name, max_hours, allowed_categories, active, created_at, updated_at',
    [uid, b.user_name || null, Number(b.max_hours) || 20, (Array.isArray(b.allowed_categories)?b.allowed_categories:[]).join(','), b.active !== false]
  );
  const gid = rows[0].id;
  const subjectIds = Array.isArray(b.subject_ids) ? b.subject_ids.map(Number).filter(n=>isFinite(n)) : [];
  for (const sid of subjectIds) {
    await pool.query('INSERT INTO guru_subject(guru_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [gid, sid]);
  }
  res.status(201).json(rows[0]);
});
app.put('/akademik/guru/:id', requirePerm('akademik.guru.update'), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const { rows } = await pool.query(
    'UPDATE guru SET user_id=$1, user_name=$2, max_hours=COALESCE($3,max_hours), allowed_categories=COALESCE($4,allowed_categories), active=COALESCE($5,active), updated_at=NOW() WHERE id=$6 RETURNING id, user_id, user_name, max_hours, allowed_categories, active, created_at, updated_at',
    [Number(b.user_id) || null, b.user_name || null, Number(b.max_hours) || null, Array.isArray(b.allowed_categories) ? b.allowed_categories.join(',') : (b.allowed_categories || null), typeof b.active === 'boolean' ? b.active : null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (Array.isArray(b.subject_ids)) {
    await pool.query('DELETE FROM guru_subject WHERE guru_id=$1', [id]);
    for (const sid of b.subject_ids.map(Number).filter(n=>isFinite(n))) {
      await pool.query('INSERT INTO guru_subject(guru_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, sid]);
    }
  }
  res.json(rows[0]);
});
app.delete('/akademik/guru/:id', requirePerm('akademik.guru.delete'), async (req, res) => {
  const id = Number(req.params.id);
  const used = await pool.query('SELECT 1 FROM jadwal_pembelajaran WHERE guru_id=$1 LIMIT 1', [id]);
  if (used.rows.length) return res.status(400).json({ error: 'cannot_delete_used' });
  await pool.query('DELETE FROM guru_subject WHERE guru_id=$1', [id]);
  const { rowCount } = await pool.query('DELETE FROM guru WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Build Jadwal Pembelajaran (naive)
app.post('/akademik/jadwal/build', requirePerm('akademik.jadwal.build'), async (req, res) => {
  try {
    const companyId = Number(req.body && req.body.company_id);
    const companyName = (req.body && req.body.company_name) || null;
    if (!companyId) return res.status(400).json({ error: 'company_id required' });
    const { rows: classes } = await pool.query('SELECT id, name, kategori FROM kelas WHERE active=TRUE ORDER BY id');
    const { rows: subjects } = await pool.query('SELECT id, name, hours FROM mata_pelajaran WHERE active=TRUE ORDER BY id');
    const { rows: teachers } = await pool.query('SELECT id, user_id, user_name, max_hours, allowed_categories FROM guru WHERE active=TRUE ORDER BY id');
    const { rows: teacherSubjects } = await pool.query('SELECT guru_id, subject_id FROM guru_subject');
    const mapTeacherSubjects = new Map();
    for (const ts of teacherSubjects) {
      const arr = mapTeacherSubjects.get(ts.guru_id) || [];
      arr.push(ts.subject_id);
      mapTeacherSubjects.set(ts.guru_id, arr);
    }
    const { rows: slots } = await pool.query('SELECT id, hari, start_hour, end_hour FROM time_slot WHERE company_id=$1 ORDER BY id', [companyId]);

    const teacherLoad = new Map();
    const created = [];
    for (const kelas of classes) {
      for (const subj of subjects) {
        let remaining = Number(subj.hours || 2);
        // pick a teacher who can teach this subject and category with available hours
        const eligibleTeachers = teachers.filter(t => {
          const allowed = String(t.allowed_categories || '').split(',').filter(Boolean);
          const canCategory = allowed.length === 0 || allowed.includes(kelas.kategori);
          const canSubject = (mapTeacherSubjects.get(t.id) || []).includes(subj.id);
          const load = teacherLoad.get(t.id) || 0;
          return canCategory && canSubject && load < Number(t.max_hours || 0);
        });
        const teacher = eligibleTeachers[0] || null;
        for (const slot of slots) {
          if (remaining <= 0) break;
          if (!teacher) break;
          const load = teacherLoad.get(teacher.id) || 0;
          if (load >= Number(teacher.max_hours || 0)) break;
          await pool.query(
            'INSERT INTO jadwal_pembelajaran(company_id, company_name, kelas_id, kelas_name, hari, start_hour, end_hour, subject_id, subject_name, guru_id, guru_name, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            [companyId, companyName, kelas.id, kelas.name, slot.hari, slot.start_hour, slot.end_hour, subj.id, subj.name, teacher.id, teacher.user_name, 'scheduled']
          );
          created.push({ kelas_id: kelas.id, subject_id: subj.id, slot_id: slot.id, guru_id: teacher.id });
          teacherLoad.set(teacher.id, load + 1);
          remaining -= 1;
        }
      }
    }
    res.status(201).json({ ok: true, created_count: created.length });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});
app.get('/akademik/jadwal', requirePerm('akademik.jadwal.read'), async (req, res) => {
  const companyId = Number(req.query.company_id || 1);
  const { rows } = await pool.query('SELECT id, company_id, company_name, kelas_id, kelas_name, hari, start_hour, end_hour, subject_id, subject_name, guru_id, guru_name, status, created_at FROM jadwal_pembelajaran WHERE company_id=$1 ORDER BY id', [companyId]);
  res.json({ items: rows });
});

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`teacher-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });