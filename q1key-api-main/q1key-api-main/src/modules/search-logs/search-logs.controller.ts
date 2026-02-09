import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { SearchLogsService } from "./search-logs.service";
import { CreateSearchLogDto } from "./dto/create-search-log.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("search-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchLogsController {
  constructor(private readonly searchLogsService: SearchLogsService) {}

  @Post()
  @Roles("Super Admin", "Institution", "Branch")
  create(@Body() createSearchLogDto: CreateSearchLogDto) {
    return this.searchLogsService.create(createSearchLogDto);
  }

  @Get()
  @Roles("Super Admin")
  findAll(@Query() paginationDto: PaginationDto) {
    return this.searchLogsService.findAll(paginationDto);
  }

  @Get("customer/:customerId")
  @Roles("Super Admin", "Institution", "Branch")
  findByCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.searchLogsService.findByCustomer(customerId, paginationDto);
  }

  @Get("user/:userId")
  @Roles("Super Admin")
  findByUser(
    @Param("userId", ParseIntPipe) userId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.searchLogsService.findByUser(userId, paginationDto);
  }

  @Delete(":id")
  @Roles("Super Admin")
  delete(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.searchLogsService.delete(id, user);
  }
}
