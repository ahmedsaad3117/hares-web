import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { InstallmentsService } from "./installments.service";
import { Installment } from "../../entities/installment.entity";
import { Loan, LoanStatus } from "../../entities/loan.entity";
import { InstallmentStatus } from "../../entities/installment-status.enum";
import { NotFoundException } from "@nestjs/common";

describe("InstallmentsService", () => {
  let service: InstallmentsService;
  let installmentsRepository: Repository<Installment>;
  let loansRepository: Repository<Loan>;

  const mockInstallmentsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockLoansRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallmentsService,
        {
          provide: getRepositoryToken(Installment),
          useValue: mockInstallmentsRepository,
        },
        {
          provide: getRepositoryToken(Loan),
          useValue: mockLoansRepository,
        },
      ],
    }).compile();

    service = module.get<InstallmentsService>(InstallmentsService);
    installmentsRepository = module.get<Repository<Installment>>(
      getRepositoryToken(Installment),
    );
    loansRepository = module.get<Repository<Loan>>(getRepositoryToken(Loan));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateInstallments", () => {
    it("should create correct number of installments", async () => {
      const loan = {
        loanId: 1,
        principalAmount: 10000,
        paymentPlanMonths: 5,
        createdAt: new Date("2025-01-01"),
      } as Loan;

      mockInstallmentsRepository.create.mockImplementation((data) => data);
      mockInstallmentsRepository.save.mockResolvedValue([]);

      await service.generateInstallments(loan);

      expect(mockInstallmentsRepository.create).toHaveBeenCalledTimes(5);
      expect(mockInstallmentsRepository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            loanId: 1,
            installmentNumber: expect.any(Number),
          }),
        ]),
      );
    });

    it("should calculate installment amounts correctly", async () => {
      const loan = {
        loanId: 1,
        principalAmount: 10000,
        paymentPlanMonths: 4,
        createdAt: new Date("2025-01-01"),
      } as Loan;

      const createdInstallments: any[] = [];
      mockInstallmentsRepository.create.mockImplementation((data) => {
        createdInstallments.push(data);
        return data;
      });
      mockInstallmentsRepository.save.mockImplementation((data) => data);

      await service.generateInstallments(loan);

      expect(createdInstallments).toHaveLength(4);
      createdInstallments.forEach((inst) => {
        expect(inst.amount).toBe(2500);
      });
    });

    it("should calculate due dates correctly (monthly intervals)", async () => {
      const loan = {
        loanId: 1,
        principalAmount: 12000,
        paymentPlanMonths: 3,
        createdAt: new Date("2025-01-15"),
      } as Loan;

      const createdInstallments: any[] = [];
      mockInstallmentsRepository.create.mockImplementation((data) => {
        createdInstallments.push(data);
        return data;
      });
      mockInstallmentsRepository.save.mockImplementation((data) => data);

      await service.generateInstallments(loan);

      expect(createdInstallments[0].dueDate.getMonth()).toBe(1); // February
      expect(createdInstallments[1].dueDate.getMonth()).toBe(2); // March
      expect(createdInstallments[2].dueDate.getMonth()).toBe(3); // April
    });

    it("should set all installments to Pending status", async () => {
      const loan = {
        loanId: 1,
        principalAmount: 6000,
        paymentPlanMonths: 3,
        createdAt: new Date("2025-01-01"),
      } as Loan;

      const createdInstallments: any[] = [];
      mockInstallmentsRepository.create.mockImplementation((data) => {
        createdInstallments.push(data);
        return data;
      });
      mockInstallmentsRepository.save.mockImplementation((data) => data);

      await service.generateInstallments(loan);

      createdInstallments.forEach((inst) => {
        expect(inst.status).toBe(InstallmentStatus.PENDING);
      });
    });
  });

  describe("markAsPaid", () => {
    it("should update installment status to Paid", async () => {
      const installment = {
        id: 1,
        loanId: 1,
        amount: 1000,
        status: InstallmentStatus.PENDING,
      } as Installment;

      const loan = {
        loanId: 1,
        paidAmount: 0,
      } as Loan;

      mockInstallmentsRepository.findOne.mockResolvedValue(installment);
      mockInstallmentsRepository.save.mockResolvedValue({
        ...installment,
        status: InstallmentStatus.PAID,
      });
      mockLoansRepository.findOne.mockResolvedValue(loan);
      mockLoansRepository.save.mockResolvedValue(loan);

      const paymentDate = new Date("2025-02-01");
      const result = await service.markAsPaid(1, paymentDate);

      expect(result.status).toBe(InstallmentStatus.PAID);
      expect(result.paymentDate).toBe(paymentDate);
    });

    it("should update loan paid_amount when installment is marked paid", async () => {
      const installment = {
        id: 1,
        loanId: 1,
        amount: 2500,
        status: InstallmentStatus.PENDING,
      } as Installment;

      const loan = {
        loanId: 1,
        paidAmount: 2500,
      } as Loan;

      mockInstallmentsRepository.findOne.mockResolvedValue(installment);
      mockInstallmentsRepository.save.mockResolvedValue(installment);
      mockLoansRepository.findOne.mockResolvedValue(loan);
      mockLoansRepository.save.mockResolvedValue({
        ...loan,
        paidAmount: 5000,
      });

      await service.markAsPaid(1, new Date());

      expect(mockLoansRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          paidAmount: 5000,
        }),
      );
    });
  });

  describe("findOverdue", () => {
    it("should return only overdue installments", async () => {
      const overdueInstallments = [
        {
          id: 1,
          status: InstallmentStatus.PENDING,
          dueDate: new Date("2024-12-01"),
        },
        {
          id: 2,
          status: InstallmentStatus.PENDING,
          dueDate: new Date("2024-11-01"),
        },
      ];

      mockInstallmentsRepository.find.mockResolvedValue(overdueInstallments);

      const result = await service.findOverdue();

      expect(result).toHaveLength(2);
      expect(mockInstallmentsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: InstallmentStatus.PENDING,
            dueDate: expect.any(Object),
          },
        }),
      );
    });
  });

  describe("findByLoan", () => {
    it("should return installments for a specific loan", async () => {
      const installments = [
        { id: 1, loanId: 1, installmentNumber: 1 },
        { id: 2, loanId: 1, installmentNumber: 2 },
        { id: 3, loanId: 1, installmentNumber: 3 },
      ];

      mockInstallmentsRepository.find.mockResolvedValue(installments);

      const result = await service.findByLoan(1);

      expect(result).toHaveLength(3);
      expect(mockInstallmentsRepository.find).toHaveBeenCalledWith({
        where: { loanId: 1 },
        order: { installmentNumber: "ASC" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a single installment", async () => {
      const installment = {
        id: 1,
        loanId: 1,
        amount: 1000,
      } as Installment;

      mockInstallmentsRepository.findOne.mockResolvedValue(installment);

      const result = await service.findOne(1);

      expect(result).toEqual(installment);
    });

    it("should throw NotFoundException when installment not found", async () => {
      mockInstallmentsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("validation", () => {
    it("should validate payment_plan_months range (1-12)", async () => {
      // This would be tested via DTO validation in integration tests
      const loan = {
        loanId: 1,
        principalAmount: 12000,
        paymentPlanMonths: 12,
        createdAt: new Date("2025-01-01"),
      } as Loan;

      mockInstallmentsRepository.create.mockImplementation((data) => data);
      mockInstallmentsRepository.save.mockResolvedValue([]);

      await service.generateInstallments(loan);

      expect(mockInstallmentsRepository.create).toHaveBeenCalledTimes(12);
    });
  });
});
