// Sidebar Component
// Dynamically generates navigation based on user role

function translateRole(roleName) {
  const roleMap = {
    'Super Admin': 'users.roles.super_admin',
    'admin': 'users.roles.super_admin', // Handle 'admin' role from DB
    'Institution': 'users.roles.institution',
    'Branch': 'users.roles.branch'
  };
  return t(roleMap[roleName] || roleName || 'Guest');
}

// function isSubscriptionExpired is now globally defined in api.js

function createSidebar(user) {
  const isStrictlyExpired = user.roleName !== 'Super Admin' && isSubscriptionExpired(user.expirationDate);

  // LOGIC: Strict Enforcement - No more "session_valid" bypass. 
  // If it's expired in DB, it's expired in UI.
  let isExpiredForUI = isStrictlyExpired;

  console.log('Sidebar user:', user);
  console.log('Subscription Status:', { strict: isStrictlyExpired, finalUI: isExpiredForUI });

  const isExpired = isExpiredForUI;


  const sidebarHTML = `
    <div class="sidebar ${isExpired ? 'subscription-expired' : ''}">
      <button class="mobile-close-sidebar" onclick="toggleSidebar()" aria-label="Close Menu">&times;</button>
      <div class="sidebar-header" style="display: flex; justify-content: center; align-items: center; padding: 1.5rem 0;">
        <a href="dashboard.html" style="display: block; cursor: pointer;">
          <img src="../logo.png" alt="Logo" style="height: 140px; width: auto; max-width: 90%;">
        </a>
      </div>
      
      ${isExpired ? `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger); border-radius: 8px; padding: 0.75rem; margin: 0 1rem 1.5rem; color: #fca5a5; font-size: 0.8rem; text-align: center;">
        <span data-i18n-key="common.subscription_expired_notice">
          ${t('common.subscription_expired_notice') || 'اشتراكك منتهٍ، يرجى التجديد لاستعادة الصلاحيات'}
        </span>
      </div>
      ` : ''}

      <nav>
        <ul class="sidebar-nav">
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="dashboard.html" class="sidebar-nav-link" id="nav-dashboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              <span data-i18n-key="navigation.dashboard">${t('navigation.dashboard')}</span>
            </a>
          </li>
          
          ${user.roleName === 'Super Admin' ? `
          <li class="sidebar-nav-item">
            <a href="subscriptions.html" class="sidebar-nav-link" id="nav-subscriptions">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span data-i18n-key="navigation.subscriptions">${t('navigation.subscriptions')}</span>
            </a>
          </li>
          <li class="sidebar-nav-item">
            <a href="requests.html" class="sidebar-nav-link" id="nav-requests">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 3h5v5"/>
                <path d="M8 3H3v5"/>
                <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/>
                <path d="m15 9 6-6"/>
              </svg>
              <span data-i18n-key="navigation.requests">${t('navigation.requests')}</span>
              <span id="pendingRequestsBadge" class="nav-badge" style="display: none;">0</span>
            </a>
          </li>
          ` : ''}
          
          ${user.roleName === 'Super Admin' ? `
          <li class="sidebar-nav-item">
            <a href="institutions.html" class="sidebar-nav-link" id="nav-institutions">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span data-i18n-key="navigation.institutions">${t('navigation.institutions')}</span>
            </a>
          </li>
          ` : ''}
          
          ${(user.roleName === 'Super Admin' || (user.roleName === 'Institution' && user.canCreateBranches !== false)) ? `
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="branches.html" class="sidebar-nav-link" id="nav-branches">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <span data-i18n-key="navigation.branches">${t('navigation.branches')}</span>
            </a>
          </li>
          ` : ''}
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="customers.html" class="sidebar-nav-link" id="nav-customers">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span data-i18n-key="navigation.customers">${t('navigation.customers')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="loans.html" class="sidebar-nav-link" id="nav-loans">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span data-i18n-key="navigation.loans">${t('navigation.loans')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="installments.html" class="sidebar-nav-link" id="nav-installments">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span data-i18n-key="navigation.installments">${t('navigation.installments')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="cashbox.html" class="sidebar-nav-link" id="nav-cashbox">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <circle cx="12" cy="12" r="4"/>
                <path d="M2 8h20"/>
                <path d="M2 16h20"/>
              </svg>
              <span data-i18n-key="navigation.cashbox">${t('navigation.cashbox')}</span>
            </a>
          </li>
 
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="reports.html" class="sidebar-nav-link" id="nav-reports">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span data-i18n-key="navigation.reports">${t('navigation.reports')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="comparisons.html" class="sidebar-nav-link" id="nav-comparisons">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span data-i18n-key="navigation.comparisons">${t('navigation.comparisons')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="products.html" class="sidebar-nav-link" id="nav-products">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span data-i18n-key="navigation.products">${t('navigation.products')}</span>
            </a>
          </li>
          
          ${user.roleName === 'Super Admin' || (user.roleName === 'Institution' && user.canCreateBranches !== false) ? `
          <li class="sidebar-nav-item ${isExpired ? 'expired' : ''}">
            <a href="users.html" class="sidebar-nav-link" id="nav-users">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span data-i18n-key="navigation.users">${t('navigation.users')}</span>
            </a>
          </li>
          ` : ''}
          
          ${user.roleName === 'Super Admin' ? `
          <li class="sidebar-nav-item">
            <a href="search-logs.html" class="sidebar-nav-link" id="nav-search-logs">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span data-i18n-key="navigation.search_logs">${t('navigation.search_logs')}</span>
            </a>
          </li>
          <li class="sidebar-nav-item">
            <a href="tools.html" class="sidebar-nav-link" id="nav-tools">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              <span data-i18n-key="navigation.tools">${t('navigation.tools')}</span>
            </a>
          </li>
          ` : ''}
 
          ${user.roleName === 'Institution' || user.roleName === 'Branch' ? `
          <li class="sidebar-nav-item expired-exception">
            <a href="my-subscription.html" class="sidebar-nav-link" id="nav-my-subscription">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <path d="M8 14h.01"/>
                <path d="M12 14h.01"/>
                <path d="M16 14h.01"/>
              </svg>
              <span data-i18n-key="navigation.my_subscription">${t('navigation.my_subscription')}</span>
            </a>
          </li>
          ` : ''}
 
          <li class="sidebar-nav-item expired-exception">
            <a href="javascript:void(0)" onclick="openHelpModal()" class="sidebar-nav-link" id="nav-help">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span data-i18n-key="navigation.help">${t('navigation.help')}</span>
            </a>
          </li>
        </ul>
      </nav>
      
      <div style="margin-top: auto; padding-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;">
            ${(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: white; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${user.name}
            </div>
            <div id="sidebarUserContext" style="font-size: 0.75rem; color: #94a3b8;">
              ${translateRole(user.roleName || user.role)}
            </div>
          </div>
        </div>
        
        <button onclick="handleLogout()" class="btn btn-secondary w-full" style="width: 100%; font-size: 0.875rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span data-i18n-key="navigation.logout">${t('navigation.logout')}</span>
        </button>
      </div>
    </div>
  `;

  // After returning HTML, trigger count update if super admin
  if (user.roleName === 'Super Admin') {
    setTimeout(updatePendingRequestsCount, 100);
  }

  return sidebarHTML;
}

