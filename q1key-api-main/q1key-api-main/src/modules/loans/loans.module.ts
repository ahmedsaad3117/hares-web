import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoansService } from "./loans.service";
import { LoansController } from "./loans.controller";
import { Loan } from "../../entities/loan.entity";
import { Customer } from "../../entities/customer.entity";
import { Branch } from "../../entities/branch.entity";
import { Institution } from "../../entities/institution.entity";
import { Product } from "../../entities/product.entity";
import { InstallmentsModule } from "../installments/installments.module";
import { CashBoxModule } from "../cash-box/cash-box.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Loan, Customer, Branch, Institution, Product]),
    InstallmentsModule,
    forwardRef(() => CashBoxModule),
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
