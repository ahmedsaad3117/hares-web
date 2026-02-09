// Header Component
// Displays page title and user info

function translateRole(roleName) {
  const roleMap = {
    'Super Admin': 'users.roles.super_admin',
    'admin': 'users.roles.super_admin', // Handle 'admin' role from DB
    'Institution': 'users.roles.institution',
    'Branch': 'users.roles.branch'
  };
  return t(roleMap[roleName] || roleName || 'Guest');
}

// Session heartbeat - check periodically if session is still valid
let sessionCheckInterval = null;
let sessionCheckInitialDelay = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

function startSessionMonitoring() {
  // Clear any existing intervals
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  if (sessionCheckInitialDelay) {
    clearTimeout(sessionCheckInitialDelay);
  }

  // Reset failure counter
  consecutiveFailures = 0;

  // Wait 60 seconds before the first check to allow page to fully load
  // and avoid false positives during initial authentication
  sessionCheckInitialDelay = setTimeout(() => {
    // Then check session every 60 seconds (increased from 30 to reduce server load)
    sessionCheckInterval = setInterval(async () => {
      try {
        await api.auth.verifySession();
        // Reset failure counter on success
        consecutiveFailures = 0;
      } catch (error) {
        console.warn('[Session Monitor] Check failed:', error.message, 'Status:', error.status);

        // Only handle 401 errors
        if (error.status === 401) {
          consecutiveFailures++;
          console.warn(`[Session Monitor] Consecutive failures: ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`);

          // Try to refresh token first before logging out
          const refreshToken = getRefreshToken();
          if (refreshToken && consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
            try {
              console.log('[Session Monitor] Attempting token refresh...');
              const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
              });

              if (response.ok) {
                const newTokens = await response.json();
                saveAuthData(newTokens.access_token, getCurrentUser(), newTokens.refresh_token);
                console.log('[Session Monitor] Token refreshed successfully');
                consecutiveFailures = 0;
                return; // Continue monitoring
              }
            } catch (refreshError) {
              console.warn('[Session Monitor] Token refresh failed:', refreshError.message);
            }
          }

          // If we've had too many failures or refresh failed, logout
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            clearInterval(sessionCheckInterval);
            clearAuthData();
            const isAr = (localStorage.getItem('locale') || 'ar') === 'ar';
            const message = isAr
              ? 'انتهت جلستك. تم تسجيل الدخول من جهاز آخر.'
              : 'Your session has expired. You have been logged in from another device.';
            alert(message);
            window.location.href = '../index.html';
          }
        } else {
          // For network errors, just log and continue - don't logout
          console.warn('[Session Monitor] Non-auth error (network issue?):', error.message);
        }
      }
    }, 60000); // 60 seconds between checks
  }, 60000); // Wait 60 seconds before first check
}

async function loadUserContext() {
  const user = getCurrentUser();
  const roleName = user.roleName || user.role;
  let contextInfo = translateRole(roleName);

  try {
    // Load institution name if user has one
    if (user.institutionId) {
      const institution = await api.institutions.getById(user.institutionId);
      contextInfo = `${translateRole(roleName)} - ${institution.name}`;
    }

    // Load branch name if user has one
    if (user.branchId) {
      const branch = await api.branches.getById(user.branchId);
      if (user.institutionId) {
        contextInfo = `${translateRole(roleName)} - ${branch.name} & ${branch.institution?.name || 'Institution'}`;
      } else {
        contextInfo = `${translateRole(roleName)} - ${branch.name}`;
      }
    }
  } catch (error) {
    console.error('Error loading user context:', error);
  }

  return contextInfo;
}

