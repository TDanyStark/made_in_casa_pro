-- Seed 013: Sample campaigns — each campaign belongs to a client
-- Uses subqueries on client name to avoid hardcoded IDs

-- Grupo Empresarial Andino campaigns
INSERT INTO campaigns (name, client_id) VALUES
  ('Q1 2025 - Lanzamiento Regional', (SELECT id FROM clients WHERE name = 'Grupo Empresarial Andino')),
  ('Awareness 2025',                  (SELECT id FROM clients WHERE name = 'Grupo Empresarial Andino')),
  ('Relanzamiento Portafolio',        (SELECT id FROM clients WHERE name = 'Grupo Empresarial Andino'))
ON CONFLICT (client_id, name) DO NOTHING;

-- Corporación Digital MX campaigns
INSERT INTO campaigns (name, client_id) VALUES
  ('Q2 2025 - Campaña Digital',      (SELECT id FROM clients WHERE name = 'Corporación Digital MX')),
  ('Q3 2025 - Temporada Alta',        (SELECT id FROM clients WHERE name = 'Corporación Digital MX'))
ON CONFLICT (client_id, name) DO NOTHING;

-- TechBrands Brasil campaigns
INSERT INTO campaigns (name, client_id) VALUES
  ('Q4 2025 - Fin de Año',           (SELECT id FROM clients WHERE name = 'TechBrands Brasil'))
ON CONFLICT (client_id, name) DO NOTHING;
