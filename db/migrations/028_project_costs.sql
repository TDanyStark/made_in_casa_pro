-- ---------------------------------------------------------------------------
-- 028 — Costos asociados del proyecto (odd/tasks/project-costs.md S2, S3, S5, S6)
--
-- Cobros que no son costo de tareas (pago al comercial, tareas de comerciales,
-- herramientas y créditos) se registran por proyecto y versión, con una
-- categoría (lista ampliable, nombre único sin distinguir mayúsculas) y una
-- descripción libre; opcionalmente ligados a una tarea del proyecto.
--
-- adjustment_id es NOT NULL: todo proyecto tiene al menos su versión V1
-- (createProject la inserta en la misma transacción; la migración 004 la creó
-- para los proyectos anteriores). Su FK usa NO ACTION (no RESTRICT): borrar un
-- proyecto borra en cascada sus versiones y sus costos en la misma sentencia,
-- y NO ACTION se comprueba al final de la sentencia. Borrar a mano una versión
-- con costos falla; deleteProjectAdjustment lo rechaza antes con un mensaje.
--
-- Idempotente: IF NOT EXISTS y ON CONFLICT DO NOTHING.
-- Rollback: DROP TABLE project_costs; DROP TABLE project_cost_categories;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_cost_categories (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL CHECK (name = btrim(name) AND name <> ''),
  created_by INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_cost_categories_name
  ON project_cost_categories ((lower(name)));

INSERT INTO project_cost_categories (name)
VALUES ('Pago comercial'), ('Tarea comercial'), ('Herramientas y créditos'), ('Otro')
ON CONFLICT ((lower(name))) DO NOTHING;

CREATE TABLE IF NOT EXISTS project_costs (
  id            SERIAL        PRIMARY KEY,
  project_id    INTEGER       NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  adjustment_id INTEGER       NOT NULL REFERENCES project_adjustments(id),
  category_id   INTEGER       NOT NULL REFERENCES project_cost_categories(id),
  description   TEXT,
  amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  incurred_at   DATE          NOT NULL DEFAULT CURRENT_DATE,
  task_id       INTEGER       REFERENCES project_tasks(id) ON DELETE SET NULL,
  created_by    INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  updated_by    INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_costs_project_id ON project_costs (project_id);

CREATE INDEX IF NOT EXISTS idx_project_costs_adjustment_id ON project_costs (adjustment_id);
