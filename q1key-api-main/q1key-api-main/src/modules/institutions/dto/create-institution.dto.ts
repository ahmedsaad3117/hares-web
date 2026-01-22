import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsOptional, Min, IsDateString, IsEmail, MinLength } from 'class-validator';

export class CreateInstitutionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNumber({}, { message: 'يجب أن يكون الحد الأقصى للمستخدمين رقماً' })
  @Min(1, { message: 'يجب أن يكون الحد الأقصى للمستخدمين 1 على الأقل' })
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
  @IsNumber({}, { message: 'يجب أن يكون رقم باقة الاشتراك رقماً صحيحاً' })
  planId?: number;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @MinLength(6)
  @IsOptional()
  @IsString()
  adminPassword?: string;

  @IsOptional()
  @IsString()
  adminPhoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  adminIsActive?: boolean;
}
