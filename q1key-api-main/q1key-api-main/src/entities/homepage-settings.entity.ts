import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

/**
 * HomePage Settings Entity
 * Stores dynamic content for the public homepage
 */
@Entity('homepage_settings')
export class HomePageSettings {
    @PrimaryGeneratedColumn()
    id: number;

    // Hero Section
    @Column({ name: 'hero_title_ar', type: 'text', default: 'منصة Q1Key لإدارة القروض' })
    heroTitleAr: string;

    @Column({ name: 'hero_title_en', type: 'text', default: 'Q1Key Loan Management Platform' })
    heroTitleEn: string;

    @Column({ name: 'hero_subtitle_ar', type: 'text', default: 'الحل الأمثل لإدارة مؤسستك المالية' })
    heroSubtitleAr: string;

    @Column({ name: 'hero_subtitle_en', type: 'text', default: 'The Ultimate Solution for Managing Your Financial Institution' })
    heroSubtitleEn: string;

    @Column({ name: 'hero_image_url', type: 'text', nullable: true })
    heroImageUrl: string;

    @Column({ name: 'hero_video_url', type: 'text', nullable: true })
    heroVideoUrl: string;

    @Column({ name: 'hero_background_type', type: 'varchar', length: 20, default: 'gradient' })
    heroBackgroundType: string; // 'gradient', 'image', 'video'

    // Buttons
    @Column({ name: 'login_button_text_ar', type: 'varchar', length: 100, default: 'تسجيل الدخول' })
    loginButtonTextAr: string;

    @Column({ name: 'login_button_text_en', type: 'varchar', length: 100, default: 'Login' })
    loginButtonTextEn: string;

    @Column({ name: 'login_button_visible', default: true })
    loginButtonVisible: boolean;

    @Column({ name: 'register_button_text_ar', type: 'varchar', length: 100, default: 'اشترك معنا' })
    registerButtonTextAr: string;

    @Column({ name: 'register_button_text_en', type: 'varchar', length: 100, default: 'Subscribe Now' })
    registerButtonTextEn: string;

    @Column({ name: 'register_button_visible', default: true })
    registerButtonVisible: boolean;

    // Features Section
    @Column({ name: 'features_section_visible', default: true })
    featuresSectionVisible: boolean;

    @Column({ name: 'features_title_ar', type: 'varchar', length: 200, default: 'مميزات المنصة' })
    featuresTitleAr: string;

    @Column({ name: 'features_title_en', type: 'varchar', length: 200, default: 'Platform Features' })
    featuresTitleEn: string;

    @Column({ name: 'features_data', type: 'text', nullable: true })
    featuresData: string; // JSON array of features

    // Plans Section
    @Column({ name: 'plans_section_visible', default: true })
    plansSectionVisible: boolean;

    @Column({ name: 'plans_title_ar', type: 'varchar', length: 200, default: 'باقات الاشتراك' })
    plansTitleAr: string;

    @Column({ name: 'plans_title_en', type: 'varchar', length: 200, default: 'Subscription Plans' })
    plansTitleEn: string;

    // About Section
    @Column({ name: 'about_section_visible', default: true })
    aboutSectionVisible: boolean;

    @Column({ name: 'about_title_ar', type: 'varchar', length: 200, default: 'من نحن' })
    aboutTitleAr: string;

    @Column({ name: 'about_title_en', type: 'varchar', length: 200, default: 'About Us' })
    aboutTitleEn: string;

    @Column({ name: 'about_content_ar', type: 'text', nullable: true })
    aboutContentAr: string;

    @Column({ name: 'about_content_en', type: 'text', nullable: true })
    aboutContentEn: string;

    @Column({ name: 'about_image_url', type: 'text', nullable: true })
    aboutImageUrl: string;

    // Contact Section
    @Column({ name: 'contact_section_visible', default: true })
    contactSectionVisible: boolean;

    @Column({ name: 'contact_title_ar', type: 'varchar', length: 200, default: 'تواصل معنا' })
    contactTitleAr: string;

    @Column({ name: 'contact_title_en', type: 'varchar', length: 200, default: 'Contact Us' })
    contactTitleEn: string;

    @Column({ name: 'whatsapp_number', type: 'varchar', length: 50, nullable: true })
    whatsappNumber: string;

    @Column({ name: 'support_email', type: 'varchar', length: 150, nullable: true })
    supportEmail: string;

    // Section Order (JSON array of section keys)
    @Column({ name: 'sections_order', type: 'text', default: '["hero","features","plans","about","contact"]' })
    sectionsOrder: string;

    // Footer
    @Column({ name: 'footer_text_ar', type: 'text', nullable: true })
    footerTextAr: string;

    @Column({ name: 'footer_text_en', type: 'text', nullable: true })
    footerTextEn: string;

    @Column({ name: 'social_links', type: 'text', nullable: true })
    socialLinks: string; // JSON object { twitter, facebook, linkedin, instagram }

    @Column({ name: 'quick_links', type: 'text', nullable: true })
    quickLinks: string; // JSON array of links

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
