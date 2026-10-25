-- One delivery per (event, recipient) (see odd/tasks/bug-review-fixes.md S23).
-- sendEmail claims the pair with INSERT ... ON CONFLICT (event_id, recipient_email)
-- DO NOTHING, so only one concurrent dispatch can send. Retries update the
-- existing row (resetDeliveryForRetry / markDeliverySent / markDeliveryFailed)
-- and never insert, so the constraint does not affect them.
--
-- No data is deleted. If duplicates already exist the migration aborts (and the
-- runner rolls it back) so they can be reviewed first. Pre-check query:
--
--   SELECT event_id, recipient_email, COUNT(*) AS cnt,
--          array_agg(id ORDER BY id) AS ids, array_agg(status ORDER BY id) AS statuses
--   FROM notification_deliveries
--   GROUP BY event_id, recipient_email
--   HAVING COUNT(*) > 1;
DO $$
DECLARE
  duplicate_pairs INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_pairs
  FROM (
    SELECT 1
    FROM notification_deliveries
    GROUP BY event_id, recipient_email
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_pairs > 0 THEN
    RAISE EXCEPTION 'notification_deliveries has % duplicated (event_id, recipient_email) pairs; resolve them before adding uq_delivery_event_recipient (see pre-check query in 022_notification_delivery_unique.sql)', duplicate_pairs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_delivery_event_recipient'
  ) THEN
    ALTER TABLE notification_deliveries
      ADD CONSTRAINT uq_delivery_event_recipient UNIQUE (event_id, recipient_email);
  END IF;
END $$;
