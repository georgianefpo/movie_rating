# movie_rating

Sistema de recomendação de filmes baseado no dataset **MovieLens 1M**, usando
**PostgreSQL + pgvector** para os vetores e uma **rede neural (TensorFlow.js)** para
reordenar as recomendações — reaproveitando o pipeline didático do `exemplo01`
(e-commerce), mas com banco de dados no lugar de JSON.

## Como funciona (visão geral)

1. **Ingestão** — os `.dat` do MovieLens viram tabelas no Postgres (`movies`, `users`, `ratings`).
2. **Encoding** — cada filme e cada usuário viram um **vetor** (gêneros + ano + nota média…),
   gravado como coluna `vector` (pgvector). O usuário é a média (ponderada pela nota) dos
   filmes que avaliou, considerando também seus **dados pessoais** (sexo, faixa etária, ocupação).
3. **Recomendação (híbrida)** — o **pgvector** recupera os filmes mais parecidos por
   similaridade de cosseno (`<=>`) e a **rede neural** reordena os candidatos.

## Pré-requisitos

- Node.js 18+
- PostgreSQL 18 + extensão `pgvector` (no Windows sem Docker, rodando dentro do **WSL2**).
- Os arquivos do **MovieLens 1M** (`movies.dat`, `users.dat`, `ratings.dat`).

> ⚠️ **Os dados NÃO estão neste repositório.** A licença do GroupLens/MovieLens proíbe
> redistribuição. Baixe em <https://grouplens.org/datasets/movielens/1m/> (ou use sua cópia
> local) e aponte o `.env` (`DATA_DIR`) para a pasta deles.

## Setup

```bash
cd backend
cp .env.example .env      # ajuste DATABASE_URL e DATA_DIR
npm install
npm run db:setup          # cria o banco movie_rating + extension vector + tabelas
npm run ingest            # carrega os .dat no Postgres (resumível)
npm run encode            # gera os vetores (22 dims) no pgvector + índices HNSW
npm start                 # sobe a API + serve o front em http://localhost:3001
```

Abra <http://localhost:3001>, escolha um usuário, clique em **Treinar modelo** (o
gráfico de perda/acurácia aparece ao vivo) e depois em **Recomendar**. Cada card
mostra o score da **rede neural** (ordena) e a similaridade do **pgvector**.

> Dica: o treino usa WebGL quando disponível (rápido); sem WebGL o TensorFlow.js
> cai para CPU e demora mais — normal em navegadores sem aceleração gráfica.

### Postgres no WSL2 (Windows)

O Node roda no Windows e conecta em `localhost:5432`, mas o Postgres está no WSL2.
Dois comportamentos do WSL a lembrar:

- A **VM do WSL desliga sozinha** logo após o último processo WSL terminar. Mantenha uma
  sessão viva enquanto trabalha (ex.: `wsl -d Ubuntu -u root sleep 7200` em background).
- O **relay `localhost` derruba conexões TCP ociosas** — por isso o pool usa `keepAlive`.

## Estrutura

```
backend/
  src/db/       pool (keepAlive), schema.sql, setup.js
  src/ingest/   ingest.js (parseia os .dat, latin1, ON CONFLICT DO NOTHING)
  src/encode/   context.js + encode.js (makeContext + encodeMovie/encodeUser -> vetores)
  src/api/      server.js (Express: /users, /movies, /recommend, /candidates, /train-data)
frontend/       MVC (events + services + views + controllers) e worker TF.js
  src/workers/  recommendationWorker.js (treino 65 features + reordenação híbrida)
```

## Créditos dos dados

F. Maxwell Harper and Joseph A. Konstan. 2015. *The MovieLens Datasets: History and
Context.* ACM TiiS 5, 4, Article 19. GroupLens Research, University of Minnesota.
