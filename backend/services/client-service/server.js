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
    CREATE TABLE IF NOT EXISTS checkins (
      id SERIAL PRIMARY KEY,
      user_id INT,
      location TEXT,
      ts TIMESTAMP,
      status TEXT,
      notes TEXT,
      late_minutes INT,
      early_departure_minutes INT
    );
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
// Legacy simple check-in
app.get('/check-in', async (req, res) => { const now = new Date(); await pool.query('INSERT INTO checkins(ts) VALUES ($1)', [now]); res.json({ ok: true, timestamp: now.toISOString() }); });

// New: verify location and biometrics, record check-in
app.post('/presensi/check-in', async (req, res) => {
  try {
    const { user_id, method, latitude, longitude, notes } = req.body || {};
    let uid = Number(user_id || 0);
    const lat = Number(latitude), lng = Number(longitude);
    const mth = String(method || '').toLowerCase();
    // Fallback: ambil user dari token jika user_id tidak dikirim
    const authUrl = process.env.AUTH_URL || 'http://auth-user-service-go:3000';
    if (!uid) {
      const ah = req.headers['authorization'] || '';
      if (ah) {
        try {
          const meRes = await fetch(`${authUrl}/auth/me`, { headers: { Authorization: ah } });
          const me = await meRes.json();
          if (meRes.ok && (me?.id || me?.user_id)) uid = Number(me.id || me.user_id);
        } catch {}
      }
    }
    if (!uid || !isFinite(lat) || !isFinite(lng) || !['face','qr','fingerprint'].includes(mth)) {
      return res.status(400).json({ error: 'user_id, latitude, longitude, and method (face|qr|fingerprint) required' });
    }

    // Fetch user to get jabatan name
    const setUrl = process.env.SETTING_URL || 'http://setting-service:3000';
    const ures = await fetch(`${authUrl}/users/${uid}`);
    const ujson = await ures.json();
    if (!ures.ok) return res.status(404).json({ error: 'user_not_found' });
    const jabatanName = (ujson && ujson.user && ujson.user.jabatan) || '';

    // Map jabatan name -> id
    const jres = await fetch(`${setUrl}/jabatan`);
    const jlist = await jres.json();
    const jmap = new Map();
    (Array.isArray(jlist) ? jlist : []).forEach(it => { if (it && it.name) jmap.set(String(it.name), Number(it.id)); });
    const jid = jmap.get(jabatanName) || 0;

    // Get method configured for jabatan
    const jmres = await fetch(`${setUrl}/jabatan-presensi`);
    const jmlist = await jmres.json();
    const jm = Array.isArray(jmlist) ? jmlist.find(it => Number(it.jabatan_id) === Number(jid)) : null;
    const allowedMethod = jm ? String(jm.method) : null;
    if (!allowedMethod) return res.status(403).json({ error: 'method_not_configured_for_jabatan' });
    if (allowedMethod !== mth) return res.status(403).json({ error: 'method_not_allowed_for_jabatan', allowed: allowedMethod });

    // Allowed locations
    const companyId = Number(req.query.company_id || 1);
    const locRes = await fetch(`${setUrl}/settings/locations?company_id=${companyId}`);
    const locJson = await locRes.json();
    const locations = (locJson && locJson.items) || [];
    const haversine = (lat1, lon1, lat2, lon2) => {
      const toRad = deg => deg * Math.PI / 180;
      const R = 6371000; // meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    const inside = locations.find(l => l.active && haversine(lat, lng, Number(l.latitude), Number(l.longitude)) <= Number(l.radius_m || 50));
    if (!inside) return res.status(403).json({ error: 'location_not_allowed' });

    // Ensure biometrics exists and active for method
    const bres = await fetch(`${authUrl}/user-biometrics?user_id=${uid}`);
    const blist = await bres.json();
    const b = Array.isArray(blist) && blist.length ? blist[0] : null;
    if (!b || !b.active) return res.status(404).json({ error: 'biometrics_not_found_or_inactive' });
    if (mth === 'face' && !b.face_vector) return res.status(404).json({ error: 'face_vector_missing' });
    if (mth === 'qr' && !b.qr_code) return res.status(404).json({ error: 'qr_code_missing' });
    if (mth === 'fingerprint' && !b.fingerprint_hash) return res.status(404).json({ error: 'fingerprint_hash_missing' });

    // Compute lateness against company settings
    const csRes = await fetch(`${setUrl}/settings/company/${companyId}`);
    const cs = await csRes.json();
    const now = new Date();
    const parseHM = (s) => { if (!s) return null; const [h,m] = String(s).split(':').map(n=>parseInt(n,10)); if (isNaN(h)||isNaN(m)) return null; const d = new Date(now); d.setHours(h, m, 0, 0); return d; };
    const targetIn = parseHM(cs.default_check_in);
    const targetOut = parseHM(cs.default_check_out);
    let lateMin = 0;
    if (targetIn && now > targetIn) lateMin = Math.round((now.getTime() - targetIn.getTime())/60000);

    // Record check-in
    const locStr = JSON.stringify({ latitude: lat, longitude: lng, location_id: inside.id });
    const { rows } = await pool.query(
      'INSERT INTO checkins(user_id, location, ts, status, notes, late_minutes, early_departure_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [uid, locStr, now, 'check_in', notes || null, lateMin, null]
    );
    res.status(201).json({ ok: true, id: rows[0].id, late_minutes: lateMin, method: mth });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});

// New: verify and record check-out
app.post('/presensi/check-out', async (req, res) => {
  try {
    const { user_id, latitude, longitude, notes } = req.body || {};
    let uid = Number(user_id || 0);
    const lat = Number(latitude), lng = Number(longitude);
    const authUrl = process.env.AUTH_URL || 'http://auth-user-service-go:3000';
    const setUrl = process.env.SETTING_URL || 'http://setting-service:3000';
    if (!uid) {
      const ah = req.headers['authorization'] || '';
      if (ah) {
        try {
          const meRes = await fetch(`${authUrl}/auth/me`, { headers: { Authorization: ah } });
          const me = await meRes.json();
          if (meRes.ok && (me?.id || me?.user_id)) uid = Number(me.id || me.user_id);
        } catch {}
      }
    }
    if (!uid || !isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: 'user_id, latitude and longitude required' });
    }

    // Fetch user and method by jabatan
    const ures = await fetch(`${authUrl}/users/${uid}`);
    const ujson = await ures.json();
    if (!ures.ok) return res.status(404).json({ error: 'user_not_found' });
    const jabatanName = (ujson && ujson.user && ujson.user.jabatan) || '';
    const jres = await fetch(`${setUrl}/jabatan`);
    const jlist = await jres.json();
    const jmap = new Map();
    (Array.isArray(jlist) ? jlist : []).forEach(it => { if (it && it.name) jmap.set(String(it.name), Number(it.id)); });
    const jid = jmap.get(jabatanName) || 0;
    const jmres = await fetch(`${setUrl}/jabatan-presensi`);
    const jmlist = await jmres.json();
    const jm = Array.isArray(jmlist) ? jmlist.find(it => Number(it.jabatan_id) === Number(jid)) : null;
    const mth = jm ? String(jm.method) : null;
    if (!mth) return res.status(403).json({ error: 'method_not_configured_for_jabatan' });

    // Allowed locations
    const companyId = Number(req.query.company_id || 1);
    const locRes = await fetch(`${setUrl}/settings/locations?company_id=${companyId}`);
    const locJson = await locRes.json();
    const locations = (locJson && locJson.items) || [];
    const haversine = (lat1, lon1, lat2, lon2) => {
      const toRad = deg => deg * Math.PI / 180;
      const R = 6371000; // meters
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    const inside = locations.find(l => l.active && haversine(lat, lng, Number(l.latitude), Number(l.longitude)) <= Number(l.radius_m || 50));
    if (!inside) return res.status(403).json({ error: 'location_not_allowed' });

    // Ensure biometrics exists and active for method
    const bres = await fetch(`${authUrl}/user-biometrics?user_id=${uid}`);
    const blist = await bres.json();
    const b = Array.isArray(blist) && blist.length ? blist[0] : null;
    if (!b || !b.active) return res.status(404).json({ error: 'biometrics_not_found_or_inactive' });
    if (mth === 'face' && !b.face_vector) return res.status(404).json({ error: 'face_vector_missing' });
    if (mth === 'qr' && !b.qr_code) return res.status(404).json({ error: 'qr_code_missing' });
    if (mth === 'fingerprint' && !b.fingerprint_hash) return res.status(404).json({ error: 'fingerprint_hash_missing' });

    // Compute early departure
    const csRes = await fetch(`${setUrl}/settings/company/${companyId}`);
    const cs = await csRes.json();
    const now = new Date();
    const parseHM = (s) => { if (!s) return null; const [h,m] = String(s).split(':').map(n=>parseInt(n,10)); if (isNaN(h)||isNaN(m)) return null; const d = new Date(now); d.setHours(h, m, 0, 0); return d; };
    const targetOut = parseHM(cs.default_check_out);
    let earlyMin = 0;
    if (targetOut && now < targetOut) earlyMin = Math.round((targetOut.getTime() - now.getTime())/60000);

    // Record check-out
    const locStr = JSON.stringify({ latitude: lat, longitude: lng, location_id: inside.id });
    const { rows } = await pool.query(
      'INSERT INTO checkins(user_id, location, ts, status, notes, late_minutes, early_departure_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [uid, locStr, now, 'check_out', notes || null, null, earlyMin]
    );
    res.status(201).json({ ok: true, id: rows[0].id, early_departure_minutes: earlyMin, method: mth });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});

// Status hari ini untuk user dari token
app.get('/presensi/me/today', async (req, res) => {
  try {
    const authUrl = process.env.AUTH_URL || 'http://auth-user-service-go:3000';
    const ah = req.headers['authorization'] || '';
    if (!ah) return res.status(401).json({ error: 'unauthorized' });
    const meRes = await fetch(`${authUrl}/auth/me`, { headers: { Authorization: ah } });
    const me = await meRes.json();
    if (!meRes.ok || !(me?.id || me?.user_id)) return res.status(401).json({ error: 'unauthorized' });
    const uid = Number(me.id || me.user_id);

    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const { rows } = await pool.query(
      'SELECT ts, status FROM checkins WHERE user_id=$1 AND ts BETWEEN $2 AND $3 ORDER BY ts ASC',
      [uid, start, end]
    );
    const ci = rows.find(r => r.status === 'check_in');
    const co = [...rows].reverse().find(r => r.status === 'check_out');
    res.json({ date: start.toISOString().slice(0,10), check_in: ci ? ci.ts.toISOString() : null, check_out: co ? co.ts.toISOString() : null });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});
// List check-ins with optional filters: start_date, end_date, user_id, status
app.get('/presensi/check-ins', async (req, res) => {
  try {
    const { start_date, end_date, user_id, status } = req.query || {};
    const params = [];
    const conds = [];
    if (start_date) { params.push(start_date); conds.push(`ts >= $${params.length}`); }
    if (end_date) { params.push(end_date); conds.push(`ts <= $${params.length}`); }
    if (user_id) { params.push(Number(user_id)); conds.push(`user_id = $${params.length}`); }
    if (status) { params.push(String(status)); conds.push(`status = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT id, user_id, location, ts, status, notes, late_minutes, early_departure_minutes FROM checkins ${where} ORDER BY ts DESC`, params);
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});

// Summary for charts: daily counts and average lateness within range
app.get('/presensi/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query || {};
    const params = [];
    const conds = [];
    if (start_date) { params.push(start_date); conds.push(`ts >= $${params.length}`); }
    if (end_date) { params.push(end_date); conds.push(`ts <= $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const daily = await pool.query(`
      SELECT to_char(ts::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count,
             COALESCE(AVG(late_minutes),0)::int AS avg_late
      FROM checkins ${where}
      GROUP BY ts::date
      ORDER BY ts::date
    `, params);
    const byStatus = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM checkins ${where}
      GROUP BY status
      ORDER BY status
    `, params);
    res.json({ daily: daily.rows, by_status: byStatus.rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'internal error' });
  }
});
app.get('/setting-presensi', async (req, res) => { const { rows } = await pool.query('SELECT timezone, latitude, longitude FROM setting_presensi ORDER BY id LIMIT 1'); res.json(rows[0] || {}); });

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`client-service listening on ${port}`);
    });
  })
  .catch((e) => { console.error('Failed to init DB', e); process.exit(1); });