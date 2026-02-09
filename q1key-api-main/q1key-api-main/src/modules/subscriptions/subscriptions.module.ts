import { Module, OnModuleInit, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionPlan } from "../../entities/subscription-plan.entity";
import { SubscriptionRequest } from "../../entities/subscription-request.entity";
import { Institution } from "../../entities/institution.entity";
import { Branch } from "../../entities/branch.entity";
import { CashBox } from "../../entities/cash-box.entity";
import { CashBoxTransaction } from "../../entities/cash-box-transaction.entity";
import { User } from "../../entities/user.entity";

import { UsersModule } from "../users/users.module";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      SubscriptionRequest,
      Institution,
      Branch,
      CashBox,
      CashBoxTransaction,
      User,
    ]),
    UsersModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule implements OnModuleInit {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async onModuleInit() {
    // Seed default plans if none exist
    await this.subscriptionsService.seedDefaultPlans();
  }
}
