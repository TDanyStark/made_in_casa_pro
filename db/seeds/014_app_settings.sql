-- Seed the Google OAuth keys with empty values so they always exist
INSERT INTO app_settings (key, value) VALUES
  ('google_oauth_client_id',     NULL),
  ('google_oauth_client_secret', NULL),
  ('google_oauth_refresh_token', NULL),
  ('google_oauth_connected_email', NULL)
ON CONFLICT (key) DO NOTHING;