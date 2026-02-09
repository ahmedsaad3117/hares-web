import { IsString, IsOptional, IsBoolean, Length, IsInt } from 'class-validator';

export class UpdateProductDto {
  @IsInt()
  @IsOptional()
  institutionId?: number | null;

  @IsInt()
  @IsOptional()
  branchId?: number | null;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isVisibleToBranches?: boolean;
}
