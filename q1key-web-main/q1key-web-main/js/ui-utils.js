/**
 * UI Utilities for Q1KEY Platform
 * Handles meatball menus and deletion modals
 */
(function (global) {
  'use strict';

  console.log('Loading UI Utils...');

  // Simple translation fallback for pages without i18n loaded
  const t = window.t || ((key) => {
    const translations = {
      'help.title': 'المساعدة والدعم',
      'help.contact_whatsapp': 'تواصل عبر واتساب',
      'help.contact_email': 'تواصل عبر البريد الإلكتروني',
      'help.cancel': 'إغلاق',
      'help.no_info': 'معلومات التواصل غير متوفرة حالياً'
    };
    return translations[key] || key;
  });

  // Initialize meatball menu for a page
  function initMeatballMenu() {
    const containers = document.querySelectorAll('.meatball-container');

    containers.forEach(container => {
      // Prevent multiple initializations
      if (container.dataset.initialized === 'true') return;

      const btn = container.querySelector('.meatball-btn');
      const dropdown = container.querySelector('.meatball-dropdown');

      if (!btn || !dropdown) return;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Close all other dropdowns first
        document.querySelectorAll('.meatball-dropdown.show').forEach(d => {
          if (d !== dropdown) d.classList.remove('show');
        });

        dropdown.classList.toggle('show');
      });

      container.dataset.initialized = 'true';
    });

    // Global listener to close dropdowns when clicking outside
    // Only add if not already added
    if (!window._meatballListenerAdded) {
      document.addEventListener('click', (e) => {
        document.querySelectorAll('.meatball-dropdown.show').forEach(dropdown => {
          if (!dropdown.closest('.meatball-container').contains(e.target)) {
            dropdown.classList.remove('show');
          }
        });
      });
      window._meatballListenerAdded = true;
    }
  }

  /**
   * Show a custom deletion modal
   * @param {Object} options 
   * @param {string} options.title - Modal title
   * @param {string} options.itemName - Name of the item to delete
   * @param {string} options.warningText - Warning message
   * @param {Function} options.onConfirm - Callback when confirmed
   */
  function showDeleteModal(options) {
    const { title, itemName, warningText, confirmText, onConfirm } = options;

    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    // Create modal HTML
    const modalHTML = `
    <div class="modal-overlay" id="deleteModal">
      <div class="modal-card">
        <div class="modal-card-header">
          <h3 class="text-xl font-bold text-white">${title || t('common.delete_confirm_title') || 'Confirm Deletion'}</h3>
          <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
        </div>
        <div class="modal-card-body">
          <div class="modal-icon">🗑️</div>
          <p class="delete-warning-text">${warningText || t('common.delete_irreversible_warning') || 'This action is final and cannot be undone.'}</p>
          <span class="item-to-delete">${itemName}</span>
        </div>
        <div class="modal-card-footer">
          <button class="btn btn-secondary" onclick="closeDeleteModal()">${t('common.button.cancel') || 'إلغاء'}</button>
          <button class="btn btn-danger" id="confirmDeleteBtn">
            ${confirmText || t('common.button.confirm_delete') || 'تأكيد الحذف'}
          </button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    // Show modal with animation
    setTimeout(() => modal.classList.add('show'), 10);

    // Handle confirm
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      await onConfirm();
      closeDeleteModal();
    });
  }

  function closeDeleteModal() {
    // Close Delete Modal
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) {
      deleteModal.classList.remove('show');
      setTimeout(() => deleteModal.remove(), 300);
    }

    // Close Help Modal
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.remove('show');
      setTimeout(() => helpModal.remove(), 300);
    }
  }

  // Alias for clarity
  const closeHelpModal = closeDeleteModal;
  window.closeHelpModal = closeHelpModal;

  /**
   * Show a generic confirmation modal
   * @param {Object} options 
   * @param {string} options.title - Modal title
   * @param {string} options.message - Main message text
   * @param {string} options.subMessage - Secondary message/item name
   * @param {string} options.confirmText - Button text
   * @param {Function} options.onConfirm - Callback
   * @param {string} options.icon - Icon character/HTML (default: ✨)
   * @param {string} options.btnClass - Button class (default: btn-primary)
   */
  function showConfirmModal(options) {
    const { title, message, subMessage, confirmText, onConfirm, icon = '✨', btnClass = 'btn-primary' } = options;

    // Determine theme color based on btnClass
    let themeColor = '#ef4444'; // Red (Changed from #6366f1)
    let themeBg = 'rgba(239, 68, 68, 0.1)';
    let themeBorder = 'rgba(239, 68, 68, 0.3)';

    if (btnClass.includes('success')) {
      themeColor = '#10b981'; // Emerald Green
      themeBg = 'rgba(16, 185, 129, 0.1)';
      themeBorder = 'rgba(16, 185, 129, 0.3)';
    } else if (btnClass.includes('danger') || btnClass.includes('error')) {
      themeColor = '#ef4444'; // Red
      themeBg = 'rgba(239, 68, 68, 0.1)';
      themeBorder = 'rgba(239, 68, 68, 0.3)';
    }

    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    const modalHTML = `
    <div class="modal-overlay" id="confirmModal">
      <div class="modal-card">
        <div class="modal-card-header">
          <h3 class="text-xl font-bold text-white">${title}</h3>
          <button class="modal-close" onclick="closeConfirmModal()">&times;</button>
        </div>
        <div class="modal-card-body">
          <div class="modal-icon" style="background: ${themeBg}; color: ${themeColor};">${icon}</div>
          <p class="delete-warning-text" style="color: #e2e8f0;">${message}</p>
          ${subMessage ? `<span class="item-to-delete" style="color: ${themeColor}; border-color: ${themeBorder}; background: ${themeBg};">${subMessage}</span>` : ''}
        </div>
        <div class="modal-card-footer">
          <button class="btn btn-secondary" onclick="closeConfirmModal()">${t('common.button.cancel') || 'إلغاء'}</button>
          <button class="btn ${btnClass}" id="confirmActionBtn">
            ${confirmText || t('common.button.confirm') || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('confirmModal');
    const confirmBtn = document.getElementById('confirmActionBtn');
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.btn-secondary'); // The cancel button

    setTimeout(() => modal.classList.add('show'), 10);

    // Helper to handle closing/cancelling
    const handleCancel = () => {
      if (options.onCancel) options.onCancel();
      closeConfirmModal();
    };

    // Attach handlers
    closeBtn.onclick = handleCancel;
    cancelBtn.onclick = handleCancel;

    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      try {
        await onConfirm();
      } catch (e) {
        console.error(e);
      }
      closeConfirmModal();
    });
  }

  function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  }

  /**
   * Create a WhatsApp link for a given phone number
   * @param {string} phone - Phone number
   * @returns {string|null} - WhatsApp URL or null if invalid
   */
  function createWhatsappLink(phone) {
    if (!phone) return null;

    // Remove non-numeric characters
    let cleanPhone = phone.toString().replace(/\D/g, '');

    // Add country code if missing (assuming SA +966 for now as per context)
    if (cleanPhone.startsWith('05')) {
      cleanPhone = '966' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 9 && cleanPhone.startsWith('5')) {
      cleanPhone = '966' + cleanPhone;
    }

    // Basic validation (at least 10 digits) - Commented out to allow testing/shorter numbers temporarily
    // if (cleanPhone.length < 10) return null;

    return `https://wa.me/${cleanPhone}`;
  }

  /**
   * Open WhatsApp chat for a given number
   * @param {string} phone - Phone number
   */
  function openWhatsapp(phone) {
    const link = createWhatsappLink(phone);
    if (link) {
      window.open(link, '_blank');
    } else {
      alert(t('common.invalid_phone') || 'Invalid phone number');
    }
  }

  // Immediately export WhatsApp functions to global (before any other code runs)
  global.createWhatsappLink = createWhatsappLink;
  global.openWhatsapp = openWhatsapp;

  // Auto-refresh manager
  const refreshManager = {
    intervalId: null,
    isPageVisible: true,
    listeners: []
  };

  // Handle visibility change to pause/resume updates
  document.addEventListener('visibilitychange', () => {
    refreshManager.isPageVisible = !document.hidden;
    if (refreshManager.isPageVisible) {
      // Immediate refresh when becoming visible
      refreshManager.listeners.forEach(callback => callback());
    }
  });

  /**
   * Setup auto-refresh for a page
   * @param {Function} refreshCallback - Function to call to refresh data
   * @param {number} intervalMs - Interval in milliseconds (default 15000)
   */
  function setupAutoRefresh(refreshCallback, intervalMs = 15000) {
    // Register callback
    refreshManager.listeners.push(refreshCallback);

    // Clear existing interval if any (singleton pattern per page load)
    if (refreshManager.intervalId) {
      clearInterval(refreshManager.intervalId);
    }

    // Start polling
    refreshManager.intervalId = setInterval(() => {
      if (refreshManager.isPageVisible) {
        // Check if user is interacting (optional enhancement: pause if mouse down? sticking to simple visibility for now)
        refreshCallback();
      }
    }, intervalMs);

    // Return cleanup function
    return () => {
      clearInterval(refreshManager.intervalId);
      refreshManager.listeners = refreshManager.listeners.filter(cb => cb !== refreshCallback);
    };
  }

  /**
   * Open Help/Support Modal
   */
  /**
   * Open Help/Support Modal
   */
  async function openHelpModal() {
    console.log('openHelpModal called');
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      // Ignore error if not logged in
    }

    const isSuperAdmin = user && user.roleName === 'Super Admin';

    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();

    // Load current settings
    let supportInfo = { whatsapp: '', email: '' };
    try {
      supportInfo = await window.api.settings.getSupportInfo();
    } catch (error) {
      console.error('Failed to load support info', error);
    }

    // Create Modal Content based on Role
    let modalContent = '';

    if (isSuperAdmin) {
      // Super Admin: Edit Form
      modalContent = `
      <div class="form-group mb-4">
        <label class="label">${t('help.whatsapp_label')}</label>
        <input type="text" id="supportWhatsapp" class="input" value="${supportInfo.whatsapp || ''}" placeholder="e.g. 966500000000">
        <p class="text-xs text-secondary mt-1">${t('help.whatsapp_format')}</p>
      </div>
      <div class="form-group mb-4">
        <label class="label">${t('help.email_label')}</label>
        <input type="email" id="supportEmail" class="input" value="${supportInfo.email || ''}" placeholder="support@domain.com">
      </div>
    `;
    } else {
      // Others: Contact Buttons
      modalContent = `
      <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0;">
        ${supportInfo.whatsapp ? `
          <a href="https://wa.me/${supportInfo.whatsapp}" target="_blank" class="btn btn-whatsapp" style="justify-content: center; width: 100%; padding: 1rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            ${t('help.contact_whatsapp')}
          </a>
        ` : ''}
        
        ${supportInfo.email ? `
          <a href="mailto:${supportInfo.email}" class="btn btn-primary" style="justify-content: center; width: 100%; padding: 1rem;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            ${t('help.contact_email')}
          </a>
        ` : ''}

        ${!supportInfo.whatsapp && !supportInfo.email ? `<p class="text-center text-muted">${t('help.no_info')}</p>` : ''}
      </div>
    `;
    }

    // Construct Full Modal
    const modalHTML = `
    <div class="modal-overlay" id="helpModal">
      <div class="modal-card">
        <div class="modal-card-header">
          <h3 class="text-xl font-bold text-white">${isSuperAdmin ? t('help.manage_title') : t('help.title')}</h3>
          <button class="modal-close" onclick="closeDeleteModal()">&times;</button>
        </div>
        <div class="modal-card-body">
          ${modalContent}
        </div>
        <div class="modal-card-footer">
          <button class="btn btn-secondary" onclick="closeDeleteModal()">${t('help.cancel')}</button>
          ${isSuperAdmin ? `<button class="btn btn-primary" id="saveSupportBtn" onclick="saveSupportSettings()">${t('help.save')}</button>` : ''}
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('helpModal');
    setTimeout(() => modal.classList.add('show'), 10);
  }

  /**
   * Handle saving support settings
   */
  async function saveSupportSettings() {
    const wa = document.getElementById('supportWhatsapp').value.trim();
    const em = document.getElementById('supportEmail').value.trim();

    showConfirmModal({
      title: t('help.save_settings') || 'حفظ الإعدادات',
      message: t('help.save_confirm_msg') || 'هل أنت متأكد من حفظ تغييرات بيانات التواصل؟',
      confirmText: t('common.button.save') || 'حفظ',
      icon: '💾',
      btnClass: 'btn-primary',
      onConfirm: async () => {
        try {
          console.log('Saving support info:', { whatsapp: wa, email: em });
          await window.api.settings.updateSupportInfo({ whatsapp: wa, email: em });
          showToast(t('common.message.success') || 'تم التحديث بنجاح', 'success');

          // Force close Help Modal
          const modal = document.getElementById('helpModal');
          if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
          }
        } catch (error) {
          console.error('Save error:', error);
          showToast(t('common.message.error') + ': ' + (error.message || 'Unknown error.'), 'error');
          throw error;
        }
      }
    });
  }

  /**
   * Toggle Sidebar for Mobile
   */
  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const body = document.body;

    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle('open');
    body.classList.toggle('menu-open', isOpen);

    // Manage Overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.onclick = toggleSidebar;
      document.body.appendChild(overlay);
    }

    if (isOpen) {
      overlay.classList.add('show');
    } else {
      overlay.classList.remove('show');
    }
  }

  /**
   * Debounce function to limit the rate at which a function can fire
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   */
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

  // Export functions to global scope
  try {
    global.initMeatballMenu = initMeatballMenu;
    global.showDeleteModal = showDeleteModal;
    global.closeDeleteModal = closeDeleteModal;
    global.showConfirmModal = showConfirmModal;
    global.closeConfirmModal = closeConfirmModal;
    global.createWhatsappLink = createWhatsappLink;
    global.openWhatsapp = openWhatsapp;
    global.setupAutoRefresh = setupAutoRefresh;
    global.openHelpModal = openHelpModal;
    global.toggleSidebar = toggleSidebar;
    global.t = t; // Ensure translation fallback is global
    global.saveSupportSettings = saveSupportSettings;
    global.debounce = debounce;

    console.log('UI Utils loaded successfully');
  } catch (e) {
    console.error('Error exporting UI Utils:', e);
  }

})(typeof window !== 'undefined' ? window : this);
