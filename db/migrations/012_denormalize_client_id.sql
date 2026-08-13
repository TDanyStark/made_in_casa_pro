-- ---------------------------------------------------------------------------
-- 012 — Denormalizar client_id en brands y projects
--
-- PROBLEMA QUE RESUELVE
-- Hasta ahora el cliente de una marca y de un proyecto se DERIVABA en tiempo
-- de lectura vía `manager_id -> managers.client_id`. Eso implica que mover un
-- gerente de cliente reescribe RETROACTIVAMENTE el cliente de todo su
-- historial (proyectos facturados, reportes, etc.).
--
-- A partir de aquí, la marca y el proyecto guardan su propio cliente. El
-- cliente es un hecho del negocio, no una consecuencia de quién es el gerente.
--
-- Precondiciones verificadas en producción antes de escribir esta migración:
--   - 0 marcas con manager_id NULL
--   - 0 proyectos cuyo cliente (vía gerente) difiera del de su marca
-- ---------------------------------------------------------------------------

-- ── brands.client_id ────────────────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE RESTRICT;

UPDATE brands b
   SET client_id = m.client_id
  FROM managers m
 WHERE m.id = b.manager_id
   AND b.client_id IS DISTINCT FROM m.client_id;

-- ── projects.client_id ──────────────────────────────────────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE RESTRICT;

UPDATE projects p
   SET client_id = m.client_id
  FROM managers m
 WHERE m.id = p.manager_id
   AND p.client_id IS DISTINCT FROM m.client_id;

-- ── Guardas: abortar si el backfill dejó huecos ─────────────────────────────
DO $$
DECLARE
  huerfanas INTEGER;
  huerfanos INTEGER;
BEGIN
  SELECT count(*) INTO huerfanas FROM brands   WHERE client_id IS NULL;
  SELECT count(*) INTO huerfanos FROM projects WHERE client_id IS NULL;

  IF huerfanas > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % marca(s) sin client_id. Revisa marcas con manager_id NULL.', huerfanas;
  END IF;

  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % proyecto(s) sin client_id.', huerfanos;
  END IF;
END $$;

ALTER TABLE brands   ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN client_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brands_client_id   ON brands(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
