import { IsOptional, IsDateString, IsNumber, IsString } from "class-validator";
import { Type } from "class-transformer";

export class ReportFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  institutionId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  branchId?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  customerId?: number;

  @IsOptional()
  @IsString()
  status?: string; // loan status, etc.

  @IsOptional()
  @IsString()
  type?: string; // transaction type, loan type

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cashBoxId?: number;
}
