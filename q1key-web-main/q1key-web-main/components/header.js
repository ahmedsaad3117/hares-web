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

// Session heartbeat - check every 30 seconds if session is still valid
let sessionCheckInterval = null;

function startSessionMonitoring() {
  // Clear any existing interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  // Check session every 30 seconds
  sessionCheckInterval = setInterval(async () => {
    try {
      await api.auth.verifySession();
    } catch (error) {
      // Session is invalid - user logged in elsewhere
      clearInterval(sessionCheckInterval);
      clearAuthData();
      alert('Your session has expired. You have been logged in from another device.');
      window.location.href = '../index.html';
    }
  }, 30000); // 30 seconds
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
    <div class="header">
      <div>
        <h1 class="text-2xl font-bold text-white">${title}</h1>
        ${subtitle ? `<p class="text-secondary text-sm">${subtitle}</p>` : ''}
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Language Switcher -->
        <button id="languageSwitcher" class="language-switcher" title="Switch Language">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span id="currentLanguage">EN</span>
        </button>
        
        <div class="text-right">
          <div class="text-white font-semibold text-sm">${user.name}</div>
          <div id="userContext" class="text-muted text-sm">${translateRole(user.roleName || user.role)}</div>
        </div>
        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px;">
          ${user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </div>
  `;

  return headerHTML;
}

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
