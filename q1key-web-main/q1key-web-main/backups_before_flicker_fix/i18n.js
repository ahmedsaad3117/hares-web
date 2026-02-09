// i18n.js - Internationalization module for Q1KEY Platform
// Implements custom vanilla JS i18n solution following research recommendations

class I18nManager {
  constructor() {
    this.currentLocale = 'ar';
    this.defaultLocale = 'ar';
    this.supportedLocales = ['en', 'ar'];
    this.translations = {};
    this.loadedNamespaces = new Set();

    // Immediately apply direction based on stored preference or default
    // This prevents the "flash" of incorrect direction
    try {
      const stored = localStorage.getItem('locale') || this.defaultLocale;
      this.updateDirection(stored);
    } catch (e) {
      console.warn('Could not access localStorage inside constructor', e);
    }
  }

  /**
   * Initialize i18n system - detect language and load translations
   */
  async init() {
    const detectedLocale = this.detectUserLocale();
    // Ensure direction is applied again just in case
    this.updateDirection(detectedLocale);
    await this.setLocale(detectedLocale);
  }

  /**
   * Detect user's preferred locale using cascading strategy:
   * 1. localStorage (user preference)
   * 2. Browser language
   * 3. Default (ar)
   */
  detectUserLocale() {
    // Check localStorage first (user preference)
    const storedLocale = localStorage.getItem('locale');
    if (storedLocale && this.supportedLocales.includes(storedLocale)) {
      return storedLocale;
    }

    // Check browser language
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // Extract 'ar' from 'ar-SA'

    if (this.supportedLocales.includes(langCode)) {
      return langCode;
    }

    // Fallback to default
    return this.defaultLocale;
  }

