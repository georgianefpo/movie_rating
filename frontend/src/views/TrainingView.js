import { $ } from './dom.js';

// View do treino: botao, barra de progresso, status e grafico de perda/acuracia
// (via tfjs-vis, carregado como global `tfvis` no index.html).
export class TrainingView {
    #onTrain = () => {};
    #history = { loss: [], acc: [], valAcc: [] };

    onTrain(cb) {
        this.#onTrain = cb;
        $('#trainBtn').onclick = () => this.#onTrain();
    }

    setTraining(isTraining) {
        const btn = $('#trainBtn');
        btn.disabled = isTraining;
        btn.innerHTML = isTraining
            ? '<span class="spinner"></span> Treinando…'
            : '⚙️ Treinar modelo';
        if (isTraining) {
            this.#history = { loss: [], acc: [], valAcc: [] };
            $('#trainStatus').textContent = 'Preparando dados de treino…';
        }
    }

    updateProgress({ stage, value }) {
        $('#trainProgressFill').style.width = `${value}%`;
        $('#trainStatus').textContent = `${stage}… ${value}%`;
    }

    pushLog({ epoch, loss, acc, valAcc }) {
        this.#history.loss.push({ x: epoch + 1, y: loss });
        this.#history.acc.push({ x: epoch + 1, y: acc });
        if (valAcc != null) this.#history.valAcc.push({ x: epoch + 1, y: valAcc });

        if (typeof tfvis !== 'undefined') {
            tfvis.render.linechart(
                $('#trainChart'),
                {
                    values: [this.#history.loss, this.#history.acc, this.#history.valAcc],
                    series: ['perda (loss)', 'acurácia', 'acurácia (val)'],
                },
                { xLabel: 'época', yLabel: 'valor', width: 460, height: 240, zoomToFit: true }
            );
        }
    }

    setComplete({ examples }) {
        $('#trainStatus').innerHTML =
            `✅ Modelo treinado com <strong>${examples.toLocaleString('pt-BR')}</strong> exemplos.`;
    }
}
