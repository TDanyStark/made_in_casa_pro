-- Migration: create users table
-- Depende de: roles (001), areas (003)
-- is_internal / must_change_password / is_active: SMALLINT (0/1) para compatibilidad con código TS existente.
-- last_login: BIGINT para timestamps Unix.
CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL      PRIMARY KEY,
  name                 TEXT,
  email                TEXT,
  password             TEXT,
  rol_id               INTEGER,
  area_id              INTEGER,
  is_internal          SMALLINT,
  must_change_password SMALLINT    DEFAULT 0,
  is_active            SMALLINT    DEFAULT 1,
  last_login           BIGINT,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  monthly_salary       REAL,
  CONSTRAINT fk_users_rol_id  FOREIGN KEY (rol_id)  REFERENCES roles (id),
  CONSTRAINT fk_users_area_id FOREIGN KEY (area_id) REFERENCES areas (id)
);
