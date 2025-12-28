// Header Component
// Displays page title and user info

async function loadUserContext() {
  const user = getCurrentUser();
  let contextInfo = user.roleName;
  
  try {
    // Load institution name if user has one
    if (user.institutionId) {
      const institution = await api.institutions.getById(user.institutionId);
      contextInfo = `${user.roleName} - ${institution.name}`;
    }
    
    // Load branch name if user has one
    if (user.branchId) {
      const branch = await api.branches.getById(user.branchId);
      if (user.institutionId) {
        contextInfo = `${user.roleName} - ${branch.name} & ${branch.institution?.name || 'Institution'}`;
      } else {
        contextInfo = `${user.roleName} - ${branch.name}`;
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
          <div id="userContext" class="text-muted text-sm">${user.roleName}</div>
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

// Render header and load user context
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
});
