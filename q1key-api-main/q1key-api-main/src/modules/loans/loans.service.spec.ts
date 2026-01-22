import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LoansService } from './loans.service';
import { Loan, LoanStatus } from '../../entities/loan.entity';
import { Customer } from '../../entities/customer.entity';
import { Branch } from '../../entities/branch.entity';
import { Product } from '../../entities/product.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateLoanDto } from './dto/create-loan.dto';
import { InstallmentsService } from '../installments/installments.service';

describe('LoansService', () => {
  let service: LoansService;
  let loanRepository: Repository<Loan>;
  let customerRepository: Repository<Customer>;
  let branchRepository: Repository<Branch>;
  let productRepository: Repository<Product>;
  let dataSource: DataSource;

  const mockLoanRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCustomerRepository = {
    findOne: jest.fn(),
  };

  const mockBranchRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockProductRepository = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockInstallmentsService = {
    generateInstallments: jest.fn(),
    findByLoan: jest.fn(),
    markAsPaid: jest.fn(),
    findOverdue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoanRepository,
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
        {
          provide: getRepositoryToken(Branch),
          useValue: mockBranchRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: InstallmentsService,
          useValue: mockInstallmentsService,
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    loanRepository = module.get<Repository<Loan>>(getRepositoryToken(Loan));
    customerRepository = module.get<Repository<Customer>>(getRepositoryToken(Customer));
    branchRepository = module.get<Repository<Branch>>(getRepositoryToken(Branch));
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createLoanDto: CreateLoanDto = {
      customerId: 1,
      branchId: 1,
      productId: 1,
      principalAmount: 10000,
    };

    const mockCustomer = {
      customerId: 1,
      name: 'John Doe',
      nationalId: '123456',
      phoneNumber: '0501234567',
    };

    const mockBranch = {
      branchId: 1,
      name: 'Main Branch',
      institutionId: 1,
      totalLoans: 50000,
      maximumLoans: 1000000,
    };

    const mockProduct = {
      productId: 1,
      name: 'Personal Loan',
      isActive: true,
    };

    it('should throw BadRequestException when branch is at capacity', async () => {
      // Arrange - RED PHASE: This test should FAIL initially
      const branchAtCapacity = {
        ...mockBranch,
        totalLoans: 100,
        maximumLoans: 100,
      };

      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(branchAtCapacity);
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      // Act & Assert
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        'Branch has insufficient loan capacity',
      );

      // Verify no loan was created
      expect(mockLoanRepository.create).not.toHaveBeenCalled();
      expect(mockLoanRepository.save).not.toHaveBeenCalled();
    });

    it('should successfully create loan when branch has available capacity', async () => {
      // Arrange
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const mockCreatedLoan = {
        loanId: 1,
        ...createLoanDto,
        status: LoanStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTransactionManager = {
        increment: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockReturnValue(mockCreatedLoan),
        save: jest.fn().mockResolvedValue(mockCreatedLoan),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockTransactionManager);
      });

      mockLoanRepository.findOne.mockResolvedValue({
        ...mockCreatedLoan,
        paymentPlanMonths: 1,
        paidAmount: 0,
        customer: mockCustomer,
        branch: mockBranch,
        product: mockProduct,
      });

      mockInstallmentsService.generateInstallments.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createLoanDto, { userId: 1 });

      // Assert
      expect(result).toBeDefined();
      expect(result.loanId).toBe(1);
      expect(mockCustomerRepository.findOne).toHaveBeenCalledWith({
        where: { customerId: createLoanDto.customerId },
      });
      expect(mockBranchRepository.findOne).toHaveBeenCalledWith({
        where: { branchId: createLoanDto.branchId },
      });
      expect(mockProductRepository.findOne).toHaveBeenCalledWith({
        where: { productId: createLoanDto.productId },
      });
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      // Arrange
      mockCustomerRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        `Customer with ID ${createLoanDto.customerId} not found`,
      );
    });

    it('should throw NotFoundException when branch does not exist', async () => {
      // Arrange
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        `Branch with ID ${createLoanDto.branchId} not found`,
      );
    });

    it('should throw NotFoundException when product does not exist', async () => {
      // Arrange
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockProductRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        `Product with ID ${createLoanDto.productId} not found`,
      );
    });

    it('should throw BadRequestException when product is inactive', async () => {
      // Arrange
      const inactiveProduct = { ...mockProduct, isActive: false };
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockProductRepository.findOne.mockResolvedValue(inactiveProduct);

      // Act & Assert
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createLoanDto, { userId: 1 })).rejects.toThrow(
        `Product ${inactiveProduct.name} is not active and cannot be used for new loans`,
      );
    });
  });

  describe('Branch Capacity Management', () => {
    const createLoanDto: CreateLoanDto = {
      customerId: 1,
      branchId: 1,
      productId: 1,
      principalAmount: 10000,
    };

    const mockCustomer = {
      customerId: 1,
      name: 'John Doe',
      nationalId: '123456',
      phoneNumber: '0501234567',
    };

    const mockBranch = {
      branchId: 1,
      name: 'Main Branch',
      institutionId: 1,
      totalLoans: 50000,
      maximumLoans: 1000000,
    };

    const mockProduct = {
      productId: 1,
      name: 'Personal Loan',
      isActive: true,
    };

    it('should atomically update branch counters when loan is created', async () => {
      // Arrange - RED PHASE: This should FAIL until we implement transaction logic
      mockCustomerRepository.findOne.mockResolvedValue(mockCustomer);
      mockBranchRepository.findOne.mockResolvedValue(mockBranch);
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const mockTransactionManager = {
        increment: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockReturnValue({
          loanId: 1,
          ...createLoanDto,
          status: LoanStatus.ACTIVE,
        }),
        save: jest.fn().mockResolvedValue({
          loanId: 1,
          ...createLoanDto,
          status: LoanStatus.ACTIVE,
        }),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockTransactionManager);
      });

      mockLoanRepository.findOne.mockResolvedValue({
        loanId: 1,
        ...createLoanDto,
        status: LoanStatus.ACTIVE,
        paymentPlanMonths: 1,
        paidAmount: 0,
        customer: mockCustomer,
        branch: mockBranch,
        product: mockProduct,
        createdAt: new Date(),
        updatedAt: new Date(),
        dueDate: null,
      });

      mockInstallmentsService.generateInstallments.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createLoanDto, { userId: 1 });

      // Assert
      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockTransactionManager.increment).toHaveBeenCalledWith(
        Branch,
        { branchId: mockBranch.branchId },
        'totalLoans',
        createLoanDto.principalAmount,
      );
      expect(mockTransactionManager.create).toHaveBeenCalled();
      expect(mockTransactionManager.save).toHaveBeenCalled();
    });

    it('should handle concurrent loan creation correctly', async () => {
      // Edge case test for Task 8
      // Testing race conditions
    });
  });
});
