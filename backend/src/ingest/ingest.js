// Ingestao dos arquivos do MovieLens 1M (movies.dat, users.dat, ratings.dat)
// para o Postgres. Resumivel (ON CONFLICT DO NOTHING) e tolerante a reexecucao.
//
// IMPORTANTE: os .dat do MovieLens 1M sao ISO-8859-1 (Latin-1), nao UTF-8.
// Ler como utf8 corrompe acentos de titulos (ex: "Les Misérables"). Por isso latin1.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { pool } from '../db/pool.js';

loadEnv();

const DATA_DIR = process.env.DATA_DIR;
if (!DATA_DIR) {
    console.error('Defina DATA_DIR no .env apontando para a pasta dos .dat.');
    process.exit(1);
}

const BATCH = 1000; // linhas por INSERT (mantem os params bem abaixo do limite do pg)

function readDat(name) {
    // split por "::" e por linha; latin1 preserva os acentos dos titulos.
    const raw = readFileSync(join(DATA_DIR, name), 'latin1');
    return raw
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => line.split('::'));
}

// Extrai o ano do titulo "Nome do Filme (1995)" -> 1995 (ou null se nao casar).
function extractYear(title) {
    const m = title.match(/\((\d{4})\)\s*$/);
    return m ? Number(m[1]) : null;
}

// INSERT multi-linha parametrizado + ON CONFLICT DO NOTHING (idempotente/resumivel).
async function batchInsert(client, table, columns, rows, onConflict) {
    const colCount = columns.length;
    for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const values = [];
        const params = [];
        slice.forEach((row, r) => {
            const placeholders = row.map((_, c) => `$${r * colCount + c + 1}`);
            values.push(`(${placeholders.join(',')})`);
            params.push(...row);
        });
        const sql =
            `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values.join(',')} ` +
            `ON CONFLICT ${onConflict} DO NOTHING`;
        await client.query(sql, params);
        process.stdout.write(`\r  ${table}: ${Math.min(i + BATCH, rows.length)}/${rows.length}   `);
    }
    process.stdout.write('\n');
}

async function ingestMovies(client) {
    const rows = readDat('movies.dat').map(([id, title, genres]) => [
        Number(id),
        title,
        extractYear(title),
        // TEXT[] literal do Postgres: {A,"B C",...}. Aspas duplas escapam virgula/aspas.
        `{${(genres || '')
            .split('|')
            .filter(Boolean)
            .map((g) => `"${g.replace(/"/g, '\\"')}"`)
            .join(',')}}`,
    ]);
    console.log(`Filmes: ${rows.length} linhas`);
    await batchInsert(client, 'movies', ['movie_id', 'title', 'year', 'genres'], rows, '(movie_id)');
}

async function ingestUsers(client) {
    const rows = readDat('users.dat').map(([id, gender, age, occ, zip]) => [
        Number(id),
        gender,
        Number(age),
        Number(occ),
        zip || null,
    ]);
    console.log(`Usuarios: ${rows.length} linhas`);
    await batchInsert(client, 'users', ['user_id', 'gender', 'age', 'occupation', 'zipcode'], rows, '(user_id)');
}

async function ingestRatings(client) {
    const rows = readDat('ratings.dat').map(([uid, mid, rating, ts]) => [
        Number(uid),
        Number(mid),
        Number(rating),
        new Date(Number(ts) * 1000), // epoch segundos -> Date
    ]);
    console.log(`Avaliacoes: ${rows.length} linhas (isso leva um tempinho)`);
    await batchInsert(client, 'ratings', ['user_id', 'movie_id', 'rating', 'rated_at'], rows, '(user_id, movie_id)');
}

async function main() {
    const client = await pool.connect();
    try {
        await ingestMovies(client); // primeiro movies e users (ratings tem FK para eles)
        await ingestUsers(client);
        await ingestRatings(client);

        const { rows } = await client.query(
            `SELECT (SELECT count(*) FROM movies)  AS movies,
                    (SELECT count(*) FROM users)   AS users,
                    (SELECT count(*) FROM ratings) AS ratings`
        );
        console.log('Totais no banco:', rows[0]);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('\nFalha na ingestao:', err.message);
    process.exit(1);
});
