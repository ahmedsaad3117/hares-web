import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerNotesService } from './customer-notes.service';
import { CustomerNote } from './entities/customer-note.entity';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { NoteCategory } from './entities/note-category.enum';

describe('CustomerNotesService - Branch Assignment Logic', () => {
  let service: CustomerNotesService;
  let repository: Repository<CustomerNote>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerNotesService,
        {
          provide: getRepositoryToken(CustomerNote),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CustomerNotesService>(CustomerNotesService);
    repository = module.get<Repository<CustomerNote>>(
      getRepositoryToken(CustomerNote),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Branch Assignment for Regular Users (Branch role)', () => {
    const branchUser = {
      userId: 10,
      branchId: 5,
      role: { roleName: 'Branch' },
    };

    it('should auto-assign branch from user for regular users', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
      };

      const mockNote = {
        id: 1,
        ...createDto,
        branch_id: 5, // User's branch
        user_id: 10,
        created_by: 10,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, branchUser);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 5,
          user_id: 10,
          created_by: 10,
        }),
      );
      expect(result.branch_id).toBe(5);
    });

    it('should ignore branch_id in request for regular users', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        branch_id: 99, // Trying to override
      };

      const mockNote = {
        id: 1,
        ...createDto,
        branch_id: 5, // User's branch, not 99
        user_id: 10,
        created_by: 10,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, branchUser);

      // Should use user's branch, not provided branch_id
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 5, // User's branch
        }),
      );
      expect(result.branch_id).toBe(5);
    });
  });

  describe('Branch Assignment for Institution Admin', () => {
    const institutionAdmin = {
      userId: 20,
      branchId: 3,
      role: { roleName: 'Institution' },
    };

    it('should use provided branch_id when Institution Admin provides one', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Admin note',
        category: NoteCategory.COMPLAINT,
        branch_id: 10, // Manual override
      };

      const mockNote = {
        id: 2,
        ...createDto,
        branch_id: 10, // Provided branch_id
        user_id: 20,
        created_by: 20,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, institutionAdmin);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 10, // Provided value
        }),
      );
      expect(result.branch_id).toBe(10);
    });

    it('should use user branch when Institution Admin does not provide branch_id', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Admin note without branch',
        category: NoteCategory.GENERAL,
      };

      const mockNote = {
        id: 3,
        ...createDto,
        branch_id: 3, // User's default branch
        user_id: 20,
        created_by: 20,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, institutionAdmin);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 3, // User's branch
        }),
      );
      expect(result.branch_id).toBe(3);
    });
  });

  describe('Branch Assignment for Super Admin', () => {
    const superAdmin = {
      userId: 1,
      branchId: 1,
      role: { roleName: 'Super Admin' },
    };

    it('should use provided branch_id when Super Admin provides one', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Super admin note',
        category: NoteCategory.PAYMENT_ISSUE,
        branch_id: 15, // Manual override
      };

      const mockNote = {
        id: 4,
        ...createDto,
        branch_id: 15, // Provided branch_id
        user_id: 1,
        created_by: 1,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, superAdmin);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 15, // Provided value
        }),
      );
      expect(result.branch_id).toBe(15);
    });

    it('should use user branch when Super Admin does not provide branch_id', async () => {
      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Super admin note without branch',
        category: NoteCategory.GENERAL,
      };

      const mockNote = {
        id: 5,
        ...createDto,
        branch_id: 1, // User's default branch
        user_id: 1,
        created_by: 1,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, superAdmin);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 1, // User's branch
        }),
      );
      expect(result.branch_id).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with null branchId', async () => {
      const userWithoutBranch = {
        userId: 30,
        branchId: null,
        role: { roleName: 'Branch' },
      };

      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
      };

      const mockNote = {
        id: 6,
        ...createDto,
        branch_id: null,
        user_id: 30,
        created_by: 30,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, userWithoutBranch);

      expect(result.branch_id).toBeNull();
    });

    it('should handle user with no role object', async () => {
      const userWithoutRole = {
        userId: 40,
        branchId: 7,
        role: null,
      };

      const createDto: CreateCustomerNoteDto = {
        customer_id: 1,
        note_text: 'Test note',
        category: NoteCategory.GENERAL,
        branch_id: 99, // Trying to override
      };

      const mockNote = {
        id: 7,
        ...createDto,
        branch_id: 7, // User's branch (override ignored)
        user_id: 40,
        created_by: 40,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, userWithoutRole);

      // Should default to user's branch since no admin role
      expect(result.branch_id).toBe(7);
    });
  });
});
