import { IsString, IsEnum, IsOptional, MaxLength, MinLength } from 'class-validator';
import { NoteCategory } from '../entities/note-category.enum';

export class UpdateCustomerNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1400)
  @IsOptional()
  note_text?: string;

  @IsEnum(NoteCategory)
  @IsOptional()
  category?: NoteCategory;
}
