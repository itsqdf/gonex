-- Setting Service schema and seed
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT
);

CREATE TABLE IF NOT EXISTS jabatan (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO companies(name, address) VALUES ('PT Contoh Sejahtera', 'Jakarta') ON CONFLICT DO NOTHING;
INSERT INTO jabatan(name) VALUES ('Manager') ON CONFLICT DO NOTHING;
INSERT INTO jabatan(name) VALUES ('Staff') ON CONFLICT DO NOTHING;