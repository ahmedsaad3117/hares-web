import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { QuickLinksService } from "./quick-links.service";
import { QuickLink } from "./quick-link.entity";
import { JwtAuthGuard } from "../modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../modules/auth/guards/roles.guard";
import { Roles } from "../modules/auth/decorators/roles.decorator";

@Controller("quick-links")
export class QuickLinksController {
  constructor(private readonly quickLinksService: QuickLinksService) {}

  // Get active links (public - for dashboard)
  @Get("active")
  async getActiveLinks(): Promise<QuickLink[]> {
    return this.quickLinksService.getActiveLinks();
  }

  // Get all links (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Get()
  async getAllLinks(): Promise<QuickLink[]> {
    return this.quickLinksService.getAllLinks();
  }

  // Get single link by ID (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Get(":id")
  async getById(@Param("id", ParseIntPipe) id: number): Promise<QuickLink> {
    return this.quickLinksService.getById(id);
  }

  // Create new quick link (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Post()
  async create(@Body() data: Partial<QuickLink>): Promise<QuickLink> {
    return this.quickLinksService.create(data);
  }

  // Update quick link (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Put(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() data: Partial<QuickLink>,
  ): Promise<QuickLink> {
    return this.quickLinksService.update(id, data);
  }

  // Delete quick link (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Delete(":id")
  async delete(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.quickLinksService.delete(id);
    return { message: "Quick link deleted successfully" };
  }

  // Reorder links (Super Admin only)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Super Admin")
  @Post("reorder")
  async reorder(
    @Body() body: { orderedIds: number[] },
  ): Promise<{ message: string }> {
    await this.quickLinksService.reorder(body.orderedIds);
    return { message: "Quick links reordered successfully" };
  }
}
