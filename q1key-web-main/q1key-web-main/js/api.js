// Q1KEY Platform - API Client (Enhanced v2.0)
// Base configuration and utilities for API calls
// Features: Timeout, Error Handling, Request Deduplication, Centralized Auth

// ============================================== //
//              API CONFIGURATION                 //
// ============================================== //

const API_BASE_URL = (window.API_CONFIG && window.API_CONFIG.baseUrl)
  ? window.API_CONFIG.baseUrl
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api'
    : window.location.origin.replace(/:\d+$/, ':3001/api');

// Default timeout in milliseconds (60 seconds)
const API_TIMEOUT = 60000;

// ============================================== //
//          REQUEST DEDUPLICATION CACHE          //
// ============================================== //

// Store for in-flight requests to prevent duplicates
const pendingRequests = new Map();

// Generate unique key for request deduplication
function generateRequestKey(endpoint, options) {
  const method = options.method || 'GET';
  const body = options.body || '';
  return `${method}:${endpoint}:${body}`;
}

// ============================================== //
//              AUTH UTILITIES                   //
// ============================================== //

function getToken() {
  return localStorage.getItem('token');
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function isAuthenticated() {
  return !!getToken();
}

/**
 * Check if a subscription is expired
 * @param {string|Date} expirationDate 
 * @returns {boolean}
 */
function isSubscriptionExpired(expirationDate) {
  // Super Admin check is usually done outside, but let's be safe
  if (!expirationDate) {
    // If no expiration date is provided for a non-super-admin, 
    // it could be a newly created account without a plan yet.
    // We should treat this based on our business logic. 
    // For now, let's assume no date = not expired yet (to prevent blocking new users)
    // BUT we should log this.
    return false;
  }

  try {
    const now = new Date();
    const exp = new Date(expirationDate);

    // Check for invalid date
    if (isNaN(exp.getTime())) {
      console.warn('Invalid expiration date format:', expirationDate);
      return false;
    }

    // Set time to end of day for expiration date to be generous
    // This ensures "Expires on 2026-01-23" means valid UNTIL the end of that day
    exp.setHours(23, 59, 59, 999);

    const isExpired = now.getTime() > exp.getTime();
    if (isExpired) {
      console.log(`Subscription check: EXPIRED (Now: ${now.toISOString()}, Exp: ${exp.toISOString()})`);
    }
    return isExpired;
  } catch (e) {
    console.error('Error during subscription check:', e);
    return false;
  }
}

function requireAuth() {
  if (!isAuthenticated()) {
    const isInsidePages = window.location.pathname.includes('/pages/');
    window.location.href = isInsidePages ? '../index.html' : 'index.html';
    return false;
  }

  // --- ADDED: Strict Subscription Check in requirement ---
  const user = getCurrentUser();
  if (user && user.roleName !== 'Super Admin') {
    const isExpired = isSubscriptionExpired(user.expirationDate);
    const path = window.location.pathname.toLowerCase();
    const isSubscriptionPage = path.endsWith('/my-subscription.html');

    if (isExpired && !isSubscriptionPage) {
      console.warn('Blocking access: Subscription expired for', user.email);
      const isInsidePages = window.location.pathname.includes('/pages/');
      window.location.href = isInsidePages ? 'my-subscription.html' : 'pages/my-subscription.html';
      return false;
    }
  }

  return true;
}

function saveAuthData(token, user, refreshToken) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }

  // LOGIC PLAN 11: Set Session Validity Flag
  // If subscription is valid NOW, gave a "Pass" for the entire session
  const isExpired = user.roleName !== 'Super Admin' && isSubscriptionExpired(user.expirationDate);
  if (!isExpired) {
    localStorage.setItem('session_valid', 'true');
  } else {
    localStorage.removeItem('session_valid');
  }
}

function clearAuthData() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('refresh_token');
  // LOGIC PLAN 11: Revoke Session Pass on Logout
  localStorage.removeItem('session_valid');
}

