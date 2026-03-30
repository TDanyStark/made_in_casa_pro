-- Projects: core entity linking a brand to managed products
CREATE TABLE IF NOT EXISTS projects (
  id               SERIAL      PRIMARY KEY,
  title            TEXT        NOT NULL,
  brand_id         INTEGER     NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  manager_id       INTEGER     NOT NULL REFERENCES managers(id) ON DELETE RESTRICT,
  product_id       INTEGER     REFERENCES products(id) ON DELETE SET NULL,
  campaign_id      INTEGER     REFERENCES campaigns(id) ON DELETE SET NULL,
  drive_folder_id  TEXT,
  drive_folder_url TEXT,
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'active',
  -- active | paused | completed | archived
  progress         SMALLINT    NOT NULL DEFAULT 0,
  created_by       INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
