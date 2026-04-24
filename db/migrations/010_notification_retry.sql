-- Phase 9-10: Notification System - Retry Tracking & Admin Visibility
-- Adds retry_count and last_attempt_at to notification_deliveries for Phase 10 retry support.

ALTER TABLE notification_deliveries
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;