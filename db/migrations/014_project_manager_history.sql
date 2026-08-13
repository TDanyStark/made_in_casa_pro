-- ---------------------------------------------------------------------------
-- 014 — Historial de reasignación de gerente en proyectos
--
-- Hasta ahora `projects.manager_id` era inmutable: ni `updateProject` ni el
-- PATCH del endpoint lo aceptaban. Si un gerente dejaba el cliente, sus
-- proyectos en curso quedaban huérfanos sin forma de reasignarlos desde la app.
--
-- Se habilita la reasignación con auditoría. La regla de negocio (validada en
-- la capa de queries) es que el nuevo gerente debe pertenecer al MISMO cliente
-- del proyecto.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_manager_history (
  id                  SERIAL      PRIMARY KEY,
  project_id          INTEGER     NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  previous_manager_id INTEGER     REFERENCES managers(id) ON DELETE SET NULL,
  new_manager_id      INTEGER     NOT NULL REFERENCES managers(id) ON DELETE RESTRICT,
  changed_by          INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  reason              TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_manager_history_project
  ON project_manager_history(project_id, changed_at DESC);

-- ── Registro retroactivo de la reasignación ya ejecutada manualmente ────────
-- Proyecto 11 "Nulytelly 2026": Monica Robles (2) -> Luis Sandoval (11).
-- Necesario antes de trasladar a Monica: el proyecto es de la marca Nulytely,
-- que pertenece a Adium, y de lo contrario habría pasado a reportarse como Abbott.
INSERT INTO project_manager_history (project_id, previous_manager_id, new_manager_id, reason)
SELECT 11, 2, 11, 'Reasignación manual por SQL previa al traslado de Monica Robles a Abbott Co'
WHERE EXISTS (SELECT 1 FROM projects WHERE id = 11 AND manager_id = 11)
  AND NOT EXISTS (SELECT 1 FROM project_manager_history WHERE project_id = 11);
