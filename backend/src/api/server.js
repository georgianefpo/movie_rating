// Etapa 5 — API. Expoe os dados e a recomendacao por similaridade (pgvector).
// O front consome estes endpoints; a rede neural (reordenacao hibrida) roda no
// worker do navegador usando os dados de /train-data e /users/:id/candidates.
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { pool } from '../db/pool.js';
import { ageLabel, occupationLabel } from './labels.js';

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, '../../../frontend');

const app = express();
app.use(cors());
app.use(express.json());
// Serve o front (mesma origem que a API -> sem CORS no browser).
app.use(express.static(FRONTEND_DIR));

// pgvector volta como texto "[1,2,3]" — que ja e JSON valido.
const parseVec = (s) => (s == null ? null : JSON.parse(s));
const asInt = (v, def) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : def;
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Lista (amostra) de usuarios para o seletor do front.
app.get('/api/users', async (req, res, next) => {
    try {
        const limit = Math.min(asInt(req.query.limit, 50), 200);
        const offset = asInt(req.query.offset, 0);
        const { rows } = await pool.query(
            `SELECT u.user_id, u.gender, u.age, u.occupation,
                    count(r.*)::int AS num_ratings
             FROM users u LEFT JOIN ratings r ON r.user_id = u.user_id
             GROUP BY u.user_id
             ORDER BY u.user_id
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        res.json(rows.map((u) => ({
            id: u.user_id,
            gender: u.gender,
            age: u.age,
            ageLabel: ageLabel(u.age),
            occupation: u.occupation,
            occupationLabel: occupationLabel(u.occupation),
            numRatings: u.num_ratings,
        })));
    } catch (e) { next(e); }
});

// Detalhe de um usuario: dados pessoais, vetor e os filmes que ele avaliou.
app.get('/api/users/:id', async (req, res, next) => {
    try {
        const id = asInt(req.params.id);
        const { rows: urows } = await pool.query(
            'SELECT user_id, gender, age, occupation, zipcode, vector FROM users WHERE user_id = $1',
            [id]
        );
        if (!urows.length) return res.status(404).json({ error: 'usuario nao encontrado' });
        const u = urows[0];

        const { rows: rated } = await pool.query(
            `SELECT m.movie_id, m.title, m.genres, r.rating
             FROM ratings r JOIN movies m ON m.movie_id = r.movie_id
             WHERE r.user_id = $1
             ORDER BY r.rating DESC, r.rated_at DESC`,
            [id]
        );

        res.json({
            id: u.user_id,
            gender: u.gender,
            age: u.age,
            ageLabel: ageLabel(u.age),
            occupation: u.occupation,
            occupationLabel: occupationLabel(u.occupation),
            zipcode: u.zipcode,
            vector: parseVec(u.vector),
            ratings: rated.map((m) => ({
                id: m.movie_id, title: m.title, genres: m.genres, rating: m.rating,
            })),
        });
    } catch (e) { next(e); }
});

// Detalhe de um filme.
app.get('/api/movies/:id', async (req, res, next) => {
    try {
        const id = asInt(req.params.id);
        const { rows } = await pool.query(
            'SELECT movie_id, title, year, genres, vector FROM movies WHERE movie_id = $1',
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'filme nao encontrado' });
        const m = rows[0];
        res.json({ id: m.movie_id, title: m.title, year: m.year, genres: m.genres, vector: parseVec(m.vector) });
    } catch (e) { next(e); }
});

// Recomendacao por similaridade (baseline pgvector): filmes mais proximos do
// vetor do usuario, excluindo os que ele ja avaliou. score = 1 - dist_cosseno.
app.get('/api/recommend/:id', async (req, res, next) => {
    try {
        const id = asInt(req.params.id);
        const k = Math.min(asInt(req.query.k, 20), 200);
        const { rows } = await pool.query(
            `SELECT m.movie_id, m.title, m.year, m.genres,
                    1 - (m.vector <=> u.vector) AS score
             FROM movies m
             CROSS JOIN (SELECT vector FROM users WHERE user_id = $1) u
             WHERE m.vector IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.user_id = $1 AND r.movie_id = m.movie_id)
             ORDER BY m.vector <=> u.vector
             LIMIT $2`,
            [id, k]
        );
        if (!rows.length) return res.status(404).json({ error: 'usuario sem vetor ou inexistente' });
        res.json(rows.map((m) => ({
            id: m.movie_id, title: m.title, year: m.year, genres: m.genres, score: Number(m.score),
        })));
    } catch (e) { next(e); }
});

// Candidatos (pgvector) para a rede neural reordenar no worker.
app.get('/api/users/:id/candidates', async (req, res, next) => {
    try {
        const id = asInt(req.params.id);
        const k = Math.min(asInt(req.query.k, 200), 500);
        const { rows } = await pool.query(
            `SELECT m.movie_id, m.title, m.year, m.genres, m.vector,
                    1 - (m.vector <=> u.vector) AS sim
             FROM movies m
             CROSS JOIN (SELECT vector FROM users WHERE user_id = $1) u
             WHERE m.vector IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.user_id = $1 AND r.movie_id = m.movie_id)
             ORDER BY m.vector <=> u.vector
             LIMIT $2`,
            [id, k]
        );
        res.json(rows.map((m) => ({
            id: m.movie_id, title: m.title, year: m.year, genres: m.genres,
            vector: parseVec(m.vector), sim: Number(m.sim),
        })));
    } catch (e) { next(e); }
});

// Conjunto de TREINO para a rede neural (subconjunto, roda no worker):
//  - movies: os N filmes mais avaliados (populares), com vetor;
//  - users: amostra de M usuarios, com vetor + ocupacao + suas notas nesses filmes.
// O worker cruza users x movies e usa a nota (>=4 = gostou) como rotulo.
app.get('/api/train-data', async (req, res, next) => {
    try {
        const nUsers = Math.min(asInt(req.query.users, 300), 1000);
        const nMovies = Math.min(asInt(req.query.movies, 200), 500);

        const { rows: movies } = await pool.query(
            `SELECT m.movie_id, m.title, m.genres, m.vector, count(r.*)::int AS n
             FROM movies m JOIN ratings r ON r.movie_id = m.movie_id
             WHERE m.vector IS NOT NULL
             GROUP BY m.movie_id
             ORDER BY n DESC
             LIMIT $1`,
            [nMovies]
        );
        const { rows: users } = await pool.query(
            'SELECT user_id, gender, age, occupation, vector FROM users ORDER BY user_id LIMIT $1',
            [nUsers]
        );

        const movieIds = movies.map((m) => m.movie_id);
        const userIds = users.map((u) => u.user_id);
        const { rows: ratings } = await pool.query(
            'SELECT user_id, movie_id, rating FROM ratings WHERE user_id = ANY($1) AND movie_id = ANY($2)',
            [userIds, movieIds]
        );

        // Mapa user_id -> { movie_id: rating } apenas dos filmes do conjunto.
        const byUser = new Map(userIds.map((id) => [id, {}]));
        for (const r of ratings) byUser.get(r.user_id)[r.movie_id] = r.rating;

        res.json({
            movies: movies.map((m) => ({
                id: m.movie_id, title: m.title, genres: m.genres, vector: parseVec(m.vector),
            })),
            users: users.map((u) => ({
                id: u.user_id, gender: u.gender, age: u.age, occupation: u.occupation,
                vector: parseVec(u.vector), ratings: byUser.get(u.user_id),
            })),
        });
    } catch (e) { next(e); }
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error('[api] erro:', err.message);
    res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API ouvindo em http://localhost:${PORT}`));
