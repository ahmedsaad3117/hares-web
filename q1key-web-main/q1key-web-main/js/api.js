// Q1KEY Platform - API Client
// Base configuration and utilities for API calls

// API Configuration - can be overridden by setting window.API_CONFIG before this script loads
// In production, create a config.js file that sets window.API_CONFIG = { baseUrl: 'https://your-api-domain.com' }
const API_BASE_URL = (window.API_CONFIG && window.API_CONFIG.baseUrl)
  ? window.API_CONFIG.baseUrl
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : window.location.origin.replace(/:\d+$/, ':3001'); // Use same host with API port

// Get auth token from localStorage
function getToken() {
  return localStorage.getItem('token');
}

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}
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
      window.location.href = '../home.html';
      throw new Error('Unauthorized');
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json();
      const error = new Error(errorData.message?.message || errorData.message || 'Request failed');
      error.code = errorData.message?.code || errorData.code;
      error.customer = errorData.message?.customer || errorData.customer;
      error.originalError = errorData;
      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null;
    }
    // Safely parse JSON

    // Safely parse JSON
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      console.warn('Response was not JSON:', text);
      return null; // Return null if response is not valid JSON
    }
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

    logout: () =>
      apiRequest('/auth/logout', {
        method: 'POST',
      }),

    verifySession: () => apiRequest('/auth/verify-session'),

    getProfile: () => apiRequest('/users/me'),
  },

  // Users
  users: {
    getAll: (page = 1, limit = 10, search = '') => {
      let url = `/users?page=${page}&limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return apiRequest(url);
    },
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
    search: (term) => apiRequest(`/institutions/search?q=${encodeURIComponent(term)}`),
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
    search: (term) => apiRequest(`/branches/search?q=${encodeURIComponent(term)}`),
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
    getAll: (page = 1, limit = 10, deleted = false) => apiRequest(`/customers?page=${page}&limit=${limit}&deleted=${deleted}`),
    search: (params) => {
      const query = new URLSearchParams(params).toString();
      return apiRequest(`/customers/search?${query}`);
    },
    getById: (id) => apiRequest(`/customers/${id}`),
    create: (data) => apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    link: (id) => apiRequest(`/customers/${id}/link`, { method: 'POST' }),
    restore: (id) => apiRequest(`/customers/${id}/restore`, { method: 'POST' }),
    update: (id, data) => apiRequest(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    updateTrustStatus: (id, trustStatus) => apiRequest(`/customers/${id}/trust-status`, {
      method: 'PATCH',
      body: JSON.stringify({ trust_status: trustStatus }),
    }),
    softDelete: (id) => apiRequest(`/customers/${id}/soft-delete`, {
      method: 'POST',
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
    search: (searchTerm) => apiRequest(`/loans/search?q=${encodeURIComponent(searchTerm)}`),
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
    delete: (id) => apiRequest(`/loans/${id}`, { method: 'DELETE' }),
  },

  // Installments
  installments: {
    search: (searchTerm) => apiRequest(`/installments/search?q=${encodeURIComponent(searchTerm)}`),
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
    delete: (id) => apiRequest(`/installments/${id}`, {
      method: 'DELETE',
    }),
  },

  // Search Logs
  searchLogs: {
    getAll: (page = 1, limit = 10, searchType = '', search = '') => {
      let url = `/search-logs?page=${page}&limit=${limit}`;
      if (searchType) url += `&searchType=${encodeURIComponent(searchType)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      return apiRequest(url);
    },
    getByCustomer: (customerId, page = 1, limit = 10, searchType = '') => {
      const url = searchType
        ? `/search-logs/customer/${customerId}?page=${page}&limit=${limit}&searchType=${encodeURIComponent(searchType)}`
        : `/search-logs/customer/${customerId}?page=${page}&limit=${limit}`;
      return apiRequest(url);
    },
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

  // Cash Box Management
  cashBox: {
    // Get current user's cash box
    get: () => apiRequest('/cash-box'),

    // Get specific cash box
    getById: (id) => apiRequest(`/cash-box/${id}`),

    // Get branch cash boxes for institution
    getBranchCashBoxes: () => apiRequest('/cash-box/institution/branches'),

    // Deposit money
    deposit: (data) => apiRequest('/cash-box/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Deposit to specific cash box
    depositTo: (id, data) => apiRequest(`/cash-box/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Withdraw money
    withdraw: (data) => apiRequest('/cash-box/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Withdraw from specific cash box
    withdrawFrom: (id, data) => apiRequest(`/cash-box/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Get transactions
    getTransactions: (filter = {}) => {
      const params = new URLSearchParams(filter).toString();
      return apiRequest(`/cash-box/transactions?${params}`);
    },

    // Get transactions for specific cash box
    getTransactionsFor: (id, filter = {}) => {
      const params = new URLSearchParams(filter).toString();
      return apiRequest(`/cash-box/${id}/transactions?${params}`);
    },

    // Get report
    getReport: (fromDate, toDate) => apiRequest(`/cash-box/report?fromDate=${fromDate}&toDate=${toDate}`),

    // Get report for specific cash box
    getReportFor: (id, fromDate, toDate) => apiRequest(`/cash-box/${id}/report?fromDate=${fromDate}&toDate=${toDate}`),
  },

  // Reports
  reports: {
    getGeneralStats: (filters = {}) => {
      // filters: startDate, endDate, institutionId, branchId
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/general-stats?${params}`);
    },
    getCashBoxReport: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/cash-box?${params}`);
    },
    getCustomersReport: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/customers?${params}`);
    },
    getLoansReport: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/loans?${params}`);
    },
    getInstallmentsReport: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/installments?${params}`);
    },
    getUnifiedReport: (filters = {}) => {
      const params = new URLSearchParams(filters).toString();
      return apiRequest(`/reports/unified?${params}`);
    }
  },

  // Settings (Support Info)
  settings: {
    getSupportInfo: () => apiRequest('/settings/support-contact'),
    updateSupportInfo: (data) => apiRequest('/settings/support-contact', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Subscriptions Management
  subscriptions: {
    // Plans
    getPlans: (includeInactive = false) => apiRequest(`/subscriptions/plans?includeInactive=${includeInactive}`),
    getActivePlans: () => apiRequest('/subscriptions/plans/active'),
    createPlan: (data) => apiRequest('/subscriptions/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updatePlan: (id, data) => apiRequest(`/subscriptions/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    togglePlanVisibility: (id) => apiRequest(`/subscriptions/plans/${id}/toggle`, {
      method: 'PUT',
    }),
    deletePlan: (id) => apiRequest(`/subscriptions/plans/${id}`, {
      method: 'DELETE',
    }),

    // Requests
    getRequests: (status = '', page = 1, limit = 20) => {
      let url = `/subscriptions/requests?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      return apiRequest(url);
    },
    getPendingCount: () => apiRequest('/subscriptions/requests/pending-count'),
    getRequestById: (id) => apiRequest(`/subscriptions/requests/${id}`),
    createRequest: (data) => apiRequest('/subscriptions/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    processRequest: (id, data) => apiRequest(`/subscriptions/requests/${id}/process`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    updateRequest: (id, data) => apiRequest(`/subscriptions/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    cancelRequest: (id) => apiRequest(`/subscriptions/requests/${id}/cancel`, {
      method: 'PUT',
    }),

    // My Subscription (for Institution/Branch)
    getMySubscription: () => apiRequest('/subscriptions/my-subscription'),
    getMyRequests: () => apiRequest('/subscriptions/my-requests'),

    // Settings
    getSettings: () => apiRequest('/subscriptions/settings'),
    updateSettings: (data) => apiRequest('/subscriptions/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Announcements Management
  announcements: {
    // Get active announcement (for banner display)
    getActive: () => apiRequest('/announcements/active'),

    // Get all announcements (Super Admin)
    getAll: () => apiRequest('/announcements'),

    // Get announcement by ID
    getById: (id) => apiRequest(`/announcements/${id}`),

    // Create announcement
    create: (data) => apiRequest('/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Update announcement
    update: (id, data) => apiRequest(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    // Toggle announcement status
    toggle: (id) => apiRequest(`/announcements/${id}/toggle`, {
      method: 'PUT',
    }),

    // Delete announcement
    delete: (id) => apiRequest(`/announcements/${id}`, {
      method: 'DELETE',
    }),
  },

  // Homepage Management
  homepage: {
    // Get public homepage data (no auth required)
    getPublicData: () => fetch(`${API_BASE_URL}/homepage/public?_t=${Date.now()}`)
      .then(res => res.json()),

    // Get homepage settings (Super Admin only)
    getSettings: () => apiRequest('/homepage/settings'),

    // Update homepage settings (Super Admin only)
    updateSettings: (data) => apiRequest('/homepage/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },
};

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
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
  }).format(amount);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime()) || date.getTime() === 0) return '-';

  const locale = localStorage.getItem('locale') || 'ar';
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
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
  if (!trustStatus || trustStatus === 'Unverified') return '';

  const statusClass = `trust-status-${trustStatus.toLowerCase()}`;
  const displayStatus = (window.t)
    ? window.t(`customers.view_page.trust_status_options.${trustStatus.toLowerCase()}`)
    : trustStatus;

  return `<span class="trust-status-badge ${statusClass}">${displayStatus}</span>`;
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

// Expose api to window object for strict global access
// Expose api to window object for strict global access
window.api = api;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;
window.formatRelativeTime = formatRelativeTime;
window.formatTrustStatusBadge = formatTrustStatusBadge;
