import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Institution } from '../../entities/institution.entity';
import { User } from '../../entities/user.entity';
import { Customer } from '../../entities/customer.entity';
import { Loan } from '../../entities/loan.entity';
import { Branch } from '../../entities/branch.entity';
import { UsersService } from '../users/users.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { SubscriptionRequest, RequesterType, SubscriptionRequestStatus } from '../../entities/subscription-request.entity';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { CashBox, CashBoxType } from '../../entities/cash-box.entity';
import { CashBoxTransaction, TransactionType } from '../../entities/cash-box-transaction.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private institutionsRepository: Repository<Institution>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    @InjectRepository(SubscriptionRequest)
    private requestsRepository: Repository<SubscriptionRequest>,
    @InjectRepository(SubscriptionPlan)
    private plansRepository: Repository<SubscriptionPlan>,
    @InjectRepository(CashBox)
    private cashBoxRepository: Repository<CashBox>,
    @InjectRepository(CashBoxTransaction)
    private transactionRepository: Repository<CashBoxTransaction>,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) { }

  async create(createInstitutionDto: CreateInstitutionDto): Promise<any> {
    const { planId, ...institutionData } = createInstitutionDto;

    // Check if taxId already exists in institutions
    if (institutionData.taxId) {
      const existingInstitution = await this.institutionsRepository.findOne({
        where: { taxId: institutionData.taxId }
      });
      if (existingInstitution) {
        throw new BadRequestException('رقم السجل التجاري مسجل مسبقاً في مؤسسة أخرى');
      }

      // Check if taxId exists in pending subscription requests
      const pendingRequests = await this.requestsRepository
        .createQueryBuilder('request')
        .where('request.status = :status', { status: SubscriptionRequestStatus.PENDING })
        .andWhere('request.pending_data IS NOT NULL')
        .getMany();

      for (const req of pendingRequests) {
        try {
          const pendingData = JSON.parse(req.pendingData || '{}');
          if (pendingData.taxId === institutionData.taxId) {
            throw new BadRequestException('رقم السجل التجاري مستخدم في طلب اشتراك قيد المراجعة');
          }
        } catch (e) {
          // Skip if pendingData is not valid JSON
        }
      }
    }

    // Check if admin email is already taken in the system
    if (createInstitutionDto.adminEmail) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: createInstitutionDto.adminEmail.trim() }
      });
      if (existingUser) {
        throw new BadRequestException('البريد الإلكتروني لمدير المؤسسة مسجل مسبقاً في النظام');
      }
    }

    // Validate Plan if provided
    let plan: SubscriptionPlan | null = null;
    if (planId) {
      plan = await this.plansRepository.findOne({ where: { id: planId } });
      if (!plan) {
        throw new BadRequestException('Invalid subscription plan ID');
      }
    } else {
      throw new BadRequestException('Subscription Plan is required');
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);

    // Create Subscription Request with PENDING DATA
    // We don't create the institution or user yet
    const request = this.requestsRepository.create({
      requesterType: RequesterType.INSTITUTION,
      planId: plan.id,
      amount: plan.price,
      status: SubscriptionRequestStatus.PENDING,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      notes: `طلب اشتراك جديد لمؤسسة: ${institutionData.name}`,
      pendingData: JSON.stringify(createInstitutionDto) // Store full data
    });

    return await this.requestsRepository.save(request);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Institution>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [institutions, total] = await this.institutionsRepository.findAndCount({
      relations: ['branches'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: institutions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async search(searchTerm: string): Promise<Institution[]> {
    const queryBuilder = this.institutionsRepository
      .createQueryBuilder('institution')
      .leftJoinAndSelect('institution.branches', 'branches')
      .orderBy('institution.createdAt', 'DESC');

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      queryBuilder.where(
        '(institution.name ILIKE :term OR institution.phoneNumber ILIKE :term OR CAST(institution.institutionId AS TEXT) ILIKE :term)',
        { term }
      );
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Institution> {
    const institution = await this.institutionsRepository.findOne({
      where: { institutionId: id },
      relations: ['branches'],
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found`);
    }

    return institution;
  }

  async update(id: number, updateInstitutionDto: UpdateInstitutionDto): Promise<Institution> {
    const institution = await this.findOne(id);

    // If reducing maxUsers, check current user count
    if (updateInstitutionDto.maxUsers !== undefined && updateInstitutionDto.maxUsers < institution.maxUsers) {
      const userCount = await this.usersRepository.count({
        where: { institutionId: id },
      });

      if (userCount > updateInstitutionDto.maxUsers) {
        throw new BadRequestException(
          `Cannot reduce max users to ${updateInstitutionDto.maxUsers}. Current user count: ${userCount}`
        );
      }
    }

    Object.assign(institution, updateInstitutionDto);
    return await this.institutionsRepository.save(institution);
  }

  async remove(id: number): Promise<void> {
    const institution = await this.findOne(id);

    // Check for branches
    const branchCount = await this.branchesRepository.count({ where: { institutionId: id } });
    if (branchCount > 0) {
      throw new BadRequestException(`لا يمكن حذف المؤسسة لوجود ${branchCount} فروع مرتبطة بها. يرجى حذف الفروع أولاً.`);
    }

    // Check for loans
    const loanCount = await this.loansRepository.count({ where: { institutionId: id } });
    if (loanCount > 0) {
      throw new BadRequestException(`لا يمكن حذف المؤسسة لوجود سجلات قروض مرتبطة بها.`);
    }

    // Check for customers
    const customerCount = await this.customersRepository.count({ where: { institutionId: id } });
    if (customerCount > 0) {
      throw new BadRequestException(`لا يمكن حذف المؤسسة لوجود عملاء مرتبطين بها.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find all paid approved requests to reverse their cash box effect
      const paidRequests = await queryRunner.manager.find(SubscriptionRequest, {
        where: { institutionId: id, status: SubscriptionRequestStatus.APPROVED, isFree: false }
      });

      const totalRefund = paidRequests.reduce((sum, req) => sum + Number(req.amount), 0);

      if (totalRefund > 0) {
        const adminCashBox = await queryRunner.manager.findOne(CashBox, {
          where: { boxType: CashBoxType.ADMIN }
        });

        if (adminCashBox) {
          const balanceBefore = Number(adminCashBox.balance);
          const balanceAfter = balanceBefore - totalRefund;

          const transaction = queryRunner.manager.create(CashBoxTransaction, {
            cashBoxId: adminCashBox.cashBoxId,
            transactionType: TransactionType.WITHDRAWAL,
            amount: totalRefund,
            balanceBefore,
            balanceAfter,
            description: `استرجاع مبلغ اشتراكات بسبب حذف مؤسسة: ${institution.name}`,
          });

          await queryRunner.manager.save(CashBoxTransaction, transaction);
          adminCashBox.balance = balanceAfter;
          await queryRunner.manager.save(CashBox, adminCashBox);
        }
      }

      // If we reach here, we can safely delete users and subscription requests first
      await queryRunner.manager.delete(User, { institutionId: id });
      await queryRunner.manager.delete(SubscriptionRequest, { institutionId: id });

      // Finally delete the institution
      await queryRunner.manager.remove(Institution, institution);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async toggleActive(id: number): Promise<Institution> {
    const institution = await this.findOne(id);
    institution.isActive = !institution.isActive;
    return await this.institutionsRepository.save(institution);
  }

  async getStatistics(id: number) {
    const institution = await this.findOne(id);

    // Count active users for this institution
    const activeUsers = await this.usersRepository.count({
      where: { institutionId: id, isActive: true },
    });

    // Count total branches for this institution
    const totalBranches = institution.branches?.length || 0;

    // Count total customers for this institution
    const totalCustomers = await this.customersRepository.count({
      where: { institutionId: id },
    });

    // Count total loans for this institution (through branches OR direct institution loans)
    const branchIds = institution.branches?.map(b => b.branchId) || [];
    let totalLoans = 0;
    let activeLoans = 0;
    let lateLoans = 0;

    const loanQueryBuilder = this.loansRepository.createQueryBuilder('loan');

    if (branchIds.length > 0) {
      // Institution with branches: count both branch loans and direct institution loans
      loanQueryBuilder.where(
        '(loan.branchId IN (:...branchIds) OR loan.institutionId = :institutionId)',
        { branchIds, institutionId: id }
      );
    } else {
      // Institution without branches: count only direct institution loans
      loanQueryBuilder.where('loan.institutionId = :institutionId', { institutionId: id });
    }

    totalLoans = await loanQueryBuilder.getCount();

    // Count active loans
    activeLoans = await loanQueryBuilder
      .clone()
      .andWhere("loan.status = 'Active'")
      .getCount();

    // Count late loans
    lateLoans = await loanQueryBuilder
      .clone()
      .andWhere("loan.status = 'Late'")
      .getCount();

    return {
      institutionId: institution.institutionId,
      name: institution.name,
      activeUsers,
      totalBranches,
      totalCustomers,
      totalLoans,
      activeLoans,
      lateLoans,
      maxUsers: institution.maxUsers,
      availableUserSlots: institution.maxUsers - activeUsers,
      isActive: institution.isActive,
    };
  }

  /**
   * Check if a tax ID is already in use by an existing institution or pending request
   */
  async checkTaxIdExists(taxId: string): Promise<{ exists: boolean; message?: string }> {
    if (!taxId || taxId.trim() === '') {
      return { exists: false };
    }

    // Check in existing institutions
    const existingInstitution = await this.institutionsRepository.findOne({
      where: { taxId: taxId.trim() }
    });
    if (existingInstitution) {
      return {
        exists: true,
        message: 'رقم السجل التجاري مسجل مسبقاً في مؤسسة أخرى'
      };
    }

    // Check in pending subscription requests
    const pendingRequests = await this.requestsRepository
      .createQueryBuilder('request')
      .where('request.status = :status', { status: SubscriptionRequestStatus.PENDING })
      .andWhere('request.pending_data IS NOT NULL')
      .getMany();

    for (const req of pendingRequests) {
      try {
        const pendingData = JSON.parse(req.pendingData || '{}');
        if (pendingData.taxId && pendingData.taxId.trim() === taxId.trim()) {
          return {
            exists: true,
            message: 'رقم السجل التجاري مستخدم في طلب اشتراك قيد المراجعة'
          };
        }
      } catch (e) {
        // Skip if pendingData is not valid JSON
      }
    }

    return { exists: false };
  }
}
