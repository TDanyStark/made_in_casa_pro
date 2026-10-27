-- ---------------------------------------------------------------------------
-- 027 — Eliminar `projects.manager_id`
--
-- El gerente actual de un proyecto se lee siempre de su marca principal
-- (`brands.manager_id` vía `projects.brand_id`). Desde la migración 026 el código ya
-- no lee ni escribe esta columna; aquí se eliminan la columna (su FK se va con
-- ella) y su índice.
--
-- Se conservan `projects.created_manager_id` (gerente al crearse),
-- `projects.client_id` (cliente al crearse), `project_manager_history` (sus
-- datos, ya no se escribe) y `brand_manager_history`.
--
-- Orden de despliegue: 026 → desplegar el código que ya no usa la columna →
-- 027. Si el código anterior a 026 sigue desplegado, NO ejecutar esta
-- migración: ese código escribe y lee `projects.manager_id`.
--
-- Rollback: el valor se puede reconstruir desde la marca (y los valores
-- anteriores a la alineación de 024 siguen en `project_manager_history`):
--   ALTER TABLE projects ADD COLUMN manager_id INTEGER
--     REFERENCES managers(id) ON DELETE RESTRICT;
--   UPDATE projects p SET manager_id = b.manager_id
--     FROM brands b WHERE b.id = p.brand_id;
--   CREATE INDEX idx_projects_manager_id ON projects (manager_id);
--
-- Idempotente: ambas sentencias usan IF EXISTS.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_projects_manager_id;

ALTER TABLE projects DROP COLUMN IF EXISTS manager_id;
