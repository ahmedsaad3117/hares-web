import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TelegramService } from "./telegram.service";

import { IsString, IsBoolean, IsOptional } from "class-validator";

class SaveSettingsDto {
  @IsString()
  @IsOptional()
  botToken?: string;

  @IsString()
  @IsOptional()
  chatId?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyNewRequests?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyRenewals?: boolean;

  @IsBoolean()
  @IsOptional()
  allowActionButtons?: boolean;
}

/**
 * Helper function to get role name from user object
 */
function getUserRoleName(user: any): string {
  return user?.role?.roleName || user?.roleName || "";
}

@Controller("telegram")
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Get current Telegram settings
   * Only Super Admin can access
   */
  @Get("settings")
  @UseGuards(JwtAuthGuard)
  async getSettings(@Request() req) {
    // Check if user is Super Admin
    if (getUserRoleName(req.user) !== "Super Admin") {
      return { error: "غير مصرح لك بالوصول لهذه الإعدادات", statusCode: 403 };
    }

    const settings = await this.telegramService.getSettings();

    if (!settings) {
      // Return default empty settings
      return {
        botToken: "",
        chatId: "",
        isEnabled: false,
        notifyNewRequests: true,
        notifyRenewals: true,
        lastTestAt: null,
        lastTestSuccess: false,
        lastTestError: null,
      };
    }

    // Mask the bot token for security (show only last 10 chars)
    const maskedToken = settings.botToken
      ? "••••••••••" + settings.botToken.slice(-10)
      : "";

    return {
      botToken: maskedToken,
      botTokenExists: !!settings.botToken,
      chatId: settings.chatId || "",
      isEnabled: settings.isEnabled,
      notifyNewRequests: settings.notifyNewRequests,
      notifyRenewals: settings.notifyRenewals,
      allowActionButtons: settings.allowActionButtons,
      lastTestAt: settings.lastTestAt,
      lastTestSuccess: settings.lastTestSuccess,
      lastTestError: settings.lastTestError,
    };
  }

  /**
   * Save Telegram settings
   * Only Super Admin can access
   */
  @Put("settings")
  @UseGuards(JwtAuthGuard)
  async saveSettings(@Request() req, @Body() dto: SaveSettingsDto) {
    // Check if user is Super Admin
    if (getUserRoleName(req.user) !== "Super Admin") {
      return { error: "غير مصرح لك بتعديل هذه الإعدادات", statusCode: 403 };
    }

    // If botToken starts with dots, it means it's masked - don't update it
    let tokenToSave = dto.botToken;
    if (dto.botToken && dto.botToken.startsWith("••")) {
      tokenToSave = undefined; // Don't update token
    }

    const settings = await this.telegramService.saveSettings({
      botToken: tokenToSave,
      chatId: dto.chatId,
      isEnabled: dto.isEnabled,
      notifyNewRequests: dto.notifyNewRequests,
      notifyRenewals: dto.notifyRenewals,
      allowActionButtons: dto.allowActionButtons,
    });

    return {
      success: true,
      message: "تم حفظ الإعدادات بنجاح",
      isEnabled: settings.isEnabled,
    };
  }

  /**
   * TEST ENDPOINT
   */
  @Get("test-trigger")
  async testTrigger(@Query("type") type?: string, @Query("id") id?: string) {
    if (type === "renewal" && id) {
      const requestId = parseInt(id);
      console.log(`Testing renewal for Request #${requestId}`);

      // We need to access repositories to replicate the exact logic
      // Since we can't easily inject them here without refactoring the module,
      // we will use the logic we know is in the service, but debug it step-by-step
      // properly we should probably simulate the data fetching here
      // or add a method in TelegramService to 'testNotificationForRequest(id)'

      // For now, let's just try to send a dummy one with the ID to see if it reaches
      const result = await this.telegramService.sendNewRequestNotification({
        requestId: requestId,
        requestType: "renewal",
        entityName: "debug-entity",
        entityType: "Institution",
        taxId: "debug-tax",
        entityEmail: "debug@test.com",
        entityPhone: "000000",
        amount: 999,
        planName: "Debug Plan",
        duration: 1,
        adminName: "Debug Admin",
        customerNotes: "Debug Note",
      });

      return { success: result, message: `Sent debug for #${requestId}` };
    }
    if (type === "renewal") {
      const settings = await this.telegramService.getSettings();
      console.log("Testing renewal notification. Settings:", settings);

      const result = await this.telegramService.sendNewRequestNotification({
        requestId: 51, // The ID from user's image
        requestType: "renewal",
        entityName: "مؤسسة عرفان",
        entityType: "Institution",
        taxId: "UNKNOWN",
        entityEmail: "test@example.com",
        entityPhone: "0500000000",
        amount: 480,
        planName: "3 أشهر",
        duration: 3,
        adminName: "Admin",
        adminPhone: "0500000000",
        adminEmail: "admin@example.com",
        customerNotes: "Test Renewal",
        currentExpiration: "2026-02-03",
        newExpiration: "2026-05-03",
      });

      return {
        message: "Renewal test executed",
        success: result,
        settings: {
          isEnabled: settings?.isEnabled,
          notifyRenewals: settings?.notifyRenewals,
        },
      };
    }
    return { message: "Use ?type=renewal" };
  }

  /**
   * Test connection (Used by Frontend)
   */
  @Post("test")
  @UseGuards(JwtAuthGuard)
  async testConnection(@Request() req) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      return { error: "غير مصرح لك بإجراء هذا الاختبار", statusCode: 403 };
    }
    return await this.telegramService.testConnection();
  }

  /**
   * Webhook endpoint for Telegram updates
   * This must be public so Telegram can send POST requests to it
   */
  @Post("webhook")
  async handleWebhook(@Body() update: any) {
    // console.log('[Telegram Webhook] Received update:', JSON.stringify(update));
    return this.telegramService.handleUpdate(update);
  }

  /**
   * Set up Webhook automatically (Super Admin only)
   */
  @Post("setup-webhook")
  @UseGuards(JwtAuthGuard)
  async setupWebhook(@Request() req, @Body("url") url: string) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      return { error: "غير مصرح لك بإجراء هذا التعديل", statusCode: 403 };
    }
    return this.telegramService.setupWebhook(url);
  }
}
