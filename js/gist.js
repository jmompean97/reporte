/* =============================================
   js/gist.js — GitHub Gist Sync
   Guarda y recupera las entradas personalizadas
   de horas en un Gist privado de GitHub.
   ============================================= */
'use strict';

// TODO(security): El token PAT se guarda en localStorage (app personal).
// En producción pública usar BFF server-side.

const Gist = (() => {
    const API = 'https://api.github.com';
    const HORAS_FILE = 'reporte-horas-custom.json';
    const DESCRIPTION = 'Reporte de Horas — entradas personalizadas';

    let _token = null;
    let _gistId = null;

    function setToken(t) { _token = t; }
    function setGistId(id) { _gistId = id; }
    function getToken() { return _token; }
    function getGistId() { return _gistId; }
    function isConfigured() { return !!_token; }

    async function _request(method, path, body) {
        const res = await fetch(`${API}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${_token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `GitHub API error ${res.status}`);
        }
        return res.status === 204 ? null : res.json();
    }

    async function validateToken(token) {
        const res = await fetch(`${API}/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!res.ok) throw new Error('Token inválido o sin permisos de Gist');
        const user = await res.json();
        return user.login;
    }

    async function read() {
        if (!_gistId) return null;
        const res = await _request('GET', `/gists/${_gistId}`);
        const content = res.files?.[HORAS_FILE]?.content;
        if (!content) return null;
        return JSON.parse(content);
    }

    async function write(data) {
        const payload = { [HORAS_FILE]: { content: JSON.stringify(data, null, 2) } };
        if (!_gistId) {
            const res = await _request('POST', '/gists', {
                description: DESCRIPTION,
                public: false,
                files: payload,
            });
            _gistId = res.id;
            // Persist new gist id
            localStorage.setItem('horas-gist-id', _gistId);
            return;
        }
        await _request('PATCH', `/gists/${_gistId}`, { files: payload });
    }

    return { setToken, setGistId, getToken, getGistId, isConfigured, validateToken, read, write };
})();
