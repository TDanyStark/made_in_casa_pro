-- Migration to add granular delivery time in minutes to task_quotes
ALTER TABLE task_quotes ADD COLUMN delivery_minutes INTEGER;

-- Migrate existing data: (days * 1440) + (hours * 60)
UPDATE task_quotes 
SET delivery_minutes = COALESCE(delivery_days, 0) * 1440 + COALESCE(delivery_hours, 0) * 60;
