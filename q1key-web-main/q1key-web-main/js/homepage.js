/**
 * Q1KEY Homepage - Modern UI JavaScript
 * New implementation from scratch - 2024
 * 
 * Features:
 * - Dynamic content loading from API
 * - Bilingual support (AR/EN)
 * - Integration with existing login system
 * - Integration with existing subscription system
 */

// ============================================== //
//                 CONFIGURATION                  //
// ============================================== //

let currentLang = localStorage.getItem('locale') || 'ar';
let homepageData = null;
let subscriptionPlans = [];

// ============================================== //
//               INITIALIZATION                   //
// ============================================== //

document.addEventListener('DOMContentLoaded', () => {
    initializeHomepage();
});

async function initializeHomepage() {
    // Set language attributes
    updateLanguageDirection();

    // Load data from API
    await loadHomepageData();

    // Render content
    renderPage();

    // Setup event listeners
    setupEventListeners();

    // Update all text content based on language
    updateAllTexts();
}

// ============================================== //
//                DATA LOADING                    //
// ============================================== //

async function loadHomepageData() {
    try {
        // Load homepage settings and plans in parallel using unified API
        const [pageResponse, plans] = await Promise.all([
            window.publicApiRequest('/homepage/public').catch(() => null),
            api.subscriptions.getActivePlans().catch(() => [])
        ]);

        homepageData = pageResponse;
        subscriptionPlans = plans || [];
    } catch (error) {
        console.error('Error loading homepage data:', error);
        homepageData = null;
        subscriptionPlans = [];
    }
}

// ============================================== //
//                PAGE RENDERING                  //
// ============================================== //

function renderPage() {
    const isAr = currentLang === 'ar';

    // Render Header Links
    renderHeaderLinks(isAr);

    // Render Features
    renderFeatures(isAr);

    // Render Plans
    renderPlans(isAr);

    // Render Contact Cards
    renderContactCards(isAr);

    // Render Footer Links
    renderFooterLinks(isAr);

    // Render Plan Selector in Modal
    renderPlanSelector(isAr);
}

// ---------- Header Links ---------- //
function renderHeaderLinks(isAr) {
    const container = document.getElementById('headerNav');
    if (!container) return;

    const quickLinks = homepageData?.footer?.quickLinks || [];

    // If we have custom links, use them. Otherwise, build from sections
    if (quickLinks.length > 0) {
        container.innerHTML = quickLinks.map(link => `
            <a href="${link.url}" class="nav-link">${isAr ? (link.titleAr || link.textAr) : (link.titleEn || link.textEn)}</a>
        `).join('');
    } else {
        // Fallback to section-based links with visibility checks
        const links = [
            { id: 'hero', url: '#hero', textAr: 'الرئيسية', textEn: 'Home', visible: true },
            { id: 'features', url: '#features', textAr: 'المميزات', textEn: 'Features', visible: homepageData?.features?.visible !== false },
            { id: 'plans', url: '#plans', textAr: 'الباقات', textEn: 'Plans', visible: homepageData?.plans?.visible !== false },
            { id: 'about', url: '#about', textAr: 'من نحن', textEn: 'About', visible: homepageData?.about?.visible !== false },
            { id: 'contact', url: '#contact', textAr: 'تواصل معنا', textEn: 'Contact', visible: homepageData?.contact?.visible !== false }
        ];

        container.innerHTML = links
            .filter(l => l.visible)
            .map(l => `<a href="${l.url}" class="nav-link">${isAr ? l.textAr : l.textEn}</a>`)
            .join('');
    }
}

