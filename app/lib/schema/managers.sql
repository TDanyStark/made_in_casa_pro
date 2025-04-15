-- Create managers table if it doesn't exist
CREATE TABLE IF NOT EXISTS managers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  biography TEXT NOT NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Create index for fast lookup by client_id
CREATE INDEX IF NOT EXISTS idx_managers_client_id ON managers (client_id);