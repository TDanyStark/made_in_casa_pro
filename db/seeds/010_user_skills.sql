-- Seed 010: User skills (habilidades por usuario)
-- user_id y skill_id referenciados por email y nombre respectivamente

-- Admin Sistema → SQL, JavaScript, TypeScript
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@madencasa.com'), (SELECT id FROM skills WHERE name = 'SQL'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@madencasa.com'), (SELECT id FROM skills WHERE name = 'JavaScript'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'admin@madencasa.com'), (SELECT id FROM skills WHERE name = 'TypeScript'));

-- Juan Pablo Vargas (directivo) → Leadership, Project Management, Communication
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'jp.vargas@madencasa.com'), (SELECT id FROM skills WHERE name = 'Leadership'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'jp.vargas@madencasa.com'), (SELECT id FROM skills WHERE name = 'Project Management'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'jp.vargas@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));

-- María Fernanda Ospina (directiva) → Leadership, Communication, Design
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'mf.ospina@madencasa.com'), (SELECT id FROM skills WHERE name = 'Leadership'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'mf.ospina@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'mf.ospina@madencasa.com'), (SELECT id FROM skills WHERE name = 'Design'));

-- Pedro Alejandro Ríos (comercial) → Communication, Project Management
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'pa.rios@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'pa.rios@madencasa.com'), (SELECT id FROM skills WHERE name = 'Project Management'));

-- Ana Sofía Herrera (comercial) → Communication, Design
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'as.herrera@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'as.herrera@madencasa.com'), (SELECT id FROM skills WHERE name = 'Design'));

-- Luis Miguel Pardo (comercial) → Communication, Leadership, SQL
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lm.pardo@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lm.pardo@madencasa.com'), (SELECT id FROM skills WHERE name = 'Leadership'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'lm.pardo@madencasa.com'), (SELECT id FROM skills WHERE name = 'SQL'));

-- Sofía Valentina Cruz (colaboradora) → JavaScript, TypeScript, React
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sv.cruz@madencasa.com'), (SELECT id FROM skills WHERE name = 'JavaScript'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sv.cruz@madencasa.com'), (SELECT id FROM skills WHERE name = 'TypeScript'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'sv.cruz@madencasa.com'), (SELECT id FROM skills WHERE name = 'React'));

-- Carlos Andrés Mejía (colaborador) → Design, Communication
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'ca.mejia@madencasa.com'), (SELECT id FROM skills WHERE name = 'Design'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'ca.mejia@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));

-- Isabella Moreno (colaboradora) → SQL, Python
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'i.moreno@madencasa.com'), (SELECT id FROM skills WHERE name = 'SQL'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'i.moreno@madencasa.com'), (SELECT id FROM skills WHERE name = 'Python'));

-- Mateo Santiago Duarte (colaborador externo) → Communication, Project Management
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'ms.duarte@madencasa.com'), (SELECT id FROM skills WHERE name = 'Communication'));
INSERT INTO user_skills (user_id, skill_id)
VALUES ((SELECT id FROM users WHERE email = 'ms.duarte@madencasa.com'), (SELECT id FROM skills WHERE name = 'Project Management'));
