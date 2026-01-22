import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerNotesService } from './customer-notes.service';
import { CustomerNotesController } from './customer-notes.controller';
import { CustomerNote } from './entities/customer-note.entity';
import { NotePermissionGuard } from './guards/note-permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerNote])],
  controllers: [CustomerNotesController],
  providers: [CustomerNotesService, NotePermissionGuard],
  exports: [CustomerNotesService],
})
export class CustomerNotesModule {}
