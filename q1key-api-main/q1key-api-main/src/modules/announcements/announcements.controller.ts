import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    ParseIntPipe,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnnouncementsService } from './announcements.service';

/**
 * Helper function to get role name from user object
 */
function getUserRoleName(user: any): string {
    return user?.role?.roleName || user?.roleName || '';
}

import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTOs
 */
export class CreateAnnouncementDto {
    @IsNotEmpty()
    @IsString()
    textAr: string;

    @IsNotEmpty()
    @IsString()
    textEn: string;

    @IsOptional()
    @IsString()
    backgroundColor?: string;

    @IsOptional()
    @IsString()
    textColor?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateAnnouncementDto {
    @IsOptional()
    @IsString()
    textAr?: string;

    @IsOptional()
    @IsString()
    textEn?: string;

    @IsOptional()
    @IsString()
    backgroundColor?: string;

    @IsOptional()
    @IsString()
    textColor?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    /**
     * Get active announcement (public - for banner display)
     * No auth required for this endpoint
     */
    @Get('active')
    async getActiveAnnouncement() {
        return this.announcementsService.getActiveAnnouncement();
    }

    /**
     * Get all announcements (Super Admin only)
     */
    @Get()
    @UseGuards(JwtAuthGuard)
    async getAllAnnouncements(@Request() req) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.getAllAnnouncements();
    }

    /**
     * Get announcement by ID (Super Admin only)
     */
    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getAnnouncementById(@Request() req, @Param('id', ParseIntPipe) id: number) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.getAnnouncementById(id);
    }

    /**
     * Create new announcement (Super Admin only)
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async createAnnouncement(@Request() req, @Body() dto: CreateAnnouncementDto) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.createAnnouncement(dto, req.user.userId);
    }

    /**
     * Update announcement (Super Admin only)
     */
    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async updateAnnouncement(
        @Request() req,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAnnouncementDto,
    ) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.updateAnnouncement(id, dto);
    }

    /**
     * Toggle announcement active status (Super Admin only)
     */
    @Put(':id/toggle')
    @UseGuards(JwtAuthGuard)
    async toggleAnnouncement(@Request() req, @Param('id', ParseIntPipe) id: number) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.toggleAnnouncement(id);
    }

    /**
     * Delete announcement (Super Admin only)
     */
    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    async deleteAnnouncement(@Request() req, @Param('id', ParseIntPipe) id: number) {
        if (getUserRoleName(req.user) !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بهذا الإجراء', HttpStatus.FORBIDDEN);
        }
        return this.announcementsService.deleteAnnouncement(id);
    }
}
