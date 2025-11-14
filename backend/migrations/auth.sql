-- Auth/User Service schema and seed (rapih, dengan relasi hak akses)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  nama TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE,
  jabatan_id INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Backfill agar data lama konsisten
UPDATE users SET email = username WHERE email IS NULL OR email='';
UPDATE users SET nama = CASE WHEN position('@' in email)>0 THEN split_part(email,'@',1) ELSE email END WHERE nama = '';

CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Seed roles inti dan user awal
INSERT INTO roles(name) VALUES ('admin') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('user') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('Pengguna') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('superadmin') ON CONFLICT DO NOTHING;
INSERT INTO users(username, password, role) VALUES ('admin','admin123','admin') ON CONFLICT DO NOTHING;
INSERT INTO users(username, password, role) VALUES ('superadmin@gmail.com','admin123','superadmin') ON CONFLICT DO NOTHING;

-- Seed minimal permissions agar UI tidak kosong (service akan menambah lengkap)
INSERT INTO permissions(code, name, description) VALUES ('menu_master_data','menu_master_data','Menu permission') ON CONFLICT(code) DO NOTHING;