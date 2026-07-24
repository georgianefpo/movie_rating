import { $, genreChips, stars, escapeHtml } from './dom.js';

// View do perfil do usuario: seletor, dados pessoais e filmes avaliados.
export class UserView {
    #onSelect = () => {};

    onUserSelected(cb) { this.#onSelect = cb; }

    renderUserOptions(users) {
        const select = $('#userSelect');
        select.innerHTML =
            '<option value="">— escolha um usuário —</option>' +
            users.map((u) =>
                `<option value="${u.id}">#${u.id} · ${u.gender === 'F' ? '♀' : '♂'} ${escapeHtml(u.ageLabel)} · ${escapeHtml(u.occupationLabel)} · ${u.numRatings} notas</option>`
            ).join('');

        select.onchange = () => {
            const id = Number(select.value);
            if (id) this.#onSelect(id);
        };
    }

    renderProfile(user) {
        $('#userProfile').classList.remove('hidden');
        $('#profileMeta').innerHTML = `
            <div class="meta-grid">
                <div><span class="meta-k">Usuário</span><span class="meta-v">#${user.id}</span></div>
                <div><span class="meta-k">Sexo</span><span class="meta-v">${user.gender === 'F' ? 'Feminino' : 'Masculino'}</span></div>
                <div><span class="meta-k">Faixa etária</span><span class="meta-v">${escapeHtml(user.ageLabel)}</span></div>
                <div><span class="meta-k">Ocupação</span><span class="meta-v">${escapeHtml(user.occupationLabel)}</span></div>
                <div><span class="meta-k">Avaliações</span><span class="meta-v">${user.ratings.length}</span></div>
            </div>`;

        const top = user.ratings.slice(0, 8);
        $('#ratedList').innerHTML = top.map((m) => `
            <li class="rated-item">
                <div class="rated-main">
                    <span class="rated-title">${escapeHtml(m.title)}</span>
                    <div class="chips">${genreChips(m.genres)}</div>
                </div>
                ${stars(m.rating)}
            </li>`).join('');
    }

    setSelected(id) {
        const select = $('#userSelect');
        if (select) select.value = String(id);
    }
}
