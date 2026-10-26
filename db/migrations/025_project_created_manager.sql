-- ---------------------------------------------------------------------------
-- 025 — Gerente con el que se creó cada proyecto (`projects.created_manager_id`)
--
-- `projects.manager_id` es el gerente ACTUAL (siempre el de la marca principal,
-- cambia por cascada al reasignar la marca). `projects.client_id` ya es el
-- cliente de la creación y no cambia. Faltaba guardar el gerente de la
-- creación: esta columna se fija al crear el proyecto (`createProject`) y nada
-- más la escribe (ni la cascada de marca, ni el traslado, ni `updateProject`).
--
-- Backfill: el gerente al crearse es el `previous_manager_id` de la fila más
-- antigua de `project_manager_history` (por `changed_at`, desempate por `id`);
-- si el proyecto no tiene historial (o ese valor es NULL porque el gerente se
-- borró), se usa el `manager_id` actual. Luego la columna pasa a NOT NULL.
--
-- Idempotente: la columna se agrega con IF NOT EXISTS y el backfill solo toca
-- filas sin valor. `updated_at` no se toca (es una corrección de datos).
-- ---------------------------------------------------------------------------

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS created_manager_id INTEGER REFERENCES managers(id) ON DELETE RESTRICT;

UPDATE projects p
SET created_manager_id = COALESCE(
  (
    SELECT pmh.previous_manager_id
    FROM project_manager_history pmh
    WHERE pmh.project_id = p.id
    ORDER BY pmh.changed_at ASC, pmh.id ASC
    LIMIT 1
  ),
  p.manager_id
)
WHERE p.created_manager_id IS NULL;

ALTER TABLE projects ALTER COLUMN created_manager_id SET NOT NULL;

-- Soporta el ON DELETE RESTRICT al borrar un gerente.
CREATE INDEX IF NOT EXISTS idx_projects_created_manager_id ON projects (created_manager_id);
