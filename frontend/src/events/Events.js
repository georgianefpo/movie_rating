import { events } from './constants.js';

// Barramento de eventos simples sobre CustomEvent (mesmo padrao do exemplo01):
// cada evento tem um dispatch* (dispara) e um on* (escuta).
export default class Events {
    static #on(name, cb) {
        document.addEventListener(name, (e) => cb(e.detail));
    }
    static #emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail }));
    }

    static onUserSelected(cb) { Events.#on(events.userSelected, cb); }
    static dispatchUserSelected(d) { Events.#emit(events.userSelected, d); }

    static onTrainRequested(cb) { Events.#on(events.trainRequested, cb); }
    static dispatchTrainRequested(d) { Events.#emit(events.trainRequested, d); }

    static onTrainingProgress(cb) { Events.#on(events.trainingProgress, cb); }
    static dispatchTrainingProgress(d) { Events.#emit(events.trainingProgress, d); }

    static onTrainingLog(cb) { Events.#on(events.trainingLog, cb); }
    static dispatchTrainingLog(d) { Events.#emit(events.trainingLog, d); }

    static onTrainingComplete(cb) { Events.#on(events.trainingComplete, cb); }
    static dispatchTrainingComplete(d) { Events.#emit(events.trainingComplete, d); }

    static onRecommendRequested(cb) { Events.#on(events.recommendRequested, cb); }
    static dispatchRecommendRequested(d) { Events.#emit(events.recommendRequested, d); }

    static onRecommendationsReady(cb) { Events.#on(events.recommendationsReady, cb); }
    static dispatchRecommendationsReady(d) { Events.#emit(events.recommendationsReady, d); }
}
