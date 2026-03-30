-- Full database schema (consolidated)
-- All tables, constraints, and indexes in dependency order.

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Lookup tables ─────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id   SERIAL PRIMARY KEY,
  role TEXT
);

CREATE TABLE countries (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE,
  flag TEXT   NOT NULL
);

CREATE TABLE areas (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE
);

CREATE TABLE skills (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE
);

-- IDs are explicit (no auto-increment) so seeds can reference them by known value.
CREATE TABLE business_units (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL
);

-- ── Client / Brand / Manager ──────────────────────────────────────────────────
CREATE TABLE clients (
  id                    SERIAL   PRIMARY KEY,
  name                  TEXT     NOT NULL,
  country_id            INTEGER  REFERENCES countries(id),
  accept_business_units SMALLINT DEFAULT 0
);

CREATE TABLE managers (
  id        SERIAL  PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL,
  email     TEXT    NOT NULL UNIQUE,
  phone     TEXT    NOT NULL,
  biography TEXT    NOT NULL
);

CREATE TABLE brands (
  id               SERIAL  PRIMARY KEY,
  name             TEXT    NOT NULL,
  manager_id       INTEGER REFERENCES managers(id) ON DELETE SET NULL,
  business_unit_id INTEGER REFERENCES business_units(id)
);

CREATE TABLE brand_manager_history (
  id                  SERIAL      PRIMARY KEY,
  brand_id            INTEGER     NOT NULL REFERENCES brands(id)   ON DELETE CASCADE,
  previous_manager_id INTEGER     NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  new_manager_id      INTEGER     NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  changed_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                   SERIAL      PRIMARY KEY,
  name                 TEXT,
  email                TEXT,
  password             TEXT,
  rol_id               INTEGER     REFERENCES roles(id),
  area_id              INTEGER     REFERENCES areas(id),
  is_internal          SMALLINT,
  must_change_password SMALLINT    DEFAULT 0,
  is_active            SMALLINT    DEFAULT 1,
  last_login           BIGINT,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  monthly_salary       REAL
);

CREATE TABLE user_skills (
  user_id  INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, skill_id)
);

-- ── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE product_categories (
  id   SERIAL PRIMARY KEY,
  name TEXT   NOT NULL UNIQUE
);

