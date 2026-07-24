-- Schema base do movie_rating (MovieLens 1M).
-- As colunas de VETOR (pgvector) sao adicionadas na etapa de encoding (etapa 4),
-- porque a dimensao depende do desenho das features. Aqui ficam so as tabelas cruas.

CREATE EXTENSION IF NOT EXISTS vector;

-- Filmes: MovieID::Titulo (Ano)::Generos(pipe-separated)
CREATE TABLE IF NOT EXISTS movies (
    movie_id   INTEGER PRIMARY KEY,
    title      TEXT    NOT NULL,   -- titulo com ano, ex: "Toy Story (1995)"
    year       INTEGER,            -- ano extraido do titulo (pode ser NULL se nao casar)
    genres     TEXT[]  NOT NULL DEFAULT '{}'  -- ex: {Animation,Children's,Comedy}
);

-- Usuarios: UserID::Sexo::FaixaEtaria::Ocupacao::CEP
-- age e occupation sao CODIGOS do MovieLens (ver mapas em src/encode/context.js).
CREATE TABLE IF NOT EXISTS users (
    user_id    INTEGER PRIMARY KEY,
    gender     CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    age        INTEGER NOT NULL,   -- codigo de faixa etaria (1,18,25,35,45,50,56)
    occupation INTEGER NOT NULL,   -- codigo de ocupacao (0..20)
    zipcode    TEXT
);

-- Avaliacoes: UserID::MovieID::Nota(1-5)::Timestamp(epoch seg)
CREATE TABLE IF NOT EXISTS ratings (
    user_id  INTEGER NOT NULL REFERENCES users(user_id),
    movie_id INTEGER NOT NULL REFERENCES movies(movie_id),
    rating   SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    rated_at TIMESTAMPTZ,          -- convertido do epoch
    PRIMARY KEY (user_id, movie_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings(movie_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user  ON ratings(user_id);
