-- Phase 1: Notification System Base Infrastructure
-- Tables: user_email_connections, notification_events, notification_deliveries,
--         project_email_threads

-- User Email Connections
-- Stores Gmail OAuth connection per user.
CREATE TABLE user_email_connections (
  id             SERIAL       PRIMARY KEY,
  user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider       TEXT         NOT NULL DEFAULT 'gmail',
  email          TEXT         NOT NULL,
  access_token   TEXT,
  refresh_token  TEXT,
  expires_at     TIMESTAMPTZ,
  scopes         TEXT,
  status         TEXT         NOT NULL DEFAULT 'connected',
  last_error     TEXT,
  created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_email_provider CHECK (provider IN ('gmail')),
  CONSTRAINT chk_email_status CHECK (status IN ('connected', 'invalid', 'disconnected')),
  CONSTRAINT uq_user_email UNIQUE (user_id, provider)
);

CREATE INDEX idx_email_connections_user_id ON user_email_connections(user_id);
CREATE INDEX idx_email_connections_status  ON user_email_connections(status);

-- Notification Events
-- Records system events that may trigger email notifications.
CREATE TABLE notification_events (
  id             SERIAL       PRIMARY KEY,
  event_type     TEXT         NOT NULL,
  project_id     INTEGER     REFERENCES projects(id) ON DELETE SET NULL,
  task_id        INTEGER     REFERENCES project_tasks(id) ON DELETE SET NULL,
  adjustment_id  INTEGER     REFERENCES project_adjustments(id) ON DELETE SET NULL,
  actor_user_id  INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  metadata       JSONB,
  created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_events_project_id ON notification_events(project_id);
CREATE INDEX idx_notification_events_task_id    ON notification_events(task_id);
CREATE INDEX idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX idx_notification_events_created_at ON notification_events(created_at);

-- Notification Deliveries
-- Tracks email delivery attempts.
CREATE TABLE notification_deliveries (
  id                SERIAL       PRIMARY KEY,
  event_id          INTEGER      NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  recipient_user_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  recipient_email  TEXT         NOT NULL,
  sender_user_id   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  provider          TEXT         NOT NULL DEFAULT 'gmail',
  status            TEXT         NOT NULL DEFAULT 'pending',
  error             TEXT,
  gmail_thread_id   TEXT,
  message_id        TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_delivery_provider CHECK (provider IN ('gmail', 'smtp', 'resend')),
  CONSTRAINT chk_delivery_status CHECK (status IN ('pending', 'sent', 'failed', 'skipped'))
);

CREATE INDEX idx_notification_deliveries_event_id    ON notification_deliveries(event_id);
CREATE INDEX idx_notification_deliveries_recipient    ON notification_deliveries(recipient_user_id);
CREATE INDEX idx_notification_deliveries_status       ON notification_deliveries(status);
CREATE INDEX idx_notification_deliveries_created_at  ON notification_deliveries(created_at);

-- Project Email Threads
-- Maintains email threads per project version/adjustment.
CREATE TABLE project_email_threads (
  id                  SERIAL       PRIMARY KEY,
  project_id          INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  adjustment_id      INTEGER     REFERENCES project_adjustments(id) ON DELETE CASCADE,
  thread_key         TEXT         NOT NULL,
  provider           TEXT         NOT NULL DEFAULT 'gmail',
  gmail_thread_id    TEXT,
  root_message_id    TEXT,
  created_by_user_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_thread_provider CHECK (provider IN ('gmail', 'smtp', 'resend'))
);

CREATE INDEX idx_email_threads_project_id    ON project_email_threads(project_id);
CREATE INDEX idx_email_threads_adjustment_id ON project_email_threads(adjustment_id);
CREATE INDEX idx_email_threads_thread_key    ON project_email_threads(thread_key);
CREATE UNIQUE INDEX uq_project_base_thread
  ON project_email_threads(project_id, thread_key)
  WHERE adjustment_id IS NULL;
CREATE UNIQUE INDEX uq_project_adjustment_thread
  ON project_email_threads(project_id, adjustment_id, thread_key)
  WHERE adjustment_id IS NOT NULL;
