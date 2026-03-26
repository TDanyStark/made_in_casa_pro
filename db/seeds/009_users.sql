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
  'admin@market-support.com',
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
  'Sandy Baron',
  'sandy.baron@market-support.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'directivo'),
  NULL,
  1, 1, 0, 12000000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Josue Amado',
  'josue.amado@market-support.com',
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
  'Leidy Poveda',
  'leidy.poveda@market-support.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'comercial'),
  NULL,
  1, 1, 0, 5500000
);

-- ─────────────────────────────────────────────
-- COLABORADORES (4) — los únicos con area_id
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Daniel Amado',
  'daniel.amado@market-support.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Programación/IT'),
  1, 1, 1, 3500000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Nataly Ruiz',
  'nathaliaruiz.ms@gmail.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Diseño'),
  1, 1, 1, 3200000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Lina Gonzalez',
  'lina.gonzalez.market@gmail.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Escritura'),
  1, 1, 0, 3800000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Laura Obregoso',
  'laura.obregoso.market@gmail.com',
  '$2b$10$aEyIpIyBNuZxmLTk0ditj.Lq/ZJW6Zz4vgVcaXcUhwlmE2GtnV2j6',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Diseño'),
  0, 1, 1, 0
);
