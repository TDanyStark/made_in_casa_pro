-- Migration: create brands table
-- Depende de: managers (007), business_units (005)
-- ON DELETE SET NULL: si se elimina un manager, la marca queda sin manager (no se borra).
CREATE TABLE IF NOT EXISTS brands (
  id               SERIAL  PRIMARY KEY,
  name             TEXT    NOT NULL,
  manager_id       INTEGER,
  business_unit_id INTEGER,
  CONSTRAINT fk_brands_manager_id       FOREIGN KEY (manager_id)       REFERENCES managers       (id) ON UPDATE SET NULL ON DELETE SET NULL,
  CONSTRAINT fk_brands_business_unit_id FOREIGN KEY (business_unit_id) REFERENCES business_units (id)
);
