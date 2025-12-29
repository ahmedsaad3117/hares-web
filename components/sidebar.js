// Sidebar Component
// Dynamically generates navigation based on user role

function createSidebar(user) {
  const sidebarHTML = `
    <div class="sidebar">
      <div class="sidebar-header" style="display: flex; justify-content: center; align-items: center; padding: 1.5rem 0;">
        <img src="../logo.png" alt="Logo" style="height: 140px; width: auto; max-width: 90%;">
      </div>
      
      <nav>
        <ul class="sidebar-nav">
          <li class="sidebar-nav-item">
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
          <li class="sidebar-nav-item">
            <a href="branches.html" class="sidebar-nav-link" id="nav-branches">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <span data-i18n-key="navigation.branches">${t('navigation.branches')}</span>
            </a>
          </li>
          ` : ''}
          
          <li class="sidebar-nav-item">
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
          
          <li class="sidebar-nav-item">
            <a href="loans.html" class="sidebar-nav-link" id="nav-loans">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span data-i18n-key="navigation.loans">${t('navigation.loans')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item">
            <a href="installments.html" class="sidebar-nav-link" id="nav-installments">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span data-i18n-key="navigation.installments">${t('navigation.installments')}</span>
            </a>
          </li>
          
          <li class="sidebar-nav-item">
            <a href="products.html" class="sidebar-nav-link" id="nav-products">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <span data-i18n-key="navigation.products">${t('navigation.products')}</span>
            </a>
          </li>
          
          ${user.roleName === 'Super Admin' || user.roleName === 'Institution' ? `
          <li class="sidebar-nav-item">
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
          ` : ''}
        </ul>
      </nav>
      
      <div style="margin-top: auto; padding-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: white; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${user.name}
            </div>
            <div id="sidebarUserContext" style="font-size: 0.75rem; color: #94a3b8;">
              ${user.roleName}
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
  
  return sidebarHTML;
}

function setActiveNav(pageId) {
  const navLink = document.getElementById(`nav-${pageId}`);
  if (navLink) {
    navLink.classList.add('active');
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    clearAuthData();
    window.location.href = '../index.html';
  }
}
