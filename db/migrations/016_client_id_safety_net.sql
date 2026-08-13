-- ---------------------------------------------------------------------------
-- 016 — Red de seguridad para client_id en brands y projects
--
-- MOTIVO INMEDIATO
-- La migración 012 puso `client_id NOT NULL` en brands y projects, pero el
-- código desplegado en ese momento aún hacía INSERT sin esa columna. Resultado:
-- crear marcas y proyectos falló en producción entre la migración y el deploy.
--
-- Estos triggers rellenan `client_id` cuando llega NULL, tomándolo de la fuente
-- de verdad correspondiente. Con ellos el esquema tolera código viejo y nuevo,
-- de modo que el orden migración/deploy deja de importar.
--
-- Se dejan de forma PERMANENTE, no como parche temporal: elevan el invariante
-- "el cliente de un proyecto es el de su marca" a garantía de base de datos, y
-- no solo de la capa de queries.
-- ---------------------------------------------------------------------------

-- ── brands.client_id ← managers.client_id ───────────────────────────────────
CREATE OR REPLACE FUNCTION fill_brand_client_id() RETURNS trigger AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.manager_id IS NOT NULL THEN
    SELECT m.client_id INTO NEW.client_id FROM managers m WHERE m.id = NEW.manager_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brands_fill_client_id ON brands;
CREATE TRIGGER trg_brands_fill_client_id
  BEFORE INSERT ON brands
  FOR EACH ROW EXECUTE FUNCTION fill_brand_client_id();

-- ── projects.client_id ← brands.client_id ───────────────────────────────────
-- Del la marca, NO del gerente: un proyecto pertenece al cliente dueño de la
-- marca sobre la que se ejecuta. Si el gerente se traslada, el proyecto no
-- debe seguirlo salvo que su marca también lo haga.
CREATE OR REPLACE FUNCTION fill_project_client_id() RETURNS trigger AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.brand_id IS NOT NULL THEN
    SELECT b.client_id INTO NEW.client_id FROM brands b WHERE b.id = NEW.brand_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_fill_client_id ON projects;
CREATE TRIGGER trg_projects_fill_client_id
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION fill_project_client_id();
