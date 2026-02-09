import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscriptionsService } from "./subscriptions.service";

/**
 * Helper function to get role name from user object
 */
function getUserRoleName(user: any): string {
  return user?.role?.roleName || user?.roleName || "";
}

/**
 * DTOs
 */
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsEnum,
  Min,
} from "class-validator";

/**
 * DTOs
 */
export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsNumber()
  @Min(1)
  durationMonths: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFreeTrial?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  durationMonths?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFreeTrial?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateRequestDto {
  @IsNumber({}, { message: "يجب أن يكون رقم باقة الاشتراك رقماً صحيحاً" })
  @IsOptional()
  planId?: number;

  @IsNumber({}, { message: "يجب أن يكون عدد الأشهر رقماً" })
  @IsOptional()
  customDurationMonths?: number;

  @IsString()
  @IsOptional()
  customEndDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcessRequestDto {
  @IsString()
  @IsEnum(["Approved", "Rejected"])
  status: "Approved" | "Rejected";

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsString()
  @IsOptional()
  freeReason?: string;

  @IsBoolean()
  @IsOptional()
  isFree?: boolean;
}

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ==================== PLANS (Super Admin Only) ====================

  /**
   * Get all subscription plans
   */
  @Get("plans")
  @UseGuards(JwtAuthGuard)
  async getAllPlans(
    @Request() req,
    @Query("includeInactive") includeInactive?: string,
  ) {
    const roleName = getUserRoleName(req.user);
    const showInactive =
      includeInactive === "true" && roleName === "Super Admin";
    return this.subscriptionsService.getAllPlans(showInactive);
  }

  /**
   * Get active plans only (public - for customers and homepage)
   */
  @Get("plans/active")
  async getActivePlans() {
    return this.subscriptionsService.getActivePlans();
  }

  /**
   * Create a new plan (Super Admin only)
   */
  @Post("plans")
  @UseGuards(JwtAuthGuard)
  async createPlan(@Request() req, @Body() dto: CreatePlanDto) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.createPlan(dto);
  }

  /**
   * Update a plan (Super Admin only)
   */
  @Put("plans/:id")
  @UseGuards(JwtAuthGuard)
  async updatePlan(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.updatePlan(id, dto);
  }

  /**
   * Toggle plan visibility (Super Admin only)
   */
  @Put("plans/:id/toggle")
  @UseGuards(JwtAuthGuard)
  async togglePlanVisibility(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
  ) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.togglePlanVisibility(id);
  }

  /**
   * Delete a plan (Super Admin only)
   */
  @Delete("plans/:id")
  @UseGuards(JwtAuthGuard)
  async deletePlan(@Request() req, @Param("id", ParseIntPipe) id: number) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.deletePlan(id);
  }

  // ==================== REQUESTS ====================

  /**
   * Get all requests (Super Admin only)
   */
  @Get("unified")
  @UseGuards(JwtAuthGuard)
  async getUnifiedData(
    @Request() req,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    console.log(
      `[SubscriptionsController] getUnifiedData called: status=${status}, search=${search}, page=${page}, limit=${limit}`,
    );
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.getUnifiedRequests({
      status,
      search,
      page: page || 1,
      limit: limit || 20,
    });
  }

  /**
   * Get all requests (Super Admin only)
   * @deprecated Use unified endpoint
   */
  @Get("requests")
  @UseGuards(JwtAuthGuard)
  async getAllRequests(
    @Request() req,
    @Query("status") status?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.getAllRequests(
      status,
      page || 1,
      limit || 20,
    );
  }

  /**
   * Get pending requests count (Super Admin only)
   */
  @Get("requests/pending-count")
  @UseGuards(JwtAuthGuard)
  async getPendingCount(@Request() req) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.getPendingRequestsCount();
  }

  /**
   * Get unified subscriptions data (stats + list)
   */
  @Get("unified-subscriptions")
  @UseGuards(JwtAuthGuard)
  async getUnifiedSubscriptions(
    @Request() req,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.getUnifiedSubscriptions({
      type,
      status,
      search,
      page: page || 1,
      limit: limit || 20,
    });
  }

  /**
   * Get current user's subscription info
   */
  @Get("my-subscription")
  @UseGuards(JwtAuthGuard)
  async getMySubscription(@Request() req) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.getMySubscription(userWithRole);
  }

  /**
   * Get my requests history
   */
  @Get("my-requests")
  @UseGuards(JwtAuthGuard)
  async getMyRequests(@Request() req) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.getMyRequests(userWithRole);
  }

  /**
   * Create a new subscription request
   */
  @Post("requests")
  @UseGuards(JwtAuthGuard)
  async createRequest(@Request() req, @Body() dto: CreateRequestDto) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.createRequest(userWithRole, dto);
  }

  /**
   * Get request details (Super Admin or owner)
   */
  @Get("requests/:id")
  @UseGuards(JwtAuthGuard)
  async getRequestById(@Request() req, @Param("id", ParseIntPipe) id: number) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.getRequestById(id, userWithRole);
  }

  /**
   * Process a request (Approve/Reject) - Super Admin only
   */
  @Put("requests/:id/process")
  @UseGuards(JwtAuthGuard)
  async processRequest(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ProcessRequestDto,
  ) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.processRequest(id, dto, req.user);
  }

  /**
   * Update a request (Super Admin only)
   */
  @Put("requests/:id")
  @UseGuards(JwtAuthGuard)
  async updateRequest(
    @Request() req,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: any, // Using any for simplicity as DTO logic is in service
  ) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.updateRequest(id, dto, userWithRole);
  }

  /**
   * Cancel a request (only owner and if pending)
   */
  @Put("requests/:id/cancel")
  @UseGuards(JwtAuthGuard)
  async cancelRequest(@Request() req, @Param("id", ParseIntPipe) id: number) {
    const userWithRole = {
      ...req.user,
      roleName: getUserRoleName(req.user),
    };
    return this.subscriptionsService.cancelRequest(id, userWithRole);
  }

  // ==================== SETTINGS ====================

  /**
   * Get subscription settings (Super Admin only)
   */
  @Get("settings")
  @UseGuards(JwtAuthGuard)
  async getSettings(@Request() req) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.getSettings();
  }

  /**
   * Update subscription settings (Super Admin only)
   */
  @Put("settings")
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Request() req, @Body() settings: any) {
    if (getUserRoleName(req.user) !== "Super Admin") {
      throw new HttpException("غير مصرح لك بهذا الإجراء", HttpStatus.FORBIDDEN);
    }
    return this.subscriptionsService.updateSettings(settings);
  }
}
