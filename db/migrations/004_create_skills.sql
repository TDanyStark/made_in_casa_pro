-- Migration: create skills table
CREATE TABLE IF NOT EXISTS skills (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
