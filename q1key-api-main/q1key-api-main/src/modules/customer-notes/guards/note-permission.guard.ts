import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerNotesService } from '../customer-notes.service';

@Injectable()
export class NotePermissionGuard implements CanActivate {
  constructor(private customerNotesService: CustomerNotesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const noteId = parseInt(request.params.id, 10);

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Fetch the note to check ownership
    let note;
    try {
      note = await this.customerNotesService.findOne(noteId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw 404
      }
      throw error;
    }

    // Check permissions
    const isCreator = user.userId === note.created_by;
    const isInstitutionAdmin = user.role?.roleName === 'Institution';
    const isSuperAdmin = user.role?.roleName === 'Super Admin';

    if (isCreator || isInstitutionAdmin || isSuperAdmin) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have permission to modify this note',
    );
  }
}