// ---------- Features Section ---------- //
function renderFeatures(isAr) {
    const grid = document.getElementById('featuresGrid');
    if (!grid) return;

    const defaultFeatures = [
        {
            icon: '📊',
            titleAr: 'إدارة القروض',
            titleEn: 'Loan Management',
            descAr: 'تتبع وإدارة جميع القروض والأقساط بكل سهولة',
            descEn: 'Track and manage all loans and installments easily'
        },
        {
            icon: '👥',
            titleAr: 'إدارة العملاء',
            titleEn: 'Customer Management',
            descAr: 'قاعدة بيانات متكاملة لإدارة بيانات العملاء',
            descEn: 'Integrated database for customer data management'
        },
        {
            icon: '🏢',
            titleAr: 'إدارة الفروع',
            titleEn: 'Branch Management',
            descAr: 'تحكم كامل بجميع فروع المؤسسة من مكان واحد',
            descEn: 'Full control over all branches from one place'
        },
        {
            icon: '📈',
            titleAr: 'تقارير متقدمة',
            titleEn: 'Advanced Reports',
            descAr: 'تقارير مالية وإحصائية شاملة لاتخاذ قرارات أفضل',
            descEn: 'Comprehensive financial and statistical reports'
        },
        {
            icon: '🔒',
            titleAr: 'أمان عالي',
            titleEn: 'High Security',
            descAr: 'حماية متقدمة للبيانات وفقاً لأعلى المعايير',
            descEn: 'Advanced data protection with highest standards'
        },
        {
            icon: '📱',
            titleAr: 'متوافق مع الجوال',
            titleEn: 'Mobile Compatible',
            descAr: 'واجهة متجاوبة تعمل على جميع الأجهزة',
            descEn: 'Responsive interface works on all devices'
        }
    ];

    const features = homepageData?.features?.items?.length > 0
        ? homepageData.features.items
        : defaultFeatures;

    grid.innerHTML = features.map(f => `
        <div class="feature-card">
            <div class="feature-icon">${f.icon || f.iconAr || '✨'}</div>
            <h3 class="feature-title">${isAr ? (f.titleAr || f.title) : (f.titleEn || f.title)}</h3>
            <p class="feature-desc">${isAr ? (f.descAr || f.desc) : (f.descEn || f.desc)}</p>
        </div>
    `).join('');
}

// ---------- Plans Section ---------- //
function renderPlans(isAr) {
    const grid = document.getElementById('plansGrid');
    if (!grid) return;

    if (!subscriptionPlans || subscriptionPlans.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 2rem; color: var(--text-muted);">
                ${isAr ? 'لا توجد باقات متاحة حالياً' : 'No plans available'}
            </div>
        `;
        return;
    }

    // Find middle plan to mark as popular
    const popularIndex = Math.floor(subscriptionPlans.length / 2);

    grid.innerHTML = subscriptionPlans.map((plan, i) => {
        const isPopular = i === popularIndex && subscriptionPlans.length > 1;
        const badgeText = isAr ? 'الأكثر شيوعاً' : 'Most Popular';

        return `
            <div class="plan-card ${isPopular ? 'popular' : ''}">
                ${isPopular ? `<div class="plan-badge">${badgeText}</div>` : ''}
                <h3 class="plan-name">${isAr ? (plan.nameAr || plan.name) : (plan.nameEn || plan.name)}</h3>
                <p class="plan-duration">${plan.durationMonths} ${isAr ? 'شهر' : 'Months'}</p>
                <div class="plan-price">
                    ${plan.price}
                    <span class="currency">${isAr ? 'ر.س' : 'SAR'}</span>
                </div>
                <button class="plan-btn" onclick="openSubscribeModalWithPlan(${plan.id})">
                    ${isAr ? 'اشترك الآن' : 'Subscribe Now'}
                </button>
            </div>
        `;
    }).join('');
}

// ---------- Contact Cards ---------- //
function renderContactCards(isAr) {
    const container = document.getElementById('contactCards');
    if (!container) return;

    const whatsapp = homepageData?.contact?.whatsappNumber || '+966500000000';
    const email = homepageData?.contact?.supportEmail || 'support@q1key.com';

    container.innerHTML = `
        <a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" class="contact-card" target="_blank">
            <div class="contact-icon" style="background: rgba(37, 211, 102, 0.15); color: #25D366;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
            </div>
            <div class="contact-info">
                <h4>${isAr ? 'واتساب' : 'WhatsApp'}</h4>
                <p>${whatsapp}</p>
            </div>
        </a>
        <a href="mailto:${email}" class="contact-card">
            <div class="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
            </div>
            <div class="contact-info">
                <h4>${isAr ? 'البريد الإلكتروني' : 'Email'}</h4>
                <p>${email}</p>
            </div>
        </a>
    `;
}

// ---------- Footer Links ---------- //
function renderFooterLinks(isAr) {
    const container = document.getElementById('footerLinks');
    if (!container) return;

    const quickLinks = homepageData?.footer?.quickLinks || [];

    const defaultLinks = [
        { textAr: 'المميزات', textEn: 'Features', url: '#features' },
        { textAr: 'الباقات', textEn: 'Plans', url: '#plans' },
        { textAr: 'من نحن', textEn: 'About', url: '#about' },
        { textAr: 'تواصل معنا', textEn: 'Contact', url: '#contact' }
    ];

    const links = quickLinks.length > 0 ? quickLinks : defaultLinks;

    container.innerHTML = links.map(link => `
        <a href="${link.url}">${isAr ? (link.titleAr || link.textAr) : (link.titleEn || link.textEn)}</a>
    `).join('');
}

// ---------- Plan Selector in Modal ---------- //
function renderPlanSelector(isAr) {
    const container = document.getElementById('planSelector');
    if (!container) return;

    if (!subscriptionPlans || subscriptionPlans.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">${isAr ? 'جاري تحميل الباقات...' : 'Loading plans...'}</p>`;
        return;
    }

    container.innerHTML = subscriptionPlans.map((plan, i) => `
        <label class="plan-option ${i === 0 ? 'selected' : ''}" onclick="selectPlanOption(this, ${plan.id})">
            <input type="radio" name="selectedPlan" value="${plan.id}" ${i === 0 ? 'checked' : ''}>
            <div class="plan-option-duration">${plan.durationMonths} ${isAr ? 'شهر' : 'Mo'}</div>
            <div class="plan-option-price">${plan.price} ${isAr ? 'ر.س' : 'SAR'}</div>
        </label>
    `).join('');
}

