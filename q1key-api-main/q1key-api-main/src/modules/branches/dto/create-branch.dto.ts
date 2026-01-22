import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsOptional, Min, IsEmail, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsNotEmpty({ message: 'رقم المؤسسة مطلوب' })
  @IsNumber({}, { message: 'يجب أن يكون رقم المؤسسة رقماً' })
  institutionId: number;

  @IsNotEmpty({ message: 'اسم الفرع مطلوب' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'يجب أن يكون الحد الأقصى للقروض رقماً' })
  @Min(0, { message: 'يجب أن يكون الحد الأقصى للقروض 0 على الأقل' })
  maximumLoans?: number;

  @IsOptional()
  @IsNumber({}, { message: 'يجب أن يكون رقم باقة الاشتراك رقماً صحيحاً' })
  planId?: number;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsEmail()
  userEmail?: string;

  @MinLength(6)
  @IsOptional()
  @IsString()
  userPassword?: string;

  @IsOptional()
  @IsString()
  userPhoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  userIsActive?: boolean;
}
