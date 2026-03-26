-- Project co-responsible managers (many-to-many)
CREATE TABLE IF NOT EXISTS project_managers (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, manager_id)
);
