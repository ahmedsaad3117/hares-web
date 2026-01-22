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
} from '@nestjs/common';
import { InstallmentsService } from './installments.service';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { PayInstallmentDto } from './dto/pay-installment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@Controller('installments')
@UseGuards(JwtAuthGuard)
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) { }

  @Post()
  create(@Body() createInstallmentDto: CreateInstallmentDto) {
    return this.installmentsService.create(createInstallmentDto);
  }

  @Get('search')
  search(@Query('q') searchTerm: string) {
    return this.installmentsService.search(searchTerm || '');
  }

  @Get('overdue')
  findOverdue() {
    return this.installmentsService.findOverdue();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInstallmentDto: UpdateInstallmentDto,
  ) {
    return this.installmentsService.update(id, updateInstallmentDto);
  }

  @Patch(':id/pay')
  pay(
    @Param('id', ParseIntPipe) id: number,
    @Body() payInstallmentDto: PayInstallmentDto,
    @CurrentUser() user: User,
  ) {
    const paymentDate = new Date(payInstallmentDto.paymentDate);
    return this.installmentsService.markAsPaid(id, paymentDate, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.installmentsService.remove(id);
  }
}
