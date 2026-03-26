-- Seed 013: Sample campaigns
INSERT INTO campaigns (name) VALUES
  ('Q1 2025 - Lanzamiento Regional'),
  ('Q2 2025 - Campaña Digital'),
  ('Q3 2025 - Temporada Alta'),
  ('Q4 2025 - Fin de Año'),
  ('Awareness 2025'),
  ('Relanzamiento Portafolio')
ON CONFLICT (name) DO NOTHING;
