import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) { }

    @Get('support-contact')
    async getSupportInfo() {
        return this.settingsService.getSupportInfo();
    }

    @Put('support-contact')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Super Admin')
    async updateSupportInfo(@Body() body: { whatsapp: string; email: string }) {
        return this.settingsService.updateSupportInfo(body.whatsapp, body.email);
    }
}
