// Cliente HTTP fininho para a API (mesma origem: o Express serve o front e a API).
const BASE = '/api';

async function get(path) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `${res.status} ${res.statusText}`);
    }
    return res.json();
}

export const api = {
    listUsers: (limit = 60) => get(`/users?limit=${limit}`),
    getUser: (id) => get(`/users/${id}`),
    getCandidates: (id, k = 200) => get(`/users/${id}/candidates?k=${k}`),
    recommendBaseline: (id, k = 12) => get(`/recommend/${id}?k=${k}`),
    trainData: (users = 300, movies = 200) => get(`/train-data?users=${users}&movies=${movies}`),
};
