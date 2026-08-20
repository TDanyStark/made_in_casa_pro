CREATE TABLE project_drive_access_failures (
  project_id      INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  failure_code    TEXT        NOT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id, email),
  CONSTRAINT chk_project_drive_access_failure_code CHECK (
    failure_code IN ('NO_GOOGLE_ACCOUNT', 'POLICY_OR_RESTRICTION', 'TRANSIENT_OR_UNKNOWN')
  )
);
