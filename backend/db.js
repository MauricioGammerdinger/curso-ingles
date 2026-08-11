// db.js — conexão com Postgres (Neon, Supabase, Railway ou qualquer Postgres funciona,
// basta trocar a DATABASE_URL). Trocamos de SQLite local pra isso porque hospedagens
// gratuitas (como o plano Free do Render) não oferecem disco persistente — um arquivo
// local seria apagado toda vez que o servidor "dorme" por inatividade e acorda de novo.
// Um banco Postgres gerenciado fica numa conta separada e não é afetado por isso.
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não definida. Configure no .env (veja .env.example).');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // A maioria dos provedores gratuitos (Neon, Supabase, Render Postgres) exige SSL.
  // rejectUnauthorized:false evita erro de certificado autoassinado em alguns provedores.
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      avatar_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Guarda a "inscrição" de push de cada aparelho (uma pessoa pode ter várias, ex:
    -- celular + PC). endpoint é único por aparelho/navegador.
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT UNIQUE NOT NULL,
      subscription_json JSONB NOT NULL,
      last_notified_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Migração segura: adiciona a coluna se o banco já existia de antes (sem essa coluna)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;
  `);
}

module.exports = { pool, initSchema };
