import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TelegramSettings } from "../../entities/telegram-settings.entity";
import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([TelegramSettings]),
    AuthModule,
    UsersModule,
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService], // Export so other modules can use it
})
export class TelegramModule {}
