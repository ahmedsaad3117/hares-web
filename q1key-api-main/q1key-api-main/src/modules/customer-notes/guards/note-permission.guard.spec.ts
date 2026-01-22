import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotePermissionGuard } from './note-permission.guard';
import { CustomerNotesService } from '../customer-notes.service';
import { NoteCategory } from '../entities/note-category.enum';

describe('NotePermissionGuard', () => {
  let guard: NotePermissionGuard;
  let service: CustomerNotesService;

  const mockCustomerNotesService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotePermissionGuard,
        {
          provide: CustomerNotesService,
          useValue: mockCustomerNotesService,
        },
      ],
    }).compile();

    guard = module.get<NotePermissionGuard>(NotePermissionGuard);
    service = module.get<CustomerNotesService>(CustomerNotesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user: any, noteId: number): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { id: noteId.toString() },
        }),
      }),
    } as ExecutionContext;
  };

  describe('creator permissions', () => {
    it('should allow creator to access their own note', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 5,
        role: { roleName: 'Branch' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockCustomerNotesService.findOne).toHaveBeenCalledWith(1);
    });

    it('should deny non-creator non-admin from accessing note', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 10, // Different user
        role: { roleName: 'Branch' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'You do not have permission to modify this note',
      );
    });
  });

  describe('Institution Admin permissions', () => {
    it('should allow Institution Admin to access any note', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 10, // Different user
        role: { roleName: 'Institution' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow Institution Admin to access note created by others', async () => {
      const mockNote = {
        id: 2,
        customer_id: 1,
        note_text: 'Another note',
        category: NoteCategory.COMPLAINT,
        created_by: 15,
      };

      const mockUser = {
        userId: 20, // Different user
        role: { roleName: 'Institution' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 2);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Super Admin permissions', () => {
    it('should allow Super Admin to access any note', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 1,
        role: { roleName: 'Super Admin' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow Super Admin to access note created by others', async () => {
      const mockNote = {
        id: 3,
        customer_id: 2,
        note_text: 'Sensitive note',
        category: NoteCategory.PAYMENT_ISSUE,
        created_by: 25,
      };

      const mockUser = {
        userId: 1,
        role: { roleName: 'Super Admin' },
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 3);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockExecutionContext(null, 1);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User not authenticated');
    });

    it('should propagate NotFoundException when note does not exist', async () => {
      const mockUser = {
        userId: 5,
        role: { roleName: 'Branch' },
      };

      mockCustomerNotesService.findOne.mockRejectedValue(
        new NotFoundException('Customer note with ID 999 not found'),
      );

      const context = createMockExecutionContext(mockUser, 999);

      await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Customer note with ID 999 not found',
      );
    });

    it('should deny access for user with no role', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 10,
        role: null, // No role
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('role name variations', () => {
    it('should handle role names case-sensitively', async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        created_by: 5,
      };

      const mockUser = {
        userId: 10,
        role: { roleName: 'super admin' }, // lowercase
      };

      mockCustomerNotesService.findOne.mockResolvedValue(mockNote);

      const context = createMockExecutionContext(mockUser, 1);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
