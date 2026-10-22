-- Internal cost from the monthly salary (see odd/tasks/project-financials.md S11-S14).
-- A completed internal task freezes the salary and the working minutes of the
-- month it was completed in, next to the resulting completion_hourly_rate, so
-- later salary or weekly-hours changes never alter past projects.
-- users.hourly_rate is no longer used by the app; it is kept so no data is deleted.
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_monthly_salary NUMERIC(14,2);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_month_minutes  INT;
