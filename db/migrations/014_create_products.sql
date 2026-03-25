CREATE TABLE IF NOT EXISTS products (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  category_id INTEGER,
  is_active   SMALLINT    NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id)
    REFERENCES product_categories (id) ON DELETE SET NULL
);
