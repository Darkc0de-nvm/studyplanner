-- Enable pgcrypto for gen_random_uuid() in older Postgres versions
-- In Postgres 13+ gen_random_uuid() is built-in but pgcrypto is harmless
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
