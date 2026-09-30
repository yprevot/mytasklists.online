-- Extensiones que necesita el esquema (gen_random_uuid).
-- La migracion tambien las crea si faltan; esto solo adelanta el trabajo.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
