-- Seed 007: Managers (~2 por cliente)
-- Las referencias a client_id se hacen por nombre para evitar depender de IDs hardcodeados

-- Grupo Empresarial Andino
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Grupo Empresarial Andino'),
  'Carlos Rodríguez',
  'carlos.rodriguez@gea.com.co',
  '+57 300 123 4567',
  'Gerente de marca con 12 años de experiencia en el sector FMCG. Especialista en posicionamiento y lanzamientos regionales.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Grupo Empresarial Andino'),
  'María Alejandra Torres',
  'ma.torres@gea.com.co',
  '+57 315 987 6543',
  'Directora de portafolio con trayectoria en consumo masivo y retail. MBA en Marketing por la Universidad de los Andes.'
);

-- Corporación Digital MX
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Corporación Digital MX'),
  'Jorge Hernández',
  'j.hernandez@corpdigital.mx',
  '+52 55 1234 5678',
  'Líder de marcas digitales con enfoque en growth marketing y estrategia de contenido para mercados hispanohablantes.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Corporación Digital MX'),
  'Ana Lucía Mendoza',
  'al.mendoza@corpdigital.mx',
  '+52 55 8765 4321',
  'Brand manager con 8 años en agencias de comunicación. Especializada en transformación digital y e-commerce.'
);

-- Distribuidora Sur SA
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Distribuidora Sur SA'),
  'Roberto Fernández',
  'roberto.fernandez@distsur.com.ar',
  '+54 11 4567 8901',
  'Gerente comercial con amplia experiencia en distribución FMCG en el Cono Sur. Foco en canal moderno y tradicional.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Distribuidora Sur SA'),
  'Laura Gómez',
  'laura.gomez@distsur.com.ar',
  '+54 11 2345 6789',
  'Especialista en trade marketing y shopper insight con 6 años de experiencia en retail argentina y mercados limítrofes.'
);

-- Comercial Pacífico
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Comercial Pacífico'),
  'Diego Morales',
  'd.morales@compacif.cl',
  '+56 9 8765 4321',
  'Director de marcas con experiencia en consumo masivo y cuidado personal. Especialista en expansión a mercados LATAM.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Comercial Pacífico'),
  'Valentina Reyes',
  'v.reyes@compacif.cl',
  '+56 9 1234 5678',
  'Brand strategist enfocada en innovación de producto y desarrollo de nuevas categorías para el mercado chileno y peruano.'
);

-- TechBrands Brasil
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'TechBrands Brasil'),
  'Thiago Oliveira',
  'thiago.oliveira@techbrands.com.br',
  '+55 11 9 8765 4321',
  'Head de marcas tecnológicas con background en startups y empresas de consumer tech. Referencia en branding digital en Brasil.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'TechBrands Brasil'),
  'Camila Santos',
  'camila.santos@techbrands.com.br',
  '+55 11 9 1234 5678',
  'Gerente de portafolio con 9 años en marcas de tecnología de consumo. Experta en lanzamientos B2C y estrategia omnicanal.'
);

-- Inversiones Caribe
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Inversiones Caribe'),
  'Andrés Castellanos',
  'a.castellanos@invcaribe.com.ve',
  '+58 412 345 6789',
  'Gerente de marca con experiencia en mercados emergentes y estrategias de precio adaptadas a contextos de alta inflación.'
);

INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Inversiones Caribe'),
  'Gabriela Montoya',
  'g.montoya@invcaribe.com.ve',
  '+58 424 987 6543',
  'Directora de portafolio especializada en consumo masivo y canales alternativos de distribución en el Caribe hispanohablante.'
);
