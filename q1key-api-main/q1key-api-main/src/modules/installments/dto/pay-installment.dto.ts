import { IsDateString } from 'class-validator';

export class PayInstallmentDto {
  @IsDateString()
  paymentDate: string;
}