function selectPlanOption(element, planId) {
    document.querySelectorAll('.plan-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// ============================================== //
//              LANGUAGE MANAGEMENT               //
// ============================================== //

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('locale', currentLang);
    updateLanguageDirection();
    updateAllTexts();
    renderPage();
}

function updateLanguageDirection() {
    document.documentElement.setAttribute('lang', currentLang);
    document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
}

function updateAllTexts() {
    const isAr = currentLang === 'ar';

    // Update language toggle button
    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = isAr ? 'EN' : 'ع';

    // 1. Update Hero Section from homepageData
    if (homepageData?.hero) {
        const titleEl = document.getElementById('heroTitle');
        if (titleEl) {
            const title = isAr ? homepageData.hero.titleAr : homepageData.hero.titleEn;
            if (title) {
                // Keep the Q1KEY gradient span if present
                const gradientSpan = titleEl.querySelector('.text-gradient');
                if (gradientSpan) {
                    const parts = title.split('Q1Key') || title.split('Q1KEY');
                    if (parts.length > 1) {
                        titleEl.innerHTML = `<span>${parts[0]}</span> <span class="text-gradient">Q1KEY</span> <span>${parts[1]}</span>`;
                    } else {
                        titleEl.textContent = title;
                    }
                } else {
                    titleEl.textContent = title;
                }
            }
        }
        const subtitleEl = document.getElementById('heroSubtitle');
        if (subtitleEl) {
            const subtitle = isAr ? homepageData.hero.subtitleAr : homepageData.hero.subtitleEn;
            if (subtitle) subtitleEl.textContent = subtitle;
        }
    }

    // 2. Update Main Action Buttons
    if (homepageData?.buttons) {
        // Login Button
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.style.display = homepageData.buttons.login?.visible ? 'inline-flex' : 'none';
            const btnText = isAr ? homepageData.buttons.login?.textAr : homepageData.buttons.login?.textEn;
            if (btnText) loginBtn.querySelector('span').textContent = btnText;
        }

        // Register Button
        const subscribeBtn = document.getElementById('subscribeBtn');
        const heroSubscribeBtn = document.getElementById('heroSubscribeBtn');
        const isVisible = homepageData.buttons.register?.visible;

        if (subscribeBtn) subscribeBtn.style.display = isVisible ? 'inline-flex' : 'none';
        if (heroSubscribeBtn) heroSubscribeBtn.style.display = isVisible ? 'inline-flex' : 'none';

        const regText = isAr ? homepageData.buttons.register?.textAr : homepageData.buttons.register?.textEn;
        if (regText) {
            if (subscribeBtn) subscribeBtn.querySelector('span').textContent = regText;
            if (heroSubscribeBtn) heroSubscribeBtn.querySelector('span').textContent = regText;
        }
    }

    // 3. Update Sections Visibility & Titles
    if (homepageData?.features) {
        const sec = document.getElementById('features');
        if (sec) sec.style.display = homepageData.features.visible ? 'block' : 'none';
        const title = document.getElementById('featuresTitle');
        if (title) title.textContent = isAr ? homepageData.features.titleAr : homepageData.features.titleEn;
    }

    if (homepageData?.plans) {
        const sec = document.getElementById('plans');
        if (sec) sec.style.display = homepageData.plans.visible ? 'block' : 'none';
        const title = document.getElementById('plansTitle');
        if (title) title.textContent = isAr ? homepageData.plans.titleAr : homepageData.plans.titleEn;
    }

    if (homepageData?.about) {
        const sec = document.getElementById('about');
        if (sec) sec.style.display = homepageData.about.visible ? 'block' : 'none';
        const title = document.getElementById('aboutTitle');
        if (title) title.textContent = isAr ? homepageData.about.titleAr : homepageData.about.titleEn;
        const text = document.getElementById('aboutText');
        if (text) text.textContent = isAr ? homepageData.about.contentAr : homepageData.about.contentEn;
    }

    if (homepageData?.contact) {
        const sec = document.getElementById('contact');
        if (sec) sec.style.display = homepageData.contact.visible ? 'block' : 'none';
        const title = document.getElementById('contactTitle');
        if (title) title.textContent = isAr ? homepageData.contact.titleAr : homepageData.contact.titleEn;
    }

    // 4. Update Footer Links & Text
    if (homepageData?.footer) {
        const footerText = document.getElementById('footerCopyright');
        if (footerText) {
            footerText.textContent = isAr ? homepageData.footer.textAr : homepageData.footer.textEn;
        }
    }

    // fallback: Update all other elements with data-text-ar and data-text-en attributes
    document.querySelectorAll('[data-text-ar][data-text-en]').forEach(el => {
        const text = isAr ? el.getAttribute('data-text-ar') : el.getAttribute('data-text-en');
        if (text) {
            const requiredStar = el.querySelector('.required-star');
            if (requiredStar) {
                el.childNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        node.textContent = text + ' ';
                    }
                });
            } else if (!el.id || !['heroTitle', 'heroSubtitle', 'featuresTitle', 'plansTitle', 'aboutTitle', 'aboutText', 'contactTitle'].includes(el.id)) {
                el.textContent = text;
            }
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-placeholder-ar][data-placeholder-en]').forEach(el => {
        const placeholder = isAr ? el.getAttribute('data-placeholder-ar') : el.getAttribute('data-placeholder-en');
        if (placeholder) {
            el.setAttribute('placeholder', placeholder);
        }
    });
}

