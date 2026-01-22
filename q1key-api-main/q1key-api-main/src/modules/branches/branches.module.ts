import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { Branch } from '../../entities/branch.entity';
import { Institution } from '../../entities/institution.entity';
import { User } from '../../entities/user.entity';
import { Customer } from '../../entities/customer.entity';
import { Loan } from '../../entities/loan.entity';
import { SubscriptionRequest } from '../../entities/subscription-request.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Branch, Institution, User, Customer, Loan, SubscriptionRequest, SubscriptionPlan]),
    UsersModule,
  ],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule { }
