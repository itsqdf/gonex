-- Client Service schema and seed
CREATE TABLE IF NOT EXISTS presensi (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  status TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS absences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  reason TEXT,
  date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  activity TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  location TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setting_presensi (
  id SERIAL PRIMARY KEY,
  working_hours TEXT,
  timezone TEXT
);

INSERT INTO presensi(user_id, status) VALUES (1, 'present') ON CONFLICT DO NOTHING;
INSERT INTO activities(user_id, activity) VALUES (1, 'login') ON CONFLICT DO NOTHING;
INSERT INTO setting_presensi(working_hours, timezone) VALUES ('09:00-17:00', 'Asia/Jakarta') ON CONFLICT DO NOTHING;