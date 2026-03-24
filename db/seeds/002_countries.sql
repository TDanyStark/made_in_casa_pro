-- Seed 002: Countries
INSERT INTO countries (name, flag) VALUES ('Colombia',   '🇨🇴') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('México',     '🇲🇽') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Argentina',  '🇦🇷') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Chile',      '🇨🇱') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Perú',       '🇵🇪') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Brasil',     '🇧🇷') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Venezuela',  '🇻🇪') ON CONFLICT (name) DO NOTHING;
INSERT INTO countries (name, flag) VALUES ('Ecuador',    '🇪🇨') ON CONFLICT (name) DO NOTHING;
