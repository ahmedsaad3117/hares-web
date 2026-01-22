import { IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchCustomerDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  nationalId?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
