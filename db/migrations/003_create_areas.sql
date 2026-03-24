-- Migration: create areas table
CREATE TABLE IF NOT EXISTS areas (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
