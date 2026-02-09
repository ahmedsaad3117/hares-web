import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  IsDateString,
  IsEmail,
} from "class-validator";

export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: "البريد الإلكتروني المدخل غير صحيح" })
  email?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsBoolean()
  canCreateBranches?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumLoans?: number;
}
