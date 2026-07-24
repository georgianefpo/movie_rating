// Etapa 4 — Encoding. Transforma cada filme e cada usuario num vetor de 22
// numeros e grava na coluna `vector` (pgvector). Espelha encodeProduct/encodeUser
// do exemplo01, com 2 diferencas:
//  - genero e MULTI-hot (um filme tem varios generos) -> normalizado pelo nº de generos;
//  - idade e sexo do usuario entram como dados pessoais DELE (sobrescrevem o herdado).
import { pool } from '../db/pool.js';
import {
    GENRE_INDEX, DIM, WEIGHTS,
    normalize, normAge, normRating, buildContext,
} from './context.js';

// Um filme -> vetor de 22 numeros.
function encodeMovie(movie, ctx) {
    const vec = new Array(DIM).fill(0);
    const stats = ctx.movieStats.get(movie.movie_id);

    // [0..17] generos multi-hot: cada genero presente recebe (1/nGeneros)*peso,
    // pra o bloco somar sempre WEIGHTS.genre independente de quantos generos o filme tem.
    const genres = movie.genres || [];
    if (genres.length) {
        const share = (1 / genres.length) * WEIGHTS.genre;
        for (const g of genres) {
            const idx = GENRE_INDEX[g];
            if (idx !== undefined) vec[idx] = share;
        }
    }

    // [18] ano · [19] nota media · [20] idade media de quem assistiu · [21] fracao de mulheres.
    // Filme sem avaliacao (stats ausente) usa os fatos globais como chute.
    const avgRating = stats ? stats.avg_rating : ctx.global.avgRating;
    const avgAge = stats ? stats.avg_age : ctx.global.avgAge;
    const femaleFrac = stats ? stats.female_frac : ctx.global.femaleFrac;

    vec[18] = normalize(movie.year, ctx.minYear, ctx.maxYear) * WEIGHTS.year;
    vec[19] = normRating(avgRating) * WEIGHTS.rating;
    vec[20] = normAge(avgAge) * WEIGHTS.age;
    vec[21] = femaleFrac * WEIGHTS.gender;
    return vec;
}

// Um usuario -> vetor de 22 numeros. Gosto = media dos filmes que avaliou,
// PONDERADA pela nota (5 puxa mais que 1). Depois sobrescreve idade e sexo com
// os dados pessoais DELE (dimensoes 20 e 21).
function encodeUser(user, ratedList, movieVecs) {
    const acc = new Array(DIM).fill(0);
    let sumW = 0;
    for (const { movie_id, rating } of ratedList) {
        const v = movieVecs.get(movie_id);
        if (!v) continue;
        for (let i = 0; i < DIM; i++) acc[i] += v[i] * rating;
        sumW += rating;
    }
    if (sumW > 0) for (let i = 0; i < DIM; i++) acc[i] /= sumW;

    // Dados pessoais dela sobrescrevem as dimensoes de idade e sexo.
    // (genero/ano/nota continuam vindo do gosto herdado dos filmes avaliados.)
    acc[20] = normAge(user.age) * WEIGHTS.age;
    acc[21] = (user.gender === 'F' ? 1 : 0) * WEIGHTS.gender;
    return acc;
}

// pgvector le/escreve vetor como texto "[v1,v2,...]".
const toVec = (arr) => `[${arr.map((x) => x.toFixed(6)).join(',')}]`;

// UPDATE em lote via unnest (1 ida ao banco por tabela).
async function bulkUpdate(client, table, key, ids, vecs) {
    await client.query(
        `UPDATE ${table} AS t SET vector = v.vec::vector
         FROM (SELECT unnest($1::int[]) AS id, unnest($2::text[]) AS vec) v
         WHERE t.${key} = v.id`,
        [ids, vecs.map(toVec)]
    );
}

async function main() {
    const client = await pool.connect();
    try {
        console.log('Adicionando colunas vector(22)...');
        await client.query(`ALTER TABLE movies ADD COLUMN IF NOT EXISTS vector vector(${DIM})`);
        await client.query(`ALTER TABLE users  ADD COLUMN IF NOT EXISTS vector vector(${DIM})`);

        console.log('Montando o contexto (agregados por filme + globais)...');
        const ctx = await buildContext(client);

        // 1) Codifica todos os filmes e guarda os vetores em memoria (usados pelos usuarios).
        console.log('Codificando filmes...');
        const { rows: movies } = await client.query('SELECT movie_id, year, genres FROM movies');
        const movieVecs = new Map();
        for (const m of movies) movieVecs.set(m.movie_id, encodeMovie(m, ctx));
        await bulkUpdate(client, 'movies', 'movie_id',
            movies.map((m) => m.movie_id), movies.map((m) => movieVecs.get(m.movie_id)));
        console.log(`  ${movies.length} filmes codificados.`);

        // 2) Carrega TODAS as avaliacoes agrupadas por usuario (1M linhas).
        console.log('Carregando avaliacoes por usuario...');
        const { rows: ratings } = await client.query('SELECT user_id, movie_id, rating FROM ratings');
        const byUser = new Map();
        for (const r of ratings) {
            let list = byUser.get(r.user_id);
            if (!list) byUser.set(r.user_id, (list = []));
            list.push(r);
        }

        // 3) Codifica cada usuario (gosto ponderado + dados pessoais).
        console.log('Codificando usuarios...');
        const userIds = [];
        const userVecs = [];
        for (const [userId, user] of ctx.users) {
            userIds.push(userId);
            userVecs.push(encodeUser(user, byUser.get(userId) || [], movieVecs));
        }
        await bulkUpdate(client, 'users', 'user_id', userIds, userVecs);
        console.log(`  ${userIds.length} usuarios codificados.`);

        // 4) Indices HNSW para busca por cosseno (rapido no <=>).
        console.log('Criando indices HNSW (cosseno)...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_movies_vec ON movies USING hnsw (vector vector_cosine_ops)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_vec  ON users  USING hnsw (vector vector_cosine_ops)');

        console.log('Encoding concluido.');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('\nFalha no encoding:', err.message);
    process.exit(1);
});
