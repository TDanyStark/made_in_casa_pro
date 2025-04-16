-- Create brands table if it doesn't exist
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manager_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (manager_id) REFERENCES managers(id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_brands_manager_id ON brands (manager_id);