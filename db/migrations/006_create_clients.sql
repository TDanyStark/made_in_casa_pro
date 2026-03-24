-- Migration: create clients table
-- Depende de: countries (002)
CREATE TABLE IF NOT EXISTS clients (
  id                    SERIAL   PRIMARY KEY,
  name                  TEXT     NOT NULL,
  country_id            INTEGER,
  accept_business_units SMALLINT DEFAULT 0,
  CONSTRAINT fk_clients_country_id FOREIGN KEY (country_id) REFERENCES countries (id)
);
