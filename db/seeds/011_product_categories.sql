-- Seed 011: Product Categories
INSERT INTO product_categories (name) VALUES
  ('Audio'),
  ('Aplicativos digitales'),
  ('Editoriales'),
  ('Mailing'),
  ('Realidad virtual y aumentada'),
  ('Videos'),
  ('Web y programación'),
  ('Learning Live'),
  ('IA'),
  ('Souvenirs'),
  ('Branding'),
  ('Programas de transformación')
ON CONFLICT (name) DO NOTHING;