// ============================================== //
//              MODAL MANAGEMENT                  //
// ============================================== //

// ---------- Login Modal ---------- //
function openLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus on first input
    setTimeout(() => {
        document.getElementById('loginIdentifier')?.focus();
    }, 100);
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Reset form
    document.getElementById('loginForm')?.reset();
    document.getElementById('loginError')?.classList.remove('visible');

    // Reset button state
    const btn = document.getElementById('loginSubmitBtn');
    if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

function toggleLoginPassword() {
    const input = document.getElementById('loginPassword');
    const icon = document.getElementById('loginEyeIcon');

    if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
        input.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const isAr = currentLang === 'ar';
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    // Validate
    if (!identifier || !password) {
        showError(errorDiv, isAr ? 'يرجى إدخال جميع البيانات' : 'Please fill all fields');
        return;
    }

    // Show loading
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    hideError(errorDiv);

    try {
        // Use existing login API with a safety timeout
        const loginPromise = api.auth.login({ identifier, password });
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 10000)
        );

        const response = await Promise.race([loginPromise, timeoutPromise]);

        if (response?.access_token) {
            saveAuthData(response.access_token, response.user, response.refresh_token);

            const user = response.user;
            const isExpired = user.roleName !== 'Super Admin' && isSubscriptionExpired(user.expirationDate);

            if (isExpired) {
                window.location.href = 'pages/my-subscription.html';
            } else {
                window.location.href = 'pages/dashboard.html';
            }
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Login Error details:', error);

        const errorMessage = error.message || '';

        // ترجمة رسائل الخطأ من الـ Backend للعربية
        const translateError = (msg) => {
            if (!isAr) return msg;

            const translations = {
                'Invalid credentials': 'بيانات الدخول غير صحيحة (البريد الإلكتروني أو كلمة المرور)',
                'Account is deactivated': 'الحساب معطّل. يرجى التواصل مع الإدارة',
                'User not found': 'المستخدم غير موجود في النظام',
                'Invalid password': 'كلمة المرور غير صحيحة',
                'Session expired': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
                'Session expired or terminated by administrator': 'تم إنهاء الجلسة من قبل المسؤول أو انتهت صلاحيتها',
                'Invalid or expired refresh token': 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
                'Unauthorized': 'غير مصرح لك بالدخول',
                'Invalid response': 'استجابة غير صالحة من الخادم'
            };

            // البحث عن ترجمة مطابقة
            for (const [en, ar] of Object.entries(translations)) {
                if (msg.toLowerCase().includes(en.toLowerCase())) {
                    return ar;
                }
            }
            return msg;
        };

        // Handle subscription expired error
        if (errorMessage.includes('SUBSCRIPTION_EXPIRED')) {
            showError(errorDiv, isAr
                ? '⚠️ انتهى اشتراك المؤسسة/الفرع. يرجى التواصل مع الإدارة لتجديد الاشتراك قبل تسجيل الدخول.'
                : '⚠️ Institution/Branch subscription has expired. Please contact admin to renew your subscription before logging in.');
        } else if (errorMessage.includes('ACTIVE_SESSION_EXISTS') || errorMessage.includes('ALREADY_LOGGED_IN')) {
            showError(errorDiv, isAr
                ? '🔒 يوجد هناك جهاز نشط، يجب تسجيل الخروج من الجهاز الآخر أو الانتظار لمدة 15 دقيقة.'
                : '🔒 An active session exists. Please logout from the other device or wait for 15 minutes of inactivity.');
        } else if (errorMessage === 'TIMEOUT' || errorMessage.includes('Failed to fetch')) {
            showError(errorDiv, isAr
                ? '🌐 خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً.'
                : 'Server connection error, please check your connection');
        } else if (errorMessage.includes('Invalid credentials') || errorMessage.includes('Invalid password')) {
            showError(errorDiv, isAr
                ? '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة'
                : 'Invalid email or password');
        } else if (errorMessage.includes('deactivated') || errorMessage.includes('معطّل')) {
            showError(errorDiv, isAr
                ? '🚫 الحساب معطّل. يرجى التواصل مع الإدارة لتفعيل حسابك.'
                : 'Account is deactivated. Please contact admin to activate your account.');
        } else if (errorMessage.includes('not found')) {
            showError(errorDiv, isAr
                ? '❓ المستخدم غير موجود. يرجى التأكد من البريد الإلكتروني أو رقم الهاتف.'
                : 'User not found. Please check your email or phone number.');
        } else if (errorMessage) {
            // ترجمة الرسالة إذا كانت عربية
            const translatedMsg = translateError(errorMessage);
            showError(errorDiv, isAr
                ? `❌ ${translatedMsg}`
                : `Login failed: ${errorMessage}`);
        } else {
            showError(errorDiv, isAr
                ? '❌ فشل تسجيل الدخول. يرجى التأكد من البيانات والمحاولة مجدداً.'
                : 'Login failed: Invalid credentials');
        }
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// ---------- Subscribe Modal ---------- //
function openSubscribeModal() {
    const modal = document.getElementById('subscribeModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset to form view
    document.getElementById('subscribeFormView').style.display = 'block';
    document.getElementById('subscribeSuccessView').style.display = 'none';

    // Re-render plan selector
    renderPlanSelector(currentLang === 'ar');
}

function openSubscribeModalWithPlan(planId) {
    openSubscribeModal();

    // Select the specified plan
    setTimeout(() => {
        const radio = document.querySelector(`input[name="selectedPlan"][value="${planId}"]`);
        if (radio) {
            radio.checked = true;
            document.querySelectorAll('.plan-option').forEach(el => el.classList.remove('selected'));
            radio.closest('.plan-option')?.classList.add('selected');
        }
    }, 100);
}

function closeSubscribeModal() {
    const modal = document.getElementById('subscribeModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Reset form
    document.getElementById('subscribeForm')?.reset();
    document.getElementById('subscribeError')?.classList.remove('visible');

    // Reset button state
    const btn = document.getElementById('subscribeSubmitBtn');
    if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

async function handleSubscribe(event) {
    event.preventDefault();

    const isAr = currentLang === 'ar';
    const errorDiv = document.getElementById('subscribeError');
    const submitBtn = document.getElementById('subscribeSubmitBtn');

    // Get form values
    const planId = document.querySelector('input[name="selectedPlan"]:checked')?.value;
    const adminName = document.getElementById('subAdminName').value.trim();
    const adminEmail = document.getElementById('subAdminEmail').value.trim();
    const adminPhone = document.getElementById('subAdminPhone').value.trim();
    const adminPassword = document.getElementById('subAdminPassword').value;
    const instName = document.getElementById('subInstName').value.trim();
    const instTaxId = document.getElementById('subInstTaxId').value.trim();
    const instPhone = document.getElementById('subInstPhone').value.trim();
    const instEmail = document.getElementById('subInstEmail').value.trim();
    const adminNationalId = document.getElementById('subAdminNationalId').value.trim();

    // Validate
    if (!planId) {
        showError(errorDiv, isAr ? 'يرجى اختيار باقة' : 'Please select a plan');
        return;
    }

    if (!adminName || !adminEmail || !adminPhone || !adminPassword || !adminNationalId) {
        showError(errorDiv, isAr ? 'يرجى إدخال جميع بيانات المدير بما في ذلك رقم الهوية' : 'Please fill all admin details including National ID');
        return;
    }

    if (!instName || !instTaxId || !instPhone || !instEmail) {
        showError(errorDiv, isAr ? 'يرجى إدخال جميع بيانات المؤسسة' : 'Please fill all institution details');
        return;
    }

    if (adminPassword.length < 6) {
        showError(errorDiv, isAr ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
        return;
    }

    // Show loading
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    hideError(errorDiv);

    try {
        // Check if tax ID exists using unified API
        const taxIdCheck = await window.publicApiRequest(`/institutions/check-tax-id/${encodeURIComponent(instTaxId)}`)
            .catch(() => ({ exists: false }));

        if (taxIdCheck.exists) {
            showError(errorDiv, isAr ? 'السجل التجاري مسجل مسبقاً في النظام، يرجى التواصل مع الدعم الفني' : 'Commercial registration already exists in the system. Please contact technical support');
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            return;
        }

        // Submit subscription request using unified API
        const result = await window.publicApiRequest('/institutions/subscribe', {
            method: 'POST',
            body: JSON.stringify({
                name: instName,
                taxId: instTaxId,
                phoneNumber: instPhone,
                email: instEmail,
                planId: parseInt(planId),
                adminName,
                adminEmail,
                adminPhoneNumber: adminPhone,
                adminPassword,
                adminNationalId,
                adminIsActive: true,
                isActive: true,
                maxUsers: 1,
                canCreateBranches: true
            })
        });

        // Get selected plan price
        const selectedPlanOption = document.querySelector('input[name="selectedPlan"]:checked');
        const planPrice = selectedPlanOption?.closest('.plan-option')?.querySelector('.plan-option-price')?.textContent || '0.00 ر.س';

        // Update success view with request details
        const requestId = result.id || result.requestId || Math.floor(Math.random() * 10000);
        document.getElementById('requestNumberValue').textContent = `#${requestId}`;
        document.getElementById('requestAmountValue').textContent = planPrice;

        // Set WhatsApp button link with support number
        const whatsappNumber = homepageData?.contact?.whatsappNumber || '966500000000';
        const whatsappMessage = encodeURIComponent(isAr
            ? `مرحباً، أرغب في تأكيد طلب الاشتراك رقم #${requestId}. تم تحويل المبلغ وأرغب في إرسال إيصال التحويل.`
            : `Hello, I want to confirm subscription request #${requestId}. I have transferred the amount and want to send the transfer receipt.`
        );
        document.getElementById('whatsappBtn').href = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

        // Show success view
        document.getElementById('subscribeFormView').style.display = 'none';
        document.getElementById('subscribeSuccessView').style.display = 'block';

        // Update success text for current language
        updateAllTexts();

    } catch (error) {
        showError(errorDiv, error.message || (isAr ? 'حدث خطأ، يرجى المحاولة لاحقاً' : 'An error occurred, please try again'));
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// ============================================== //
//              HELPER FUNCTIONS                  //
// ============================================== //

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.classList.add('visible');
    }
}

function hideError(element) {
    if (element) {
        element.classList.remove('visible');
    }
}

// ============================================== //
//              EVENT LISTENERS                   //
// ============================================== //

function setupEventListeners() {
    // Close modals on overlay click
    document.getElementById('loginModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeLoginModal();
        }
    });

    document.getElementById('subscribeModal')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeSubscribeModal();
        }
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLoginModal();
            closeSubscribeModal();
        }
    });

    // Header scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            header?.classList.add('scrolled');
        } else {
            header?.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });
}

// Mobile menu toggle (placeholder - can be expanded)
function toggleMobileMenu() {
    // TODO: Implement mobile menu toggle
    console.log('Mobile menu toggle');
}
