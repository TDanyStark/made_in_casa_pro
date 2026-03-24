-- Migration: create business_units table
-- IDs son explícitos (no auto-increment) para que los seeds puedan referenciarlos por valor conocido.
CREATE TABLE IF NOT EXISTS business_units (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL
);
