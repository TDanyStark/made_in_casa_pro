-- Add Drive folder fields to project_products
ALTER TABLE project_products ADD COLUMN drive_folder_id TEXT;
ALTER TABLE project_products ADD COLUMN drive_folder_url TEXT;
