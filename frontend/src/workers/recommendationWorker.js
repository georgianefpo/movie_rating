// Worker de recomendacao (roda em thread separada, nao trava a UI).
// Espelha as etapas do exemplo01, mas os VETORES ja vem prontos do pgvector (API):
//  - treino: cruza usuarios x filmes populares; rotulo = nota >= 4 (gostou);
//    entrada = [vetor_user(22) + ocupacao one-hot(21) + vetor_filme(22)] = 65 numeros;
//  - recomendar: pega os candidatos do pgvector e a rede REORDENA (hibrido).
import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

const OCCUPATIONS = 21; // codigos 0..20
const MOVIE_DIM = 22;   // tamanho do vetor de filme/usuario (pgvector)
const INPUT_DIM = MOVIE_DIM + OCCUPATIONS + MOVIE_DIM; // 65

let _model = null;

// One-hot da ocupacao (0..20) -> 21 numeros.
function occupationOneHot(code) {
    const v = new Array(OCCUPATIONS).fill(0);
    if (code >= 0 && code < OCCUPATIONS) v[code] = 1;
    return v;
}

// Entrada da rede para um par (usuario, filme).
function buildInput(user, movieVector) {
    return [...user.vector, ...occupationOneHot(user.occupation), ...movieVector];
}

// Monta os exemplos de treino: para cada usuario, cada filme que ele avaliou
// (no conjunto) vira um exemplo. Rotulo = 1 se deu nota >= 4, senao 0.
function createTrainingData({ users, movies }) {
    const movieById = new Map(movies.map((m) => [m.id, m]));
    const inputs = [];
    const labels = [];

    for (const user of users) {
        for (const [movieIdStr, rating] of Object.entries(user.ratings)) {
            const movie = movieById.get(Number(movieIdStr));
            if (!movie) continue;
            inputs.push(buildInput(user, movie.vector));
            labels.push(rating >= 4 ? 1 : 0);
        }
    }

    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        count: labels.length,
        positives: labels.reduce((a, b) => a + b, 0),
    };
}

// Rede em funil 65 -> 128 -> 64 -> 32 -> 1 (sigmoid), igual em espirito ao exemplo01.
async function trainModel(trainData) {
    postMessage({ type: workerEvents.progressUpdate, progress: { stage: 'montando', value: 20 } });

    const data = createTrainingData(trainData);
    console.log(`Treino: ${data.count} exemplos (${data.positives} positivos)`);

    postMessage({ type: workerEvents.progressUpdate, progress: { stage: 'treinando', value: 40 } });

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [INPUT_DIM], units: 128, activation: 'relu' }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
        optimizer: tf.train.adam(0.005),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
    });

    const EPOCHS = 30;
    await model.fit(data.xs, data.ys, {
        epochs: EPOCHS,
        batchSize: 128,
        shuffle: true,
        validationSplit: 0.15,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch,
                    loss: logs.loss,
                    acc: logs.acc,
                    valLoss: logs.val_loss,
                    valAcc: logs.val_acc,
                });
                postMessage({
                    type: workerEvents.progressUpdate,
                    progress: { stage: 'treinando', value: 40 + Math.round((60 * (epoch + 1)) / EPOCHS) },
                });
            },
        },
    });

    data.xs.dispose();
    data.ys.dispose();
    _model = model;

    postMessage({ type: workerEvents.progressUpdate, progress: { stage: 'pronto', value: 100 } });
    postMessage({ type: workerEvents.trainingComplete, examples: data.count });
}

// Reordena os candidatos do pgvector usando a rede. Cada card leva o score da
// rede (primario) e a similaridade do pgvector (secundario) — para ver o efeito.
function recommend({ user, candidates }) {
    if (!_model) return;

    const inputs = candidates.map((m) => buildInput(user, m.vector));
    const scores = tf.tidy(() => _model.predict(tf.tensor2d(inputs)).dataSync());

    const ranked = candidates
        .map((m, i) => ({
            id: m.id,
            title: m.title,
            year: m.year,
            genres: m.genres,
            neuralScore: scores[i],
            pgvectorSim: m.sim,
        }))
        .sort((a, b) => b.neuralScore - a.neuralScore);

    postMessage({ type: workerEvents.recommendations, userId: user.id, recommendations: ranked });
}

const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: recommend,
};

self.onmessage = (e) => {
    const { action, ...data } = e.data;
    const handler = handlers[action];
    if (handler) handler(data);
};
