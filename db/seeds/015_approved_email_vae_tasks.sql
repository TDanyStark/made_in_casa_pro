-- Seed 015: Approved Email (VAE) Tasks
INSERT INTO product_task_templates 
  (product_id, title, area_id, assigned_user_id, order_index, task_type, requires_quote, assign_to_commercial)
VALUES
  (
    (SELECT id FROM products WHERE name = 'Approved Email (VAE)'),
    'Redacción de contenido',
    (SELECT id FROM areas WHERE name = 'Escritura'),
    (SELECT id FROM users WHERE email = 'lina.gonzalez.market@gmail.com'),
    0,
    'execution',
    0,
    0
  ),
  (
    (SELECT id FROM products WHERE name = 'Approved Email (VAE)'),
    'Diseñar contenido',
    (SELECT id FROM areas WHERE name = 'Diseño'),
    NULL,
    1,
    'execution',
    0,
    0
  ),
  (
    (SELECT id FROM products WHERE name = 'Approved Email (VAE)'),
    'Revisar si el diseño quedo como se esperaba',
    NULL,
    (SELECT id FROM users WHERE email = 'lina.gonzalez.market@gmail.com'),
    2,
    'validation',
    0,
    0
  ),
  (
    (SELECT id FROM products WHERE name = 'Approved Email (VAE)'),
    'Enviar contenido para aprobación',
    NULL,
    NULL,
    3,
    'execution',
    0,
    1
  ),
  (
    (SELECT id FROM products WHERE name = 'Approved Email (VAE)'),
    'Programar para Veeva',
    (SELECT id FROM areas WHERE name = 'Programación/IT'),
    NULL,
    4,
    'execution',
    0,
    0
  )
ON CONFLICT DO NOTHING;
