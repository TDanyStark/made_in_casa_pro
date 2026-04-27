-- Seed 008: Brands (~2-3 por gerente)
-- manager_id referenciado por email, business_unit_id por los IDs fijos del seed 005

-- Marcas de Carlos Rodríguez (GEA)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('Bellanew',    (SELECT id FROM managers WHERE email = 'marcela.toro@abbott.com'),    1);
