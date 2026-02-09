import { IsInt, IsOptional, Min, IsEnum } from "class-validator";
import { InstallmentStatus } from "../../../entities/installment-status.enum";

export class CreateInstallmentDto {
  @IsInt()
  loanId: number;

  @IsInt()
  @Min(1)
  installmentNumber: number;

  dueDate: Date;

  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsEnum(InstallmentStatus)
  status?: InstallmentStatus;
}
