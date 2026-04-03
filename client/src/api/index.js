const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur serveur.');
    return data;
}

export function loginUser(email, password) {
    return request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
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
