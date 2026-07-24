import pg from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv();

const { Pool } = pg;

// keepAlive por causa de 2 comportamentos do WSL2 (o Node roda no Windows):
//  - o relay "localhost" do WSL derruba conexoes TCP ociosas (a ingestao fica
//    parada segundos processando lotes) -> keepAlive evita a queda.
//  - a VM do WSL pode reciclar conexoes; retry/ON CONFLICT deixam tudo resumivel.
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    max: 10,
    idleTimeoutMillis: 30000,
});

// Sem esse handler, um erro num client ocioso derruba o processo inteiro.
pool.on('error', (err) => {
    console.error('[pool] erro em client ocioso:', err.message);
});

export async function withClient(fn) {
    const client = await pool.connect();
    try {
        return await fn(client);
    } finally {
        client.release();
    }
}
