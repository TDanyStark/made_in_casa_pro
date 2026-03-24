-- Seed 009: Users
--
-- IMPORTANTE: Las contraseñas son bcrypt del string "Password123!" (10 rounds).
-- Cámbialas en producción o usa el endpoint de cambio de contraseña.
-- Hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW
--
-- is_internal: 1 = empleado interno, 0 = colaborador externo
-- must_change_password: 1 = debe cambiar al primer login

-- ─────────────────────────────────────────────
-- ADMIN (1)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password)
VALUES (
  'Admin Sistema',
  'admin@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'admin'),
  (SELECT id FROM areas WHERE name = 'Tecnología'),
  1, 1, 0
);

-- ─────────────────────────────────────────────
-- DIRECTIVOS (2)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Juan Pablo Vargas',
  'jp.vargas@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'directivo'),
  (SELECT id FROM areas WHERE name = 'Operaciones'),
  1, 1, 0, 12000000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'María Fernanda Ospina',
  'mf.ospina@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'directivo'),
  (SELECT id FROM areas WHERE name = 'Marketing'),
  1, 1, 0, 11500000
);

-- ─────────────────────────────────────────────
-- COMERCIALES (3)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Pedro Alejandro Ríos',
  'pa.rios@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'comercial'),
  (SELECT id FROM areas WHERE name = 'Ventas'),
  1, 1, 0, 5500000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Ana Sofía Herrera',
  'as.herrera@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'comercial'),
  (SELECT id FROM areas WHERE name = 'Ventas'),
  1, 1, 0, 5200000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Luis Miguel Pardo',
  'lm.pardo@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'comercial'),
  (SELECT id FROM areas WHERE name = 'Marketing'),
  1, 1, 0, 5800000
);

-- ─────────────────────────────────────────────
-- COLABORADORES (4)
-- ─────────────────────────────────────────────
INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Sofía Valentina Cruz',
  'sv.cruz@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Tecnología'),
  1, 1, 1, 3500000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Carlos Andrés Mejía',
  'ca.mejia@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Diseño'),
  1, 1, 1, 3200000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Isabella Moreno',
  'i.moreno@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Finanzas'),
  1, 1, 0, 3800000
);

INSERT INTO users (name, email, password, rol_id, area_id, is_internal, is_active, must_change_password, monthly_salary)
VALUES (
  'Mateo Santiago Duarte',
  'ms.duarte@madencasa.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lsvW',
  (SELECT id FROM roles WHERE role = 'colaborador'),
  (SELECT id FROM areas WHERE name = 'Recursos Humanos'),
  0, 1, 1, 0
);
