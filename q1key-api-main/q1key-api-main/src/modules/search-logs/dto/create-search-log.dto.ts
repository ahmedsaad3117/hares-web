import { IsNumber, IsString, IsOptional, MaxLength } from "class-validator";

export class CreateSearchLogDto {
  @IsNumber()
  customerId: number;

  @IsNumber()
  userId: number;

  @IsString()
  @MaxLength(500)
  searchQuery: string;

  @IsString()
  @MaxLength(50)
  searchType: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ipAddress?: string;
}
