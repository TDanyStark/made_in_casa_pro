ALTER TABLE projects
  ADD COLUMN ideal_delivery_at TIMESTAMPTZ NULL,
  ADD COLUMN oc TEXT NULL,
  ADD COLUMN billing_closed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN projects.billing_closed_at IS 'Administrative billing closure milestone. Distinct from projects.completed_at operational completion.';
