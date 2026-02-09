import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { Customer } from "../../entities/customer.entity";
import { SearchLogsModule } from "../search-logs/search-logs.module";

import { CustomerRelation } from "../../entities/customer-relation.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerRelation]),
    SearchLogsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
