-- Correction of an external task cost (see odd/tasks/project-financials.md S15-S16).
-- Admin and directivo can correct completion_cost of a completed external task.
-- completion_cost_original keeps the value the external declared before the first
-- correction (NULL = never corrected, or nothing was declared); the other two
-- columns record who made the last correction and when. No data is rewritten.
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_cost_original   NUMERIC(10,2);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_cost_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_cost_updated_at TIMESTAMPTZ;
