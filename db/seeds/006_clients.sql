-- Seed 006: Clients
-- accept_business_units: 1 = sí maneja unidades de negocio, 0 = no

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Abbott Co',  (SELECT id FROM countries WHERE name = 'Colombia'),  1);