function createHeader(title, subtitle = '') {
  const user = getCurrentUser();

  const headerHTML = `
    <!-- NEW PREMIUM HEADER DESIGN -->
    <div class="header-container-premium">
      <!-- Top Layer: Date & Quick Links -->
      <div class="header-top-bar">
        <div class="header-date-box">
          <div class="date-item clock">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-pulse">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span id="currentTime">--:--</span>
          </div>
          <div class="date-divider"></div>
          <div class="date-item calendar">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span id="currentDate">-- -- ----</span>
          </div>
        </div>

        <div id="quickLinksContainer" class="header-quick-links">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>

        <!-- Left Spacer for centering -->
        <div class="header-top-spacer hidden md:block" style="flex: 1;"></div>
      </div>

      <!-- Main Layer: Navigation & Profile -->
      <div class="header-main-bar">
        <div class="header-breadcrumb">
          <button class="mobile-toggle-btn md:hidden" onclick="toggleSidebar()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div class="title-group">
            <h1 class="header-main-title">${title}</h1>
            ${subtitle ? `<p class="header-subtitle">${subtitle}</p>` : ''}
          </div>
        </div>

        <div class="header-actions">
          <!-- Language Switcher -->
          <button id="languageSwitcher" class="action-btn-glass lang-switcher">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            <span id="currentLanguage">AR</span>
          </button>

          <!-- Notification (Optional) -->
          <div class="action-btn-glass theme-toggle" onclick="toggleTheme?.()">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
             </svg>
          </div>

          <div class="user-profile-premium">
            <div class="user-details text-right hidden md:block">
              <span class="user-name">${user.name}</span>
              <span id="userContext" class="user-role">${translateRole(user.roleName || user.role)}</span>
            </div>
            <div class="avatar-premium-wrapper">
               <div class="avatar-premium">${(user.name || 'U').charAt(0).toUpperCase()}</div>
               <div class="status-indicator"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize scripts
  setTimeout(() => {
    startDateTime();
    loadQuickLinks();
    updateHeaderContext();
  }, 50);

  return headerHTML;
}

// Update user context in header (Role, Institution, Branch)
// Update user context in header (Role, Institution, Branch)
// Update user context in header (Role, Institution, Branch)
async function updateHeaderContext() {
  const contextInfo = await loadUserContext();

  // Update text
  const contextElement = document.getElementById('userContext');
  if (contextElement) {
    contextElement.textContent = contextInfo;
  }

  // Update avatar interaction
  const avatarWrapper = document.querySelector('.avatar-premium-wrapper');
  if (avatarWrapper) {
    // Remove title to prevent browser tooltip
    avatarWrapper.removeAttribute('title');
    avatarWrapper.style.cursor = 'pointer';
    avatarWrapper.style.position = 'relative'; // Ensure positioning context for popover

    // Inject styles for the note if not present
    if (!document.getElementById('user-note-styles')) {
      const style = document.createElement('style');
      style.id = 'user-note-styles-v2';
      style.textContent = `
        .user-info-popover {
          position: absolute;
          top: 130%;
          /* Default (RTL): Profile is on Left, so align Left to grow Right */
          left: 0;
          right: auto;
          
          background: rgba(30, 41, 59, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(99, 102, 241, 0.3);
          padding: 16px;
          border-radius: 12px;
          color: white;
          font-size: 0.9rem;
          min-width: 240px;
          max-width: 300px;
          width: max-content;
          z-index: 1000;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          opacity: 0;
          transform: translateY(-10px);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          visibility: hidden;
          text-align: right;
        }
        
        /* LTR Override: Profile is on Right, so align Right to grow Left */
        [dir="ltr"] .user-info-popover {
          left: auto;
          right: 0;
          text-align: left;
        }

        .user-info-popover.show {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          visibility: visible;
        }

        /* Arrow - Default RTL (Left side) */
        .user-info-popover::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 14px;
          right: auto;
          width: 12px;
          height: 12px;
          background: inherit;
          border-top: 1px solid rgba(99, 102, 241, 0.3);
          border-left: 1px solid rgba(99, 102, 241, 0.3);
          transform: rotate(45deg);
        }

        /* Arrow - LTR Override (Right side) */
        [dir="ltr"] .user-info-popover::before {
          left: auto;
          right: 14px;
        }

        .user-info-popover .popover-label {
          display: block;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          font-weight: 600;
        }
        
        .user-info-popover .popover-content {
           line-height: 1.6;
           color: #e2e8f0;
        }
      `;
      document.head.appendChild(style);

      // Remove old style if it exists
      const oldStyle = document.getElementById('user-note-styles');
      if (oldStyle) oldStyle.remove();
    }

    // Create or get the popover element
    let popover = avatarWrapper.querySelector('.user-info-popover');
    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'user-info-popover';
      avatarWrapper.appendChild(popover);
    }

    // Update content
    popover.innerHTML = `
      <span class="popover-label">${t('users.details') || 'التفاصيل'}</span>
      <div style="line-height: 1.4;">${contextInfo}</div>
    `;

    // Add click listener
    // Using onclick property to overwrite any previous handlers
    avatarWrapper.onclick = (e) => {
      e.stopPropagation(); // Prevent bubble up

      const isActive = popover.classList.contains('show');

      if (isActive) {
        popover.classList.remove('show');
      } else {
        popover.classList.add('show');

        // One-time listener to close on outside click
        const closeHandler = () => {
          popover.classList.remove('show');
          document.removeEventListener('click', closeHandler);
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
      }
    };
  }

  // Also update sidebar if present
  const sidebarContextElement = document.getElementById('sidebarUserContext');
  if (sidebarContextElement) {
    sidebarContextElement.textContent = contextInfo;
  }
}

// Date/Time Functions
function startDateTime() {
  updateDateTime();
  // Update every second
  setInterval(updateDateTime, 1000);
}

function updateDateTime() {
  const now = new Date();
  const locale = localStorage.getItem('locale') || 'ar';

  // Format time (without seconds)
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  const timeStr = now.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', timeOptions);

  // Format date (with numeric month)
  const dateOptions = { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' };
  const dateStr = now.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', dateOptions);

  const timeEl = document.getElementById('currentTime');
  const dateEl = document.getElementById('currentDate');

  if (timeEl) timeEl.textContent = timeStr;
  if (dateEl) dateEl.textContent = dateStr;
}

// Quick Links Functions
async function loadQuickLinks() {
  const container = document.getElementById('quickLinksContainer');
  if (!container) return;

  try {
    const links = await api.quickLinks.getActive();

    if (!links || links.length === 0) {
      container.innerHTML = '<span class="text-slate-500 text-xs">لا توجد روابط سريعة</span>';
      return;
    }

    const linksHTML = links.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener noreferrer" 
         class="quick-link-btn inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-white text-xs font-medium transition-all duration-200 hover:-translate-y-0.5"
         title="${link.name}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        <span class="truncate max-w-[100px] md:max-w-[150px]">${link.name}</span>
      </a>
    `).join('');

    container.innerHTML = linksHTML;
  } catch (error) {
    console.error('Error loading quick links:', error);
    container.innerHTML = '';
  }
}

