// i18n.js - Internationalization module for Q1KEY Platform
// Implements custom vanilla JS i18n solution following research recommendations

class I18nManager {
  constructor() {
    this.currentLocale = 'en';
    this.defaultLocale = 'en';
    this.supportedLocales = ['en', 'ar'];
    this.translations = {};
    this.loadedNamespaces = new Set();
  }

  /**
   * Initialize i18n system - detect language and load translations
   */
  async init() {
    const detectedLocale = this.detectUserLocale();
    await this.setLocale(detectedLocale);
  }

  /**
   * Detect user's preferred locale using cascading strategy:
   * 1. localStorage (user preference)
   * 2. Browser language
   * 3. Default (en)
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
      
      const path = `${basePath}/${locale}.json`;
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

    // Load translations if not already loaded
    if (!this.translations[newLocale]) {
      await this.loadLocale(newLocale);
    }

    // Update current locale
    this.currentLocale = newLocale;

    // Update HTML attributes for RTL/LTR
    document.documentElement.setAttribute('lang', newLocale);
    document.documentElement.setAttribute('dir', newLocale === 'ar' ? 'rtl' : 'ltr');

    // Add/remove RTL class
    if (newLocale === 'ar') {
      document.documentElement.classList.add('rtl');
      // Load RTL stylesheet if not already loaded
      if (!document.getElementById('rtl-styles')) {
        const link = document.createElement('link');
        link.id = 'rtl-styles';
        link.rel = 'stylesheet';
        // Use relative path based on current location
        const cssPath = window.location.pathname.includes('/pages/') ? '../css/rtl.css' : 'css/rtl.css';
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

    // Persist choice
    localStorage.setItem('locale', newLocale);

    // Retranslate page
    this.translatePage();

    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('localeChanged', { detail: { locale: newLocale } }));

    console.log(`Language changed to: ${newLocale}`);
  }

  /**
   * Get translation for a key with optional interpolation
   * @param {string} key - Translation key (supports dot notation: "login.title")
   * @param {object} options - Interpolation values and options
   * @returns {string} Translated text
   */
  t(key, options = {}) {
    const { locale = this.currentLocale, ...interpolations } = options;

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
window.t = function(key, options) {
  return i18n.t(key, options);
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
window.waitForI18n = function() {
  return i18nReadyPromise;
};
