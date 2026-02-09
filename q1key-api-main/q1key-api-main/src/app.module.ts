import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CacheModule } from "./common/cache";
import { RateLimiterModule } from "./common/rate-limiter";
import { MonitoringModule, MonitoringInterceptor } from "./common/monitoring";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { InstitutionsModule } from "./modules/institutions/institutions.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { ProductsModule } from "./modules/products/products.module";
import { LoansModule } from "./modules/loans/loans.module";
import { SearchLogsModule } from "./modules/search-logs/search-logs.module";
import { CustomerNotesModule } from "./modules/customer-notes/customer-notes.module";
import { InstallmentsModule } from "./modules/installments/installments.module";
import { CashBoxModule } from "./modules/cash-box/cash-box.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { HomepageModule } from "./modules/homepage/homepage.module";
import { QuickLinksModule } from "./quick-links/quick-links.module";
import { TelegramModule } from "./modules/telegram/telegram.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: process.env.NODE_ENV === "development",
      logging: process.env.NODE_ENV === "development",
      ssl: false,
      extra: {
        max: 10,
        connectionTimeoutMillis: 5000,
      },
    }),
    // Cache Module (Global)
    CacheModule,
    // Rate Limiter Module (Global)
    RateLimiterModule,
    // Monitoring Module (Global)
    MonitoringModule,
    // Feature modules
    AuthModule,
    UsersModule,
    InstitutionsModule,
    BranchesModule,
    CustomersModule,
    ProductsModule,
    LoansModule,
    SearchLogsModule,
    CustomerNotesModule,
    InstallmentsModule,
    CashBoxModule,
    ReportsModule,
    SettingsModule,
    SubscriptionsModule,
    AnnouncementsModule,
    HomepageModule,
    QuickLinksModule,
    TelegramModule,
    // NotesModule,
    // ActivityLogModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MonitoringInterceptor,
    },
  ],
})
export class AppModule {}
