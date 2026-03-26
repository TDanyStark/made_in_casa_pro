-- Campaigns: simple lookup for grouping projects in reports
CREATE TABLE IF NOT EXISTS campaigns (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
