import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  IsEmail,
  MinLength,
} from "class-validator";

export class CreateBranchDto {
  @IsNotEmpty({ message: "رقم المؤسسة مطلوب" })
  @IsNumber({}, { message: "يجب أن يكون رقم المؤسسة رقماً" })
  institutionId: number;

  @IsNotEmpty({ message: "اسم الفرع مطلوب" })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail({}, { message: "البريد الإلكتروني للفرع غير صحيح" })
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber({}, { message: "يجب أن يكون الحد الأقصى للقروض رقماً" })
  @Min(0, { message: "يجب أن يكون الحد الأقصى للقروض 0 على الأقل" })
  maximumLoans?: number;

  @IsOptional()
  @IsNumber({}, { message: "يجب أن يكون رقم باقة الاشتراك رقماً صحيحاً" })
  planId?: number;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsEmail({}, { message: "البريد الإلكتروني للمدير غير صحيح" })
  userEmail?: string;

  @MinLength(6)
  @IsOptional()
  @IsString()
  userPassword?: string;

  @IsNotEmpty({ message: "رقم جوال المدير مطلوب" })
  @IsString()
  userPhoneNumber?: string;

  @IsNotEmpty({ message: "رقم الهوية للمدير مطلوب" })
  @IsString()
  userNationalId: string;

  @IsOptional()
  @IsBoolean()
  userIsActive?: boolean;
}
