const RESTAURANT_API = 'https://media2.edu.metropolia.fi/restaurant/api/v1';
const AUTH_API = 'https://media2.edu.metropolia.fi/auth-api/api/v1';
const UPLOAD_API = 'https://media2.edu.metropolia.fi/upload-api/api/v1';

const request = async (url, options = {}) => {
    const response = await fetch(url, options);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
        throw new Error(data?.message || `Request failed (${response.status})`);
    }

    return data;
};

const jsonRequest = (url, method, data, token) => request(url, {
    method,
    headers: {
        'Content-Type': 'application/json',
        ...(token && {Authorization: `Bearer ${token}`}),
    },
    body: JSON.stringify(data),
});

export const auth = {
    getToken: () => localStorage.getItem('token'),
    setToken: (token) => localStorage.setItem('token', token),
    clearToken: () => localStorage.removeItem('token'),
};

export const api = {
    getRestaurants: () => request(`${RESTAURANT_API}/restaurants`),

    getMenu: (restaurantId, type) =>
        request(`${RESTAURANT_API}/restaurants/${type}/${restaurantId}/en`),

    register: (user) => jsonRequest(`${AUTH_API}/users`, 'POST', user),

    login: (credentials) => jsonRequest(`${AUTH_API}/auth/login`, 'POST', credentials),

    getCurrentUser: () => request(`${AUTH_API}/users/token`, {
        headers: {Authorization: `Bearer ${auth.getToken()}`},
    }),

    updateUser: (user) =>
        jsonRequest(`${AUTH_API}/users`, 'PUT', user, auth.getToken()),

    uploadFile: (file) => {
        const formData = new FormData();
        formData.append('file', file);

        return request(`${UPLOAD_API}/upload`, {
            method: 'POST',
            headers: {Authorization: `Bearer ${auth.getToken()}`},
            body: formData,
        });
    },
};
