CREATE TABLE IF NOT EXISTS product_task_templates (
  id               SERIAL      PRIMARY KEY,
  product_id       INTEGER     NOT NULL,
  title            TEXT        NOT NULL,
  description      TEXT,
  area_id          INTEGER,
  assigned_user_id INTEGER,
  order_index      INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ptt_product_id       FOREIGN KEY (product_id)       REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_ptt_area_id          FOREIGN KEY (area_id)          REFERENCES areas    (id) ON DELETE SET NULL,
  CONSTRAINT fk_ptt_assigned_user_id FOREIGN KEY (assigned_user_id) REFERENCES users    (id) ON DELETE SET NULL
);