// Global check for session and subscription validity
(function startSessionObserver() {
  // 1. Inactivity Monitor - Auto logout after 1 minute of inactivity
  let inactivityTimer;
  const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes in milliseconds

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (isAuthenticated()) {
      inactivityTimer = setTimeout(() => {
        console.warn('Inactivity limit reached. Logging out...');
        handleInactivityLogout();
      }, INACTIVITY_LIMIT);
    }
  }

  async function handleInactivityLogout() {
    try {
      // Also try to logout from server to invalidate session
      await api.auth.logout();
    } catch (e) {
      console.error('Logout error during inactivity:', e);
    }
    clearAuthData();
    const isInsidePages = window.location.pathname.includes('/pages/');
    const redirectUrl = isInsidePages ? '../index.html?reason=inactivity' : 'index.html?reason=inactivity';
    window.location.href = redirectUrl;
  }

  // Register activity events to reset timer
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  activityEvents.forEach(event => {
    document.addEventListener(event, resetInactivityTimer, true);
  });

  // Initial timer start
  resetInactivityTimer();

  setInterval(async () => {
    // Only monitor if authenticated
    if (!isAuthenticated()) return;

    const path = window.location.pathname.toLowerCase();
    const isPublicPage = path.endsWith('index.html') || path === '/' || path.endsWith('/') || path.endsWith('login.html');

    try {
      // Get current status BEFORE sync
      const userBefore = getCurrentUser();
      const expiredBefore = userBefore && userBefore.roleName !== 'Super Admin' ? isSubscriptionExpired(userBefore.expirationDate) : false;

      // RADICAL FIX: Sync local data with server (updates localStorage)
      await api.auth.getProfile();

      // Get status AFTER sync
      const userAfter = getCurrentUser();
      const expiredAfter = userAfter && userAfter.roleName !== 'Super Admin' ? isSubscriptionExpired(userAfter.expirationDate) : false;

      // 1. AUTO-UNLOCK: If it was expired and now it's valid -> Reload to unlock UI
      // 2. AUTO-LOCK: If it's expired and we are not on subscription page -> Redirect
      if (expiredAfter && !isPublicPage && !path.endsWith('/my-subscription.html')) {
        console.warn('Subscription expired detected for user:', userAfter.email);
        const isInsidePages = window.location.pathname.includes('/pages/');
        window.location.href = isInsidePages ? 'my-subscription.html' : 'pages/my-subscription.html';
        return;
      }
    } catch (error) {
      // If error is 401 (Unauthorized), it means user session was invalidated (Forced Logout)
      if (error.status === 401) {
        console.warn('User session invalidated. Forcing logout...');
        clearAuthData();
        const isInsidePages = window.location.pathname.includes('/pages/');
        window.location.href = isInsidePages ? '../index.html' : 'index.html';
      }
    }
  }, 10000); // Sync/check every 10 seconds for radical consistency
})();

// ============================================== //
//         CENTRALIZED ERROR HANDLING            //
// ============================================== //

