-- Products assigned to a project (many-to-many with status)
CREATE TABLE IF NOT EXISTS project_products (
  id         SERIAL      PRIMARY KEY,
  project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status     TEXT        NOT NULL DEFAULT 'pending',
  -- pending | in_progress | completed
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, product_id)
);
