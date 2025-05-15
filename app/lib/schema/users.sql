PRAGMA foreign_keys = ON;

-- Tabla de roles
CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL UNIQUE
);

-- Tabla de áreas (escritura, diseño, programación, etc.)
CREATE TABLE areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Tabla de habilidades
CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Tabla de usuarios
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol_id INTEGER NOT NULL,
    area_id INTEGER,              -- Solo aplicable a COLABORADORES
    is_internal BOOLEAN,          -- TRUE: interno, FALSE: externo
    hourly_rate REAL,             -- Solo si is_internal = TRUE
    FOREIGN KEY (rol_id) REFERENCES roles(id),
    FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Tabla de relación muchos a muchos: usuarios <-> habilidades
CREATE TABLE user_skills (
    user_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
