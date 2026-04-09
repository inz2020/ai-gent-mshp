const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user_nom');
        localStorage.removeItem('user_role');
        window.location.replace('/session-expiree');
        return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur serveur.');
    return data;
}

export function loginUser(login, password) {
    return request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ login, password })
    });
}

export function getMe() {
    const token = localStorage.getItem('token');
    return request('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
    });
}

function authHeaders() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export function getUsers() {
    return request('/api/users', { headers: authHeaders() });
}

export function createUser(data) {
    return request('/api/users', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
}

export function updateUser(id, data) {
    return request(`/api/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
}

export function deleteUser(id) {
    return request(`/api/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
}

// ── Contacts ──────────────────────────────────────────────────
export function getContacts() {
    return request('/api/contacts', { headers: authHeaders() });
}

export function createContact(data) {
    return request('/api/contacts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
}

export function importContacts(rows) {
    return request('/api/contacts/import', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(rows),
    });
}

export function getContactConversations(id) {
    return request(`/api/contacts/${id}/conversations`, { headers: authHeaders() });
}

export function toggleContactBlock(id) {
    return request(`/api/contacts/${id}/bloquer`, {
        method: 'PATCH',
        headers: authHeaders(),
    });
}

export function enregistrerContact(id, nom) {
    return request(`/api/contacts/${id}/enregistrer`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ nom }),
    });
}

export function inviterContact(id) {
    return request(`/api/contacts/${id}/inviter`, {
        method: 'POST',
        headers: authHeaders(),
    });
}

// ── Conversations ─────────────────────────────────────────────
export function getConversationStats() {
    return request('/api/conversations/stats', { headers: authHeaders() });
}

export function getConversations() {
    return request('/api/conversations', { headers: authHeaders() });
}

export function getConversationMessages(id) {
    return request(`/api/conversations/${id}/messages`, { headers: authHeaders() });
}

export function toggleConversationMode(id) {
    return request(`/api/conversations/${id}/mode`, {
        method: 'PATCH',
        headers: authHeaders(),
    });
}

export function sendOperatorMessage(id, texte) {
    return request(`/api/conversations/${id}/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ texte }),
    });
}

// ── Métadonnées ───────────────────────────────────────────────
const META = '/api/metadata';

export const getRegions    = ()       => request(`${META}/regions`,    { headers: authHeaders() });
export const createRegion  = (data)   => request(`${META}/regions`,    { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
export const updateRegion  = (id, d)  => request(`${META}/regions/${id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(d) });
export const deleteRegion  = (id)     => request(`${META}/regions/${id}`, { method: 'DELETE', headers: authHeaders() });
export const importRegions = (rows)   => request(`${META}/regions/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rows) });

export const getDistricts    = ()       => request(`${META}/districts`,    { headers: authHeaders() });
export const createDistrict  = (data)   => request(`${META}/districts`,    { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
export const updateDistrict  = (id, d)  => request(`${META}/districts/${id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(d) });
export const deleteDistrict  = (id)     => request(`${META}/districts/${id}`, { method: 'DELETE', headers: authHeaders() });
export const importDistricts = (rows)   => request(`${META}/districts/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rows) });

export const getStructures    = ()       => request(`${META}/structures`,    { headers: authHeaders() });
export const createStructure  = (data)   => request(`${META}/structures`,    { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
export const updateStructure  = (id, d)  => request(`${META}/structures/${id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(d) });
export const deleteStructure  = (id)     => request(`${META}/structures/${id}`, { method: 'DELETE', headers: authHeaders() });
export const importStructures = (rows)   => request(`${META}/structures/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rows) });

export const getVaccins    = ()       => request(`${META}/vaccins`,    { headers: authHeaders() });
export const createVaccin  = (data)   => request(`${META}/vaccins`,    { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
export const updateVaccin  = (id, d)  => request(`${META}/vaccins/${id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(d) });
export const deleteVaccin  = (id)     => request(`${META}/vaccins/${id}`, { method: 'DELETE', headers: authHeaders() });
export const importVaccins = (rows)   => request(`${META}/vaccins/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rows) });

export const getCalendrier    = ()       => request(`${META}/calendrier`,    { headers: authHeaders() });
export const createCalendrier = (data)   => request(`${META}/calendrier`,    { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) });
export const updateCalendrier = (id, d)  => request(`${META}/calendrier/${id}`, { method: 'PUT',  headers: authHeaders(), body: JSON.stringify(d) });
export const deleteCalendrier = (id)     => request(`${META}/calendrier/${id}`, { method: 'DELETE', headers: authHeaders() });
export const importCalendrier = (rows)   => request(`${META}/calendrier/import`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(rows) });

export const getHausaVocab    = ()       => request(`${META}/hausa-prompt`,        { headers: authHeaders() });
export const createHausaEntry = (data)   => request(`${META}/hausa-prompt`,        { method: 'POST',   headers: authHeaders(), body: JSON.stringify(data) });
export const updateHausaEntry = (id, data) => request(`${META}/hausa-prompt/${id}`, { method: 'PUT',    headers: authHeaders(), body: JSON.stringify(data) });
export const deleteHausaEntry = (id)     => request(`${META}/hausa-prompt/${id}`,  { method: 'DELETE', headers: authHeaders() });
export const importHausaVocab = (rows)   => request(`${META}/hausa-prompt/import`, { method: 'POST',   headers: authHeaders(), body: JSON.stringify(rows) });

// ── Broadcasts ────────────────────────────────────────────────
export function getBroadcasts() {
    return request('/api/broadcasts', { headers: authHeaders() });
}

export function getBroadcastById(id) {
    return request(`/api/broadcasts/${id}`, { headers: authHeaders() });
}

export async function uploadBroadcastMedia(file, mediaType) {
    const form = new FormData();
    form.append('file', file);
    form.append('mediaType', mediaType);
    const res = await fetch(`${BASE_URL}/api/broadcasts/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur upload.');
    return data; // { url, publicId, mediaType }
}

export function sendBroadcast(data) {
    return request('/api/broadcasts', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data)
    });
}
