-- ── Migration: Initialize V1 for all projects ────────────────────────────────
-- This ensures every project has at least one entry in project_adjustments (v1)
-- and that all existing tasks are linked to it.

-- 1. Insert V1 adjustments for all existing projects
INSERT INTO project_adjustments (project_id, version_number, status, drive_folder_id, drive_folder_url, created_at, completed_at)
SELECT 
    id, 
    1, 
    CASE WHEN status = 'completed' THEN 'completed' ELSE 'active' END,
    drive_folder_id,
    drive_folder_url,
    created_at,
    completed_at
FROM projects
ON CONFLICT DO NOTHING;

-- 2. Link all tasks that don't have an adjustment_id to their project's V1
UPDATE project_tasks
SET adjustment_id = pa.id
FROM project_adjustments pa
WHERE project_tasks.project_id = pa.project_id 
  AND pa.version_number = 1 
  AND project_tasks.adjustment_id IS NULL;
