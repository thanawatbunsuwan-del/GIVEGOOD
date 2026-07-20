// API client for GIVEGOOD Web App

const API_BASE = '/api';

async function handleResponse(response) {
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
    return data;
}

const API = {
    // Auth
    async register(name, email, password) {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        return handleResponse(response);
    },

    async verify(email, code) {
        const response = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        return handleResponse(response);
    },

    async login(email, password) {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return handleResponse(response);
    },

    async logout() {
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return handleResponse(response);
    },

    async getCurrentUser() {
        const response = await fetch(`${API_BASE}/current-user`);
        return handleResponse(response);
    },

    // Items
    async getItems(category = '', search = '') {
        let url = `${API_BASE}/items`;
        const params = [];
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        
        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }
        
        const response = await fetch(url);
        return handleResponse(response);
    },

    async getItem(itemId) {
        const response = await fetch(`${API_BASE}/items/${itemId}`);
        return handleResponse(response);
    },

    async createItem(formData) {
        const response = await fetch(`${API_BASE}/items`, {
            method: 'POST',
            body: formData // Let browser set Content-Type for multipart/form-data
        });
        return handleResponse(response);
    },

    async updateItemStatus(itemId, status) {
        const response = await fetch(`${API_BASE}/items/${itemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        return handleResponse(response);
    },

    async deleteItem(itemId) {
        const response = await fetch(`${API_BASE}/items/${itemId}`, {
            method: 'DELETE'
        });
        return handleResponse(response);
    },

    // Chat
    async getChatContacts() {
        const response = await fetch(`${API_BASE}/chat/contacts`);
        return handleResponse(response);
    },

    async getChatMessages(contactId) {
        const response = await fetch(`${API_BASE}/chat/messages/${contactId}`);
        return handleResponse(response);
    },

    async sendMessage(receiverId, message) {
        const response = await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiver_id: receiverId, message })
        });
        return handleResponse(response);
    },

    async getUser(userId) {
        const response = await fetch(`${API_BASE}/users/${userId}`);
        return handleResponse(response);
    }
};

window.API = API;
