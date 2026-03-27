-- Task transitions: audit log for every status change in project_tasks
-- Records who moved the task, from what status to what, and why
-- Used for history display, correction tracing, and validation flow tracking

CREATE TABLE IF NOT EXISTS task_transitions (
  id               SERIAL       PRIMARY KEY,
  task_id          INTEGER      NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  project_id       INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status      TEXT,
  to_status        TEXT         NOT NULL,
  from_flag        TEXT,
  to_flag          TEXT,
  moved_by         INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  notes            TEXT,
  transitioned_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_transitions_task_id    ON task_transitions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_transitions_project_id ON task_transitions(project_id);
