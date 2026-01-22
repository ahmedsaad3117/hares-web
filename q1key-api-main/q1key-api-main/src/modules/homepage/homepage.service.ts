import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HomePageSettings } from '../../entities/homepage-settings.entity';

@Injectable()
export class HomepageService {
    constructor(
        @InjectRepository(HomePageSettings)
        private homepageRepo: Repository<HomePageSettings>,
    ) { }

    /**
     * Get homepage settings (creates default if not exists)
     */
    async getSettings(): Promise<HomePageSettings> {
        let settings = await this.homepageRepo.findOne({ where: { id: 1 } });

        if (!settings) {
            // Create default settings
            settings = this.homepageRepo.create({
                id: 1,
                heroTitleAr: 'منصة Q1Key لإدارة القروض',
                heroTitleEn: 'Q1Key Loan Management Platform',
                heroSubtitleAr: 'الحل الأمثل لإدارة مؤسستك المالية بكفاءة وأمان',
                heroSubtitleEn: 'The Ultimate Solution for Managing Your Financial Institution',
                heroBackgroundType: 'gradient',
                loginButtonTextAr: 'تسجيل الدخول',
                loginButtonTextEn: 'Login',
                loginButtonVisible: true,
                registerButtonTextAr: 'اشترك معنا',
                registerButtonTextEn: 'Subscribe Now',
                registerButtonVisible: true,
                featuresSectionVisible: true,
                featuresTitleAr: 'مميزات المنصة',
                featuresTitleEn: 'Platform Features',
                featuresData: JSON.stringify([
                    { iconAr: '📊', iconEn: '📊', titleAr: 'إدارة القروض', titleEn: 'Loan Management', descAr: 'إدارة شاملة لجميع القروض والأقساط', descEn: 'Comprehensive management of all loans and installments' },
                    { iconAr: '👥', iconEn: '👥', titleAr: 'إدارة العملاء', titleEn: 'Customer Management', descAr: 'نظام متكامل لإدارة بيانات العملاء', descEn: 'Integrated system for customer data management' },
                    { iconAr: '🏢', iconEn: '🏢', titleAr: 'إدارة الفروع', titleEn: 'Branch Management', descAr: 'تحكم كامل بجميع الفروع من مكان واحد', descEn: 'Full control over all branches from one place' },
                    { iconAr: '📈', iconEn: '📈', titleAr: 'تقارير متقدمة', titleEn: 'Advanced Reports', descAr: 'تقارير مالية وإحصائية شاملة', descEn: 'Comprehensive financial and statistical reports' },
                ]),
                plansSectionVisible: true,
                plansTitleAr: 'باقات الاشتراك',
                plansTitleEn: 'Subscription Plans',
                aboutSectionVisible: true,
                aboutTitleAr: 'من نحن',
                aboutTitleEn: 'About Us',
                aboutContentAr: 'نحن منصة رائدة في مجال إدارة القروض والمؤسسات المالية، نقدم حلولاً تقنية متطورة تساعد المؤسسات على تحقيق أهدافها.',
                aboutContentEn: 'We are a leading platform in loan and financial institution management, providing advanced technological solutions to help institutions achieve their goals.',
                contactSectionVisible: true,
                contactTitleAr: 'تواصل معنا',
                contactTitleEn: 'Contact Us',
                sectionsOrder: JSON.stringify(['hero', 'features', 'plans', 'about', 'contact']),
                footerTextAr: '© 2024 Q1Key - جميع الحقوق محفوظة',
                footerTextEn: '© 2024 Q1Key - All Rights Reserved',
                socialLinks: JSON.stringify({}),
            });
            await this.homepageRepo.save(settings);
        }

        return settings;
    }

    /**
     * Update homepage settings
     */
    async updateSettings(updateData: Partial<HomePageSettings>): Promise<HomePageSettings> {
        let settings = await this.getSettings();

        // Merge updates
        Object.assign(settings, updateData);

        return this.homepageRepo.save(settings);
    }

    /**
     * Get public homepage data (for unauthenticated users)
     */
    async getPublicData(): Promise<any> {
        const settings = await this.getSettings();

        // Parse JSON fields
        let features = [];
        let sectionsOrder = ['hero', 'features', 'plans', 'about', 'contact'];
        let socialLinks = {};

        try {
            features = settings.featuresData ? JSON.parse(settings.featuresData) : [];
        } catch (e) { }

        try {
            sectionsOrder = settings.sectionsOrder ? JSON.parse(settings.sectionsOrder) : sectionsOrder;
        } catch (e) { }

        try {
            socialLinks = settings.socialLinks ? JSON.parse(settings.socialLinks) : {};
        } catch (e) { }

        return {
            hero: {
                titleAr: settings.heroTitleAr,
                titleEn: settings.heroTitleEn,
                subtitleAr: settings.heroSubtitleAr,
                subtitleEn: settings.heroSubtitleEn,
                imageUrl: settings.heroImageUrl,
                videoUrl: settings.heroVideoUrl,
                backgroundType: settings.heroBackgroundType,
            },
            buttons: {
                login: {
                    textAr: settings.loginButtonTextAr,
                    textEn: settings.loginButtonTextEn,
                    visible: settings.loginButtonVisible,
                },
                register: {
                    textAr: settings.registerButtonTextAr,
                    textEn: settings.registerButtonTextEn,
                    visible: settings.registerButtonVisible,
                },
            },
            features: {
                visible: settings.featuresSectionVisible,
                titleAr: settings.featuresTitleAr,
                titleEn: settings.featuresTitleEn,
                items: features,
            },
            plans: {
                visible: settings.plansSectionVisible,
                titleAr: settings.plansTitleAr,
                titleEn: settings.plansTitleEn,
            },
            about: {
                visible: settings.aboutSectionVisible,
                titleAr: settings.aboutTitleAr,
                titleEn: settings.aboutTitleEn,
                contentAr: settings.aboutContentAr,
                contentEn: settings.aboutContentEn,
                imageUrl: settings.aboutImageUrl,
            },
            contact: {
                visible: settings.contactSectionVisible,
                titleAr: settings.contactTitleAr,
                titleEn: settings.contactTitleEn,
            },
            footer: {
                textAr: settings.footerTextAr,
                textEn: settings.footerTextEn,
                socialLinks,
            },
            sectionsOrder,
        };
    }
}
