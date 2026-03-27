-- Task quote invitations: controls which external collaborators are invited
-- to submit a quote for a specific task
-- Only invited externals can submit via POST /api/projects/[id]/tasks/[tid]/quotes/submit

CREATE TABLE IF NOT EXISTS task_quote_invitations (
  id          SERIAL       PRIMARY KEY,
  task_id     INTEGER      NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tqi_task_id ON task_quote_invitations(task_id);
CREATE INDEX IF NOT EXISTS idx_tqi_user_id ON task_quote_invitations(user_id);
