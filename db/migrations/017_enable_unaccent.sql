-- Enable unaccent extension for accent-insensitive search
-- This must be run once per database (requires superuser or pg_extension privilege)
CREATE EXTENSION IF NOT EXISTS unaccent;
