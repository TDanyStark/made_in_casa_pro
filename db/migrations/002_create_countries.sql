-- Migration: create countries table
CREATE TABLE IF NOT EXISTS countries (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  flag TEXT NOT NULL
);
