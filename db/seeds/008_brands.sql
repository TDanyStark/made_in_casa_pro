-- Seed 008: Brands (~2-3 por gerente)
-- manager_id referenciado por email, business_unit_id por los IDs fijos del seed 005

-- Marcas de Carlos Rodríguez (GEA)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('AguaViva',    (SELECT id FROM managers WHERE email = 'carlos.rodriguez@gea.com.co'),    1);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('NutriPure',   (SELECT id FROM managers WHERE email = 'carlos.rodriguez@gea.com.co'),    2);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('FreshLine',   (SELECT id FROM managers WHERE email = 'carlos.rodriguez@gea.com.co'),    2);

-- Marcas de María Alejandra Torres (GEA)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('CasaFácil',   (SELECT id FROM managers WHERE email = 'ma.torres@gea.com.co'),           3);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('Andina Home', (SELECT id FROM managers WHERE email = 'ma.torres@gea.com.co'),           3);

-- Marcas de Jorge Hernández (Digital MX)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('ClickOn',     (SELECT id FROM managers WHERE email = 'j.hernandez@corpdigital.mx'),     1);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('DataPulse',   (SELECT id FROM managers WHERE email = 'j.hernandez@corpdigital.mx'),     1);

-- Marcas de Ana Lucía Mendoza (Digital MX)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('ShopMax',     (SELECT id FROM managers WHERE email = 'al.mendoza@corpdigital.mx'),      4);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('QuickCart',   (SELECT id FROM managers WHERE email = 'al.mendoza@corpdigital.mx'),      4);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('MercadoOn',   (SELECT id FROM managers WHERE email = 'al.mendoza@corpdigital.mx'),      4);

-- Marcas de Roberto Fernández (Distribuidora Sur)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('Sur Drinks',  (SELECT id FROM managers WHERE email = 'roberto.fernandez@distsur.com.ar'), 2);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('PampaBev',    (SELECT id FROM managers WHERE email = 'roberto.fernandez@distsur.com.ar'), 2);

-- Marcas de Laura Gómez (Distribuidora Sur)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('CleanSur',    (SELECT id FROM managers WHERE email = 'laura.gomez@distsur.com.ar'),     3);

-- Marcas de Diego Morales (Comercial Pacífico)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('OcéanoSkin',  (SELECT id FROM managers WHERE email = 'd.morales@compacif.cl'),          2);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('AndesNature', (SELECT id FROM managers WHERE email = 'd.morales@compacif.cl'),          2);

-- Marcas de Valentina Reyes (Comercial Pacífico)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('NovaCare',    (SELECT id FROM managers WHERE email = 'v.reyes@compacif.cl'),            1);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('PurePacific', (SELECT id FROM managers WHERE email = 'v.reyes@compacif.cl'),            3);

-- Marcas de Thiago Oliveira (TechBrands Brasil)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('SmartBR',     (SELECT id FROM managers WHERE email = 'thiago.oliveira@techbrands.com.br'), 1);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('TecnoLife',   (SELECT id FROM managers WHERE email = 'thiago.oliveira@techbrands.com.br'), 1);

-- Marcas de Camila Santos (TechBrands Brasil)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('ConnectHub',  (SELECT id FROM managers WHERE email = 'camila.santos@techbrands.com.br'), 4);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('StreamBR',    (SELECT id FROM managers WHERE email = 'camila.santos@techbrands.com.br'), 4);

-- Marcas de Andrés Castellanos (Inversiones Caribe)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('CaribeFood',  (SELECT id FROM managers WHERE email = 'a.castellanos@invcaribe.com.ve'), 2);
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('SolMar',      (SELECT id FROM managers WHERE email = 'a.castellanos@invcaribe.com.ve'), 3);

-- Marcas de Gabriela Montoya (Inversiones Caribe)
INSERT INTO brands (name, manager_id, business_unit_id)
VALUES ('TropiSabor',  (SELECT id FROM managers WHERE email = 'g.montoya@invcaribe.com.ve'),     2);
