-- ---------------------------------------------------------------------------
-- 023 — Marcas adicionales de un proyecto
--
-- `projects.brand_id` sigue siendo la marca PRINCIPAL (cliente, gerente,
-- carpeta de Drive, correos). Esta tabla vincula marcas adicionales.
-- Regla validada en la capa de queries: toda marca adicional pertenece al
-- mismo `projects.client_id` y es distinta de la marca principal.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_brands (
  project_id INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  brand_id   INTEGER     NOT NULL REFERENCES brands(id)   ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_project_brands_brand_id ON project_brands (brand_id);
