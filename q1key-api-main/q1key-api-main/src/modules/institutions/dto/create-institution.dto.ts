import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  IsDateString,
  IsEmail,
  MinLength,
  MaxLength,
} from "class-validator";

export class CreateInstitutionDto {
  @IsNotEmpty({ message: "اسم المؤسسة مطلوب" })
  @IsString()
  @MaxLength(150, { message: "اسم المؤسسة طويل جداً" })
  name: string;

  @IsNotEmpty({ message: "السجل التجاري مطلوب" })
  @IsString()
  @MaxLength(50, { message: "رقم السجل التجاري طويل جداً" })
  taxId: string;

  @IsNotEmpty({ message: "رقم هاتف المؤسسة مطلوب" })
  @IsString()
  @MaxLength(20, { message: "رقم الهاتف طويل جداً" })
  phoneNumber: string;

  @IsNotEmpty({ message: "البريد الإلكتروني للمؤسسة مطلوب" })
  @IsEmail({}, { message: "البريد الإلكتروني غير صالح" })
  @MaxLength(100, { message: "البريد الإلكتروني طويل جداً" })
  email: string;

  @IsOptional()
  @IsNumber({}, { message: "يجب أن يكون الحد الأقصى للمستخدمين رقماً" })
  @Min(1, { message: "يجب أن يكون الحد الأقصى للمستخدمين 1 على الأقل" })
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

  @IsNotEmpty({ message: "باقة الاشتراك مطلوبة" })
  @IsNumber({}, { message: "يجب أن يكون رقم باقة الاشتراك رقماً صحيحاً" })
  planId: number;

  @IsNotEmpty({ message: "اسم المدير مطلوب" })
  @IsString()
  @MaxLength(100, { message: "اسم المدير طويل جداً" })
  adminName: string;

  @IsNotEmpty({ message: "البريد الإلكتروني للمدير مطلوب" })
  @IsEmail({}, { message: "البريد الإلكتروني للمدير غير صالح" })
  @MaxLength(100, { message: "البريد الإلكتروني للمدير طويل جداً" })
  adminEmail: string;

  @IsNotEmpty({ message: "كلمة مرور المدير مطلوبة" })
  @MinLength(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" })
  @MaxLength(50, { message: "كلمة المرور طويلة جداً" })
  @IsString()
  adminPassword: string;

  @IsNotEmpty({ message: "رقم هاتف المدير مطلوب" })
  @IsString()
  @MaxLength(20, { message: "رقم هاتف المدير طويل جداً" })
  adminPhoneNumber: string;

  @IsNotEmpty({ message: "رقم الهوية للمدير مطلوب" })
  @IsString()
  @MaxLength(50, { message: "رقم الهوية طويل جداً" })
  adminNationalId: string;

  @IsOptional()
  @IsBoolean()
  adminIsActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumLoans?: number;
}
