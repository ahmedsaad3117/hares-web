import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[0-9]+$/, { message: 'National ID must contain only numbers with no spaces' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  nationalId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @Matches(/^[0-9+()-]+$/, { message: 'Phone number must not contain spaces' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  phoneNumber: string;
}
