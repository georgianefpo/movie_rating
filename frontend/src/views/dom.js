// Helpers minimos de DOM/HTML compartilhados pelas views.
export const $ = (sel, root = document) => root.querySelector(sel);

export const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Chips de genero.
export const genreChips = (genres = []) =>
    genres.map((g) => `<span class="chip">${escapeHtml(g)}</span>`).join('');

// Estrelas (nota 1..5).
export const stars = (rating) =>
    `<span class="stars" title="${rating}/5">${'★'.repeat(rating)}<span class="star-off">${'★'.repeat(5 - rating)}</span></span>`;

// Barra de score 0..1 com rotulo.
export const scoreBar = (value, label, kind = 'neural') =>
    `<div class="scorebar ${kind}">
        <div class="scorebar-fill" style="width:${(value * 100).toFixed(0)}%"></div>
        <span class="scorebar-label">${label} ${(value * 100).toFixed(0)}%</span>
     </div>`;
