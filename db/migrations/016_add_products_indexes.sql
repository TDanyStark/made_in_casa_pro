CREATE INDEX IF NOT EXISTS idx_products_category_id           ON products               (category_id);
CREATE INDEX IF NOT EXISTS idx_product_task_templates_product ON product_task_templates (product_id);
CREATE INDEX IF NOT EXISTS idx_product_task_templates_area    ON product_task_templates (area_id);
