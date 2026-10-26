-- ---------------------------------------------------------------------------
-- 024 — Alinear el gerente de cada proyecto con el de su marca principal
--
-- Desde ahora el gerente de un proyecto es SIEMPRE el gerente actual de su
-- marca principal (`projects.brand_id`): solo cambia al reasignar la marca
-- (`updateBrand`), que mueve todos sus proyectos en la misma transacción.
-- Los proyectos creados o reasignados antes de esta regla pueden tener otro
-- gerente; aquí se alinean, en cualquier estado.
--
-- 1. Se registra cada cambio en `project_manager_history` (changed_by NULL:
--    lo hace la migración, no un usuario).
-- 2. Se actualiza `projects.manager_id`. `client_id` y `updated_at` no se tocan
--    (es una corrección de datos, no actividad del proyecto).
--
-- Marcas sin gerente se omiten. Idempotente: ambas sentencias usan la misma
-- guarda, así que una segunda ejecución no inserta ni actualiza nada.
-- REESCRIBE DATOS DE PRODUCCIÓN: ejecutar solo con aprobación explícita.
-- ---------------------------------------------------------------------------

INSERT INTO project_manager_history
  (project_id, previous_manager_id, new_manager_id, changed_by, reason)
SELECT p.id, p.manager_id, b.manager_id, NULL,
       'Alineación con el gerente de la marca principal (migración 024)'
FROM projects p
JOIN brands b ON b.id = p.brand_id
WHERE b.manager_id IS NOT NULL
  AND p.manager_id IS DISTINCT FROM b.manager_id;

UPDATE projects p
SET manager_id = b.manager_id
FROM brands b
WHERE b.id = p.brand_id
  AND b.manager_id IS NOT NULL
  AND p.manager_id IS DISTINCT FROM b.manager_id;
