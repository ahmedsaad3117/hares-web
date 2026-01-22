import { IsNumber, IsOptional, IsString, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../../entities/cash-box-transaction.entity';

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
