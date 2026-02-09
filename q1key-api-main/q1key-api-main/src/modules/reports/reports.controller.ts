import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  RateLimiterGuard,
  RateLimit,
  RATE_LIMITS,
} from "../../common/rate-limiter";

/**
 * Reports Controller with Rate Limiting
 *
 * Rate Limits:
 * - 10 requests per minute per user (heavy queries)
 * - Super Admin: unlimited (skipRoles)
 */
@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("general-stats")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getGeneralStats(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getGeneralStats(filter, user);
  }

  @Get("cash-box")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getCashBoxReport(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getCashBoxReport(filter, user);
  }

  @Get("customers")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getCustomersReport(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getCustomersReport(filter, user);
  }

  @Get("loans")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getLoansReport(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getLoansReport(filter, user);
  }

  @Get("installments")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getInstallmentsReport(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getInstallmentsReport(filter, user);
  }

  @Get("dashboard-summary")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getDashboardSummary(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.getDashboardSummary(filter, user);
  }

  @Get("comparisons")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getComparisonsData(@CurrentUser() user: any) {
    return this.reportsService.getComparisonsData(user);
  }

  @Get("unified")
  @Roles("Super Admin", "Institution", "Branch")
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REPORTS)
  async getUnifiedReport(
    @Query() filter: ReportFilterDto,
    @CurrentUser() user: any,
  ) {
    try {
      if (!user) {
        console.warn("Unified Report: No user found in request");
      }
      return await this.reportsService.getUnifiedReport(filter, user);
    } catch (error) {
      console.error("API Error [unified]:", error);
      return { error: error.message };
    }
  }
}
