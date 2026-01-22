import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Installment } from '../../entities/installment.entity';
import { Loan } from '../../entities/loan.entity';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';
import { CashBoxModule } from '../cash-box/cash-box.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Installment, Loan]),
    CashBoxModule,
  ],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule { }

