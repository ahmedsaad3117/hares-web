import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../entities/system-setting.entity';

@Injectable()
export class SettingsService {
    constructor(
        @InjectRepository(SystemSetting)
        private settingsRepository: Repository<SystemSetting>,
    ) { }

    async getSupportInfo() {
        const whatsapp = await this.settingsRepository.findOne({ where: { key: 'support.whatsapp' } });
        const email = await this.settingsRepository.findOne({ where: { key: 'support.email' } });

        return {
            whatsapp: whatsapp?.value || '',
            email: email?.value || '',
        };
    }

    async updateSupportInfo(whatsapp: string, email: string) {
        // Upsert WhatsApp
        let waSetting = await this.settingsRepository.findOne({ where: { key: 'support.whatsapp' } });
        if (!waSetting) {
            waSetting = this.settingsRepository.create({ key: 'support.whatsapp', description: 'Support WhatsApp Number' });
        }
        waSetting.value = whatsapp;
        await this.settingsRepository.save(waSetting);

        // Upsert Email
        let emailSetting = await this.settingsRepository.findOne({ where: { key: 'support.email' } });
        if (!emailSetting) {
            emailSetting = this.settingsRepository.create({ key: 'support.email', description: 'Support Email Address' });
        }
        emailSetting.value = email;
        await this.settingsRepository.save(emailSetting);

        return { whatsapp, email };
    }
}
