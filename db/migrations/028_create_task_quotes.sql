-- Task quotes: proposals submitted by external collaborators for a task
-- Created when the flow reaches a task with requires_quote=1 and no assigned user
-- The project manager invites externals via task_quote_invitations (migration 030)
-- and externals submit their proposals here

CREATE TABLE IF NOT EXISTS task_quotes (
  id              SERIAL       PRIMARY KEY,
  task_id         INTEGER      NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price           NUMERIC(12,2),
  delivery_days   INTEGER,
  delivery_hours  INTEGER,
  notes           TEXT,
  status          TEXT         NOT NULL DEFAULT 'pending',
  -- pending | accepted | rejected
  created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_tq_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_quotes_task_id ON task_quotes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_quotes_user_id ON task_quotes(user_id);
