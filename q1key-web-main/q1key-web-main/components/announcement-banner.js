// Announcement Banner Component
// This component displays the active announcement as a banner at the top of all pages

/**
 * Loads and displays the active announcement banner
 */
async function loadAnnouncementBanner() {
    try {
        const announcement = await api.announcements.getActive();

        if (!announcement) {
            // Remove any existing banner if no active announcement
            removeAnnouncementBanner();
            return;
        }

        // Determine which text to display based on current language
        const currentLang = localStorage.getItem('locale') || 'ar';
        const text = currentLang === 'ar' ? announcement.textAr : announcement.textEn;

        // Create or update the banner
        displayAnnouncementBanner(text, announcement.backgroundColor, announcement.textColor);
    } catch (error) {
        console.error('Error loading announcement:', error);
    }
}

// Add event listener for language changes
window.addEventListener('localeChanged', () => {
    loadAnnouncementBanner();
});

/**
 * Displays the announcement banner
 */
function displayAnnouncementBanner(text, backgroundColor, textColor) {
    let banner = document.getElementById('announcement-banner');

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'announcement-banner';
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
        `;
        document.body.insertBefore(banner, document.body.firstChild);

        // Adjust body padding to account for the banner
        document.body.style.paddingTop = '46px';
    }

    banner.style.backgroundColor = backgroundColor || '#3b82f6';
    banner.style.color = textColor || '#ffffff';
    banner.innerHTML = `<span style="font-size: 1.1em;">📢</span> ${text}`;
}

/**
 * Removes the announcement banner
 */
function removeAnnouncementBanner() {
    const banner = document.getElementById('announcement-banner');
    if (banner) {
        banner.remove();
        document.body.style.paddingTop = '0';
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.loadAnnouncementBanner = loadAnnouncementBanner;
    window.displayAnnouncementBanner = displayAnnouncementBanner;
    window.removeAnnouncementBanner = removeAnnouncementBanner;
}
