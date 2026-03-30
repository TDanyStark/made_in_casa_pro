-- Pre-configured external quoters for product task templates.
-- When a project is created and a requires_quote task is instantiated,
-- these users are automatically inserted into task_quote_invitations.

CREATE TABLE IF NOT EXISTS product_task_template_quoters (
  id          SERIAL   PRIMARY KEY,
  template_id INTEGER  NOT NULL REFERENCES product_task_templates(id) ON DELETE CASCADE,
  user_id     INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pttq_template_id ON product_task_template_quoters(template_id);
CREATE INDEX IF NOT EXISTS idx_pttq_user_id     ON product_task_template_quoters(user_id);
