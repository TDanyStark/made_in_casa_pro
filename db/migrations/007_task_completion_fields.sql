-- Migration 007: Add completion and progress fields to project_tasks
-- Adds: delivery_url, completion_cost, progress_percent, progress_minutes
-- Note: progress_minutes is the single source of truth for time tracking
-- (accumulates during work AND stores the final total at completion).

ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS delivery_url        TEXT,
  ADD COLUMN IF NOT EXISTS completion_cost     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS progress_percent    SMALLINT       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_minutes    INT            DEFAULT 0;
