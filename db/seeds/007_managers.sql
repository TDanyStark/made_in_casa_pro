-- Seed 007: Managers
-- Las referencias a client_id se hacen por nombre para evitar depender de IDs hardcodeados

-- Abbott Co
INSERT INTO managers (client_id, name, email, phone, biography)
VALUES (
  (SELECT id FROM clients WHERE name = 'Abbott Co'),
  'Marcela Toro',
  'marcela.toro@abbott.com',
  '+57 300 123 4567',
  'Gerente de marca con 12 años de experiencia en el sector FMCG. Especialista en posicionamiento y lanzamientos regionales.'
);
