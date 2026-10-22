-- Adds the 'paused' task status: a collaborator keeps a single 'in_progress'
-- task and the rest are paused (see odd/tasks/single-in-progress-task.md).
-- Existing rows are intentionally left untouched.
ALTER TABLE project_tasks DROP CONSTRAINT chk_pt_status;
ALTER TABLE project_tasks ADD CONSTRAINT chk_pt_status
  CHECK (status IN ('not_started', 'waiting', 'in_progress', 'paused', 'completed', 'blocked'));
