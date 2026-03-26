-- Performance indexes for projects module
CREATE INDEX IF NOT EXISTS idx_projects_brand_id      ON projects(brand_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id    ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_campaign_id   ON projects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_managers_pid   ON project_managers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_managers_mid   ON project_managers(manager_id);
CREATE INDEX IF NOT EXISTS idx_project_products_pid   ON project_products(project_id);
CREATE INDEX IF NOT EXISTS idx_project_products_prod  ON project_products(product_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_pid      ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_ppid     ON project_tasks(project_product_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_user     ON project_tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status   ON project_tasks(status);
