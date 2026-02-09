import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from "@nestjs/common";
import { CustomerNotesService } from "./customer-notes.service";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { UpdateCustomerNoteDto } from "./dto/update-customer-note.dto";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { NotePermissionGuard } from "./guards/note-permission.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("customer-notes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerNotesController {
  constructor(private readonly customerNotesService: CustomerNotesService) {}

  @Post()
  @Roles("Super Admin", "Institution", "Branch")
  create(@Body() createDto: CreateCustomerNoteDto, @CurrentUser() user: any) {
    return this.customerNotesService.create(createDto, user);
  }

  @Get()
  @Roles("Super Admin", "Institution", "Branch")
  findAll(@Query() pagination: PaginationDto) {
    return this.customerNotesService.findAll(pagination);
  }

  @Get(":id")
  @Roles("Super Admin", "Institution", "Branch")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.customerNotesService.findOne(id);
  }

  @Get("customer/:customerId")
  @Roles("Super Admin", "Institution", "Branch")
  findByCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.customerNotesService.findByCustomer(customerId, pagination);
  }

  @Put(":id")
  @UseGuards(NotePermissionGuard)
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateCustomerNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.customerNotesService.update(id, updateDto, user.userId);
  }

  @Delete(":id")
  @UseGuards(NotePermissionGuard)
  async remove(@Param("id", ParseIntPipe) id: number) {
    await this.customerNotesService.remove(id);
    return { message: "Customer note deleted successfully" };
  }
}
