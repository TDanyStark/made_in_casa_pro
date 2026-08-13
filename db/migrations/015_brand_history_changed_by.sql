-- ---------------------------------------------------------------------------
-- 015 — Actor en el historial de gerente de marca
--
-- `brand_manager_history` es la única tabla de historial que no registra QUIÉN
-- hizo el cambio. `manager_client_history` (013) y `project_manager_history`
-- (014) sí lo hacen, y el traslado de gerentes escribe en las tres: sin este
-- campo la auditoría queda incompleta justo en la tabla más antigua.
--
-- Nullable a propósito: las filas históricas previas no tienen actor conocido
-- y no hay forma de reconstruirlo.
-- ---------------------------------------------------------------------------

ALTER TABLE brand_manager_history
  ADD COLUMN IF NOT EXISTS changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- `reason` también falta respecto a 013/014. Se añade por simetría para que el
-- traslado pueda dejar la misma justificación en las tres tablas.
ALTER TABLE brand_manager_history
  ADD COLUMN IF NOT EXISTS reason TEXT;
