-- Delete Service schema and seed
CREATE TABLE IF NOT EXISTS deletion_logs (
  id SERIAL PRIMARY KEY,
  resource TEXT NOT NULL,
  resource_id INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO deletion_logs(resource, resource_id, reason) VALUES ('produk', 1, 'cleanup') ON CONFLICT DO NOTHING;