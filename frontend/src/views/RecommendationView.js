import { $, genreChips, escapeHtml, scoreBar } from './dom.js';

// View das recomendacoes: botao e grade de cards (score da rede + similaridade pgvector).
export class RecommendationView {
    #onRecommend = () => {};

    onRecommend(cb) {
        this.#onRecommend = cb;
        $('#recommendBtn').onclick = () => this.#onRecommend();
    }

    setEnabled(enabled) {
        $('#recommendBtn').disabled = !enabled;
    }

    setLoading() {
        $('#recommendBtn').disabled = true;
        $('#recommendations').innerHTML =
            '<div class="empty"><span class="spinner big"></span> A rede neural está reordenando os candidatos…</div>';
    }

    render(recommendations) {
        $('#recommendBtn').disabled = false;
        const top = recommendations.slice(0, 12);
        $('#recTitle').classList.remove('hidden');

        $('#recommendations').innerHTML = top.map((m, i) => `
            <article class="rec-card">
                <div class="rec-rank">${i + 1}</div>
                <div class="rec-body">
                    <h4 class="rec-title">${escapeHtml(m.title)}</h4>
                    <div class="chips">${genreChips(m.genres)}</div>
                    <div class="rec-scores">
                        ${scoreBar(m.neuralScore, 'rede neural', 'neural')}
                        ${scoreBar(m.pgvectorSim, 'pgvector', 'pgvector')}
                    </div>
                </div>
            </article>`).join('');
    }

    setEmpty(msg) {
        $('#recommendations').innerHTML = `<div class="empty">${escapeHtml(msg)}</div>`;
    }
}
