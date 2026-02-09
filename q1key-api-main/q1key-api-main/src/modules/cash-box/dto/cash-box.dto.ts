import { IsNumber, IsOptional, IsString, Min, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { TransactionType } from "../../../entities/cash-box-transaction.entity";

export class DepositDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class WithdrawDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class TransactionFilterDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cashBoxId?: number;
}

export class CashBoxResponseDto {
  cashBoxId: number;
  branchId?: number;
  institutionId?: number;
  boxType: string;
  balance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  branchName?: string;
  institutionName?: string;
  totalDeposits?: number;
  totalWithdrawals?: number;
  manualDeposits?: number;
  manualWithdrawals?: number;
  totalLoanPayments?: number;
  totalLoanDisbursements?: number;
  transactionCount?: number;
}

export class TransactionResponseDto {
  id: number;
  cashBoxId: number;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  loanId?: number;
  installmentId?: number;
  createdBy?: number;
  createdByName?: string;
  createdByRole?: string;
  branchName?: string;
  customerName?: string;
  createdAt: Date;
}

export class CashBoxReportDto {
  cashBox: CashBoxResponseDto;
  totalDeposits: number;
  totalWithdrawals: number;
  totalLoanDisbursements: number;
  totalLoanPayments: number;
  netChange: number;
  transactions: TransactionResponseDto[];
}
