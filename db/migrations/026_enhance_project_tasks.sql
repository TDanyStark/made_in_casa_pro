-- Enhance project_tasks with workflow fields
-- task_type: 'execution' | 'validation'
-- task_flag: 'new' | 'correction' | 'adjustment'
-- requires_quote: 1 if the task requires a quote from an external collaborator
-- status gains 'waiting' (assigned but waiting for previous task to complete)

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS task_type    TEXT NOT NULL DEFAULT 'execution',
  ADD COLUMN IF NOT EXISTS task_flag    TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS requires_quote SMALLINT NOT NULL DEFAULT 0;

-- Add check constraints
ALTER TABLE project_tasks
  DROP CONSTRAINT IF EXISTS chk_pt_task_type,
  ADD  CONSTRAINT chk_pt_task_type    CHECK (task_type    IN ('execution', 'validation')),
  DROP CONSTRAINT IF EXISTS chk_pt_task_flag,
  ADD  CONSTRAINT chk_pt_task_flag    CHECK (task_flag    IN ('new', 'correction', 'adjustment')),
  DROP CONSTRAINT IF EXISTS chk_pt_status,
  ADD  CONSTRAINT chk_pt_status       CHECK (status       IN ('not_started', 'waiting', 'in_progress', 'completed', 'blocked'));
