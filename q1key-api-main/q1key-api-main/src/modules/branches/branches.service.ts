import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Branch } from "../../entities/branch.entity";
import { Institution } from "../../entities/institution.entity";
import { User } from "../../entities/user.entity";
import { Customer } from "../../entities/customer.entity";
import { Loan, LoanStatus } from "../../entities/loan.entity";
import { UsersService } from "../users/users.service";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";
import {
  BranchDashboardStatsDto,
  BranchTeamMemberDto,
  BranchCustomerDto,
  BranchLoanDto,
  ActivityDto,
} from "./dto/branch-dashboard.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import {
  SubscriptionRequest,
  RequesterType,
  SubscriptionRequestStatus,
} from "../../entities/subscription-request.entity";
import { SubscriptionPlan } from "../../entities/subscription-plan.entity";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private branchesRepository: Repository<Branch>,
    @InjectRepository(Institution)
    private institutionsRepository: Repository<Institution>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    @InjectRepository(SubscriptionRequest)
    private requestsRepository: Repository<SubscriptionRequest>,
    @InjectRepository(SubscriptionPlan)
    private plansRepository: Repository<SubscriptionPlan>,
    private usersService: UsersService,
    private telegramService: TelegramService,
  ) { }

  async create(createBranchDto: CreateBranchDto): Promise<any> {
    const { planId, ...branchData } = createBranchDto as any;

    // Verify institution exists
    const institution = await this.institutionsRepository.findOne({
      where: { institutionId: branchData.institutionId },
    });

    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${branchData.institutionId} not found`,
      );
    }

    // Check if institution can create branches
    if (!institution.canCreateBranches) {
      throw new ForbiddenException(
        `المؤسسة '${institution.name}' غير مصرح لها بإنشاء فروع إضافية`,
      );
    }

    // Check if manager email is already taken in the system
    if (branchData.userEmail) {
      const existingUser = await this.usersRepository.findOne({
        where: { email: branchData.userEmail.trim() },
      });
      if (existingUser) {
        throw new BadRequestException(
          "البريد الإلكتروني لمدير الفرع مسجل مسبقاً في النظام",
        );
      }
    }

    // Check if there's already a pending request for this branch name/email in this institution
    const pendingRequest = await this.requestsRepository
      .createQueryBuilder("request")
      .where("request.institutionId = :institutionId", {
        institutionId: branchData.institutionId,
      })
      .andWhere("request.status = :status", {
        status: SubscriptionRequestStatus.PENDING,
      })
      .andWhere("request.requesterType = :type", { type: RequesterType.BRANCH })
      .getMany();

    for (const req of pendingRequest) {
      try {
        const pd = JSON.parse(req.pendingData || "{}");
        if (
          pd.name === branchData.name ||
          pd.userEmail === branchData.userEmail
        ) {
          throw new BadRequestException(
            "يوجد طلب اشتراك قيد المراجعة لهذا الفرع أو لهذا البريد الإلكتروني",
          );
        }
      } catch (e) { }
    }

    // Validate Plan if provided
    let plan: SubscriptionPlan | null = null;
    if (planId) {
      plan = await this.plansRepository.findOne({ where: { id: planId } });
      if (!plan) {
        throw new BadRequestException("Invalid subscription plan ID");
      }
    } else {
      throw new BadRequestException("Subscription Plan is required");
    }

    // Calculate requested end date
    const requestedEndDate = new Date();
    requestedEndDate.setMonth(
      requestedEndDate.getMonth() + plan.durationMonths,
    );

    // Create ONLY the Subscription Request
    // DO NOT change anything here, this must remain ONLY a request
    const request = this.requestsRepository.create({
      requesterType: RequesterType.BRANCH,
      institutionId: branchData.institutionId,
      branchId: undefined,
      planId: plan.id,
      amount: plan.price,
      status: SubscriptionRequestStatus.PENDING,
      requestedStartDate: new Date(),
      requestedEndDate: requestedEndDate,
      notes: `طلب اشتراك أولي للفرع: ${branchData.name}`,
      pendingData: JSON.stringify(createBranchDto),
    });

    const savedRequest = await this.requestsRepository.save(request);

    // Send Telegram notification for new branch requests
    try {
      await this.telegramService.sendNewRequestNotification({
        requestId: savedRequest.id,
        requestType: "new_branch",
        entityName: branchData.name,
        entityType: "Branch",
        parentInstitution: institution.name,
        entityEmail: branchData.email,
        entityPhone: branchData.phoneNumber,
        amount: plan.price,
        planName: plan.name,
        duration: plan.durationMonths,
        customerNotes:
          branchData.notes || `طلب فرع جديد للمؤسسة: ${institution.name}`,
        adminName: branchData.userName,
        adminEmail: branchData.userEmail,
        adminPhone: branchData.userPhoneNumber,
        email: branchData.userEmail,
        phoneNumber: branchData.userPhoneNumber || institution.phoneNumber,
      });
    } catch (telegramError) {
      console.error(
        "Failed to send Telegram notification (Branch):",
        telegramError,
      );
    }

    // DEBUG LOG - If you see this in your console, the NEW code is working
    console.log("DEBUG: Branch request created, ID:", savedRequest.id);

    return {
      message:
        "تم استقبال طلب إنشاء الفرع بنجاح، يرجى انتظار موافقة الإدارة العليا وتفعيل الاشتراك",
      requestId: savedRequest.id,
    };
  }

  /**
   * Get all branches with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findAll(
    paginationDto: PaginationDto,
    institutionId?: number,
  ): Promise<PaginatedResult<any>> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const offset = (page - 1) * limit;

      let whereClause = "";
      const params: any[] = [];

      if (institutionId) {
        whereClause = "WHERE b.institution_id = $1";
        params.push(institutionId);
      }

      const combinedQuery = `
        WITH branch_data AS (
          SELECT 
            b.branch_id as "branchId",
            b.name,
            b.phone_number as "phoneNumber",
            b.email,
            b.is_active as "isActive",
            b.total_loans as "totalLoans",
            b.maximum_loans as "maximumLoans",
            b.expiration_date as "expirationDate",
            b.created_at as "createdAt",
            b.updated_at as "updatedAt",
            b.institution_id as "institutionId",
            json_build_object(
              'institutionId', i.institution_id,
              'name', i.name
            ) as institution
          FROM branches b
          LEFT JOIN institutions i ON b.institution_id = i.institution_id
          ${whereClause}
        )
        SELECT 
          (SELECT COUNT(*) FROM branch_data) as total,
          (SELECT COALESCE(json_agg(row_to_json(bd)), '[]'::json) FROM (
            SELECT * FROM branch_data 
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          ) bd) as data
      `;

      const result = await this.branchesRepository.query(combinedQuery, params);
      const row = result[0] || {};

      return {
        data: row.data || [],
        meta: {
          total: parseInt(row.total || "0"),
          page,
          limit,
          totalPages: Math.ceil(parseInt(row.total || "0") / limit),
        },
      };
    } catch (error) {
      console.error("Error in branches findAll:", error);
      throw error;
    }
  }

  async search(searchTerm: string): Promise<Branch[]> {
    const queryBuilder = this.branchesRepository
      .createQueryBuilder("branch")
      .leftJoinAndSelect("branch.institution", "institution")
      .orderBy("branch.createdAt", "DESC");

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      queryBuilder.where(
        "(branch.name ILIKE :term OR branch.phoneNumber ILIKE :term OR institution.name ILIKE :term OR CAST(branch.branchId AS TEXT) ILIKE :term)",
        { term },
      );
    }

    return await queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { branchId: id },
      relations: ["institution"],
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    return branch;
  }

  async findByInstitution(institutionId: number): Promise<Branch[]> {
    return await this.branchesRepository.find({
      where: { institutionId },
      order: { name: "ASC" },
    });
  }

  async update(
    id: number,
    updateBranchDto: UpdateBranchDto,
    currentUser?: any,
  ): Promise<Branch> {
    const branch = await this.findOne(id);

    // If user is Institution owner, verify they own this branch
    if (
      currentUser?.role?.roleName === "Institution" &&
      currentUser.institutionId !== branch.institutionId
    ) {
      throw new ForbiddenException(
        "You can only update branches in your institution",
      );
    }

    Object.assign(branch, updateBranchDto);
    return await this.branchesRepository.save(branch);
  }

  async remove(id: number): Promise<void> {
    const branch = await this.findOne(id);

    // Check if branch has users
    const userCount = await this.usersRepository.count({
      where: { branchId: id },
    });

    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete branch with ${userCount} users. Please reassign or delete users first.`,
      );
    }

    await this.branchesRepository.remove(branch);
  }

  async toggleActive(id: number): Promise<Branch> {
    const branch = await this.findOne(id);
    branch.isActive = !branch.isActive;
    return await this.branchesRepository.save(branch);
  }

  /**
   * Get branch statistics
   * OPTIMIZED: Single Raw SQL query instead of 5+ queries
   */
  async getStatistics(id: number) {
    const statsQuery = `
      SELECT
        b.branch_id as "branchId",
        b.name,
        b.institution_id as "institutionId",
        i.name as "institutionName",
        b.is_active as "isActive",
        b.created_at as "createdAt",
        (SELECT COUNT(*) FROM users u WHERE u.branch_id = $1 AND u.is_active = true) as "totalUsers",
        (SELECT COUNT(DISTINCT l.customer_id) FROM loans l WHERE l.branch_id = $1) as "totalCustomers",
        (SELECT COUNT(*) FROM loans l WHERE l.branch_id = $1) as "totalLoansCount",
        (SELECT COUNT(*) FROM loans l WHERE l.branch_id = $1 AND l.status = 'Active') as "activeLoans",
        (SELECT COALESCE(SUM(l.principal_amount), 0) FROM loans l 
          WHERE l.branch_id = $1 AND l.status IN ('Active', 'Late')) as "totalLoanAmount"
      FROM branches b
      LEFT JOIN institutions i ON b.institution_id = i.institution_id
      WHERE b.branch_id = $1
    `;

    const result = await this.branchesRepository.query(statsQuery, [id]);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Branch with ID ${id} not found`);
    }

    const stats = result[0];

    return {
      branchId: stats.branchId,
      name: stats.name,
      institutionId: stats.institutionId,
      institutionName: stats.institutionName,
      totalUsers: parseInt(stats.totalUsers || 0),
      totalCustomers: parseInt(stats.totalCustomers || 0),
      totalLoansCount: parseInt(stats.totalLoansCount || 0),
      activeLoans: parseInt(stats.activeLoans || 0),
      totalLoanAmount: parseFloat(stats.totalLoanAmount || 0),
      isActive: stats.isActive,
      createdAt: stats.createdAt,
    };
  }

  async getBranchDashboard(id: number): Promise<BranchDashboardStatsDto> {
    const branch = await this.findOne(id);

    // Get customers count for this branch (via loans)
    const customersData = await this.loansRepository
      .createQueryBuilder("loan")
      .select("COUNT(DISTINCT loan.customerId)", "count")
      .where("loan.branchId = :branchId", { branchId: id })
      .getRawOne();

    const totalCustomers = parseInt(customersData.count) || 0;

    // Get loans metrics
    const totalLoans = await this.loansRepository.count({
      where: { branchId: id },
    });

    const activeLoans = await this.loansRepository.count({
      where: { branchId: id, status: LoanStatus.ACTIVE },
    });

    const lateLoans = await this.loansRepository.count({
      where: { branchId: id, status: LoanStatus.LATE },
    });

    // Get portfolio value
    const portfolioData = await this.loansRepository
      .createQueryBuilder("loan")
      .select("SUM(loan.principalAmount)", "total")
      .where("loan.branchId = :branchId", { branchId: id })
      .andWhere("loan.status IN (:...statuses)", {
        statuses: [LoanStatus.ACTIVE, LoanStatus.LATE],
      })
      .getRawOne();

    const totalPortfolioValue = parseFloat(portfolioData.total) || 0;

    // Calculate average loan size
    const averageLoanSize =
      totalLoans > 0 ? totalPortfolioValue / activeLoans : 0;

    // Get team members count
    const teamMembers = await this.usersRepository.count({
      where: { branchId: id, isActive: true },
    });

    // Get recent activities (last 10 loans created)
    const recentLoans = await this.loansRepository.find({
      where: { branchId: id },
      relations: ["customer"],
      order: { createdAt: "DESC" },
      take: 10,
    });

    const recentActivities: ActivityDto[] = recentLoans.map((loan, index) => ({
      id: index + 1,
      type: "loan_created" as const,
      description: `New loan of ${loan.principalAmount} created for ${loan.customer?.name || "Unknown"}`,
      user: "System", // TODO: Track actual user when loan creation is implemented
      timestamp: loan.createdAt.toISOString(),
    }));

    return {
      branchId: branch.branchId,
      branchName: branch.name,
      institution: {
        id: branch.institution.institutionId,
        name: branch.institution.name,
      },
      metrics: {
        totalCustomers,
        totalLoans,
        activeLoans,
        lateLoans,
        totalPortfolioValue,
        averageLoanSize,
      },
      teamMembers,
      recentActivities,
    };
  }

  async getBranchCustomers(id: number): Promise<BranchCustomerDto[]> {
    // Get unique customers who have loans in this branch
    const customersWithLoans = await this.loansRepository
      .createQueryBuilder("loan")
      .leftJoinAndSelect("loan.customer", "customer")
      .select([
        "customer.customerId as customerId",
        "customer.name as name",
        "customer.nationalId as nationalId",
        "customer.phoneNumber as phoneNumber",
        "customer.createdAt as createdAt",
        "COUNT(loan.loanId) as totalLoans",
        "SUM(CASE WHEN loan.status = :active THEN 1 ELSE 0 END) as activeLoans",
      ])
      .where("loan.branchId = :branchId", { branchId: id })
      .setParameter("active", LoanStatus.ACTIVE)
      .groupBy("customer.customerId")
      .addGroupBy("customer.name")
      .addGroupBy("customer.nationalId")
      .addGroupBy("customer.phoneNumber")
      .addGroupBy("customer.createdAt")
      .orderBy("customer.createdAt", "DESC")
      .getRawMany();

    return customersWithLoans.map((c) => ({
      customerId: c.customerId,
      name: c.name,
      nationalId: c.nationalId,
      phoneNumber: c.phoneNumber,
      totalLoans: parseInt(c.totalLoans) || 0,
      activeLoans: parseInt(c.activeLoans) || 0,
      createdAt: c.createdAt,
    }));
  }

  async getBranchLoans(id: number): Promise<BranchLoanDto[]> {
    const loans = await this.loansRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.product', 'product')
      .where('loan.branchId = :id', { id })
      .orderBy('loan.createdAt', 'DESC')
      .getMany();

    return loans.map((loan) => ({
      loanId: loan.loanId,
      customerName: loan.customer?.name || "Unknown Customer",
      customerId: loan.customerId,
      principalAmount: parseFloat(loan.principalAmount.toString()),
      status: loan.status,
      createdAt: loan.createdAt,
      dueDate: loan.dueDate,
      productName: loan.product?.name || "Generic Loan",
    }));
  }

  async getBranchTeam(id: number): Promise<BranchTeamMemberDto[]> {
    const users = await this.usersRepository.find({
      where: { branchId: id },
      relations: ["role"],
      order: { createdAt: "DESC" },
    });

    return users.map((user) => ({
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role?.roleName || "Unknown",
      status: user.isActive ? "active" : "inactive",
    }));
  }

  async getBranchActivities(id: number): Promise<ActivityDto[]> {
    // Get recent loans as activities
    const recentLoans = await this.loansRepository.createQueryBuilder('loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .where('loan.branchId = :id', { id })
      .orderBy('loan.createdAt', 'DESC')
      .take(20)
      .getMany();

    return recentLoans.map((loan, index) => ({
      id: index + 1,
      type: "loan_created" as const,
      description: `Loan ${loan.loanId} created for ${loan.customer?.name || "Unknown Customer"} - Amount: ${loan.principalAmount}`,
      user: "System",
      timestamp: loan.createdAt.toISOString(),
    }));
  }
}