// Function to update the badge count
async function updatePendingRequestsCount() {
  try {
    const badge = document.getElementById('pendingRequestsBadge');
    if (!badge) return;

    const result = await api.subscriptions.getPendingCount();
    const count = result.count || 0;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating pending count:', error);
  }
}

function setActiveNav(pageId) {
  const navLink = document.getElementById(`nav-${pageId}`);
  if (navLink) {
    navLink.classList.add('active');
  }
}

async function handleLogout() {
  showConfirmModal({
    title: t('navigation.logout') || 'تسجيل الخروج',
    message: t('common.message.logout_confirm_message') || 'هل أنت متأكد أنك تريد تسجيل الخروج؟',
    confirmText: t('navigation.logout') || 'تسجيل الخروج',
    icon: '👋',
    btnClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await api.auth.logout();
      } catch (error) {
        console.error('Logout error:', error);
      }
      clearAuthData();
      window.location.href = '../index.html';
    }
  });
}
// Make functions globally available
window.updatePendingRequestsCount = updatePendingRequestsCount;
window.createSidebar = createSidebar;
window.setActiveNav = setActiveNav;
window.handleLogout = handleLogout;

// Inject expired styles automatically if not present
(function injectSidebarStyles() {
  if (document.getElementById('sidebar-expired-styles')) return;
  const style = document.createElement('style');
  style.id = 'sidebar-expired-styles';
  style.textContent = `
    .sidebar-nav-item.expired {
      opacity: 0.3 !important;
      position: relative !important;
      cursor: not-allowed !important;
      filter: grayscale(100%) !important;
      transition: all 0.3s ease;
    }
    .sidebar-nav-item.expired a,
    .sidebar-nav-item.expired button {
      pointer-events: none !important;
      cursor: not-allowed !important;
    }
    .sidebar-nav-item.expired::after {
      content: '🔒';
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.9rem;
      z-index: 20;
      opacity: 0.8;
    }
    [dir="ltr"] .sidebar-nav-item.expired::after {
      left: auto;
      right: 1rem;
    }
    .sidebar-nav-item.expired-exception {
      opacity: 1 !important;
      pointer-events: auto !important;
      filter: none !important;
    }
    .sidebar-nav-item.expired-exception a {
      pointer-events: auto !important;
    }
    .sidebar-nav-item.expired-exception::after {
      display: none !important;
    }
    /* Ensure logout button stays visible and active */
    .sidebar button.btn-secondary {
      opacity: 1 !important;
      pointer-events: auto !important;
      filter: none !important;
    }
  `;
  document.head.appendChild(style);
})();

// Block clicks on expired items globally as a fallback
document.addEventListener('click', function (e) {
  const expiredItem = e.target.closest('.sidebar-nav-item.expired');
  if (expiredItem && !e.target.closest('.expired-exception')) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Blocked click on expired sidebar item');
    return false;
  }
}, true);

// Optimization: Targeted observation for better performance
// Only observes specific containers instead of the entire document tree
const initSidebarObserver = () => {
  const targets = ['sidebar', 'sidebarContainer'];
  let observed = false;

  const observer = new MutationObserver((mutations) => {
    // Debounce the check slightly or just check existence
    const badge = document.getElementById('pendingRequestsBadge');
    if (badge && !badge.dataset.observed) {
      badge.dataset.observed = "true";
      updatePendingRequestsCount();
    }
  });

  // Try to observe specific containers
  targets.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      observer.observe(el, { childList: true }); // No subtree needed for direct injection
      observed = true;
    }
  });

  // Fallback: If no specific container found, observe body but without subtree if possible,
  // or restricted subtree. For now, if no container, we rely on createSidebar's internal timeout.
  // This prevents the expensive global observer.
  if (!observed) {
    console.warn('Sidebar container not found for observation. Relying on createSidebar timeout.');
  }

  // Initial check
  updatePendingRequestsCount();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebarObserver);
} else {
  initSidebarObserver();
}
