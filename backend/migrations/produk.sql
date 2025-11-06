-- Produk Service schema and seed
CREATE TABLE IF NOT EXISTS gudang (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT
);

CREATE TABLE IF NOT EXISTS produk (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0
);

INSERT INTO gudang(name, location) VALUES ('Gudang Pusat', 'Bandung') ON CONFLICT DO NOTHING;
INSERT INTO produk(name, price, stock) VALUES ('Produk A', 100000, 10) ON CONFLICT DO NOTHING;