-- Migration: create roles table
CREATE TABLE IF NOT EXISTS roles (
  id   SERIAL PRIMARY KEY,
  role TEXT
);