  /**
   * Load translation file for a specific locale
   */
  async loadLocale(locale) {
    if (this.translations[locale]) {
      return; // Already loaded
    }

    try {
      // Determine correct path based on current page location
      const currentPath = window.location.pathname;
      const isInPagesFolder = currentPath.includes('/pages/');
      const basePath = isInPagesFolder ? '../i18n' : './i18n';

      const path = `${basePath}/${locale}.json?v=${new Date().getTime()}`;
      console.log(`Attempting to load: ${path}`);

      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load ${locale}.json from ${path}`);
      }

      const data = await response.json();
      this.translations[locale] = data;
      console.log(`✓ Loaded translations for: ${locale}`);
    } catch (error) {
      console.error(`Failed to load locale ${locale}:`, error);

      // If loading non-default locale fails, ensure default is loaded
      if (locale !== this.defaultLocale && !this.translations[this.defaultLocale]) {
        await this.loadLocale(this.defaultLocale);
      }
    }
  }

  /**
   * Change active language
   */
  async setLocale(newLocale) {
    if (!this.supportedLocales.includes(newLocale)) {
      console.warn(`Unsupported locale: ${newLocale}. Falling back to ${this.defaultLocale}`);
      newLocale = this.defaultLocale;
    }

    // 1. Update DOM immediately (fixes flash issue)
    this.updateDirection(newLocale);

    // 2. Load translations if not already loaded
    if (!this.translations[newLocale]) {
      await this.loadLocale(newLocale);
    }

    // 3. Update current locale
    this.currentLocale = newLocale;

    // 4. Persist choice
    localStorage.setItem('locale', newLocale);

    // 5. Retranslate page
    this.translatePage();

    // 6. Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale: newLocale } }));

    console.log(`Language changed to: ${newLocale}`);
  }

  /**
   * Helper to update DOM attributes and CSS based on locale
   */
  updateDirection(locale) {
    // Update HTML attributes for RTL/LTR
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

    // Add/remove RTL class
    if (locale === 'ar') {
      document.documentElement.classList.add('rtl');
      // Load RTL stylesheet if not already loaded
      if (!document.getElementById('rtl-styles')) {
        const link = document.createElement('link');
        link.id = 'rtl-styles';
        link.rel = 'stylesheet';
        // Use relative path based on current location
        const cssPath = (window.location.pathname.includes('/pages/') ? '../css/rtl.css' : 'css/rtl.css') + '?v=' + new Date().getTime();
        link.href = cssPath;
        document.head.appendChild(link);
      }
    } else {
      document.documentElement.classList.remove('rtl');
      // Remove RTL stylesheet
      const rtlStyles = document.getElementById('rtl-styles');
      if (rtlStyles) {
        rtlStyles.remove();
      }
    }
  }

  /**
   * Get translation for a key with optional interpolation
   * @param {string} key - Translation key (supports dot notation: "login.title")
   * @param {object} options - Interpolation values and options
   * @returns {string} Translated text
   */
  t(key, options = {}) {
    const { locale = this.currentLocale, ...interpolations } = options;

    if (!key || typeof key !== 'string') {
      console.warn('i18n.t called with invalid key:', key);
      return '';
    }

    // Get translation from nested structure
    let translation = this.getNestedTranslation(key, locale);

    // Fallback to default locale if not found
    if (!translation && locale !== this.defaultLocale) {
      translation = this.getNestedTranslation(key, this.defaultLocale);
    }

    // Last resort: return key itself
    if (!translation) {
      console.warn(`Missing translation: ${key} [${locale}]`);
      return key;
    }

    // Apply interpolations
    return this.interpolate(translation, interpolations);
  }

  /**
   * Get translation from nested object using dot notation
   */
  getNestedTranslation(key, locale) {
    const parts = key.split('.');
    let current = this.translations[locale];

    for (const part of parts) {
      if (!current || typeof current !== 'object') {
        return null;
      }
      current = current[part];
    }

    return typeof current === 'string' ? current : null;
  }

  /**
   * Replace {placeholders} with values
   */
  interpolate(message, values) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  /**
   * Get current locale
   */
  getCurrentLocale() {
    return this.currentLocale;
  }

  /**
   * Check if current locale is RTL
   */
  isRTL() {
    return this.currentLocale === 'ar';
  }

  /**
   * Translate all elements with data-i18n-key attribute
   */
  translatePage() {
    // Text content
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
      const key = element.getAttribute('data-i18n-key');
      const options = element.getAttribute('data-i18n-opt');
      element.textContent = this.t(key, options ? JSON.parse(options) : {});
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.setAttribute('placeholder', this.t(key));
    });

    // ARIA labels (accessibility)
    document.querySelectorAll('[data-i18n-aria]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria');
      element.setAttribute('aria-label', this.t(key));
    });

    // Titles (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.setAttribute('title', this.t(key));
    });

    // Page Title (Browser Tab)
    const pageTitleKey = document.querySelector('title')?.getAttribute('data-i18n-key');
    if (pageTitleKey) {
      document.title = this.t(pageTitleKey) + ' - Q1KEY Platform';
    }
  }

  /**
   * Translate dynamic data strings based on mapping
   */
  translateData(text) {
    if (!text) return '';
    if (this.currentLocale !== 'ar') return text;

    const normalized = text.trim().toLowerCase();

    // Mapping for known data values to Arabic
    const mapping = {
      'main financial institution': 'المؤسسة المالية الرئيسية',
      'test institution lnline': 'مؤسسة اختبار',
      'test institution inline': 'مؤسسة اختبار',
      'downtown branch': 'فرع وسط البلد',
      'n/a': 'غير متوفر',
      'id:': 'الرقم:'
    };

    return mapping[normalized] || text;
  }

  /**
   * Get list of supported locales
   */
  getSupportedLocales() {
    return [...this.supportedLocales];
  }
}

// Global instance
window.i18n = new I18nManager();
const i18n = window.i18n;

// Convenience function
window.t = function (key, options) {
  return i18n.t(key, options);
};
window.translateData = function (text) {
  return i18n.translateData(text);
};
const t = window.t;

// Initialize immediately and synchronously
let i18nReady = false;
const i18nReadyPromise = i18n.init().then(() => {
  i18nReady = true;
  console.log('✓ i18n system ready');
  console.log('Current locale:', i18n.getCurrentLocale());
  console.log('Available translations:', Object.keys(i18n.translations));
  // Dispatch ready event
  window.dispatchEvent(new CustomEvent('i18nReady'));
}).catch(error => {
  console.error('Failed to initialize i18n:', error);
});

// Helper to wait for i18n to be ready
window.waitForI18n = function () {
  return i18nReadyPromise;
};
