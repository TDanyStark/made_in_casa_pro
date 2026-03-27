-- Enhance product_task_templates with workflow fields
-- task_type: 'execution' | 'validation'
-- requires_quote: 1 if the task requires a quote from an external collaborator before execution

ALTER TABLE product_task_templates
  ADD COLUMN IF NOT EXISTS task_type      TEXT    NOT NULL DEFAULT 'execution',
  ADD COLUMN IF NOT EXISTS requires_quote SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE product_task_templates
  DROP CONSTRAINT IF EXISTS chk_ptt_task_type,
  ADD  CONSTRAINT chk_ptt_task_type CHECK (task_type IN ('execution', 'validation'));
