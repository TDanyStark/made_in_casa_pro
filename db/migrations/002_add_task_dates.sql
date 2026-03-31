-- Add assigned_at and completed_at to project_tasks
ALTER TABLE project_tasks ADD COLUMN assigned_at TIMESTAMPTZ;
ALTER TABLE project_tasks ADD COLUMN completed_at TIMESTAMPTZ;

-- Initialize assigned_at for already assigned tasks
UPDATE project_tasks SET assigned_at = created_at WHERE assigned_user_id IS NOT NULL;
-- Initialize completed_at for already completed tasks
UPDATE project_tasks SET completed_at = updated_at WHERE status = 'completed';
