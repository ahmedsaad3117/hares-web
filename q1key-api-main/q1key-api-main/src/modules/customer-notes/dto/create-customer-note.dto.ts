import { IsString, IsEnum, IsInt, IsOptional, MaxLength, MinLength } from 'class-validator';
import { NoteCategory } from '../entities/note-category.enum';

export class CreateCustomerNoteDto {
  @IsInt()
  customer_id: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1400)
  note_text: string;

  @IsEnum(NoteCategory)
  @IsOptional()
  category?: NoteCategory = NoteCategory.GENERAL;

  @IsInt()
  @IsOptional()
  branch_id?: number;
}
