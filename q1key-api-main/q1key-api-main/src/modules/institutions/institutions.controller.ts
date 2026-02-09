import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from "@nestjs/common";
import { InstitutionsService } from "./institutions.service";
import { CreateInstitutionDto } from "./dto/create-institution.dto";
import { UpdateInstitutionDto } from "./dto/update-institution.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  RateLimiterGuard,
  RateLimit,
  RATE_LIMITS,
} from "../../common/rate-limiter";

@Controller("institutions")
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  /**
   * Public endpoint to check if a tax ID already exists
   * Rate limited to prevent scraping
   */
  @Get("check-tax-id/:taxId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.SEARCH)
  checkTaxId(@Param("taxId") taxId: string) {
    return this.institutionsService.checkTaxIdExists(taxId);
  }

  /**
   * Public endpoint for subscription requests (no authentication required)
   * Rate limited: 5 attempts per hour per IP
   * Prevents spam and abuse of subscription form
   */
  @Post("subscribe")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.REGISTRATION)
  publicSubscriptionRequest(
    @Body() createInstitutionDto: CreateInstitutionDto,
  ) {
    return this.institutionsService.create(createInstitutionDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createInstitutionDto: CreateInstitutionDto) {
    return this.institutionsService.create(createInstitutionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  findAll(@Query() paginationDto: PaginationDto) {
    return this.institutionsService.findAll(paginationDto);
  }

  /**
   * Search institutions with rate limiting
   */
  @Get("search")
  @UseGuards(JwtAuthGuard, RolesGuard, RateLimiterGuard)
  @Roles("Super Admin", "Institution", "Branch")
  @RateLimit(RATE_LIMITS.SEARCH)
  search(@Query("q") searchTerm: string) {
    return this.institutionsService.search(searchTerm || "");
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin", "Institution", "Branch")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.institutionsService.findOne(id);
  }

  @Get(":id/statistics")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin", "Institution", "Branch")
  getStatistics(@Param("id", ParseIntPipe) id: number) {
    return this.institutionsService.getStatistics(id);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateInstitutionDto: UpdateInstitutionDto,
  ) {
    return this.institutionsService.update(id, updateInstitutionDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.institutionsService.remove(id);
  }

  @Patch(":id/toggle-active")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  toggleActive(@Param("id", ParseIntPipe) id: number) {
    return this.institutionsService.toggleActive(id);
  }
}
