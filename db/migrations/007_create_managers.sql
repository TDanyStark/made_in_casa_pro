-- Migration: create managers table
-- Depende de: clients (006)
CREATE TABLE IF NOT EXISTS managers (
  id        SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  email     TEXT    NOT NULL UNIQUE,
  phone     TEXT    NOT NULL,
  biography TEXT    NOT NULL,
  CONSTRAINT fk_managers_client_id FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
);
