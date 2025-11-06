-- Auth/User Service schema and seed
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO roles(name) VALUES ('admin') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('user') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('superadmin') ON CONFLICT DO NOTHING;
INSERT INTO users(username, password, role) VALUES ('admin','admin123','admin') ON CONFLICT DO NOTHING;
INSERT INTO users(username, password, role) VALUES ('superadmin@gmail.com','admin123','superadmin') ON CONFLICT DO NOTHING;