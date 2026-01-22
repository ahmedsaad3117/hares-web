import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsNumber()
  roleId: number;

  @IsOptional()
  @IsNumber()
  institutionId?: number;

  @IsOptional()
  @IsNumber()
  branchId?: number;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