function handleApiError(response, endpoint, errorData) {
  const status = response.status;
  const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';

  // Create enhanced error object
  const error = new Error(errorData?.message?.message || errorData?.message || 'Request failed');
  error.status = status;
  error.code = errorData?.message?.code || errorData?.code;
  error.customer = errorData?.message?.customer || errorData?.customer;
  error.originalError = errorData;

  // Handle specific status codes
  switch (status) {
    case 400:
      // Bad Request - often used for capacity issues
      let msg = errorData?.message || '';
      if (isAr) {
        if (msg.includes('Branch capacity exceeded')) {
          msg = 'تم تجاوز الحد الأقصى للمبلغ المسموح به لهذا الفرع';
        } else if (msg.includes('Institution capacity exceeded')) {
          msg = 'تم تجاوز الحد الأقصى للمبلغ المسموح به لهذه المؤسسة';
        } else if (msg.includes('This installment has already been paid')) {
          msg = 'هذا القسط مدفوع بالفعل';
        } else if (msg.includes('Please pay installment') && msg.includes('first')) {
          // Attempt to extract numbers if possible, or just provide a general Arabic message
          const matches = msg.match(/#(\d+)/g);
          if (matches && matches.length >= 2) {
            msg = `لا يمكن دفع القسط رقم ${matches[1]}. يرجى دفع القسط رقم ${matches[0]} أولاً.`;
          } else {
            msg = 'يرجى دفع الأقساط السابقة أولاً قبل دفع هذا القسط.';
          }
        } else {
          msg = msg || 'طلب غير صالح';
        }
      }
      error.message = msg;
      break;

    case 401:
      // Unauthorized - handle in apiRequest (auto-refresh)
      // but if it's explicitly for login or already failed refresh, then clear
      if (endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh')) {
        clearAuthData();
        if (!endpoint.includes('/auth/login')) {
          window.location.href = '../index.html';
        }

        let customMsg = errorData?.message || '';
        // Debug: Log the error for the developer to see it in console
        console.log('[API Auth Error] Raw Message:', customMsg);

        if (typeof customMsg === 'string' && customMsg.includes('Account is deactivated')) {
          error.message = isAr ? 'هذا الحساب غير نشط حالياً، يرجى مراجعة الإدارة' : 'This account is currently inactive, please contact administration';
        } else if (customMsg.includes('Session expired or terminated')) {
          error.message = isAr ? 'انتهت الجلسة أو تم إنهاؤها من قبل المسؤول' : 'Session expired or terminated by administrator';
        } else if (typeof customMsg === 'string' && customMsg.includes('ACTIVE_SESSION_EXISTS')) {
          // Keep it raw so homepage.js can catch and style it specially
          error.message = 'ACTIVE_SESSION_EXISTS';
        } else {
          error.message = isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials';
        }
      }
      break;

    case 403:
      // Forbidden - no permission
      error.message = isAr ? 'ليس لديك صلاحية لهذا الإجراء' : 'You do not have permission for this action';
      console.warn('Access Denied:', endpoint);
      break;

    case 404:
      // Not Found
      error.message = isAr ? 'المورد المطلوب غير موجود' : 'Requested resource not found';
      break;

    case 409:
      // Conflict - data already exists
      error.message = errorData?.message || (isAr ? 'البيانات موجودة مسبقاً' : 'Data already exists');
      break;

    case 422:
      // Validation Error
      error.message = errorData?.message || (isAr ? 'بيانات غير صالحة' : 'Invalid data');
      break;

    case 429:
      // Too Many Requests
      const retryAfter = errorData?.retryAfter || 60;
      error.message = isAr
        ? `طلبات كثيرة جداً، يرجى المحاولة بعد ${retryAfter} ثانية`
        : `Too many requests, please try again after ${retryAfter} seconds`;
      break;

    case 500:
    case 502:
    case 503:
    case 504:
      // Server Error
      error.message = isAr ? 'خطأ في الخادم، يرجى المحاولة لاحقاً' : 'Server error, please try again later';
      console.error('Server Error:', status, endpoint);
      break;
  }

  return error;
}

// ============================================== //
//         FETCH WITH TIMEOUT WRAPPER            //
// ============================================== //

async function fetchWithTimeout(url, config, timeout = API_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';
      const timeoutError = new Error(isAr ? 'انتهت مهلة الطلب، يرجى المحاولة مرة أخرى' : 'Request timeout, please try again');
      timeoutError.isTimeout = true;
      throw timeoutError;
    }
    throw error;
  }
}

// ============================================== //
//           MAIN API REQUEST FUNCTION           //
// ============================================== //

// Track refreshing status
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token) {
  refreshSubscribers.map(cb => cb(token));
  refreshSubscribers = [];
}

