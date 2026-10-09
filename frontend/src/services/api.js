const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include' // Send session cookie across requests
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getCurrentUser: () => request('/auth/me'),

  // Products
  getProducts: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, v);
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request(`/products${qs}`);
  },
  getProductById: (id) => request(`/products/${id}`),
  getCategories: () => request('/products/categories'),

  // Cart
  getCart: () => request('/cart'),
  addToCart: (productId, quantity = 1) =>
    request('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  updateCartItem: (itemId, quantity) =>
    request(`/cart/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
  removeCartItem: (itemId) =>
    request(`/cart/items/${itemId}`, { method: 'DELETE' }),
  clearCart: () =>
    request('/cart', { method: 'DELETE' }),

  // Orders & Checkout
  checkout: (payload) =>
    request('/orders/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  getOrders: () => request('/orders'),
  getOrderById: (id) => request(`/orders/${id}`),

  // Admin
  getAdminMetrics: () => request('/admin/metrics'),
  getAdminProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/products${query ? `?${query}` : ''}`);
  },
  createProduct: (payload) =>
    request('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) =>
    request(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateProductStock: (id, stockQuantity) =>
    request(`/admin/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stockQuantity }) }),
  deleteProduct: (id) =>
    request(`/admin/products/${id}`, { method: 'DELETE' }),
  getAdminOrders: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/orders${query ? `?${query}` : ''}`);
  },
  updateOrderStatus: (id, status) =>
    request(`/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // AI Agents & Operations
  getAgents: () => request('/agents'),
  agentChat: (payload) =>
    request('/agents/chat', { method: 'POST', body: JSON.stringify(payload) }),
  agentDirectChat: (agentName, payload) =>
    request(`/agents/${agentName}/chat`, { method: 'POST', body: JSON.stringify(payload) }),
  getAgentApprovals: (status = 'all') =>
    request(`/agents/approvals?status=${status}`),
  approveAgentRequest: (id, payload = {}) =>
    request(`/agents/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(payload) }),
  rejectAgentRequest: (id, payload = {}) =>
    request(`/agents/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify(payload) }),
  getAgentMetrics: () => request('/agents/metrics'),
  getAgentRuns: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/agents/runs${query ? `?${query}` : ''}`);
  },
  getRunToolCalls: (runId) => request(`/agents/runs/${runId}/tools`)
};

export default api;
