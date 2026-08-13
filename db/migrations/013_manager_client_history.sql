-- ---------------------------------------------------------------------------
-- 013 — Historial de traslados de gerente entre clientes
--
-- Un gerente es SIEMPRE la misma fila en `managers`. Cuando cambia de
-- laboratorio, `managers.client_id` se actualiza y aquí queda registrada la
-- trayectoria. Como brands y projects ya guardan su propio client_id (012),
-- el traslado no altera ningún dato histórico.
--
-- Modelado sobre `task_transitions`, que sí registra el actor, y no sobre
-- `brand_manager_history`, que no lo hace.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS manager_client_history (
  id                  SERIAL      PRIMARY KEY,
  manager_id          INTEGER     NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  previous_client_id  INTEGER     REFERENCES clients(id) ON DELETE SET NULL,
  new_client_id       INTEGER     NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  changed_by          INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  reason              TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manager_client_history_manager
  ON manager_client_history(manager_id, changed_at DESC);

-- ── Registro retroactivo del traslado ya ejecutado manualmente ──────────────
-- Monica Robles (managers.id = 2): Adium Co (2) -> Abbott Co (1).
-- Se ejecutó por SQL directo porque la app aún no tenía el flujo de traslado.
INSERT INTO manager_client_history (manager_id, previous_client_id, new_client_id, reason)
SELECT 2, 2, 1, 'Traslado ejecutado manualmente por SQL antes de existir el flujo en la app'
WHERE EXISTS (SELECT 1 FROM managers WHERE id = 2 AND client_id = 1)
  AND NOT EXISTS (SELECT 1 FROM manager_client_history WHERE manager_id = 2);