async function apiRequest(endpoint, options = {}) {
  // --- STRICT SUBSCRIPTION ENFORCEMENT ---
  // If subscription is expired, redirect non-super-admins to the subscription page
  const user = getCurrentUser();
  const isProfileReq = endpoint.includes('/users/me');
  const isAuthReq = endpoint.includes('/auth/login') || endpoint.includes('/auth/verify-session') || endpoint.includes('/auth/refresh');

  if (user && user.roleName !== 'Super Admin' && !isProfileReq && !isAuthReq) {
    const isExpired = isSubscriptionExpired(user.expirationDate);
    const path = window.location.pathname.toLowerCase();
    const isSubscriptionPage = path.endsWith('/my-subscription.html');

    if (isExpired && !isSubscriptionPage) {
      console.warn('Blocking API request due to expired subscription:', endpoint);
      const isInsidePages = window.location.pathname.includes('/pages/');
      window.location.href = isInsidePages ? 'my-subscription.html' : 'pages/my-subscription.html';
      return Promise.reject(new Error('Subscription expired'));
    }
  }

  const isGetRequest = !options.method || options.method === 'GET';

  // Add cache busting for GET requests - DISABLED due to strict validation logic
  let fullEndpoint = endpoint;
  // if (isGetRequest && !endpoint.includes('?')) {
  //   fullEndpoint += `?_t=${Date.now()}`;
  // } else if (isGetRequest) {
  //   fullEndpoint += `&_t=${Date.now()}`;
  // }

  // Request deduplication for GET requests
  const requestKey = generateRequestKey(endpoint, options);
  if (isGetRequest && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  // Function to perform the actual fetch
  const performRequest = async (token) => {
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

    const timeout = options.timeout || API_TIMEOUT;
    console.log(`[API] Sending ${options.method || 'GET'} to ${fullEndpoint}`);
    const response = await fetchWithTimeout(`${API_BASE_URL}${fullEndpoint}`, config, timeout);
    console.log(`[API] Received response from ${fullEndpoint}: ${response.status}`);

    // Handle error responses
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) { }

      // Special 401 Handling for Token Refresh
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        const refreshTokenVal = getRefreshToken();

        if (refreshTokenVal) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshTokenVal })
              });

              if (refreshResponse.ok) {
                const newTokens = await refreshResponse.json();
                saveAuthData(newTokens.access_token, getCurrentUser(), newTokens.refresh_token);
                isRefreshing = false;
                onTokenRefreshed(newTokens.access_token);
              } else {
                isRefreshing = false;
                clearAuthData();
                window.location.href = '../index.html';
                throw handleApiError(response, endpoint, errorData);
              }
            } catch (err) {
              isRefreshing = false;
              clearAuthData();
              window.location.href = '../index.html';
              throw err;
            }
          }

          // Return a promise that resolves when the refresh is done
          return new Promise(resolve => {
            subscribeTokenRefresh(newToken => {
              resolve(performRequest(newToken));
            });
          });
        }
      }

      throw handleApiError(response, endpoint, errorData);
    }

    if (response.status === 204) return null;

    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      return null;
    }
  };

  const requestPromise = (async () => {
    try {
      return await performRequest(getToken());
    } catch (error) {
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';
        error.message = isAr ? 'خطأ في الاتصال بالخادم' : 'Connection error to server';
        error.isNetworkError = true;
      }
      throw error;
    } finally {
      if (isGetRequest) {
        pendingRequests.delete(requestKey);
      }
    }
  })();

  if (isGetRequest) {
    pendingRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
}

// ============================================== //
//         PUBLIC API REQUEST (NO AUTH)          //
// ============================================== //

// For public endpoints that don't require authentication (homepage, etc.)
async function publicApiRequest(endpoint, options = {}) {
  const isGetRequest = !options.method || options.method === 'GET';

  let fullEndpoint = endpoint;
  if (isGetRequest && !endpoint.includes('?')) {
    fullEndpoint += `?_t=${Date.now()}`;
  } else if (isGetRequest) {
    fullEndpoint += `&_t=${Date.now()}`;
  }

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Request deduplication
  const requestKey = `public:${generateRequestKey(endpoint, options)}`;
  if (isGetRequest && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      const timeout = options.timeout || API_TIMEOUT;
      const response = await fetchWithTimeout(`${API_BASE_URL}${fullEndpoint}`, config, timeout);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) { }
        throw handleApiError(response, endpoint, errorData);
      }

      if (response.status === 204) return null;

      const text = await response.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch (e) {
        return null;
      }
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';
        error.message = isAr ? 'خطأ في الاتصال بالخادم' : 'Connection error to server';
      }
      throw error;
    } finally {
      if (isGetRequest) {
        pendingRequests.delete(requestKey);
      }
    }
  })();

  if (isGetRequest) {
    pendingRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
}

