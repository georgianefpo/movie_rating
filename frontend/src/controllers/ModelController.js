// Orquestra treino e recomendacao (a metade "cerebro" da app).
export class ModelController {
    #trainingView;
    #recommendationView;
    #userService;
    #events;
    #currentUser = null;
    #trained = false;

    constructor({ trainingView, recommendationView, userService, events }) {
        this.#trainingView = trainingView;
        this.#recommendationView = recommendationView;
        this.#userService = userService;
        this.#events = events;
    }

    static init(deps) {
        const c = new ModelController(deps);
        c.#wire();
        return c;
    }

    #wire() {
        // Treino: busca o subconjunto e pede ao worker para treinar.
        this.#trainingView.onTrain(async () => {
            this.#trainingView.setTraining(true);
            const trainData = await this.#userService.getTrainData();
            this.#events.dispatchTrainRequested(trainData);
        });

        this.#events.onTrainingProgress((p) => this.#trainingView.updateProgress(p));
        this.#events.onTrainingLog((log) => this.#trainingView.pushLog(log));
        this.#events.onTrainingComplete((data) => {
            this.#trained = true;
            this.#trainingView.setTraining(false);
            this.#trainingView.setComplete(data);
            this.#refreshRecommendAvailability();
        });

        // Selecao de usuario.
        this.#events.onUserSelected((user) => {
            this.#currentUser = user;
            this.#recommendationView.setEmpty('Treine o modelo e clique em "Recomendar".');
            this.#refreshRecommendAvailability();
        });

        // Recomendacao: candidatos do pgvector -> worker reordena.
        this.#recommendationView.onRecommend(async () => {
            if (!this.#currentUser) return;
            this.#recommendationView.setLoading();
            const candidates = await this.#userService.getCandidates(this.#currentUser.id, 200);
            this.#events.dispatchRecommendRequested({ user: this.#currentUser, candidates });
        });

        this.#events.onRecommendationsReady(({ recommendations }) => {
            this.#recommendationView.render(recommendations);
        });
    }

    #refreshRecommendAvailability() {
        this.#recommendationView.setEnabled(this.#trained && !!this.#currentUser);
    }
}
