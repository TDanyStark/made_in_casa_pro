-- Seed 005: Business Units (explicit IDs to match application references)
INSERT INTO business_units (id, name) VALUES (1, 'Salud femenina')    ON CONFLICT (id) DO NOTHING;
