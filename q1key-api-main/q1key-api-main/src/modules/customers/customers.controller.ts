import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateTrustStatusDto } from './dto/update-trust-status.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Post()
  @Roles('Super Admin', 'Institution', 'Branch')
  create(@Body() createCustomerDto: CreateCustomerDto, @CurrentUser() user: any) {
    return this.customersService.create(createCustomerDto, user);
  }

  @Get()
  @Roles('Super Admin', 'Institution', 'Branch')
  findAll(@Query() paginationDto: PaginationDto, @Query('deleted') deleted: string, @CurrentUser() user?: any) {
    return this.customersService.findAll(paginationDto, user, deleted === 'true');
  }

  @Get('search')
  @Roles('Super Admin', 'Institution', 'Branch')
  search(@Query() searchDto: SearchCustomerDto, @CurrentUser() user?: any) {
    return this.customersService.search(searchDto, user);
  }

  @Get(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  findOne(@Param('id') id: string, @CurrentUser() user?: any) {
    return this.customersService.findOne(+id, user);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto, @CurrentUser() user: any) {
    return this.customersService.update(+id, updateCustomerDto, user);
  }

  @Patch(':id/trust-status')
  @Roles('Super Admin', 'Institution', 'Branch')
  updateTrustStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTrustStatusDto: UpdateTrustStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.updateTrustStatus(id, updateTrustStatusDto, user.userId);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.remove(+id, user);
  }

  @Post(':id/link')
  @Roles('Super Admin', 'Institution', 'Branch')
  link(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.link(+id, user);
  }

  @Post(':id/soft-delete')
  @Roles('Super Admin', 'Institution', 'Branch')
  softDelete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.softDelete(+id, user);
  }

  @Post(':id/restore')
  @Roles('Super Admin', 'Institution', 'Branch')
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.customersService.restore(+id, user);
  }
}
