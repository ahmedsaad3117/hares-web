import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { CustomerNotesService } from "./customer-notes.service";
import { CustomerNote } from "./entities/customer-note.entity";
import { CreateCustomerNoteDto } from "./dto/create-customer-note.dto";
import { UpdateCustomerNoteDto } from "./dto/update-customer-note.dto";
import { NoteCategory } from "./entities/note-category.enum";
import { PaginationDto } from "../../common/dto/pagination.dto";

describe("CustomerNotesService", () => {
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

  describe("create", () => {
    const createDto: CreateCustomerNoteDto = {
      customer_id: 1,
      note_text: "Test note for customer",
      category: NoteCategory.GENERAL,
      branch_id: 1,
    };

    const userId = 5;
    const mockUser = {
      userId: 5,
      branchId: 1,
      role: { roleName: "Branch" },
    };

    it("should create a customer note with auto-filled audit fields", async () => {
      const mockCreatedAt = new Date();
      const mockNote = {
        id: 1,
        ...createDto,
        branch_id: 1,
        user_id: userId,
        created_by: userId,
        created_at: mockCreatedAt,
        last_edited_by: null,
        edited_at: null,
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(createDto, mockUser);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        branch_id: 1,
        user_id: userId,
        created_by: userId,
        created_at: expect.any(Date),
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockNote);
      expect(result).toEqual(mockNote);
      expect(result.created_by).toBe(userId);
      expect(result.created_at).toBe(mockCreatedAt);
    });

    it("should create note with default GENERAL category if not provided", async () => {
      const dtoWithoutCategory = {
        customer_id: 1,
        note_text: "Test note without category",
      };

      const mockNote = {
        id: 2,
        ...dtoWithoutCategory,
        category: NoteCategory.GENERAL,
        branch_id: 1,
        user_id: userId,
        created_by: userId,
        created_at: expect.any(Date),
      };

      mockRepository.create.mockReturnValue(mockNote);
      mockRepository.save.mockResolvedValue(mockNote);

      const result = await service.create(
        dtoWithoutCategory as CreateCustomerNoteDto,
        mockUser,
      );

      expect(result.category).toBe(NoteCategory.GENERAL);
    });
  });

  describe("findAll", () => {
    const pagination: PaginationDto = { page: 1, limit: 10 };

    it("should return paginated customer notes with metadata", async () => {
      const mockNotes = [
        {
          id: 1,
          customer_id: 1,
          note_text: "First note",
          category: NoteCategory.GENERAL,
          created_by: 5,
          created_at: new Date(),
        },
        {
          id: 2,
          customer_id: 2,
          note_text: "Second note",
          category: NoteCategory.FOLLOW_UP,
          created_by: 5,
          created_at: new Date(),
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockNotes, 2]);

      const result = await service.findAll(pagination);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        relations: ["customer", "user", "branch"],
        skip: 0,
        take: 10,
        order: { created_at: "DESC" },
      });
      expect(result.data).toEqual(mockNotes);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should handle pagination correctly for page 2", async () => {
      const paginationPage2: PaginationDto = { page: 2, limit: 10 };
      mockRepository.findAndCount.mockResolvedValue([[], 15]);

      const result = await service.findAll(paginationPage2);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        relations: ["customer", "user", "branch"],
        skip: 10,
        take: 10,
        order: { created_at: "DESC" },
      });
      expect(result.meta.totalPages).toBe(2);
    });

    it("should return empty array when no notes exist", async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(pagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe("findOne", () => {
    it("should return a customer note by id with relations", async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: "Test note",
        category: NoteCategory.GENERAL,
        customer: { customerId: 1, name: "John Doe" },
        user: { userId: 5, name: "Admin User" },
        branch: { branchId: 1, name: "Main Branch" },
      };

      mockRepository.findOne.mockResolvedValue(mockNote);

      const result = await service.findOne(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ["customer", "user", "branch"],
      });
      expect(result).toEqual(mockNote);
    });

    it("should throw NotFoundException when note does not exist", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        "Customer note with ID 999 not found",
      );
    });
  });

  describe("findByCustomer", () => {
    const customerId = 1;
    const pagination: PaginationDto = { page: 1, limit: 10 };

    it("should return paginated notes for specific customer", async () => {
      const mockNotes = [
        {
          id: 1,
          customer_id: customerId,
          note_text: "First note for customer",
          category: NoteCategory.GENERAL,
        },
        {
          id: 2,
          customer_id: customerId,
          note_text: "Second note for customer",
          category: NoteCategory.COMPLAINT,
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockNotes, 2]);

      const result = await service.findByCustomer(customerId, pagination);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { customer_id: customerId },
        relations: ["customer", "user", "branch"],
        skip: 0,
        take: 10,
        order: { created_at: "DESC" },
      });
      expect(result.data).toEqual(mockNotes);
      expect(result.meta.total).toBe(2);
    });

    it("should return empty array when customer has no notes", async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByCustomer(customerId, pagination);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe("update", () => {
    const noteId = 1;
    const userId = 5;
    const updateDto: UpdateCustomerNoteDto = {
      note_text: "Updated note text",
      category: NoteCategory.FOLLOW_UP,
    };

    it("should update note with auto-filled audit fields", async () => {
      const existingNote = {
        id: noteId,
        customer_id: 1,
        note_text: "Original text",
        category: NoteCategory.GENERAL,
        created_by: 3,
        created_at: new Date("2025-01-01"),
        last_edited_by: null,
        edited_at: null,
      };

      const mockEditedAt = new Date();
      const updatedNote = {
        ...existingNote,
        ...updateDto,
        last_edited_by: userId,
        edited_at: mockEditedAt,
      };

      mockRepository.findOne.mockResolvedValue(existingNote);
      mockRepository.save.mockResolvedValue(updatedNote);

      const result = await service.update(noteId, updateDto, userId);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          note_text: updateDto.note_text,
          category: updateDto.category,
          last_edited_by: userId,
          edited_at: expect.any(Date),
        }),
      );
      expect(result.last_edited_by).toBe(userId);
      expect(result.edited_at).toBe(mockEditedAt);
    });

    it("should throw NotFoundException when note does not exist", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should update only provided fields", async () => {
      const existingNote = {
        id: noteId,
        customer_id: 1,
        note_text: "Original text",
        category: NoteCategory.GENERAL,
        created_by: 3,
        created_at: new Date("2025-01-01"),
      };

      const partialUpdate: UpdateCustomerNoteDto = {
        note_text: "Only text updated",
      };

      mockRepository.findOne.mockResolvedValue(existingNote);
      mockRepository.save.mockResolvedValue({
        ...existingNote,
        ...partialUpdate,
        last_edited_by: userId,
        edited_at: new Date(),
      });

      const result = await service.update(noteId, partialUpdate, userId);

      expect(result.note_text).toBe(partialUpdate.note_text);
      expect(result.category).toBe(NoteCategory.GENERAL); // Unchanged
    });
  });

  describe("remove", () => {
    it("should delete a customer note", async () => {
      const mockNote = {
        id: 1,
        customer_id: 1,
        note_text: "Note to be deleted",
      };

      mockRepository.findOne.mockResolvedValue(mockNote);
      mockRepository.remove.mockResolvedValue(mockNote);

      await service.remove(1);

      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRepository.remove).toHaveBeenCalledWith(mockNote);
    });

    it("should throw NotFoundException when note does not exist", async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
