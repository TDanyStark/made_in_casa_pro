-- Seed 002: Countries
INSERT INTO countries (name, flag) VALUES ('Colombia',   'CO') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('México',     'MX') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Argentina',  'AR') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Chile',      'CL') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Perú',       'PE') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Brasil',     'BR') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Venezuela',  'VE') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Ecuador',    'EC') ON CONFLICT (name) DO NOTHING;