// Expose public request function globally
window.publicApiRequest = publicApiRequest;

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

    getProfile: async () => {
      const user = await apiRequest('/users/me');
      if (user) {
        // SYNC: Overwrite stored user data to ensure expirationDate is correctly reflected
        // We use spread but ensure user object from server takes priority for critical fields
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = {
          ...stored,
          ...user,
          expirationDate: user.expirationDate // Explicitly take server value
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        console.log('User profile synced with server:', updatedUser.email, 'Expires:', updatedUser.expirationDate);
      }
      return user;
    },
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
    forceLogout: (id) => apiRequest(`/users/${id}/logout`, {
      method: 'POST',
    }),
  },

  // Institutions
  institutions: {
    getAll: (page = 1, limit = 10) => apiRequest(`/institutions?page=${page}&limit=${limit}`),
    getById: (id) => apiRequest(`/institutions/${id}`),
    getStatistics: (id) => apiRequest(`/institutions/${id}/statistics`),
    search: (term) => apiRequest(`/institutions/search?q=${encodeURIComponent(term)}`),
    checkTaxId: (taxId) => apiRequest(`/institutions/check-tax-id/${taxId}`),
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
    getAll: (page = 1, limit = 10, status = '') => {
      let url = `/loans?page=${page}&limit=${limit}`;
      if (status) url += `&status=${encodeURIComponent(status)}`;
      return apiRequest(url);
    },
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
    getByCustomer: (customerId, page = 1, limit = 10, searchType = '', search = '') => {
      let url = `/search-logs/customer/${customerId}?page=${page}&limit=${limit}`;
      if (searchType) url += `&searchType=${encodeURIComponent(searchType)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
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

    // Get transations with cleaned filters
    getTransactions: (filter = {}) => {
      const params = new URLSearchParams(api.reports._cleanFilters(filter)).toString();
      return apiRequest(`/cash-box/transactions?${params}`);
    },

    // Get unified data (Metadata + Report + Transactions)
    getUnifiedData: (filter = {}) => {
      const params = new URLSearchParams(api.reports._cleanFilters(filter)).toString();
      return apiRequest(`/cash-box/unified?${params}`);
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
    // Helper to clean empty values from filters
    _cleanFilters: (filters) => {
      const cleaned = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          cleaned[key] = value;
        }
      }
      return cleaned;
    },
    getGeneralStats: (filters = {}) => {
      // filters: startDate, endDate, institutionId, branchId
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/general-stats?${params}`);
    },
    getCashBoxReport: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/cash-box?${params}`);
    },
    getCustomersReport: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/customers?${params}`);
    },
    getLoansReport: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/loans?${params}`);
    },
    getInstallmentsReport: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/installments?${params}`);
    },
    getUnifiedReport: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/unified?${params}`);
    },
    getDashboardData: (filters = {}) => {
      const cleanedFilters = api.reports._cleanFilters(filters);
      const params = new URLSearchParams(cleanedFilters).toString();
      return apiRequest(`/reports/dashboard-summary?${params}`);
    },
    getComparisonsData: () => apiRequest('/reports/comparisons')
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
    getUnifiedData: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.status && params.status !== 'all') queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      return apiRequest(`/subscriptions/unified?${queryParams.toString()}`);
    },

    // Unified Subscription Data (for subscriptions list)
    getUnifiedSubscriptions: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.type && params.type !== '') queryParams.append('type', params.type);
      if (params.status && params.status !== '') queryParams.append('status', params.status);
      if (params.search) queryParams.append('search', params.search);
      if (params.page) queryParams.append('page', params.page);
      if (params.limit) queryParams.append('limit', params.limit);
      return apiRequest(`/subscriptions/unified-subscriptions?${queryParams.toString()}`);
    },

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
    getPublicData: () => publicApiRequest('/homepage/public'),

    // Get homepage settings (Super Admin only)
    getSettings: () => apiRequest('/homepage/settings'),

    // Update homepage settings (Super Admin only)
    updateSettings: (data) => apiRequest('/homepage/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Quick Links Management
  quickLinks: {
    // Get active links (for dashboard display)
    getActive: () => apiRequest('/quick-links/active'),

    // Get all links (admin)
    getAll: () => apiRequest('/quick-links'),

    // Get link by ID
    getById: (id) => apiRequest(`/quick-links/${id}`),

    // Create new link
    create: (data) => apiRequest('/quick-links', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

    // Update link
    update: (id, data) => apiRequest(`/quick-links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

    // Delete link
    delete: (id) => apiRequest(`/quick-links/${id}`, {
      method: 'DELETE',
    }),

    // Reorder links
    reorder: (orderedIds) => apiRequest('/quick-links/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
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
  const num = parseFloat(amount);
  const locale = localStorage.getItem('locale') || 'ar';

  if (isNaN(num)) {
    return locale === 'ar' ? '0.00 ر.س.' : '0.00 SAR';
  }

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    numberingSystem: 'latn' // Force Latin (English) digits
  }).format(num);
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
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  const locale = localStorage.getItem('locale') || 'ar';
  return date.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
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

  const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';

  if (diffSecs < 60) return isAr ? 'الآن' : 'just now';
  if (diffMins < 60) {
    if (isAr) return `منذ ${diffMins} دقيقة`;
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) {
    if (isAr) return `منذ ${diffHours} ساعة`;
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }
  if (diffDays < 7) {
    if (isAr) return `منذ ${diffDays} أيام`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
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
window.api = api;
window.showToast = showToast;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatCurrency = formatCurrency;
window.formatRelativeTime = formatRelativeTime;
window.formatTrustStatusBadge = formatTrustStatusBadge;

// Expose additional utilities
window.API_BASE_URL = API_BASE_URL;
window.API_TIMEOUT = API_TIMEOUT;
window.apiRequest = apiRequest;
