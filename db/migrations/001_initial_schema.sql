-- Migration 001: Initial schema
-- Tables are created in dependency order (referenced tables first)

CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  role TEXT
);

CREATE TABLE IF NOT EXISTS countries (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  flag TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS skills (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Explicit IDs (not auto-increment) to match seeded values
CREATE TABLE IF NOT EXISTS business_units (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id                     SERIAL PRIMARY KEY,
  name                   TEXT    NOT NULL,
  country_id             INTEGER,
  accept_business_units  SMALLINT DEFAULT 0,
  CONSTRAINT fk_clients_country_id FOREIGN KEY (country_id) REFERENCES countries (id)
);

CREATE TABLE IF NOT EXISTS managers (
  id        SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  email     TEXT    NOT NULL UNIQUE,
  phone     TEXT    NOT NULL,
  biography TEXT    NOT NULL,
  CONSTRAINT fk_managers_client_id FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS brands (
  id               SERIAL PRIMARY KEY,
  name             TEXT    NOT NULL,
  manager_id       INTEGER,
  business_unit_id INTEGER,
  CONSTRAINT fk_brands_manager_id        FOREIGN KEY (manager_id)       REFERENCES managers      (id) ON UPDATE SET NULL ON DELETE SET NULL,
  CONSTRAINT fk_brands_business_unit_id  FOREIGN KEY (business_unit_id) REFERENCES business_units(id)
);

CREATE TABLE IF NOT EXISTS brand_manager_history (
  id                  SERIAL PRIMARY KEY,
  brand_id            INTEGER     NOT NULL,
  previous_manager_id INTEGER     NOT NULL,
  new_manager_id      INTEGER     NOT NULL,
  changed_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bmh_brand_id        FOREIGN KEY (brand_id)            REFERENCES brands   (id) ON DELETE CASCADE,
  CONSTRAINT fk_bmh_prev_manager_id FOREIGN KEY (previous_manager_id) REFERENCES managers (id) ON DELETE CASCADE,
  CONSTRAINT fk_bmh_new_manager_id  FOREIGN KEY (new_manager_id)      REFERENCES managers (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT,
  email                TEXT,
  password             TEXT,
  rol_id               INTEGER,
  area_id              INTEGER,
  is_internal          SMALLINT,
  must_change_password SMALLINT     DEFAULT 0,
  is_active            SMALLINT     DEFAULT 1,
  last_login           BIGINT,
  created_at           TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  monthly_salary       REAL,
  CONSTRAINT fk_users_area_id FOREIGN KEY (area_id) REFERENCES areas (id),
  CONSTRAINT fk_users_rol_id  FOREIGN KEY (rol_id)  REFERENCES roles (id)
);

CREATE TABLE IF NOT EXISTS user_skills (
  user_id  INTEGER NOT NULL,
  skill_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, skill_id),
  CONSTRAINT fk_user_skills_user_id  FOREIGN KEY (user_id)  REFERENCES users  (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_user_skills_skill_id FOREIGN KEY (skill_id) REFERENCES skills (id) ON UPDATE CASCADE ON DELETE CASCADE
);
