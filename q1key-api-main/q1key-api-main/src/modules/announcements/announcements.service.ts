import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
    constructor(
        @InjectRepository(Announcement)
        private announcementRepo: Repository<Announcement>,
    ) { }

    /**
     * Get the currently active announcement
     */
    async getActiveAnnouncement(): Promise<Announcement | null> {
        return this.announcementRepo.findOne({
            where: { isActive: true },
            order: { updatedAt: 'DESC' },
        });
    }

    /**
     * Get all announcements (for admin management)
     */
    async getAllAnnouncements(): Promise<Announcement[]> {
        return this.announcementRepo.find({
            order: { createdAt: 'DESC' },
            relations: ['creator'],
        });
    }

    /**
     * Get announcement by ID
     */
    async getAnnouncementById(id: number): Promise<Announcement> {
        const announcement = await this.announcementRepo.findOne({
            where: { id },
            relations: ['creator'],
        });

        if (!announcement) {
            throw new HttpException('الإعلان غير موجود', HttpStatus.NOT_FOUND);
        }

        return announcement;
    }

    /**
     * Create new announcement
     */
    async createAnnouncement(dto: any, userId: number): Promise<Announcement> {
        // If this announcement is active, deactivate all others
        if (dto.isActive) {
            await this.announcementRepo.update({ isActive: true }, { isActive: false });
        }

        const announcement = this.announcementRepo.create({
            textAr: dto.textAr,
            textEn: dto.textEn,
            backgroundColor: dto.backgroundColor || '#3b82f6',
            textColor: dto.textColor || '#ffffff',
            isActive: dto.isActive || false,
            createdBy: userId,
        });

        return this.announcementRepo.save(announcement);
    }

    /**
     * Update announcement
     */
    async updateAnnouncement(id: number, dto: any): Promise<Announcement> {
        const announcement = await this.announcementRepo.findOne({ where: { id } });

        if (!announcement) {
            throw new HttpException('الإعلان غير موجود', HttpStatus.NOT_FOUND);
        }

        // If activating this announcement, deactivate all others
        if (dto.isActive && !announcement.isActive) {
            await this.announcementRepo.update({ isActive: true }, { isActive: false });
        }

        Object.assign(announcement, dto);
        return this.announcementRepo.save(announcement);
    }

    /**
     * Toggle announcement active status
     */
    async toggleAnnouncement(id: number): Promise<Announcement> {
        const announcement = await this.announcementRepo.findOne({ where: { id } });

        if (!announcement) {
            throw new HttpException('الإعلان غير موجود', HttpStatus.NOT_FOUND);
        }

        // If activating, deactivate all others first
        if (!announcement.isActive) {
            await this.announcementRepo.update({ isActive: true }, { isActive: false });
        }

        announcement.isActive = !announcement.isActive;
        return this.announcementRepo.save(announcement);
    }

    /**
     * Delete announcement
     */
    async deleteAnnouncement(id: number): Promise<{ message: string }> {
        const announcement = await this.announcementRepo.findOne({ where: { id } });

        if (!announcement) {
            throw new HttpException('الإعلان غير موجود', HttpStatus.NOT_FOUND);
        }

        await this.announcementRepo.delete(id);
        return { message: 'تم حذف الإعلان بنجاح' };
    }
}
