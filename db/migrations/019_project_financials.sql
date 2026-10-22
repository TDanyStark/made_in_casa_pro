-- Project financials (see odd/tasks/project-financials.md).
-- users.hourly_rate replaces users.monthly_salary in the app; the old column is
-- kept untouched so no stored data is deleted.
-- project_tasks.completion_hourly_rate freezes the internal rate when a task is
-- completed, so later rate changes never alter past projects.
-- projects.sale_price is the amount the project was sold for.
ALTER TABLE users         ADD COLUMN IF NOT EXISTS hourly_rate            NUMERIC(12,2);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS completion_hourly_rate NUMERIC(12,2);
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS sale_price             NUMERIC(14,2);
