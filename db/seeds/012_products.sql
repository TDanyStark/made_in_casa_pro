-- Seed 012: Products
INSERT INTO products (name, category_id, description) VALUES
-- AUDIO
('Podcasts',                              (SELECT id FROM product_categories WHERE name = 'Audio'),                         'Producción de contenido en formato podcast'),
('Cápsulas',                              (SELECT id FROM product_categories WHERE name = 'Audio'),                         'Cápsulas de audio informativas'),
('Jingles',                               (SELECT id FROM product_categories WHERE name = 'Audio'),                         'Identidad sonora y piezas musicales cortas'),

-- APLICATIVOS DIGITALES
('Juegos',                                (SELECT id FROM product_categories WHERE name = 'Aplicativos digitales'),          'Desarrollo de juegos interactivos'),
('Quizzes',                               (SELECT id FROM product_categories WHERE name = 'Aplicativos digitales'),          'Cuestionarios interactivos para la audiencia'),
('Algoritmo diagnóstico / tratamiento',   (SELECT id FROM product_categories WHERE name = 'Aplicativos digitales'),          'Herramientas digitales de diagnóstico'),
('Simuladores de casos clínicos',         (SELECT id FROM product_categories WHERE name = 'Aplicativos digitales'),          'Entornos virtuales para práctica médica'),

-- EDITORIALES
('Flipbooks',                             (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Publicaciones digitales interactivas'),
('Posts de contenido',                    (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Redacción y diseño de posts especializados'),
('Ayudas visuales interactivas',          (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Material de apoyo visual con interacción'),
('Infografías interactivas',              (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Gráficos dinámicos con datos interactivos'),
('Newsletters',                           (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Boletines informativos periódicos'),
('Magazines',                             (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Revistas digitales o impresas'),
('One page',                              (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Diseño de aterrizaje de una sola página'),
('Sliders',                               (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Carruseles de imágenes y contenido'),
('Agenda / Booklet',                      (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Material impreso o digital de organización'),
('Cartografía / Kit informativo',         (SELECT id FROM product_categories WHERE name = 'Editoriales'),                   'Mapas y paquetes de información técnica'),

-- MAILING
('Audio-mailing',                         (SELECT id FROM product_categories WHERE name = 'Mailing'),                       'Envío masivo con contenido de audio'),
('Approved Email (VAE)',                  (SELECT id FROM product_categories WHERE name = 'Mailing'),                       'Campañas de correo bajo estándares corporativos'),
('Mailing texto/imagen',                  (SELECT id FROM product_categories WHERE name = 'Mailing'),                       'Diseño estándar de correo electrónico'),
('Video-mailing',                         (SELECT id FROM product_categories WHERE name = 'Mailing'),                       'Integración de video en campañas de correo'),

-- REALIDAD VIRTUAL Y AUMENTADA
('Experiencias VR/AR',                    (SELECT id FROM product_categories WHERE name = 'Realidad virtual y aumentada'),  'Inmersión tecnológica para eventos o educación'),

-- VIDEOS
('Animación 2D o 3D',                     (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Motion graphics y modelado'),
('Exposición de caso / Informativo',      (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Videos explicativos y educativos'),
('How it Works 3D',                       (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Demostraciones técnicas en tres dimensiones'),
('Momentos memorables',                   (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Edición de conferencias y eventos highlights'),
('Real story',                            (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Contenido basado en testimonios reales'),
('Spot publicitario / Teaser',            (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Comerciales de corta duración'),
('Tipo TED / Videopodcast',               (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Grabación de charlas y contenido hablado'),
('Videoserie tipo Netflix',               (SELECT id FROM product_categories WHERE name = 'Videos'),                        'Producción de contenido serializado de alta calidad'),

-- WEB Y PROGRAMACIÓN
('Desarrollo web (S, M, L, XL)',          (SELECT id FROM product_categories WHERE name = 'Web y programación'),            'Sitios web escalables según necesidad'),
('E-commerce',                            (SELECT id FROM product_categories WHERE name = 'Web y programación'),            'Tiendas en línea y plataformas de pago'),
('Programación Veeva',                    (SELECT id FROM product_categories WHERE name = 'Web y programación'),            'Desarrollo especializado para entorno CRM Veeva'),

-- LEARNING LIVE
('Programas Regulares',                   (SELECT id FROM product_categories WHERE name = 'Learning Live'),                 'Capacitación continua en vivo'),
('Programas Híbridos',                    (SELECT id FROM product_categories WHERE name = 'Learning Live'),                 'Mezcla de aprendizaje presencial y digital'),

-- IA
('ChatBots con IA',                       (SELECT id FROM product_categories WHERE name = 'IA'),                            'Asistentes inteligentes conversacionales'),
('Personajes animados con IA',            (SELECT id FROM product_categories WHERE name = 'IA'),                            'Avatares dinámicos potenciados por IA'),

-- SOUVENIRS
('Experience boxes',                      (SELECT id FROM product_categories WHERE name = 'Souvenirs'),                     'Cajas de regalo con experiencias físicas'),
('Eco-gifts',                             (SELECT id FROM product_categories WHERE name = 'Souvenirs'),                     'Regalos corporativos sostenibles'),
('Music experience',                      (SELECT id FROM product_categories WHERE name = 'Souvenirs'),                     'Souvenirs relacionados con música'),

-- BRANDING
('Diseño de stand / Backing',             (SELECT id FROM product_categories WHERE name = 'Branding'),                      'Elementos visuales para eventos físicos'),
('Floor graphic / Pendón',                (SELECT id FROM product_categories WHERE name = 'Branding'),                      'Señalética y piezas de gran formato'),
('Rompetráfico / Saltarín',               (SELECT id FROM product_categories WHERE name = 'Branding'),                      'Material POP para punto de venta'),

-- PROGRAMAS DE TRANSFORMACIÓN
('E-learning y b-learning (HCP)',         (SELECT id FROM product_categories WHERE name = 'Programas de transformación'),   'Programas para profesionales de la salud'),
('Programas educativos para pacientes',   (SELECT id FROM product_categories WHERE name = 'Programas de transformación'),   'Plataformas digitales de contenido para pacientes')
ON CONFLICT DO NOTHING;
