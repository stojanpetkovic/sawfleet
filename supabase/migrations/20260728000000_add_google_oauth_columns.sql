ALTER TABLE tracking_settings
ADD COLUMN IF NOT EXISTS google_oauth_client_id text,
ADD COLUMN IF NOT EXISTS google_oauth_client_secret text;
