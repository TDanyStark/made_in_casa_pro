-- Seed 003: Areas
INSERT INTO areas (name) VALUES ('Escritura')        ON CONFLICT (name) DO NOTHING;
INSERT INTO areas (name) VALUES ('Diseño')         ON CONFLICT (name) DO NOTHING;
INSERT INTO areas (name) VALUES ('Programación/IT')            ON CONFLICT (name) DO NOTHING;
