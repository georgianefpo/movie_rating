// Constantes e "fatos gerais" dos dados (espelha o makeContext do exemplo01).
// Aqui ficam: a ordem fixa dos 18 generos, os pesos das features, os mapas de
// codigo do MovieLens e as funcoes de normalizacao.

// Ordem FIXA dos 18 generos (a mesma do README do MovieLens). A posicao aqui e a
// coluna do bloco multi-hot no vetor — precisa ser estavel entre execucoes.
export const GENRES = [
    'Action', 'Adventure', 'Animation', "Children's", 'Comedy', 'Crime',
    'Documentary', 'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'Musical',
    'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western',
];
export const GENRE_INDEX = Object.fromEntries(GENRES.map((g, i) => [g, i]));

// Layout do vetor de 22 dimensoes:
//   [0..17]  generos (multi-hot normalizado)
//   [18]     ano
//   [19]     nota media
//   [20]     idade
//   [21]     sexo
export const DIM = GENRES.length + 4; // 22

// Peso (importancia) de cada bloco na similaridade. Somam 1.0.
// Genero domina; idade/sexo entram como dados pessoais de verdade.
export const WEIGHTS = {
    genre: 0.40,
    rating: 0.15,
    year: 0.10,
    age: 0.20,
    gender: 0.15,
};

// Codigos de faixa etaria do MovieLens (1=<18 ... 56=56+). Sao ordinais, entao
// da pra normalizar direto pelos extremos.
export const AGE_MIN = 1;
export const AGE_MAX = 56;

// Espreme para 0..1; `|| 1` evita divisao por zero (min===max) -> NaN.
export const normalize = (value, min, max) => (value - min) / ((max - min) || 1);
export const normAge = (ageCode) => normalize(ageCode, AGE_MIN, AGE_MAX);
export const normRating = (rating) => normalize(rating, 1, 5); // notas 1..5

// Busca os agregados por filme (nota media, idade media de quem avaliou, fracao
// de mulheres) e os fatos globais (usados como fallback p/ filmes sem avaliacao).
export async function buildContext(client) {
    // Sequencial de proposito: um client do `pg` NAO roda queries concorrentes
    // (Promise.all no mesmo client dispara DeprecationWarning e serializa mal).
    const { rows: yr } = await client.query('SELECT min(year) AS min, max(year) AS max FROM movies');
    const { rows: gl } = await client.query(
        `SELECT avg(r.rating)::float AS avg_rating,
                avg(u.age)::float    AS avg_age,
                avg((u.gender = 'F')::int)::float AS female_frac
         FROM ratings r JOIN users u ON u.user_id = r.user_id`);
    const { rows: mv } = await client.query(
        `SELECT r.movie_id,
                avg(r.rating)::float AS avg_rating,
                avg(u.age)::float    AS avg_age,
                avg((u.gender = 'F')::int)::float AS female_frac
         FROM ratings r JOIN users u ON u.user_id = r.user_id
         GROUP BY r.movie_id`);
    const { rows: us } = await client.query('SELECT user_id, gender, age FROM users');

    const movieStats = new Map(mv.map((r) => [r.movie_id, r]));
    const users = new Map(us.map((r) => [r.user_id, r]));

    return {
        minYear: yr[0].min,
        maxYear: yr[0].max,
        global: {
            avgRating: gl[0].avg_rating,
            avgAge: gl[0].avg_age,
            femaleFrac: gl[0].female_frac,
        },
        movieStats, // movie_id -> { avg_rating, avg_age, female_frac }
        users,      // user_id  -> { gender, age }
    };
}
