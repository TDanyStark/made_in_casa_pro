-- Migration: create brand_manager_history table
-- Depende de: brands (008), managers (007)
-- Registra cada cambio de manager en una marca para auditoría.
CREATE TABLE IF NOT EXISTS brand_manager_history (
  id                  SERIAL      PRIMARY KEY,
  brand_id            INTEGER     NOT NULL,
  previous_manager_id INTEGER     NOT NULL,
  new_manager_id      INTEGER     NOT NULL,
  changed_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bmh_brand_id        FOREIGN KEY (brand_id)            REFERENCES brands   (id) ON DELETE CASCADE,
  CONSTRAINT fk_bmh_prev_manager_id FOREIGN KEY (previous_manager_id) REFERENCES managers (id) ON DELETE CASCADE,
  CONSTRAINT fk_bmh_new_manager_id  FOREIGN KEY (new_manager_id)      REFERENCES managers (id) ON DELETE CASCADE
);
