import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Delete,
} from "@nestjs/common";
import { InstallmentsService } from "./installments.service";
import { CreateInstallmentDto } from "./dto/create-installment.dto";
import { UpdateInstallmentDto } from "./dto/update-installment.dto";
import { PayInstallmentDto } from "./dto/pay-installment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../../entities/user.entity";

@Controller("installments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Post()
  @Roles("Super Admin", "Institution", "Branch")
  create(@Body() createInstallmentDto: CreateInstallmentDto) {
    return this.installmentsService.create(createInstallmentDto);
  }

  @Get("search")
  @Roles("Super Admin", "Institution", "Branch")
  search(@Query("q") searchTerm: string, @CurrentUser() user: any) {
    return this.installmentsService.search(searchTerm || "", user);
  }

  @Get("overdue")
  @Roles("Super Admin", "Institution", "Branch")
  findOverdue(@CurrentUser() user: any) {
    return this.installmentsService.findOverdue(user);
  }

  @Get(":id")
  @Roles("Super Admin", "Institution", "Branch")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.installmentsService.findOne(id, user);
  }

  @Patch(":id")
  @Roles("Super Admin", "Institution", "Branch")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateInstallmentDto: UpdateInstallmentDto,
  ) {
    return this.installmentsService.update(id, updateInstallmentDto);
  }

  @Patch(":id/pay")
  @Roles("Super Admin", "Institution", "Branch")
  pay(
    @Param("id", ParseIntPipe) id: number,
    @Body() payInstallmentDto: PayInstallmentDto,
    @CurrentUser() user: User,
  ) {
    const paymentDate = new Date(payInstallmentDto.paymentDate);
    return this.installmentsService.markAsPaid(id, paymentDate, user);
  }

  @Delete(":id")
  @Roles("Super Admin", "Institution")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.installmentsService.remove(id);
  }
}
