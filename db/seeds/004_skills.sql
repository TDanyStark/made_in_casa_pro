-- Seed 004: Skills
-- Escritura
INSERT INTO skills (name) VALUES ('Escritura creativa')      ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Redacción y copywriting') ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Corrección de estilo')    ON CONFLICT (name) DO NOTHING;

-- Diseño
INSERT INTO skills (name) VALUES ('Ilustraciones')           ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Revistas')                ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Video')                   ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Diseño gráfico')          ON CONFLICT (name) DO NOTHING;

-- Programación
INSERT INTO skills (name) VALUES ('Creación de apps')              ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Creación de flipbooks digitales') ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Desarrollo web')                ON CONFLICT (name) DO NOTHING;

-- Gestión
INSERT INTO skills (name) VALUES ('Gestión de proyectos')    ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Comunicación')            ON CONFLICT (name) DO NOTHING;
INSERT INTO skills (name) VALUES ('Liderazgo')               ON CONFLICT (name) DO NOTHING;