// Make functions globally available
window.loadQuickLinks = loadQuickLinks;
window.startDateTime = startDateTime;

// Language switcher functionality
function initializeLanguageSwitcher() {
  const switcher = document.getElementById('languageSwitcher');
  const currentLangLabel = document.getElementById('currentLanguage');

  if (!switcher) return;

  // Start session monitoring when header is initialized
  startSessionMonitoring();

  // Update label to show current language
  const updateLanguageLabel = () => {
    const locale = i18n.getCurrentLocale();
    currentLangLabel.textContent = locale === 'ar' ? 'ع' : 'EN';
  };

  // Initial update
  updateLanguageLabel();

  // Handle click
  switcher.addEventListener('click', async () => {
    const currentLocale = i18n.getCurrentLocale();
    const newLocale = currentLocale === 'en' ? 'ar' : 'en';

    await i18n.setLocale(newLocale);
    updateLanguageLabel();

    // Re-render the entire page with new translations
    const user = getCurrentUser();
    if (user && typeof initializeDashboard === 'function') {
      // For dashboard pages, re-initialize
      initializeDashboard();
    } else if (user && document.getElementById('sidebar')) {
      // For other pages with sidebar, re-render sidebar and header
      document.getElementById('sidebar').innerHTML = createSidebar(user);
      const pageTitle = document.querySelector('h1')?.textContent || 'Page';
      document.getElementById('header').innerHTML = createHeader(pageTitle, '');
      initializeLanguageSwitcher();
      i18n.translatePage();
    } else {
      // For login page or pages without sidebar
      i18n.translatePage();
    }
  });

  // Listen for locale changes from other sources
  window.addEventListener('localeChanged', () => {
    updateLanguageLabel();
  });
}

// Load announcement banner if API is available
document.addEventListener('DOMContentLoaded', async () => {
  const headerContainer = document.getElementById('header');
  if (headerContainer && headerContainer.innerHTML) {
    const contextInfo = await loadUserContext();
    const contextElement = document.getElementById('userContext');
    if (contextElement) {
      contextElement.textContent = contextInfo;
    }
    // Also update sidebar if present
    const sidebarContextElement = document.getElementById('sidebarUserContext');
    if (sidebarContextElement) {
      sidebarContextElement.textContent = contextInfo;
    }

    // Initialize language switcher
    initializeLanguageSwitcher();
  }

  // Load announcement banner if API is available
  if (typeof api !== 'undefined' && api.announcements) {
    loadAnnouncementBanner();
  }
});

// Listen for locale changes to refresh the banner text
window.addEventListener('localeChanged', () => {
  if (typeof loadAnnouncementBanner === 'function') {
    loadAnnouncementBanner();
  }
});

// Announcement Banner Functions
async function loadAnnouncementBanner() {
  try {
    const announcement = await api.announcements.getActive();

    if (!announcement) {
      removeAnnouncementBanner();
      return;
    }

    // Determine which text to display based on current language
    const currentLang = localStorage.getItem('locale') || 'ar';
    const text = currentLang === 'ar' ? announcement.textAr : announcement.textEn;

    displayAnnouncementBanner(text, announcement.backgroundColor, announcement.textColor);
  } catch (error) {
    console.error('Error loading announcement:', error);
  }
}

function displayAnnouncementBanner(text, backgroundColor, textColor) {
  let banner = document.getElementById('announcement-banner');

  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'announcement-banner';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    padding: 12px 20px;
    text-align: center;
    font-weight: 500;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    background-color: ${backgroundColor || '#3b82f6'};
    color: ${textColor || '#ffffff'};
  `;

  banner.innerHTML = `<span style="font-size: 1.1em;">📢</span> ${text}`;

  // Adjust body padding
  document.body.style.paddingTop = '46px';
}

function removeAnnouncementBanner() {
  const banner = document.getElementById('announcement-banner');
  if (banner) {
    banner.remove();
    document.body.style.paddingTop = '0';
  }
}

// Make functions globally available
window.loadAnnouncementBanner = loadAnnouncementBanner;
window.displayAnnouncementBanner = displayAnnouncementBanner;
window.removeAnnouncementBanner = removeAnnouncementBanner;
