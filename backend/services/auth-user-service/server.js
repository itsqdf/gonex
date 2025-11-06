const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      password TEXT
    );
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS roles_user (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );
  `);
  // Seed basic data if empty
  const { rows: userCount } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  if (userCount[0].c === 0) {
    await pool.query(`INSERT INTO users(name, username, password) VALUES ($1, $2, $3), ($4, $5, $6)`, ['Admin', 'admin', 'admin123', 'User', 'user', 'user123']);
  }
  const { rows: roleCount } = await pool.query('SELECT COUNT(*)::int AS c FROM roles');
  if (roleCount[0].c === 0) {
    await pool.query(`INSERT INTO roles(name) VALUES ($1), ($2)`, ['ADMIN', 'USER']);
  }
  const { rows: permCount } = await pool.query('SELECT COUNT(*)::int AS c FROM permissions');
  if (permCount[0].c === 0) {
    await pool.query(`INSERT INTO permissions(name) VALUES ($1), ($2)`, ['read', 'write']);
  }
  // Map roles to users
  await pool.query(`
    INSERT INTO roles_user(user_id, role_id)
    SELECT u.id, r.id FROM users u, roles r
    WHERE (u.name='Admin' AND r.name='ADMIN') OR (u.name='User' AND r.name='USER')
    ON CONFLICT DO NOTHING;
  `);
  // Map permissions to roles
  await pool.query(`
    INSERT INTO role_permissions(role_id, permission_id)
    SELECT r.id, p.id FROM roles r, permissions p
    WHERE (r.name='ADMIN') OR (r.name='USER' AND p.name='read')
    ON CONFLICT DO NOTHING;
  `);
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'auth-user-service' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Sample endpoints
app.get('/users', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, username FROM users ORDER BY id');
  res.json(rows);
});

app.get('/roles', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM roles ORDER BY id');
  res.json(rows);
});

// CRUD Users
app.post('/users', async (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name || !username) return res.status(400).json({ error: 'name and username required' });
  const { rows } = await pool.query('INSERT INTO users(name, username, password) VALUES ($1, $2, $3) RETURNING id, name, username', [name, username, password || null]);
  res.status(201).json(rows[0]);
});

app.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, username, password } = req.body || {};
  const { rows } = await pool.query('UPDATE users SET name=COALESCE($1,name), username=COALESCE($2,username), password=COALESCE($3,password) WHERE id=$4 RETURNING id, name, username', [name, username, password, id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM users WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// CRUD Roles
app.post('/roles', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query('INSERT INTO roles(name) VALUES ($1) RETURNING id, name', [name]);
  res.status(201).json(rows[0]);
});

app.put('/roles/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name } = req.body || {};
  const { rows } = await pool.query('UPDATE roles SET name=COALESCE($1,name) WHERE id=$2 RETURNING id, name', [name, id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

app.delete('/roles/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM roles WHERE id=$1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

// Auth Login
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const { rows } = await pool.query('SELECT id, username, password FROM users WHERE username=$1', [username]);
  const user = rows[0];
  if (!user || user.password !== password) return res.status(401).json({ error: 'invalid credentials' });
  const rolesRes = await pool.query(`
    SELECT r.name FROM roles_user ru JOIN roles r ON r.id=ru.role_id WHERE ru.user_id=$1
  `, [user.id]);
  const roles = rolesRes.rows.map(r => r.name);
  const token = jwt.sign({ sub: user.id, username: user.username, roles }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '8h' });
  res.json({ token });
});

app.get('/roles-user', async (req, res) => {
  const { rows } = await pool.query('SELECT user_id AS "userId", role_id AS "roleId" FROM roles_user ORDER BY user_id');
  res.json(rows);
});

app.get('/has-permissions', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.id AS "roleId", array_agg(p.name ORDER BY p.name) AS perms
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    GROUP BY r.id
    ORDER BY r.id
  `);
  res.json(rows);
});

const port = process.env.SERVICE_PORT || 3000;
initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`auth-user-service listening on ${port}`);
    });
  })
  .catch((e) => {
    console.error('Failed to init DB', e);
    process.exit(1);
  });