-- ── Project Adjustments (Versions) ─────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN completed_at TIMESTAMPTZ;

-- Allow 'in_adjustments' as a valid status for projects
ALTER TABLE projects DROP CONSTRAINT chk_projects_status;
ALTER TABLE projects ADD CONSTRAINT chk_projects_status CHECK (status IN ('active', 'paused', 'completed', 'archived', 'in_adjustments'));

CREATE TABLE project_adjustments (
  id               SERIAL      PRIMARY KEY,
  project_id       INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number   INTEGER     NOT NULL,
  drive_folder_id  TEXT,
  drive_folder_url TEXT,
  status           TEXT        NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at     TIMESTAMPTZ,
  CONSTRAINT chk_adjustment_status CHECK (status IN ('active', 'completed'))
);

CREATE INDEX idx_project_adjustments_pid ON project_adjustments(project_id);

ALTER TABLE project_tasks ADD COLUMN adjustment_id INTEGER REFERENCES project_adjustments(id) ON DELETE CASCADE;
CREATE INDEX idx_project_tasks_adj_id ON project_tasks(adjustment_id);
