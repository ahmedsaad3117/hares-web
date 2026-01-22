import { IsString, IsNotEmpty, IsOptional, Length, IsInt } from 'class-validator';

export class CreateProductDto {
  @IsInt()
  @IsOptional()
  institutionId?: number;

  @IsInt()
  @IsOptional()
  branchId?: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
