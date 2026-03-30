-- Project tasks: instances of product task templates (or manual additions)
CREATE TABLE IF NOT EXISTS project_tasks (
  id                 SERIAL      PRIMARY KEY,
  project_id         INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id        INTEGER     REFERENCES product_task_templates(id) ON DELETE SET NULL,
  title              TEXT        NOT NULL,
  description        TEXT,
  area_id            INTEGER     REFERENCES areas(id) ON DELETE SET NULL,
  assigned_user_id   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  status             TEXT        NOT NULL DEFAULT 'not_started',
  -- not_started | in_progress | completed | blocked
  order_index        INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
