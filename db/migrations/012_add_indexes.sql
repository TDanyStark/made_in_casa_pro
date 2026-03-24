-- Migration: performance indexes
-- Se crean al final para no afectar la velocidad de inserts durante la carga inicial.
CREATE INDEX IF NOT EXISTS idx_brands_manager_id       ON brands                (manager_id);
CREATE INDEX IF NOT EXISTS idx_brands_business_unit_id ON brands                (business_unit_id);
CREATE INDEX IF NOT EXISTS idx_managers_client_id      ON managers              (client_id);
CREATE INDEX IF NOT EXISTS idx_users_email             ON users                 (email);
CREATE INDEX IF NOT EXISTS idx_users_rol_id            ON users                 (rol_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_id    ON user_skills           (skill_id);
CREATE INDEX IF NOT EXISTS idx_bmh_brand_id            ON brand_manager_history (brand_id);
CREATE INDEX IF NOT EXISTS idx_clients_country_id      ON clients               (country_id);
