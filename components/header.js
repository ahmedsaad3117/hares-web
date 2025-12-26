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
  }
});