CREATE TABLE products (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  category_id INTEGER     REFERENCES product_categories(id) ON DELETE SET NULL,
  is_active   SMALLINT    NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_task_templates (
  id                   SERIAL      PRIMARY KEY,
  product_id           INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title                TEXT        NOT NULL,
  description          TEXT,
  area_id              INTEGER     REFERENCES areas(id)  ON DELETE SET NULL,
  assigned_user_id     INTEGER     REFERENCES users(id)  ON DELETE SET NULL,
  order_index          INTEGER     NOT NULL DEFAULT 0,
  task_type            TEXT        NOT NULL DEFAULT 'execution',
  requires_quote       SMALLINT    NOT NULL DEFAULT 0,
  assign_to_commercial SMALLINT    NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ptt_task_type CHECK (task_type IN ('execution', 'validation'))
);

CREATE TABLE product_task_template_quoters (
  id          SERIAL  PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES product_task_templates(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (template_id, user_id)
);

-- ── Campaigns & Projects ──────────────────────────────────────────────────────
CREATE TABLE campaigns (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL,
  client_id  INTEGER     REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaigns_client_name_unique UNIQUE (client_id, name)
);

CREATE TABLE projects (
  id               SERIAL      PRIMARY KEY,
  title            TEXT        NOT NULL,
  brand_id         INTEGER     NOT NULL REFERENCES brands(id)   ON DELETE RESTRICT,
  manager_id       INTEGER     NOT NULL REFERENCES managers(id) ON DELETE RESTRICT,
  product_id       INTEGER     REFERENCES products(id)   ON DELETE SET NULL,
  campaign_id      INTEGER     REFERENCES campaigns(id)  ON DELETE SET NULL,
  drive_folder_id  TEXT,
  drive_folder_url TEXT,
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'active',
  progress         SMALLINT    NOT NULL DEFAULT 0,
  created_by       INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_projects_status CHECK (status IN ('active', 'paused', 'completed', 'archived'))
);

-- Co-responsible managers for a project
CREATE TABLE project_managers (
  project_id INTEGER NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, manager_id)
);

-- ── Project Tasks ─────────────────────────────────────────────────────────────
CREATE TABLE project_tasks (
  id                   SERIAL      PRIMARY KEY,
  project_id           INTEGER     NOT NULL REFERENCES projects(id)              ON DELETE CASCADE,
  template_id          INTEGER     REFERENCES product_task_templates(id) ON DELETE SET NULL,
  title                TEXT        NOT NULL,
  description          TEXT,
  area_id              INTEGER     REFERENCES areas(id) ON DELETE SET NULL,
  assigned_user_id     INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  status               TEXT        NOT NULL DEFAULT 'not_started',
  order_index          INTEGER     NOT NULL DEFAULT 0,
  task_type            TEXT        NOT NULL DEFAULT 'execution',
  task_flag            TEXT        NOT NULL DEFAULT 'new',
  requires_quote       SMALLINT    NOT NULL DEFAULT 0,
  assign_to_commercial SMALLINT    NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pt_status    CHECK (status    IN ('not_started', 'waiting', 'in_progress', 'completed', 'blocked')),
  CONSTRAINT chk_pt_task_type CHECK (task_type IN ('execution', 'validation')),
  CONSTRAINT chk_pt_task_flag CHECK (task_flag IN ('new', 'correction', 'adjustment'))
);

-- ── Quotes & Workflow ─────────────────────────────────────────────────────────
CREATE TABLE task_quotes (
  id             SERIAL       PRIMARY KEY,
  task_id        INTEGER      NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id        INTEGER      NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  price          NUMERIC(12,2),
  delivery_days  INTEGER,
  delivery_hours INTEGER,
  notes          TEXT,
  status         TEXT         NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_tq_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  UNIQUE (task_id, user_id)
);

CREATE TABLE task_transitions (
  id              SERIAL       PRIMARY KEY,
  task_id         INTEGER      NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  project_id      INTEGER      NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  from_status     TEXT,
  to_status       TEXT         NOT NULL,
  from_flag       TEXT,
  to_flag         TEXT,
  moved_by        INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  transitioned_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_quote_invitations (
  id         SERIAL      PRIMARY KEY,
  task_id    INTEGER     NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id    INTEGER     NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  invited_by INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, user_id)
);

-- ── App Settings ──────────────────────────────────────────────────────────────
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_clients_country_id                ON clients                       (country_id);
CREATE INDEX idx_managers_client_id                ON managers                      (client_id);
CREATE INDEX idx_brands_manager_id                 ON brands                        (manager_id);
CREATE INDEX idx_brands_business_unit_id           ON brands                        (business_unit_id);
CREATE INDEX idx_bmh_brand_id                      ON brand_manager_history         (brand_id);
CREATE INDEX idx_users_email                       ON users                         (email);
CREATE INDEX idx_users_rol_id                      ON users                         (rol_id);
CREATE INDEX idx_user_skills_skill_id              ON user_skills                   (skill_id);
CREATE INDEX idx_products_category_id              ON products                      (category_id);
CREATE INDEX idx_ptt_product_id                    ON product_task_templates        (product_id);
CREATE INDEX idx_ptt_area_id                       ON product_task_templates        (area_id);
CREATE INDEX idx_pttq_template_id                  ON product_task_template_quoters (template_id);
CREATE INDEX idx_pttq_user_id                      ON product_task_template_quoters (user_id);
CREATE INDEX idx_campaigns_client_id               ON campaigns                     (client_id);
CREATE INDEX idx_projects_brand_id                 ON projects                      (brand_id);
CREATE INDEX idx_projects_manager_id               ON projects                      (manager_id);
CREATE INDEX idx_projects_campaign_id              ON projects                      (campaign_id);
CREATE INDEX idx_projects_status                   ON projects                      (status);
CREATE INDEX idx_project_managers_pid              ON project_managers              (project_id);
CREATE INDEX idx_project_managers_mid              ON project_managers              (manager_id);
CREATE INDEX idx_project_tasks_pid                 ON project_tasks                 (project_id);
CREATE INDEX idx_project_tasks_user                ON project_tasks                 (assigned_user_id);
CREATE INDEX idx_project_tasks_status              ON project_tasks                 (status);
CREATE INDEX idx_task_quotes_task_id               ON task_quotes                   (task_id);
CREATE INDEX idx_task_quotes_user_id               ON task_quotes                   (user_id);
CREATE INDEX idx_task_transitions_task_id          ON task_transitions              (task_id);
CREATE INDEX idx_task_transitions_project_id       ON task_transitions              (project_id);
CREATE INDEX idx_tqi_task_id                       ON task_quote_invitations        (task_id);
CREATE INDEX idx_tqi_user_id                       ON task_quote_invitations        (user_id);
