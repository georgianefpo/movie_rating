import { workerEvents } from '../events/constants.js';

// Ponte entre o worker (postMessage) e o barramento de eventos da pagina.
export class WorkerController {
    #worker;
    #events;
    #trained = false;

    constructor({ worker, events }) {
        this.#worker = worker;
        this.#events = events;
        this.#wire();
    }

    static init(deps) { return new WorkerController(deps); }

    #wire() {
        // Pedidos vindos da UI -> mensagens para o worker.
        this.#events.onTrainRequested((trainData) => {
            this.#trained = false;
            this.#worker.postMessage({ action: workerEvents.trainModel, ...trainData });
        });

        this.#events.onRecommendRequested(({ user, candidates }) => {
            if (!this.#trained) return;
            this.#worker.postMessage({ action: workerEvents.recommend, user, candidates });
        });

        // Mensagens do worker -> eventos da pagina.
        this.#worker.onmessage = ({ data }) => {
            switch (data.type) {
                case workerEvents.progressUpdate:
                    this.#events.dispatchTrainingProgress(data.progress);
                    break;
                case workerEvents.trainingLog:
                    this.#events.dispatchTrainingLog(data);
                    break;
                case workerEvents.trainingComplete:
                    this.#trained = true;
                    this.#events.dispatchTrainingComplete(data);
                    break;
                case workerEvents.recommendations:
                    this.#events.dispatchRecommendationsReady(data);
                    break;
            }
        };
    }
}
