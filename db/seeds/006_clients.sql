-- Seed 006: Clients
-- accept_business_units: 1 = sí maneja unidades de negocio, 0 = no

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Grupo Empresarial Andino',  (SELECT id FROM countries WHERE name = 'Colombia'),  1);

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Corporación Digital MX',   (SELECT id FROM countries WHERE name = 'México'),    1);

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Distribuidora Sur SA',      (SELECT id FROM countries WHERE name = 'Argentina'), 0);

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Comercial Pacífico',        (SELECT id FROM countries WHERE name = 'Chile'),     1);

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('TechBrands Brasil',         (SELECT id FROM countries WHERE name = 'Brasil'),    0);

INSERT INTO clients (name, country_id, accept_business_units)
VALUES ('Inversiones Caribe',        (SELECT id FROM countries WHERE name = 'Venezuela'), 1);
