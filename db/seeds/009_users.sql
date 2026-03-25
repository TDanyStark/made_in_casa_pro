-- Seed 009: Users
--
-- IMPORTANTE: Las contraseñas son bcrypt del string "Password123!" (10 rounds).
-- Cámbialas en producción o usa el endpoint de cambio de contraseña.
-- Hash: $2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6
--
-- is_internal: 1 = empleado interno, 0 = colaborador externo
-- must_change_password: 1 = debe cambiar al primer login
-- area_id: solo aplica a colaboradores; NULL para admin, directivos y comerciales

-- ─────────────────────────────────────────────
-- ADMIN (1)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password)
VALUES (
  'Admin Sistema',
  'admin@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'admin'),
  NULL,
  1, 1, 0
);

-- ─────────────────────────────────────────────
-- DIRECTIVOS (2)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Juan Pablo Vargas',
  'jp.vargas@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'directivo'),
  NULL,
  1, 1, 0, 12000000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'María Fernanda Ospina',
  'mf.ospina@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'directivo'),
  NULL,
  1, 1, 0, 11500000
);

-- ─────────────────────────────────────────────
-- COMERCIALES (3)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Pedro Alejandro Ríos',
  'pa.rios@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'comercial'),
  NULL,
  1, 1, 0, 5500000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Ana Sofía Herrera',
  'as.herrera@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'comercial'),
  NULL,
  1, 1, 0, 5200000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Luis Miguel Pardo',
  'lm.pardo@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'comercial'),
  NULL,
  1, 1, 0, 5800000
);

-- ─────────────────────────────────────────────
-- COLABORADORES (4) — los únicos con area_id
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Sofía Valentina Cruz',
  'sv.cruz@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Programación/IT'),
  1, 1, 1, 3500000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Carlos Andrés Mejía',
  'ca.mejia@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Diseño'),
  1, 1, 1, 3200000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Isabella Moreno',
  'i.moreno@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Escritura'),
  1, 1, 0, 3800000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Mateo Santiago Duarte',
  'ms.duarte@madencasa.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Diseño'),
  0, 1, 1, 0
);
