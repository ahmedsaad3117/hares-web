import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsNumber, IsBoolean } from 'class-validator';

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
  @MaxLength(100)
  name: string;

  @IsNotEmpty()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneNumber?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
