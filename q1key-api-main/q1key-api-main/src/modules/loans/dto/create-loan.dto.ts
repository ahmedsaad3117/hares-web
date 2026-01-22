import { IsNumber, IsNotEmpty, IsOptional, IsDateString, Min, Max, IsInt, ValidateIf } from 'class-validator';

export class CreateLoanDto {
  @IsNumber()
  @IsNotEmpty()
  customerId: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o) => !o.institutionId)
  branchId?: number;

  @IsNumber()
  @IsOptional()
  @ValidateIf((o) => !o.branchId)
  institutionId?: number;

  @IsNumber()
  @IsNotEmpty()
  productId: number;

  @IsNumber()
  @IsNotEmpty()
  principalAmount: number;

  @IsNumber()
  @IsOptional()
  profitAmount?: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  paymentPlanMonths?: number;
}
