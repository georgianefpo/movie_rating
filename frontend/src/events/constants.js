// Nomes dos eventos do barramento interno (entre views e controllers) e das
// mensagens trocadas com o worker de recomendacao.
export const events = {
    userSelected: 'user:selected',
    trainRequested: 'train:requested',
    trainingProgress: 'training:progress',
    trainingLog: 'training:log',        // por epoca: { epoch, loss, acc }
    trainingComplete: 'training:complete',
    recommendRequested: 'recommend:requested',
    recommendationsReady: 'recommendations:ready',
};

// Protocolo com o worker (campo `action` / `type`).
export const workerEvents = {
    trainModel: 'train:model',
    recommend: 'recommend',
    progressUpdate: 'progress:update',
    trainingLog: 'training:log',
    trainingComplete: 'training:complete',
    recommendations: 'recommendations',
};
