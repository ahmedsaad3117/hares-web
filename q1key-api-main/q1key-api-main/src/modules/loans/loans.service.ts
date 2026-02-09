import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Loan, LoanStatus } from '../../entities/loan.entity';
import { CashBox } from '../../entities/cash-box.entity';
import { Customer } from '../../entities/customer.entity';
import { Branch } from '../../entities/branch.entity';
import { Institution } from '../../entities/institution.entity';
import { Product } from '../../entities/product.entity';
import { Installment } from '../../entities/installment.entity';
import { CashBoxTransaction } from '../../entities/cash-box-transaction.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { LoanResponseDto } from './dto/loan-response.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { InstallmentsService } from '../installments/installments.service';
import { CashBoxService } from '../cash-box/cash-box.service';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly installmentsService: InstallmentsService,
    private readonly cashBoxService: CashBoxService,
  ) { }

  async create(createLoanDto: CreateLoanDto, user: any): Promise<LoanResponseDto> {
    // Validate that either branchId or institutionId is provided (but not both)
    if (!createLoanDto.branchId && !createLoanDto.institutionId) {
      throw new BadRequestException('Either branchId or institutionId must be provided');
    }

    if (createLoanDto.branchId && createLoanDto.institutionId) {
      throw new BadRequestException('Cannot provide both branchId and institutionId');
    }

    // Verify customer exists
    const customer = await this.customerRepository.findOne({
      where: { customerId: createLoanDto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${createLoanDto.customerId} not found`,
      );
    }

    let branch: Branch | null = null;
    let institution: Institution | null = null;

    // Verify branch or institution exists
    if (createLoanDto.branchId) {
      branch = await this.branchRepository.findOne({
        where: { branchId: createLoanDto.branchId },
        relations: ['institution'],
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID ${createLoanDto.branchId} not found`,
        );
      }
    } else if (createLoanDto.institutionId) {
      institution = await this.institutionRepository.findOne({
        where: { institutionId: createLoanDto.institutionId },
      });
      if (!institution) {
        throw new NotFoundException(
          `Institution with ID ${createLoanDto.institutionId} not found`,
        );
      }
      // Verify institution existance is already done above. 
      // We allow institutions to have their own loans even if they can create branches.
    }

    // Verify product exists and is active
    const product = await this.productRepository.findOne({
      where: { productId: createLoanDto.productId },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with ID ${createLoanDto.productId} not found`,
      );
    }
    if (!product.isActive) {
      throw new BadRequestException(
        `Product ${product.name} is not active and cannot be used for new loans`,
      );
    }

    // Atomic transaction: Create loan and update branch/institution total amount
    const { savedLoan, warning } = await this.dataSource.transaction(async (manager) => {
      // Update branch or institution total loan amount atomically with capacity check
      if (branch) {
        // Use pessimistic lock to prevent concurrent capacity overruns
        const lockedBranch = await manager.findOne(Branch, {
          where: { branchId: branch.branchId },
          lock: { mode: 'pessimistic_write' }
        });

        if (!lockedBranch) throw new NotFoundException('Branch not found');

        if (lockedBranch.maximumLoans > 0 && (lockedBranch.totalLoans + createLoanDto.principalAmount > lockedBranch.maximumLoans)) {
          throw new BadRequestException(`Branch capacity exceeded. Current: ${lockedBranch.totalLoans}, Max: ${lockedBranch.maximumLoans}`);
        }

        lockedBranch.totalLoans += createLoanDto.principalAmount;
        await manager.save(lockedBranch);
      } else if (institution) {
        const lockedInst = await manager.findOne(Institution, {
          where: { institutionId: institution.institutionId },
          lock: { mode: 'pessimistic_write' }
        });

        if (!lockedInst) throw new NotFoundException('Institution not found');

        if (lockedInst.maximumLoans > 0 && (lockedInst.totalLoans + createLoanDto.principalAmount > lockedInst.maximumLoans)) {
          throw new BadRequestException(`Institution capacity exceeded. Current: ${lockedInst.totalLoans}, Max: ${lockedInst.maximumLoans}`);
        }

        lockedInst.totalLoans += createLoanDto.principalAmount;
        await manager.save(lockedInst);
      }

      // Create and save loan
      const loan = manager.create(Loan, {
        customerId: createLoanDto.customerId,
        branchId: createLoanDto.branchId,
        institutionId: createLoanDto.institutionId,
        productId: createLoanDto.productId,
        principalAmount: createLoanDto.principalAmount,
        profitAmount: createLoanDto.profitAmount || 0,
        status: LoanStatus.ACTIVE,
        createdBy: user?.userId,
        dueDate: createLoanDto.dueDate ? new Date(createLoanDto.dueDate) : undefined,
        paymentPlanMonths: createLoanDto.paymentPlanMonths || 1,
      });

      const saved = await manager.save(loan);

      // 3. Record cash box disbursement
      const { warning } = await this.cashBoxService.recordLoanDisbursement(
        createLoanDto.branchId,
        createLoanDto.institutionId,
        saved.loanId,
        parseFloat(saved.principalAmount.toString()),
        user?.userId,
        manager
      );

      return { savedLoan: saved, warning };
    });

    // Generate installments after loan creation
    await this.installmentsService.generateInstallments(savedLoan);

    const loanResponse = await this.findOne(savedLoan.loanId);

    if (warning) {
      (loanResponse as any).cashBoxWarning = warning;
    }

    return loanResponse;
  }

  async findAll(paginationDto: PaginationDto, user?: any): Promise<PaginatedResult<LoanResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const Skip = (page - 1) * limit;
    const Take = limit;

    // Build query to filter by institution
    const queryBuilder = this.loanRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .leftJoinAndSelect('loan.institution', 'loanInstitution')
      .leftJoinAndSelect('loan.product', 'product')
      .leftJoinAndSelect('branch.institution', 'branchInstitution')
      .orderBy('loan.createdAt', 'DESC')
      .skip(Skip)
      .take(Take);

    // Filter by status if provided
    if (paginationDto.status) {
      queryBuilder.andWhere('loan.status = :status', { status: paginationDto.status });
    }

    // Filter by institution unless Super Admin
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      queryBuilder.andWhere(
        '(branch.institution_id = :institutionId OR loan.institution_id = :institutionId)',
        { institutionId: user.institutionId }
      );
    }

    const [loans, total] = await queryBuilder.getManyAndCount();

    return {
      data: loans.map((loan) => this.toResponseDto(loan)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCustomer(customerId: number, user?: any): Promise<LoanResponseDto[]> {
    const queryBuilder = this.loanRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .leftJoinAndSelect('loan.institution', 'loanInstitution')
      .leftJoinAndSelect('loan.product', 'product')
      .leftJoinAndSelect('branch.institution', 'branchInstitution')
      .where('loan.customerId = :customerId', { customerId })
      .orderBy('loan.createdAt', 'DESC');

    // Filter by institution unless Super Admin
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      queryBuilder.andWhere(
        '(branch.institution_id = :institutionId OR loan.institution_id = :institutionId)',
        { institutionId: user.institutionId }
      );
    }

    const loans = await queryBuilder.getMany();
    return loans.map((loan) => this.toResponseDto(loan));
  }

  async findByBranch(branchId: number, user?: any): Promise<LoanResponseDto[]> {
    const queryBuilder = this.loanRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .leftJoinAndSelect('loan.institution', 'loanInstitution')
      .leftJoinAndSelect('loan.product', 'product')
      .leftJoinAndSelect('branch.institution', 'branchInstitution')
      .where('loan.branchId = :branchId', { branchId })
      .orderBy('loan.createdAt', 'DESC');

    // Filter by institution unless Super Admin
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      queryBuilder.andWhere(
        '(branch.institution_id = :institutionId OR loan.institution_id = :institutionId)',
        { institutionId: user.institutionId }
      );
    }

    const loans = await queryBuilder.getMany();
    return loans.map((loan) => this.toResponseDto(loan));
  }

  async findByStatus(status: LoanStatus, user?: any): Promise<LoanResponseDto[]> {
    const queryBuilder = this.loanRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .leftJoinAndSelect('loan.institution', 'loanInstitution')
      .leftJoinAndSelect('loan.product', 'product')
      .leftJoinAndSelect('branch.institution', 'branchInstitution')
      .where('loan.status = :status', { status })
      .orderBy('loan.createdAt', 'DESC');

    // Filter by institution unless Super Admin
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      queryBuilder.andWhere(
        '(branch.institution_id = :institutionId OR loan.institution_id = :institutionId)',
        { institutionId: user.institutionId }
      );
    }

    const loans = await queryBuilder.getMany();
    return loans.map((loan) => this.toResponseDto(loan));
  }

  async search(searchTerm: string, user?: any): Promise<LoanResponseDto[]> {
    const queryBuilder = this.loanRepository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .leftJoinAndSelect('loan.institution', 'loanInstitution')
      .leftJoinAndSelect('loan.product', 'product')
      .leftJoinAndSelect('branch.institution', 'branchInstitution')
      .orderBy('loan.createdAt', 'DESC')
      .take(100); // Limit results for performance

    // Filter by institution FIRST (uses index) before text search
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      queryBuilder.andWhere(
        '(branch.institution_id = :institutionId OR loan.institution_id = :institutionId)',
        { institutionId: user.institutionId }
      );
    }

    // Then apply text search (more expensive operation)
    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      // Check if search term is numeric (likely loan ID or amount)
      const isNumeric = /^\d+$/.test(searchTerm.trim());

      if (isNumeric) {
        // Numeric search - prioritize indexed columns
        queryBuilder.andWhere(
          '(loan.loanId = :exactId OR CAST(loan.principalAmount AS TEXT) ILIKE :term OR customer.nationalId = :exactTerm OR customer.phoneNumber = :exactTerm)',
          { term, exactId: parseInt(searchTerm.trim()), exactTerm: searchTerm.trim() }
        );
      } else {
        // Text search
        queryBuilder.andWhere(
          '(customer.name ILIKE :term OR branch.name ILIKE :term OR product.name ILIKE :term)',
          { term }
        );
      }
    }

    const loans = await queryBuilder.getMany();
    return loans.map((loan) => this.toResponseDto(loan));
  }

  async findOne(id: number, user?: any): Promise<LoanResponseDto> {
    const loan = await this.loanRepository.findOne({
      where: { loanId: id },
      relations: ['customer', 'branch', 'branch.institution', 'institution', 'product', 'creator', 'installments'],
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    // Security check: only show if Super Admin or same institution
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== 'Super Admin' && user.institutionId) {
      const loanInstId = loan.branch?.institutionId || loan.institutionId;
      if (loanInstId !== user.institutionId) {
        throw new NotFoundException(`Loan with ID ${id} not found or access denied`);
      }
    }

    return this.toResponseDto(loan);
  }

  async update(id: number, updateLoanDto: UpdateLoanDto, user?: any): Promise<LoanResponseDto> {
    const loan = await this.loanRepository.findOne({
      where: { loanId: id },
      relations: ['installments']
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    // Check permissions
    if (user && user.role !== 'Super Admin') {
      const isCreator = loan.createdBy === user.userId;
      const isSameInstitution = user.institutionId && (
        loan.institutionId === user.institutionId ||
        (loan.branchId && user.branchId === loan.branchId)
      );

      if (!isCreator && !isSameInstitution) {
        throw new BadRequestException('You do not have permission to update this loan');
      }
    }

    const currentPrincipal = parseFloat(loan.principalAmount.toString());
    const currentProfit = parseFloat(loan.profitAmount.toString());

    const isPrincipalChanged = updateLoanDto.principalAmount !== undefined && updateLoanDto.principalAmount !== currentPrincipal;
    const isPlanChanged = updateLoanDto.paymentPlanMonths !== undefined && updateLoanDto.paymentPlanMonths !== loan.paymentPlanMonths;
    const isProfitChanged = updateLoanDto.profitAmount !== undefined && updateLoanDto.profitAmount !== currentProfit;

    console.log('Update Debug:', {
      updateDto: updateLoanDto,
      currentPlan: loan.paymentPlanMonths,
      newPlan: updateLoanDto.paymentPlanMonths,
      isPlanChanged,
      isPrincipalChanged,
      isProfitChanged
    });

    // Check Date change
    let isDueDateChanged = false;
    if (updateLoanDto.dueDate) {
      const newDate = new Date(updateLoanDto.dueDate).setHours(0, 0, 0, 0);
      const oldDate = loan.dueDate ? new Date(loan.dueDate).setHours(0, 0, 0, 0) : 0;
      isDueDateChanged = newDate !== oldDate;
    }

    if (isPrincipalChanged || isPlanChanged || isDueDateChanged || isProfitChanged) {
      // 1. Validate: Cannot change terms if any installment is paid
      const hasPaidInstallments = loan.installments?.some(i => i.status === 'Paid');
      if (hasPaidInstallments) {
        throw new BadRequestException('Cannot update loan terms (Amount, Plan, or Date) because some installments are already paid.');
      }

      await this.dataSource.transaction(async (manager) => {
        // 2. Handle Principal Change (CashBox & Stats)
        if (isPrincipalChanged && updateLoanDto.principalAmount !== undefined) {
          const newPrincipal = updateLoanDto.principalAmount;
          const diff = newPrincipal - currentPrincipal;

          // Update Cash Box (Disburse diff if +, Refund if -)
          // recordLoanDisbursement subtracts the amount. 
          // Passing positive diff subtracts (Withdraw). Passing negative diff adds (Deposit).
          await this.cashBoxService.recordLoanDisbursement(
            loan.branchId,
            loan.institutionId,
            loan.loanId,
            diff,
            user?.userId,
            manager,
            `تعديل قرض رقم ${loan.loanId}`
          );

          // Update Stats
          const Entity = loan.branchId ? Branch : Institution;
          const criteria = loan.branchId ? { branchId: loan.branchId } : { institutionId: loan.institutionId };

          if (diff > 0) {
            await manager.increment(Entity, criteria, 'totalLoans', diff);
          } else {
            await manager.decrement(Entity, criteria, 'totalLoans', Math.abs(diff));
          }

          loan.principalAmount = newPrincipal;
        }

        // 3. Update other fields
        if (updateLoanDto.paymentPlanMonths) loan.paymentPlanMonths = updateLoanDto.paymentPlanMonths;
        if (updateLoanDto.profitAmount !== undefined) loan.profitAmount = updateLoanDto.profitAmount;
        if (updateLoanDto.dueDate) loan.dueDate = new Date(updateLoanDto.dueDate);
        if (updateLoanDto.status) loan.status = updateLoanDto.status;

        // 4. Delete old installments
        await manager.delete(Installment, { loanId: id });

        // Clear installments from memory to prevent cascade re-insertion
        loan.installments = [];

        // 5. Save Loan
        await manager.save(loan);

        // 6. Regenerate Installments
        await this.installmentsService.generateInstallments(loan, manager);
      });

    } else {
      // Non-structural update
      if (updateLoanDto.status) {
        loan.status = updateLoanDto.status;
      }
      await this.loanRepository.save(loan);
    }

    return this.findOne(loan.loanId);
  }

  async updateStatus(id: number, status: LoanStatus): Promise<LoanResponseDto> {
    const loan = await this.loanRepository.findOne({
      where: { loanId: id },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    loan.status = status;
    await this.loanRepository.save(loan);
    return this.findOne(id);
  }

  async getStatistics(): Promise<any> {
    const total = await this.loanRepository.count();
    const active = await this.loanRepository.count({ where: { status: LoanStatus.ACTIVE } });
    const late = await this.loanRepository.count({ where: { status: LoanStatus.LATE } });
    const paid = await this.loanRepository.count({ where: { status: LoanStatus.PAID } });
    const finished = await this.loanRepository.count({ where: { status: LoanStatus.FINISHED } });

    const totalAmount = await this.loanRepository
      .createQueryBuilder('loan')
      .select('SUM(loan.principal_amount)', 'total')
      .where('loan.status IN (:...statuses)', { statuses: [LoanStatus.ACTIVE, LoanStatus.LATE] })
      .getRawOne();

    return {
      total,
      byStatus: {
        active,
        late,
        paid,
        finished,
      },
      totalOutstandingAmount: parseFloat(totalAmount?.total || '0'),
    };
  }

  private toResponseDto(loan: Loan): LoanResponseDto {
    const response: LoanResponseDto = {
      loanId: loan.loanId,
      customerId: loan.customerId,
      branchId: loan.branchId,
      institutionId: loan.institutionId,
      productId: loan.productId,
      principalAmount: parseFloat(loan.principalAmount.toString()),
      profitAmount: parseFloat((loan.profitAmount || 0).toString()),
      status: loan.status,
      createdBy: loan.createdBy,
      createdByName: loan.creator?.name,
      createdAt: loan.createdAt,
      dueDate: loan.dueDate,
      updatedAt: loan.updatedAt,
      paymentPlanMonths: loan.paymentPlanMonths,
      paidAmount: parseFloat(loan.paidAmount.toString()),
    };

    if (loan.customer) {
      response.customer = {
        customerId: loan.customer.customerId,
        name: loan.customer.name,
        nationalId: loan.customer.nationalId,
        phoneNumber: loan.customer.phoneNumber,
      };
    }

    if (loan.branch) {
      response.branch = {
        branchId: loan.branch.branchId,
        name: loan.branch.name,
      };

      if (loan.branch.institution) {
        response.branch.institution = {
          institutionId: loan.branch.institution.institutionId,
          name: loan.branch.institution.name,
        };
      }
    }

    if (loan.institution) {
      response.institution = {
        institutionId: loan.institution.institutionId,
        name: loan.institution.name,
      };
    }

    if (loan.product) {
      response.product = {
        productId: loan.product.productId,
        name: loan.product.name,
      };
    }

    if (loan.installments && loan.installments.length > 0) {
      response.installments = loan.installments.map((installment) => ({
        id: installment.id,
        installmentNumber: installment.installmentNumber,
        dueDate: installment.dueDate,
        amount: parseFloat(installment.amount.toString()),
        status: installment.status,
        paymentDate: installment.paymentDate,
      }));
    }

    return response;
  }

  async remove(id: number): Promise<void> {
    const loan = await this.findOne(id);
    const installmentIds = loan.installments?.map(i => i.id) || [];
    const amount = parseFloat(loan.principalAmount.toString());

    await this.dataSource.transaction(async (manager) => {
      // 1. Revert Branch/Institution total loans
      if (loan.branchId) {
        await manager.decrement(
          Branch,
          { branchId: loan.branchId },
          'totalLoans',
          amount
        );
      } else if (loan.institutionId) {
        await manager.decrement(
          Institution,
          { institutionId: loan.institutionId },
          'totalLoans',
          amount
        );
      }

      // 2. Revert CashBox balance (Refund the money)
      let cashBox: CashBox | null = null;
      if (loan.branchId) {
        cashBox = await this.cashBoxService.getOrCreateBranchCashBox(loan.branchId, manager);
      } else if (loan.institutionId) {
        cashBox = await this.cashBoxService.getOrCreateInstitutionCashBox(loan.institutionId, manager);
      }

      if (cashBox) {
        const currentBalance = parseFloat(cashBox.balance.toString());
        cashBox.balance = currentBalance + amount;
        await manager.save(cashBox);
      }

      // 3. Delete transactions for installments
      if (installmentIds.length > 0) {
        await manager.delete(CashBoxTransaction, { installmentId: In(installmentIds) });
      }

      // 4. Delete transactions for loan
      await manager.delete(CashBoxTransaction, { loanId: id });

      // 5. Delete installments
      await manager.delete(Installment, { loanId: id });

      // 6. Delete loan
      await manager.delete(Loan, { loanId: id });
    });
  }
}
