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
  HttpException,
  UseGuards,
  Query,
} from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("branches")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Roles("Super Admin", "Institution")
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createBranchDto: CreateBranchDto, @CurrentUser() user: any) {
    // If Institution owner, ensure they're creating branch in their institution
    if (
      user.role.roleName === "Institution" &&
      user.institutionId !== createBranchDto.institutionId
    ) {
      throw new HttpException(
        "You can only create branches in your institution",
        HttpStatus.FORBIDDEN,
      );
    }
    return this.branchesService.create(createBranchDto);
  }

  @Get()
  @Roles("Super Admin", "Institution")
  findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("institutionId") institutionId?: string,
    @CurrentUser() user?: any,
  ) {
    const paginationDto: PaginationDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    };

    // Robust role check
    const roleName = user?.roleName || user?.role?.roleName;

    let filterInstitutionId: number | undefined;

    if (roleName === "Institution") {
      filterInstitutionId = user.institutionId;
    } else if (institutionId) {
      filterInstitutionId = parseInt(institutionId, 10);
    }

    return this.branchesService.findAll(paginationDto, filterInstitutionId);
  }

  @Get("search")
  @Roles("Super Admin", "Institution", "Branch")
  search(@Query("q") searchTerm: string) {
    return this.branchesService.search(searchTerm || "");
  }

  @Get(":id")
  @Roles("Super Admin", "Institution", "Branch")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.findOne(id);
  }

  @Get(":id/statistics")
  @Roles("Super Admin", "Institution", "Branch")
  getStatistics(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getStatistics(id);
  }

  @Get(":id/dashboard")
  @Roles("Super Admin", "Institution", "Branch")
  getBranchDashboard(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchDashboard(id);
  }

  @Get(":id/customers")
  @Roles("Super Admin", "Institution", "Branch")
  getBranchCustomers(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchCustomers(id);
  }

  @Get(":id/loans")
  @Roles("Super Admin", "Institution", "Branch")
  getBranchLoans(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchLoans(id);
  }

  @Get(":id/team")
  @Roles("Super Admin", "Institution", "Branch")
  getBranchTeam(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchTeam(id);
  }

  @Get(":id/activities")
  @Roles("Super Admin", "Institution", "Branch")
  getBranchActivities(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.getBranchActivities(id);
  }

  @Patch(":id")
  @Roles("Super Admin", "Institution")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: any,
  ) {
    return this.branchesService.update(id, updateBranchDto, user);
  }

  @Delete(":id")
  @Roles("Super Admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.remove(id);
  }

  @Patch(":id/toggle-active")
  @Roles("Super Admin", "Institution")
  toggleActive(@Param("id", ParseIntPipe) id: number) {
    return this.branchesService.toggleActive(id);
  }
}
