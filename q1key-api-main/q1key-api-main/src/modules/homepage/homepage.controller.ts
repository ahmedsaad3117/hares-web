import { Controller, Get, Put, Body, UseGuards, Request } from "@nestjs/common";
import { HomepageService } from "./homepage.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("homepage")
export class HomepageController {
  constructor(private readonly homepageService: HomepageService) {}

  /**
   * Get public homepage data (no authentication required)
   */
  @Get("public")
  async getPublicData() {
    return this.homepageService.getPublicData();
  }

  /**
   * Get full homepage settings (Super Admin only)
   */
  @Get("settings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  async getSettings() {
    return this.homepageService.getSettings();
  }

  /**
   * Update homepage settings (Super Admin only)
   */
  @Put("settings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  async updateSettings(@Body() updateData: any) {
    return this.homepageService.updateSettings(updateData);
  }
}
