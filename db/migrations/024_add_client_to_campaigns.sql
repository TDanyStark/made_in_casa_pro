-- Add client_id to campaigns: campaigns now belong to a specific client
-- Drop the global UNIQUE(name) and replace with UNIQUE(client_id, name)
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;

-- Update seed campaigns with a default client (Grupo Empresarial Andino) so the
-- NOT NULL constraint can be added after the data is populated.
-- The seed file 013 will be updated to assign client_id on fresh installs.

-- Drop the old global unique constraint on name
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_name_key;

-- Add the new scoped unique: same name allowed for different clients
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_client_name_unique UNIQUE (client_id, name);

-- Index for fast lookup by client
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
