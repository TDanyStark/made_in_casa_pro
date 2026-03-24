-- Seed 005: Business Units (explicit IDs to match application references)
INSERT INTO business_units (id, name) VALUES (1, 'Digital')    ON CONFLICT (id) DO NOTHING;
INSERT INTO business_units (id, name) VALUES (2, 'Retail')     ON CONFLICT (id) DO NOTHING;
INSERT INTO business_units (id, name) VALUES (3, 'Wholesale')  ON CONFLICT (id) DO NOTHING;
INSERT INTO business_units (id, name) VALUES (4, 'B2B')        ON CONFLICT (id) DO NOTHING;
