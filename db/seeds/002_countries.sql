-- Seed 002: Countries
INSERT INTO countries (name, flag) VALUES ('Colombia',   'co') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('México',     'mx') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Argentina',  'ar') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Chile',      'cl') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Perú',       'pe') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Brasil',     'br') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Venezuela',  've') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Ecuador',    'ec') ON CONFLICT (name) DO NOTHING;
