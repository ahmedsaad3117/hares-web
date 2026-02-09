import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  IsEmail,
} from "class-validator";

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsNumber()
  @Min(0)
  maximumLoans?: number;

  @IsOptional()
  @IsString()
  expirationDate?: string;
}
