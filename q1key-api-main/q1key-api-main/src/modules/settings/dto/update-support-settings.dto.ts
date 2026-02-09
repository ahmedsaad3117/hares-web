
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateSupportSettingsDto {
    @IsString()
    @IsOptional()
    whatsapp: string;

    @IsEmail()
    @IsOptional()
    email: string;
}
