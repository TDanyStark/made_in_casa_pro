-- Ensure each email address is used by exactly one user account.
-- The existing idx_users_email index is dropped first because PostgreSQL
-- cannot add a UNIQUE constraint that duplicates a non-unique index name.
DROP INDEX IF EXISTS idx_users_email;

ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
