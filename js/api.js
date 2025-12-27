// Hares Platform - API Client
// Base configuration and utilities for API calls

const API_BASE_URL = 'http://localhost:3001';

// Get auth token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Save auth data
function saveAuthData(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Clear auth data
function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Generic API request function
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  
  // Add cache busting for GET requests
  const isGetRequest = !options.method || options.method === 'GET';
  if (isGetRequest && !endpoint.includes('?')) {
    endpoint += `?_t=${Date.now()}`;
  } else if (isGetRequest) {
    endpoint += `&_t=${Date.now()}`;
  }
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Handle 401 Unauthorized - but not for login endpoint
    if (response.status === 401 && endpoint !== '/auth/login') {
      clearAuthData();
      window.location.href = '../index.html';
      throw new Error('Unauthorized');
    }
    
    // Handle other errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }
    
    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// API methods
const api = {
  // Auth
  auth: {
    login: (credentials) => 
      apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    
    getProfile: () => apiRequest('/users/me'),
  },
  
  // Users
  users: {
    getAll: (page = 1, limit = 10) => apiRequest(`/users?page=${page}&limit=${limit}`),
    getById: (id) => apiRequest(`/users/${id}`),
    create: (data) => apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    toggleActive: (id) => apiRequest(`/users/${id}/toggle-active`, {
      method: 'PATCH',
    }),
    delete: (id) => apiRequest(`/users/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // Institutions
  institutions: {
    getAll: (page = 1, limit = 10) => apiRequest(`/institutions?page=${page}&limit=${limit}`),
    getById: (id) => apiRequest(`/institutions/${id}`),
    getStatistics: (id) => apiRequest(`/institutions/${id}/statistics`),
    create: (data) => apiRequest('/institutions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/institutions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    toggleActive: (id) => apiRequest(`/institutions/${id}/toggle-active`, {
      method: 'PATCH',
    }),
    delete: (id) => apiRequest(`/institutions/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // Branches
  branches: {
    getAll: (page = 1, limit = 10, institutionId = null) => {
      const params = new URLSearchParams({ page, limit });
      if (institutionId) params.append('institutionId', institutionId);
      return apiRequest(`/branches?${params.toString()}`);
    },
    getById: (id) => apiRequest(`/branches/${id}`),
    getStatistics: (id) => apiRequest(`/branches/${id}/statistics`),
    getDashboard: (id) => apiRequest(`/branches/${id}/dashboard`),
    getCustomers: (id) => apiRequest(`/branches/${id}/customers`),
    getLoans: (id) => apiRequest(`/branches/${id}/loans`),
    getTeam: (id) => apiRequest(`/branches/${id}/team`),
    getActivities: (id) => apiRequest(`/branches/${id}/activities`),
    create: (data) => apiRequest('/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    toggleActive: (id) => apiRequest(`/branches/${id}/toggle-active`, {
      method: 'PATCH',
    }),
    delete: (id) => apiRequest(`/branches/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // Customers
  customers: {
    getAll: (page = 1, limit = 10) => apiRequest(`/customers?page=${page}&limit=${limit}`),
    search: (params) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/customers/search?${query}`);
    },
    getById: (id) => apiRequest(`/customers/${id}`),
    create: (data) => apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    updateTrustStatus: (id, trustStatus) => apiRequest(`/customers/${id}/trust-status`, {
      method: 'PATCH',
      body: JSON.stringify({ trust_status: trustStatus }),
    }),
    delete: (id) => apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // Products
  products: {
    getAll: (page = 1, limit = 10) => apiRequest(`/products?page=${page}&limit=${limit}`),
    getActive: () => apiRequest('/products/active'),
    getById: (id) => apiRequest(`/products/${id}`),
    create: (data) => apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    toggleActive: (id) => apiRequest(`/products/${id}/toggle-active`, {
      method: 'PATCH',
    }),
    delete: (id) => apiRequest(`/products/${id}`, {
      method: 'DELETE',
    }),
  },
  
  // Loans
  loans: {
    getAll: (page = 1, limit = 10) => apiRequest(`/loans?page=${page}&limit=${limit}`),
    getStatistics: () => apiRequest('/loans/statistics'),
    getByCustomer: (customerId) => apiRequest(`/loans/customer/${customerId}`),
    getByBranch: (branchId) => apiRequest(`/loans/branch/${branchId}`),
    getByStatus: (status) => apiRequest(`/loans/status/${status}`),
    getById: (id) => apiRequest(`/loans/${id}`),
    create: (data) => apiRequest('/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/loans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    updateStatus: (id, status) => apiRequest(`/loans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
    getInstallments: (loanId) => apiRequest(`/loans/${loanId}/installments`),
  },
  
  // Installments
  installments: {
    getById: (id) => apiRequest(`/installments/${id}`),
    payInstallment: (id, paymentDate) => apiRequest(`/installments/${id}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentDate: paymentDate }),
    }),
    getOverdue: () => apiRequest('/installments/overdue'),
    update: (id, data) => apiRequest(`/installments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  },
  
  // Search Logs
  searchLogs: {
    getAll: (page = 1, limit = 10) => apiRequest(`/search-logs?page=${page}&limit=${limit}`),
    getByCustomer: (customerId, page = 1, limit = 10) => apiRequest(`/search-logs/customer/${customerId}?page=${page}&limit=${limit}`),
    getByUser: (userId, page = 1, limit = 10) => apiRequest(`/search-logs/user/${userId}?page=${page}&limit=${limit}`),
    delete: (id) => apiRequest(`/search-logs/${id}`, {
      method: 'DELETE',
    }),
  },

  // Customer Notes
  customerNotes: {
    getAll: (page = 1, limit = 10) => apiRequest(`/customer-notes?page=${page}&limit=${limit}`),
    getByCustomer: (customerId, page = 1, limit = 100) => apiRequest(`/customer-notes/customer/${customerId}?page=${page}&limit=${limit}`),
    getById: (id) => apiRequest(`/customer-notes/${id}`),
    create: (data) => apiRequest('/customer-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiRequest(`/customer-notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiRequest(`/customer-notes/${id}`, {
      method: 'DELETE',
    }),
  },
};

// Check if user is authenticated
function isAuthenticated() {
  return !!getToken();
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '../index.html';
    return false;
  }
  return true;
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format datetime
function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDate(dateString);
}

// Format trust status badge
function formatTrustStatusBadge(trustStatus) {
  if (!trustStatus) trustStatus = 'Unverified';
  
  const statusClass = `trust-status-${trustStatus.toLowerCase()}`;
  return `<span class="trust-status-badge ${statusClass}">${trustStatus}</span>`;
}

// Debounce function for search inputs
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
