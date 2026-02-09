import { IsOptional, IsEnum } from "class-validator";
import { InstallmentStatus } from "../../../entities/installment-status.enum";

export class UpdateInstallmentDto {
  @IsOptional()
  dueDate?: Date;

  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsEnum(InstallmentStatus)
  status?: InstallmentStatus;
}
