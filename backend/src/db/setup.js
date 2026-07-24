// Cria o banco movie_rating (se faltar) e aplica o schema.sql.
// Idempotente: pode rodar quantas vezes quiser.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1); // "/movie_rating" -> "movie_rating"

async function ensureDatabase() {
    // Conecta na base de manutencao "postgres" para poder criar a nossa.
    const adminUrl = new URL(url);
    adminUrl.pathname = '/postgres';
    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
        // Nome do banco nao pode ser parametrizado; dbName vem do nosso .env (confiavel).
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`[setup] banco "${dbName}" criado.`);
    } else {
        console.log(`[setup] banco "${dbName}" ja existe.`);
    }
    await client.end();
}

async function applySchema() {
    const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
    const client = new Client({ connectionString: url.toString() });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log('[setup] schema aplicado (extension vector + tabelas).');
}

await ensureDatabase();
await applySchema();
console.log('[setup] pronto.');
