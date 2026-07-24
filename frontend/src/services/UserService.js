import { api } from './api.js';

// Fina camada de dados: cache do usuario atual e do conjunto de treino.
export class UserService {
    #trainData = null;

    listUsers(limit) { return api.listUsers(limit); }
    getUser(id) { return api.getUser(id); }
    getCandidates(id, k) { return api.getCandidates(id, k); }

    // Busca (e memoiza) o conjunto de treino — reusado entre re-treinos.
    async getTrainData() {
        if (!this.#trainData) this.#trainData = await api.trainData();
        return this.#trainData;
    }
}
