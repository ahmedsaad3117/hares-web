import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstitutionsService } from './institutions.service';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsScheduler } from './institutions.scheduler';
import { Institution } from '../../entities/institution.entity';
import { User } from '../../entities/user.entity';
import { Customer } from '../../entities/customer.entity';
import { Loan } from '../../entities/loan.entity';
import { Branch } from '../../entities/branch.entity';
import { SubscriptionRequest } from '../../entities/subscription-request.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { CashBox } from '../../entities/cash-box.entity';
import { CashBoxTransaction } from '../../entities/cash-box-transaction.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, User, Customer, Loan, Branch, SubscriptionRequest, SubscriptionPlan, CashBox, CashBoxTransaction]),
    UsersModule,
  ],
  controllers: [InstitutionsController],
  providers: [InstitutionsService, InstitutionsScheduler],
  exports: [InstitutionsService],
})
export class InstitutionsModule { }
