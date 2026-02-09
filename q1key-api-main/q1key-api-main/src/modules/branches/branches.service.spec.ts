import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BranchesService } from "./branches.service";
import { Branch } from "../../entities/branch.entity";
import { Institution } from "../../entities/institution.entity";
import { User } from "../../entities/user.entity";
import { Customer } from "../../entities/customer.entity";
import { Loan } from "../../entities/loan.entity";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { UpdateBranchDto } from "./dto/update-branch.dto";

describe("BranchesService", () => {
  let service: BranchesService;
  let branchRepository: Repository<Branch>;

  const mockBranchRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  const mockInstitutionRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    count: jest.fn(),
  };

  const mockCustomerRepository = {};
  const mockLoanRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        {
          provide: getRepositoryToken(Branch),
          useValue: mockBranchRepository,
        },
        {
          provide: getRepositoryToken(Institution),
          useValue: mockInstitutionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoanRepository,
        },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
    branchRepository = module.get<Repository<Branch>>(
      getRepositoryToken(Branch),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("update", () => {
    const mockBranch = {
      branchId: 1,
      name: "Main Branch",
      institutionId: 1,
      totalLoans: 50,
      maximumLoans: 100,
      isActive: true,
      institution: {
        institutionId: 1,
        name: "Test Institution",
      },
    };

    it("should update branch maximumLoans field", async () => {
      // Arrange - RED PHASE: Test should FAIL initially
      const updateDto: UpdateBranchDto = {
        maximumLoans: 150,
      };

      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockBranchRepository.save.mockResolvedValue({
        ...mockBranch,
        maximumLoans: 150,
      });

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.maximumLoans).toBe(150);
      expect(mockBranchRepository.save).toHaveBeenCalled();
    });

    it("should allow Institution role to update maximumLoans", async () => {
      // Arrange
      const updateDto: UpdateBranchDto = {
        maximumLoans: 150,
      };

      const currentUser = {
        userId: 1,
        institutionId: 1,
        role: { roleName: "Institution" },
      };

      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockBranchRepository.save.mockResolvedValue({
        ...mockBranch,
        maximumLoans: 150,
      });

      // Act
      const result = await service.update(1, updateDto, currentUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.maximumLoans).toBe(150);
    });

    it("should prevent Institution from updating another institutions branch", async () => {
      // Arrange
      const updateDto: UpdateBranchDto = {
        maximumLoans: 150,
      };

      const currentUser = {
        userId: 1,
        institutionId: 2, // Different institution
        role: { roleName: "Institution" },
      };

      mockBranchRepository.findOne.mockResolvedValue(mockBranch);

      // Act & Assert
      await expect(service.update(1, updateDto, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.update(1, updateDto, currentUser)).rejects.toThrow(
        "You can only update branches in your institution",
      );
    });

    it("should throw NotFoundException when branch does not exist", async () => {
      // Arrange
      const updateDto: UpdateBranchDto = {
        maximumLoans: 150,
      };

      mockBranchRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
