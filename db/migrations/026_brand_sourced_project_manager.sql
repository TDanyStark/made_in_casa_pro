-- ---------------------------------------------------------------------------
-- 026 — El gerente de un proyecto se lee SOLO de su marca principal
--
-- Desde ahora el gerente actual de un proyecto es siempre `brands.manager_id`
-- (vía `projects.brand_id`) y el código ya no escribe `projects.manager_id` ni
-- `project_manager_history`: cambiar el gerente de una marca o trasladar un
-- gerente solo escribe `brands` y `brand_manager_history`.
--
-- 1. `projects.manager_id` deja de ser NOT NULL: el código nuevo no lo escribe
--    y el viejo aún puede hacerlo (compatible en ambos sentidos). La columna
--    y su índice se eliminan en la migración 027.
-- 2. `brands.manager_id` pasa a NOT NULL: toda marca necesita gerente porque
--    es el gerente de sus proyectos. Si alguna marca no tiene, la migración
--    aborta (y se revierte) indicando cuántas: asígnales gerente y reintenta.
-- 3. Las FKs hacia `managers` de `brands.manager_id` y de
--    `brand_manager_history` (previous_manager_id, new_manager_id) pasan a
--    ON DELETE RESTRICT: borrar un gerente ya no deja marcas sin gerente ni
--    borra en cascada el historial de marca. Las FKs previas se buscan en el
--    catálogo (`pg_constraint`), así que su nombre real no importa.
--
-- `project_manager_history` se conserva con sus datos, pero ya no se escribe.
-- Idempotente: DROP NOT NULL / SET NOT NULL se pueden repetir y las FKs se
-- borran por catálogo antes de crearlas de nuevo.
-- Rollback: revertir el código y volver a ejecutar las dos sentencias de 024
-- (idempotentes) para realinear `projects.manager_id` con la marca.
-- ---------------------------------------------------------------------------

ALTER TABLE projects ALTER COLUMN manager_id DROP NOT NULL;

DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing FROM brands WHERE manager_id IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'No se puede volver obligatorio brands.manager_id: % marca(s) sin gerente. Asígnales un gerente y vuelve a ejecutar la migración 026.', missing;
  END IF;
END
$$;

ALTER TABLE brands ALTER COLUMN manager_id SET NOT NULL;

-- Se borra toda FK de esas columnas hacia `managers`, tenga el nombre que
-- tenga (una FK con nombre no estándar seguiría borrando en cascada junto a
-- la nueva), y luego se crean con nombres fijos.
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT c.conrelid::regclass::text AS table_name, c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'managers'::regclass
      AND (c.conrelid::regclass::text, a.attname) IN (
        ('brands', 'manager_id'),
        ('brand_manager_history', 'previous_manager_id'),
        ('brand_manager_history', 'new_manager_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', fk.table_name, fk.conname);
  END LOOP;
END
$$;

ALTER TABLE brands
  ADD CONSTRAINT brands_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE RESTRICT;

ALTER TABLE brand_manager_history
  ADD CONSTRAINT brand_manager_history_previous_manager_id_fkey
  FOREIGN KEY (previous_manager_id) REFERENCES managers(id) ON DELETE RESTRICT;

ALTER TABLE brand_manager_history
  ADD CONSTRAINT brand_manager_history_new_manager_id_fkey
  FOREIGN KEY (new_manager_id) REFERENCES managers(id) ON DELETE RESTRICT;
