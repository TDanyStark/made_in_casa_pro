-- Add assign_to_commercial flag to task templates and project tasks
-- When assign_to_commercial = 1, the task is assigned at runtime to the
-- user who created the project (projects.created_by) instead of a fixed user.
-- This is resolved during instantiateTasksFromTemplates.

ALTER TABLE product_task_templates
  ADD COLUMN IF NOT EXISTS assign_to_commercial SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS assign_to_commercial SMALLINT NOT NULL DEFAULT 0;
