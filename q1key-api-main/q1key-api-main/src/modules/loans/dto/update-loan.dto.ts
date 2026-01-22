import { IsNumber, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { LoanStatus } from '../../../entities/loan.entity';

export class UpdateLoanDto {
  @IsNumber()
  @IsOptional()
  principalAmount?: number;

  @IsEnum(LoanStatus)
  @IsOptional()
  status?: LoanStatus;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsNumber()
  @IsOptional()
  paymentPlanMonths?: number;

  @IsNumber()
  @IsOptional()
  profitAmount?: number;
}
