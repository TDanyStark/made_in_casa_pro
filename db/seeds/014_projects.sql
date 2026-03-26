-- Seed 014: Sample projects (1 demo project)
INSERT INTO projects (
  title,
  brand_id,
  manager_id,
  campaign_id,
  notes,
  status,
  progress,
  created_by
)
VALUES (
  'Lanzamiento AguaViva Digital 2025',
  (SELECT id FROM brands WHERE name = 'AguaViva' LIMIT 1),
  (SELECT id FROM managers WHERE email = 'carlos.rodriguez@gea.com.co' LIMIT 1),
  (SELECT id FROM campaigns WHERE name = 'Q1 2025 - Lanzamiento Regional' LIMIT 1),
  '## Objetivo del proyecto

Lanzamiento digital de AguaViva en Colombia y México para el primer trimestre de 2025.

## Alcance

- Sitio web de aterrizaje
- Campaña en redes sociales
- Material audiovisual',
  'active',
  0,
  (SELECT id FROM users WHERE email = 'admin@madeincasa.com' LIMIT 1)
);
