-- Seed 010: User skills (habilidades por usuario)
-- user_id y skill_id referenciados por email y nombre respectivamente

-- Admin Sistema → Desarrollo web, Creación de apps
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@market-support.com'), (SELECT id FROM skills WHERE name = 'Desarrollo web'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@market-support.com'), (SELECT id FROM skills WHERE name = 'Creación de apps'));

-- Sandy Baron (directiva) → Liderazgo, Gestión de proyectos, Comunicación
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sandy.baron@market-support.com'), (SELECT id FROM skills WHERE name = 'Liderazgo'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sandy.baron@market-support.com'), (SELECT id FROM skills WHERE name = 'Gestión de proyectos'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sandy.baron@market-support.com'), (SELECT id FROM skills WHERE name = 'Comunicación'));

-- Josue Amado (directivo) → Liderazgo, Comunicación, Gestión de proyectos
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'josue.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Liderazgo'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'josue.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Comunicación'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'josue.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Gestión de proyectos'));

-- Leidy Poveda (comercial) → Comunicación, Gestión de proyectos
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'leidy.poveda@market-support.com'), (SELECT id FROM skills WHERE name = 'Comunicación'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'leidy.poveda@market-support.com'), (SELECT id FROM skills WHERE name = 'Gestión de proyectos'));

-- Daniel Amado (Programación/IT) → Creación de apps, Creación de flipbooks digitales, Desarrollo web
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'daniel.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Creación de apps'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'daniel.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Creación de flipbooks digitales'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'daniel.amado@market-support.com'), (SELECT id FROM skills WHERE name = 'Desarrollo web'));

-- Nataly Ruiz (Diseño) → Ilustraciones, Revistas, Diseño gráfico
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'nathaliaruiz.ms@gmail.com'), (SELECT id FROM skills WHERE name = 'Ilustraciones'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'nathaliaruiz.ms@gmail.com'), (SELECT id FROM skills WHERE name = 'Revistas'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'nathaliaruiz.ms@gmail.com'), (SELECT id FROM skills WHERE name = 'Diseño gráfico'));

-- Lina Gonzalez (Escritura) → Escritura creativa, Redacción y copywriting, Corrección de estilo
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lina.gonzalez.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Escritura creativa'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lina.gonzalez.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Redacción y copywriting'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lina.gonzalez.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Corrección de estilo'));

-- Laura Obregoso (Diseño, externa) → Ilustraciones, Video, Diseño gráfico
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'laura.obregoso.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Ilustraciones'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'laura.obregoso.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Video'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'laura.obregoso.market@gmail.com'), (SELECT id FROM skills WHERE name = 'Diseño gráfico'));
