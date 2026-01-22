import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { LoanStatus } from '../../entities/loan.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InstallmentsService } from '../installments/installments.service';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly installmentsService: InstallmentsService,
  ) { }

  @Post()
  @Roles('Super Admin', 'Institution', 'Branch')
  create(@Body() createLoanDto: CreateLoanDto, @CurrentUser() user: any) {
    return this.loansService.create(createLoanDto, user);
  }

  @Get()
  @Roles('Super Admin', 'Institution', 'Branch')
  findAll(@Query() paginationDto: PaginationDto, @CurrentUser() user?: any) {
    return this.loansService.findAll(paginationDto, user);
  }

  @Get('search')
  @Roles('Super Admin', 'Institution', 'Branch')
  search(@Query('q') searchTerm: string) {
    return this.loansService.search(searchTerm || '');
  }

  @Get('statistics')
  @Roles('Super Admin', 'Institution', 'Branch')
  getStatistics() {
    return this.loansService.getStatistics();
  }

  @Get('customer/:customerId')
  @Roles('Super Admin', 'Institution', 'Branch')
  findByCustomer(@Param('customerId') customerId: string) {
    return this.loansService.findByCustomer(+customerId);
  }

  @Get('branch/:branchId')
  @Roles('Super Admin', 'Institution', 'Branch')
  findByBranch(@Param('branchId') branchId: string) {
    return this.loansService.findByBranch(+branchId);
  }

  @Get('status/:status')
  @Roles('Super Admin', 'Institution', 'Branch')
  findByStatus(@Param('status') status: LoanStatus) {
    return this.loansService.findByStatus(status);
  }

  @Get(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(+id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto, @CurrentUser() user: any) {
    return this.loansService.update(+id, updateLoanDto, user);
  }

  @Patch(':id/status')
  @Roles('Super Admin', 'Institution', 'Branch')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: LoanStatus,
  ) {
    return this.loansService.updateStatus(+id, status);
  }

  @Get(':id/installments')
  @Roles('Super Admin', 'Institution', 'Branch')
  findInstallments(@Param('id') id: string) {
    return this.installmentsService.findByLoan(+id);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  remove(@Param('id') id: string) {
    return this.loansService.remove(+id);
  }
}
