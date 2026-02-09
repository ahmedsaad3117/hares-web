import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
  forwardRef,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, Brackets } from "typeorm";
import { SubscriptionPlan } from "../../entities/subscription-plan.entity";
import {
  SubscriptionRequest,
  SubscriptionRequestStatus,
  RequesterType,
} from "../../entities/subscription-request.entity";
import { Institution } from "../../entities/institution.entity";
import { Branch } from "../../entities/branch.entity";
import { CashBox, CashBoxType } from "../../entities/cash-box.entity";
import {
  CashBoxTransaction,
  TransactionType,
} from "../../entities/cash-box-transaction.entity";
import { UsersService } from "../users/users.service";
import { User } from "../../entities/user.entity";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "../../common/cache";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(SubscriptionRequest)
    private requestRepo: Repository<SubscriptionRequest>,
    @InjectRepository(Institution)
    private institutionRepo: Repository<Institution>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
    @InjectRepository(CashBox)
    private cashBoxRepo: Repository<CashBox>,
    @InjectRepository(CashBoxTransaction)
    private transactionRepo: Repository<CashBoxTransaction>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private usersService: UsersService,
    private dataSource: DataSource,
    private cacheService: CacheService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) { }

  // ==================== PLANS ====================

  async getAllPlans(
    includeInactive: boolean = false,
  ): Promise<SubscriptionPlan[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.planRepo.find({
      where,
      order: { sortOrder: "ASC", durationMonths: "ASC" },
    });
  }

  /**
   * Get active subscription plans
   * CACHED: 1 hour (rarely changes)
   */
  async getActivePlans(): Promise<SubscriptionPlan[]> {
    return this.cacheService.get(
      CACHE_KEYS.SUBSCRIPTION_PLANS_ACTIVE,
      async () => {
        return this.planRepo.find({
          where: { isActive: true },
          order: { sortOrder: "ASC", durationMonths: "ASC" },
        });
      },
      CACHE_TTL.VERY_LONG, // 1 hour
    );
  }

  async createPlan(dto: any): Promise<SubscriptionPlan> {
    const plan = this.planRepo.create({
      name: dto.name,
      nameEn: dto.nameEn,
      durationMonths: dto.durationMonths,
      price: dto.price,
      description: dto.description,
      isActive: dto.isActive !== false,
      isFreeTrial: dto.isFreeTrial || false,
      sortOrder: dto.sortOrder || 0,
    });
    const saved = await this.planRepo.save(plan);
    this.cacheService.invalidate(CACHE_KEYS.SUBSCRIPTION_PLANS_ACTIVE);
    return saved;
  }

  async updatePlan(id: number, dto: any): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new HttpException("الباقة غير موجودة", HttpStatus.NOT_FOUND);
    }

    Object.assign(plan, dto);
    const saved = await this.planRepo.save(plan);
    this.cacheService.invalidate(CACHE_KEYS.SUBSCRIPTION_PLANS_ACTIVE);
    return saved;
  }

  async togglePlanVisibility(id: number): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new HttpException("الباقة غير موجودة", HttpStatus.NOT_FOUND);
    }

    plan.isActive = !plan.isActive;
    const saved = await this.planRepo.save(plan);
    this.cacheService.invalidate(CACHE_KEYS.SUBSCRIPTION_PLANS_ACTIVE);
    return saved;
  }

  async deletePlan(id: number): Promise<{ message: string }> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new HttpException("الباقة غير موجودة", HttpStatus.NOT_FOUND);
    }

    // Check if plan is used in any request
    const usedCount = await this.requestRepo.count({ where: { planId: id } });
    if (usedCount > 0) {
      throw new HttpException(
        "لا يمكن حذف هذه الباقة لأنها مستخدمة في طلبات سابقة. يمكنك إخفاؤها بدلاً من ذلك.",
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.planRepo.delete(id);
    this.cacheService.invalidate(CACHE_KEYS.SUBSCRIPTION_PLANS_ACTIVE);
    return { message: "تم حذف الباقة بنجاح" };
  }

  // ==================== REQUESTS ====================

  /**
   * Get all subscription requests with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async getAllRequests(
    status?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const params: any[] = [];
    let paramIndex = 1;
    let whereClause = "";

    if (status && status !== "" && status !== "all") {
      whereClause = `WHERE r.status = $${paramIndex++}`;
      params.push(status);
    }

    const query = `
            WITH request_data AS (
                SELECT 
                    r.id,
                    r.requester_type as "requesterType",
                    r.institution_id as "institutionId",
                    r.branch_id as "branchId",
                    r.plan_id as "planId",
                    r.custom_duration_months as "customDurationMonths",
                    r.amount,
                    r.status,
                    r.pending_data as "pendingData",
                    r.notes,
                    r.processed_by as "processedBy",
                    r.processed_at as "processedAt",
                    r.created_at as "createdAt",
                    i.name as "institutionName",
                    i.tax_id as "institutionTaxId",
                    i.email as "institutionEmail",
                    b.name as "branchName",
                    b.email as "branchEmail",
                    p.name as "planName",
                    p.duration_months as "planDuration",
                    u.name as "processorName"
                FROM subscription_requests r
                LEFT JOIN institutions i ON r.institution_id = i.institution_id
                LEFT JOIN branches b ON r.branch_id = b.branch_id
                LEFT JOIN subscription_plans p ON r.plan_id = p.id
                LEFT JOIN users u ON r.processed_by = u.user_id
                ${whereClause}
            )
            SELECT 
                (SELECT COUNT(*) FROM request_data) as total,
                (SELECT json_agg(row_to_json(rd)) FROM (
                    SELECT * FROM request_data 
                    ORDER BY "createdAt" DESC
                    LIMIT ${limit} OFFSET ${offset}
                ) rd) as data
        `;

    const result = await this.dataSource.query(query, params);
    const row = result[0] || {};

    let data = row.data || [];
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = [];
      }
    }

    return {
      data: data || [],
      total: parseInt(row.total || 0),
      page,
      limit,
    };
  }

  /**
   * Get unified requests with stats
   * OPTIMIZED: Single Raw SQL query with CTEs instead of 5+ queries
   */
  async getUnifiedRequests(filter: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    let { status = "", search = "", page = 1, limit = 20 } = filter;
    page = Number(page) || 1;
    limit = Number(limit) || 20;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status && status !== "all" && status !== "") {
      whereClauses.push(`r.status = $${paramIndex++}`);
      params.push(status);
    }

    if (search && search.trim() !== "") {
      whereClauses.push(`(
                CAST(r.id AS TEXT) ILIKE $${paramIndex} OR 
                i.name ILIKE $${paramIndex} OR 
                i.tax_id ILIKE $${paramIndex} OR 
                b.name ILIKE $${paramIndex} OR 
                r.pending_data::text ILIKE $${paramIndex}
            )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Single optimized query with CTEs
    const combinedQuery = `
            WITH global_stats AS (
                SELECT
                    (SELECT COUNT(*) FROM subscription_requests WHERE status = 'Pending') as pending,
                    (SELECT COUNT(*) FROM subscription_requests WHERE status = 'Approved') as approved,
                    (SELECT COUNT(*) FROM subscription_requests WHERE status = 'Rejected') as rejected,
                    (SELECT COUNT(*) FROM subscription_requests) as total
            ),
            filtered_requests AS (
                SELECT 
                    r.id,
                    r.requester_type as "requesterType",
                    r.institution_id as "institutionId",
                    r.branch_id as "branchId",
                    r.plan_id as "planId",
                    r.custom_duration_months as "customDurationMonths",
                    r.amount,
                    r.status,
                    r.is_free as "isFree",
                    r.requested_start_date as "requestedStartDate",
                    r.requested_end_date as "requestedEndDate",
                    r.pending_data as "pendingData",
                    r.notes,
                    r.admin_notes as "adminNotes",
                    r.processed_by as "processedBy",
                    r.processed_at as "processedAt",
                    r.created_at as "createdAt",
                    CASE WHEN i.institution_id IS NOT NULL THEN
                        json_build_object(
                            'institutionId', i.institution_id,
                            'name', i.name,
                            'taxId', i.tax_id,
                            'email', i.email,
                            'phoneNumber', i.phone_number
                        ) 
                    ELSE NULL END as institution,
                    CASE WHEN b.branch_id IS NOT NULL THEN
                        json_build_object(
                            'branchId', b.branch_id,
                            'name', b.name,
                            'email', b.email,
                            'phoneNumber', b.phone_number
                        )
                    ELSE NULL END as branch,
                    CASE WHEN p.id IS NOT NULL THEN
                        json_build_object(
                            'id', p.id,
                            'name', p.name,
                            'nameEn', p.name_en,
                            'durationMonths', p.duration_months,
                            'price', p.price
                        )
                    ELSE NULL END as plan,
                    CASE WHEN u.user_id IS NOT NULL THEN
                        json_build_object(
                            'userId', u.user_id,
                            'name', u.name
                        )
                    ELSE NULL END as processor
                FROM subscription_requests r
                LEFT JOIN institutions i ON r.institution_id = i.institution_id
                LEFT JOIN branches b ON r.branch_id = b.branch_id
                LEFT JOIN subscription_plans p ON r.plan_id = p.id
                LEFT JOIN users u ON r.processed_by = u.user_id
                ${whereClause}
            )
            SELECT 
                (SELECT row_to_json(gs) FROM global_stats gs) as stats,
                (SELECT COUNT(*) FROM filtered_requests) as total,
                (SELECT json_agg(row_to_json(fr)) FROM (
                    SELECT * FROM filtered_requests 
                    ORDER BY "createdAt" DESC
                    LIMIT ${limit} OFFSET ${offset}
                ) fr) as data
        `;

    const result = await this.dataSource.query(combinedQuery, params);
    const row = result[0] || {};

    let statsData = row.stats || {};
    if (typeof statsData === "string") {
      try {
        statsData = JSON.parse(statsData);
      } catch (e) {
        statsData = {};
      }
    }

    let requestsData = row.data || [];
    if (typeof requestsData === "string") {
      try {
        requestsData = JSON.parse(requestsData);
      } catch (e) {
        requestsData = [];
      }
    }

    const totalCount = parseInt(row.total || 0);

    return {
      stats: {
        pending: parseInt(statsData.pending || 0),
        approved: parseInt(statsData.approved || 0),
        rejected: parseInt(statsData.rejected || 0),
        total: parseInt(statsData.total || 0),
      },
      requests: {
        data: requestsData || [],
        total: totalCount,
        page,
        limit,
      },
    };
  }

  async getPendingRequestsCount(): Promise<{ count: number }> {
    const count = await this.requestRepo.count({
      where: { status: SubscriptionRequestStatus.PENDING },
    });
    return { count };
  }

  async getMySubscription(user: any): Promise<any> {
    let entity: Institution | Branch | null = null;
    let type: RequesterType = RequesterType.INSTITUTION; // Default value

    if (user.roleName === "Institution" && user.institutionId) {
      entity = await this.institutionRepo.findOne({
        where: { institutionId: user.institutionId },
      });
      type = RequesterType.INSTITUTION;
    } else if (user.roleName === "Branch" && user.branchId) {
      entity = await this.branchRepo.findOne({
        where: { branchId: user.branchId },
        relations: ["institution"],
      });
      type = RequesterType.BRANCH;
    }

    if (!entity) {
      throw new HttpException(
        "لم يتم العثور على بيانات الاشتراك",
        HttpStatus.NOT_FOUND,
      );
    }

    // Get expiration date
    let expirationDate: Date | null = null;
    if (type === RequesterType.INSTITUTION) {
      expirationDate = (entity as Institution).expirationDate;
    } else {
      // Updated to read from Branch entity
      expirationDate = (entity as Branch).expirationDate || null;
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    let status = "active";
    if (expirationDate) {
      const today = new Date();
      const expDate = new Date(expirationDate);
      daysRemaining = Math.ceil(
        (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysRemaining <= 0) {
        status = "expired";
      } else if (daysRemaining <= 5) {
        status = "expiring_soon";
      } else if (daysRemaining <= 30) {
        status = "expiring";
      }
    }

    // Get pending requests
    let pendingRequest: SubscriptionRequest | null = null;
    if (type === RequesterType.INSTITUTION && user.institutionId) {
      pendingRequest = await this.requestRepo.findOne({
        where: {
          institutionId: user.institutionId,
          status: SubscriptionRequestStatus.PENDING,
        },
        relations: ["plan"],
      });
    } else if (type === RequesterType.BRANCH && user.branchId) {
      pendingRequest = await this.requestRepo.findOne({
        where: {
          branchId: user.branchId,
          status: SubscriptionRequestStatus.PENDING,
        },
        relations: ["plan"],
      });
    }

    // Get available plans
    const plans = await this.getActivePlans();

    return {
      type,
      entityName: entity.name,
      expirationDate,
      daysRemaining,
      status,
      hasPendingRequest: !!pendingRequest,
      pendingRequest,
      availablePlans: plans,
    };
  }

  async getMyRequests(user: any): Promise<SubscriptionRequest[]> {
    if (user.roleName === "Institution" && user.institutionId) {
      return this.requestRepo.find({
        where: {
          institutionId: user.institutionId,
          requesterType: RequesterType.INSTITUTION,
        },
        relations: ["plan"],
        order: { createdAt: "DESC" },
      });
    } else if (user.roleName === "Branch" && user.branchId) {
      return this.requestRepo.find({
        where: {
          branchId: user.branchId,
          requesterType: RequesterType.BRANCH,
        },
        relations: ["plan"],
        order: { createdAt: "DESC" },
      });
    }
    return [];
  }

  async createRequest(user: any, dto: any): Promise<SubscriptionRequest> {
    // Determine requester type and ID
    let requesterType: RequesterType;
    let institutionId: number | undefined = undefined;
    let branchId: number | undefined = undefined;

    if (user.roleName === "Institution" && user.institutionId) {
      requesterType = RequesterType.INSTITUTION;
      institutionId = user.institutionId;
    } else if (user.roleName === "Branch" && user.branchId) {
      requesterType = RequesterType.BRANCH;
      branchId = user.branchId;
    } else {
      throw new HttpException(
        "غير مصرح لك بإنشاء طلب اشتراك",
        HttpStatus.FORBIDDEN,
      );
    }

    // Check for existing pending request
    let existingPending: SubscriptionRequest | null = null;
    if (institutionId) {
      existingPending = await this.requestRepo.findOne({
        where: { institutionId, status: SubscriptionRequestStatus.PENDING },
      });
    } else if (branchId) {
      existingPending = await this.requestRepo.findOne({
        where: { branchId, status: SubscriptionRequestStatus.PENDING },
      });
    }

    if (existingPending) {
      throw new HttpException(
        "لديك طلب اشتراك قيد المعالجة بالفعل. يرجى انتظار معالجته أو إلغائه.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get plan details
    let amount = 0;
    let durationMonths = dto.customDurationMonths;

    if (dto.planId) {
      const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!plan) {
        throw new HttpException("الباقة غير موجودة", HttpStatus.NOT_FOUND);
      }
      if (!plan.isActive) {
        throw new HttpException(
          "هذه الباقة غير متاحة حالياً",
          HttpStatus.BAD_REQUEST,
        );
      }
      amount = plan.price;
      durationMonths = plan.durationMonths;
    }

    // Get current expiration date to handle extension correctly
    let currentExpiration: Date | null = null;
    if (requesterType === RequesterType.INSTITUTION && institutionId) {
      const inst = await this.institutionRepo.findOne({
        where: { institutionId },
      });
      currentExpiration = inst?.expirationDate || null;
    } else if (requesterType === RequesterType.BRANCH && branchId) {
      const br = await this.branchRepo.findOne({ where: { branchId } });
      currentExpiration = br?.expirationDate || null;
    }

    // Calculate dates
    const now = new Date();
    const baseDate =
      currentExpiration && new Date(currentExpiration) > now
        ? new Date(currentExpiration)
        : now;

    const startDate = now; // Request starts being processed now
    let endDate: Date;

    if (dto.customEndDate) {
      endDate = new Date(dto.customEndDate);
    } else if (durationMonths) {
      endDate = new Date(baseDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);
    } else {
      throw new HttpException(
        "يرجى اختيار باقة أو تحديد مدة الاشتراك",
        HttpStatus.BAD_REQUEST,
      );
    }

    const request = this.requestRepo.create({
      requesterType,
      institutionId,
      branchId,
      planId: dto.planId,
      customDurationMonths: durationMonths,
      amount,
      status: SubscriptionRequestStatus.PENDING,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      notes: dto.notes,
    } as Partial<SubscriptionRequest>);

    const savedRequest = await this.requestRepo.save(request);

    // Send Telegram notification for renewal requests
    try {
      const fs = require("fs");
      const logFile = "debug_telegram.log";
      const log = (msg) =>
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);

      log(`Preparing notification for Request #${savedRequest.id}`);
      log(
        `RequesterType: ${requesterType}, InstId: ${institutionId}, BranchId: ${branchId}`,
      );

      let entityName = "";
      let taxId = "";
      let parentInst = "";

      if (institutionId) {
        const inst = await this.institutionRepo.findOne({
          where: { institutionId },
        });
        entityName = inst?.name || "مؤسسة";
        taxId = inst?.taxId || "";
      } else if (branchId) {
        const br = await this.branchRepo.findOne({
          where: { branchId },
          relations: ["institution"],
        });
        entityName = br?.name || "فرع";
        parentInst = br?.institution?.name || "";
      }

      const plan = dto.planId
        ? await this.planRepo.findOne({ where: { id: dto.planId } })
        : null;

      let entityEmail = "";
      let entityPhone = "";

      if (requesterType === RequesterType.INSTITUTION && institutionId) {
        const instFull = await this.institutionRepo.findOne({
          where: { institutionId },
        });
        entityEmail = instFull?.email || "";
        entityPhone = instFull?.phoneNumber || "";
      } else if (requesterType === RequesterType.BRANCH && branchId) {
        const branchFull = await this.branchRepo.findOne({
          where: { branchId },
        });
        entityEmail = branchFull?.email || "";
        entityPhone = branchFull?.phoneNumber || "";
      }

      log(
        `Entity Info: Name=${entityName}, Email=${entityEmail}, Phone=${entityPhone}`,
      );

      const success = await this.telegramService.sendNewRequestNotification({
        requestId: savedRequest.id,
        requestType: "renewal",
        entityName,
        entityType:
          requesterType === RequesterType.INSTITUTION
            ? "Institution"
            : "Branch",
        parentInstitution: parentInst,
        taxId,
        entityEmail,
        entityPhone,
        amount,
        planName: plan?.name || `${durationMonths} شهر`,
        duration: durationMonths,
        adminName: user.name || "",
        adminEmail: user.email || "",
        adminPhone: user.phoneNumber || "",
        customerNotes: dto.notes,
        currentExpiration: currentExpiration
          ? new Date(currentExpiration).toISOString().split("T")[0]
          : null,
        newExpiration: endDate.toISOString().split("T")[0],
      });
      log(`Notification Sent Result: ${success}`);
    } catch (telegramError) {
      console.error("Failed to send Telegram notification:", telegramError);
      const fs = require("fs");
      fs.appendFileSync(
        "debug_telegram.log",
        `[${new Date().toISOString()}] ERROR: ${telegramError.message}\n`,
      );
    }

    return savedRequest;
  }

  async getRequestById(id: number, user: any): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: [
        "institution",
        "institution.users",
        "branch",
        "branch.users",
        "plan",
        "processor",
      ],
    });

    if (!request) {
      throw new HttpException("الطلب غير موجود", HttpStatus.NOT_FOUND);
    }

    // Check access
    if (user.roleName !== "Super Admin") {
      const hasAccess =
        (user.institutionId && request.institutionId === user.institutionId) ||
        (user.branchId && request.branchId === user.branchId);

      if (!hasAccess) {
        throw new HttpException(
          "غير مصرح لك بالوصول لهذا الطلب",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return request;
  }

  async processRequest(
    id: number,
    dto: any,
    adminUser: any,
  ): Promise<SubscriptionRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await this.requestRepo.findOne({
        where: { id },
        relations: ["institution", "branch", "plan"],
      });

      if (!request) {
        throw new HttpException("الطلب غير موجود", HttpStatus.NOT_FOUND);
      }

      if (request.status !== SubscriptionRequestStatus.PENDING) {
        throw new HttpException(
          "تم معالجة هذا الطلب مسبقاً",
          HttpStatus.BAD_REQUEST,
        );
      }

      // Detect NEW registration types
      const isNewInstitution =
        !request.institutionId && !request.branchId && !!request.pendingData;
      const isNewBranch =
        request.institutionId &&
        !request.branchId &&
        !!request.pendingData &&
        request.requesterType === RequesterType.BRANCH;

      request.status = dto.status;
      request.adminNotes = dto.adminNotes;
      request.processedBy = adminUser.userId;
      request.processedAt = new Date();

      if (dto.isFree) {
        request.isFree = true;
        request.freeReason = dto.freeReason;
        request.amount = 0;
      }

      if (dto.status === "Approved") {
        // CASE 1: New Institution Registration
        if (isNewInstitution && request.pendingData) {
          try {
            const data = JSON.parse(request.pendingData);

            // Create the institution
            const institution = queryRunner.manager.create(Institution, {
              name: data.name,
              taxId: data.taxId,
              phoneNumber: data.phoneNumber,
              email: data.email,
              maxUsers: data.maxUsers || 5,
              canCreateBranches: data.canCreateBranches !== false,
              isActive: true,
              expirationDate: request.requestedEndDate,
            });
            const savedInstitution = await queryRunner.manager.save(
              Institution,
              institution,
            );

            // Link request to new institution
            request.institutionId = savedInstitution.institutionId;
            request.institution = savedInstitution;

            // Create the admin user for the institution
            if (data.adminName && data.adminEmail && data.adminPassword) {
              const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
              const newUser = queryRunner.manager.create(User, {
                name: data.adminName,
                email: data.adminEmail,
                passwordHash: hashedPassword,
                phoneNumber: data.adminPhoneNumber,
                roleId: 2, // Institution role
                institutionId: savedInstitution.institutionId,
                isActive: data.adminIsActive !== false,
                nationalId: data.adminNationalId || null,
              });
              await queryRunner.manager.save(User, newUser);
            }
          } catch (e) {
            console.error("Error creating institution from pending data:", e);
            throw new HttpException(
              "فشل إنشاء المؤسسة من بيانات الطلب",
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
        }
        // CASE 2: New Branch Registration (requested by an existing institution)
        else if (isNewBranch && request.pendingData) {
          try {
            const data = JSON.parse(request.pendingData);

            // Create the branch
            const branch = queryRunner.manager.create(Branch, {
              institutionId: request.institutionId!,
              name: data.name,
              phoneNumber: data.phoneNumber,
              email: data.email,
              maximumLoans: data.maximumLoans || 0,
              isActive: true,
              expirationDate: request.requestedEndDate,
            });
            const savedBranch = await queryRunner.manager.save(Branch, branch);

            // Link request to new branch
            request.branchId = savedBranch.branchId;
            request.branch = savedBranch;

            // Create the admin user for the branch
            if (data.userName && data.userEmail && data.userPassword) {
              // Check institution user capacity - REMOVED per user request
              // const currentUsers = await queryRunner.manager.count(User, {
              //     where: { institutionId: request.institutionId!, isActive: true }
              // });

              // const institution = await queryRunner.manager.findOne(Institution, {
              //     where: { institutionId: request.institutionId! }
              // });

              // if (institution && currentUsers >= institution.maxUsers) {
              //     throw new HttpException(`لا يمكن إنشاء مستخدم جديد للفرع. تم الوصول للحد الأقصى من المستخدمين للمؤسسة (${institution.maxUsers})`, HttpStatus.BAD_REQUEST);
              // }

              const hashedPassword = await bcrypt.hash(data.userPassword, 10);
              const newUser = queryRunner.manager.create(User, {
                name: data.userName,
                email: data.userEmail,
                passwordHash: hashedPassword,
                phoneNumber: data.userPhoneNumber,
                roleId: 3, // Branch role
                institutionId: request.institutionId!,
                branchId: savedBranch.branchId,
                isActive: data.userIsActive !== false,
                nationalId: data.userNationalId || null,
              });
              await queryRunner.manager.save(User, newUser);
            }
          } catch (e) {
            console.error("Error creating branch from pending data:", e);
            throw new HttpException(
              "فشل إنشاء الفرع من بيانات الطلب: " + e.message,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
        }
        // CASE 3: Standard Renewal for existing Institution
        else if (
          request.requesterType === RequesterType.INSTITUTION &&
          request.institutionId
        ) {
          const institution = await queryRunner.manager.findOne(Institution, {
            where: { institutionId: request.institutionId }
          });

          if (institution) {
            institution.expirationDate = request.requestedEndDate;
            institution.isActive = true;

            if (request.pendingData) {
              try {
                const data = JSON.parse(request.pendingData);
                if (data.name) institution.name = data.name;
                if (data.email) institution.email = data.email;
                if (data.phoneNumber) institution.phoneNumber = data.phoneNumber;
                if (data.taxId) institution.taxId = data.taxId;
                if (data.maxUsers) institution.maxUsers = data.maxUsers;
                if (data.canCreateBranches !== undefined) institution.canCreateBranches = data.canCreateBranches;

                // Find manager user to update
                const manager = await queryRunner.manager.findOne(User, {
                  where: { institutionId: institution.institutionId, roleId: 2 }
                });

                if (manager) {
                  if (data.adminName) manager.name = data.adminName;
                  if (data.adminEmail) manager.email = data.adminEmail;
                  if (data.adminPhoneNumber) manager.phoneNumber = data.adminPhoneNumber;
                  if (data.adminIsActive !== undefined) manager.isActive = data.adminIsActive;
                  if (data.adminPassword) {
                    manager.passwordHash = await bcrypt.hash(data.adminPassword, 10);
                  }
                  await queryRunner.manager.save(User, manager);
                }
              } catch (e) { console.error("Error updating institution renewal:", e); }
            }
            await queryRunner.manager.save(Institution, institution);
          }
        }
        // CASE 4: Standard Renewal for existing Branch
        else if (
          request.requesterType === RequesterType.BRANCH &&
          request.branchId
        ) {
          const branch = await queryRunner.manager.findOne(Branch, {
            where: { branchId: request.branchId }
          });

          if (branch) {
            branch.expirationDate = request.requestedEndDate;
            branch.isActive = true;

            if (request.pendingData) {
              try {
                const data = JSON.parse(request.pendingData);
                if (data.name) branch.name = data.name;
                if (data.email) branch.email = data.email;
                if (data.phoneNumber) branch.phoneNumber = data.phoneNumber;
                if (data.maximumLoans) branch.maximumLoans = data.maximumLoans;

                // Find manager user to update
                const manager = await queryRunner.manager.findOne(User, {
                  where: { branchId: branch.branchId, roleId: 3 }
                });

                if (manager) {
                  if (data.userName) manager.name = data.userName;
                  if (data.userEmail) manager.email = data.userEmail;
                  if (data.userPhoneNumber) manager.phoneNumber = data.userPhoneNumber;
                  if (data.userIsActive !== undefined) manager.isActive = data.userIsActive;
                  if (data.userPassword) {
                    manager.passwordHash = await bcrypt.hash(data.userPassword, 10);
                  }
                  await queryRunner.manager.save(User, manager);
                }
              } catch (e) { console.error("Error updating branch renewal:", e); }
            }
            await queryRunner.manager.save(Branch, branch);
          }
        }

        // Add to Super Admin's cash box (if not free)
        if (!request.isFree && Number(request.amount) > 0) {
          // Find Super Admin's cash box (Admin type)
          const adminCashBox = await queryRunner.manager.findOne(CashBox, {
            where: { boxType: CashBoxType.ADMIN },
          });

          if (adminCashBox) {
            const balanceBefore = Number(adminCashBox.balance);
            const balanceAfter = balanceBefore + Number(request.amount);

            // Create transaction
            const entityName =
              request.institution?.name || request.branch?.name || "غير معروف";
            const planName =
              request.plan?.name || `${request.customDurationMonths} شهر`;
            const prefix =
              isNewInstitution || isNewBranch ? "جديد: " : "تجديد: ";

            const transaction = queryRunner.manager.create(CashBoxTransaction, {
              cashBoxId: adminCashBox.cashBoxId,
              transactionType: TransactionType.SUBSCRIPTION,
              amount: request.amount,
              balanceBefore,
              balanceAfter,
              description: `${prefix}اشتراك ${planName} - ${entityName}`,
              createdBy: adminUser.userId,
            });

            await queryRunner.manager.save(CashBoxTransaction, transaction);

            // Update cash box balance
            adminCashBox.balance = balanceAfter;
            await queryRunner.manager.save(CashBox, adminCashBox);

            request.cashBoxTransactionId = transaction.id;
          }
        }
      }

      await queryRunner.manager.save(SubscriptionRequest, request);
      await queryRunner.commitTransaction();

      return request;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelRequest(id: number, user: any): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });

    if (!request) {
      throw new HttpException("الطلب غير موجود", HttpStatus.NOT_FOUND);
    }

    // Check ownership
    const isOwner =
      (user.institutionId && request.institutionId === user.institutionId) ||
      (user.branchId && request.branchId === user.branchId);

    if (!isOwner && user.roleName !== "Super Admin") {
      throw new HttpException(
        "غير مصرح لك بإلغاء هذا الطلب",
        HttpStatus.FORBIDDEN,
      );
    }

    if (request.status !== SubscriptionRequestStatus.PENDING) {
      throw new HttpException(
        "لا يمكن إلغاء طلب تمت معالجته",
        HttpStatus.BAD_REQUEST,
      );
    }

    request.status = SubscriptionRequestStatus.CANCELLED;
    return this.requestRepo.save(request);
  }

  async updateRequest(
    id: number,
    dto: any,
    user: any,
  ): Promise<SubscriptionRequest> {
    const request = await this.requestRepo.findOne({ where: { id } });

    if (!request) {
      throw new HttpException("الطلب غير موجود", HttpStatus.NOT_FOUND);
    }

    // Only Super Admin can update
    if (user.roleName !== "Super Admin") {
      throw new HttpException(
        "غير مصرح لك بتعديل هذا الطلب",
        HttpStatus.FORBIDDEN,
      );
    }

    if (request.status !== SubscriptionRequestStatus.PENDING) {
      throw new HttpException(
        "لا يمكن تعديل طلب تمت معالجته",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Update plan if provided
    if (dto.planId) {
      const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!plan) {
        throw new HttpException("الباقة غير موجودة", HttpStatus.NOT_FOUND);
      }
      request.planId = plan.id;
      request.amount = plan.price;
      request.customDurationMonths = plan.durationMonths;

      // Recalculate end date based on plan duration and extension logic
      let currentExpiration: Date | null = null;
      if (
        request.requesterType === RequesterType.INSTITUTION &&
        request.institutionId
      ) {
        const inst = await this.institutionRepo.findOne({
          where: { institutionId: request.institutionId },
        });
        currentExpiration = inst?.expirationDate || null;
      } else if (
        request.requesterType === RequesterType.BRANCH &&
        request.branchId
      ) {
        const br = await this.branchRepo.findOne({
          where: { branchId: request.branchId },
        });
        currentExpiration = br?.expirationDate || null;
      }

      const now = new Date();
      const baseDate =
        currentExpiration && new Date(currentExpiration) > now
          ? new Date(currentExpiration)
          : now;

      const endDate = new Date(baseDate);
      endDate.setMonth(endDate.getMonth() + plan.durationMonths);
      request.requestedEndDate = endDate;
    }

    // Update amount if provided (can override plan price)
    if (dto.amount !== undefined) {
      request.amount = dto.amount;
    }

    // Update requested end date if provided
    if (dto.requestedEndDate) {
      request.requestedEndDate = new Date(dto.requestedEndDate);
    }

    // Update notes if provided
    if (dto.notes !== undefined) {
      request.notes = dto.notes;
    }

    // Update admin notes if provided
    if (dto.adminNotes !== undefined) {
      request.adminNotes = dto.adminNotes;
    }

    // Update pending data (for new institution/branch requests)
    if (dto.pendingData !== undefined) {
      // If pendingData is an object, stringify it
      if (typeof dto.pendingData === "object") {
        request.pendingData = JSON.stringify(dto.pendingData);
      } else {
        request.pendingData = dto.pendingData;
      }
    }

    // Update custom duration months if provided
    if (dto.customDurationMonths !== undefined) {
      request.customDurationMonths = dto.customDurationMonths;
    }

    return this.requestRepo.save(request);
  }

  /**
   * Get unified subscriptions data (stats + list)
   * OPTIMIZED: Uses Raw SQL with CTEs for maximum performance
   * Single query instead of 8+ separate queries
   */
  async getUnifiedSubscriptions(filter: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      let {
        type = "",
        status = "",
        search = "",
        page = 1,
        limit = 20,
      } = filter;
      page = Number(page) || 1;
      limit = Number(limit) || 20;
      const offset = (page - 1) * limit;

      const today = new Date().toISOString().split("T")[0];
      const next30 = new Date();
      next30.setDate(next30.getDate() + 30);
      const next30Str = next30.toISOString().split("T")[0];

      // Build dynamic WHERE clause
      const whereClauses: string[] = [];
      const params: any[] = [today, next30Str]; // $1 = today, $2 = next30
      let paramIndex = 3;

      if (type && type !== "") {
        whereClauses.push(`type = $${paramIndex++}`);
        params.push(type);
      }

      if (status && status !== "" && status !== "all") {
        if (status === "active") {
          whereClauses.push(
            `"isActive" = true AND ("expirationDate" > $1 OR "expirationDate" IS NULL)`,
          );
        } else if (status === "expired") {
          whereClauses.push(`"expirationDate" <= $1`);
        } else if (status === "expiring") {
          whereClauses.push(`"expirationDate" > $1 AND "expirationDate" <= $2`);
        } else if (status === "inactive") {
          whereClauses.push(`"isActive" = false`);
        }
      }

      if (search && search.trim() !== "") {
        whereClauses.push(
          `(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR "parentName" ILIKE $${paramIndex})`,
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Single optimized query with CTEs
      const combinedQuery = `
                WITH unified_data AS (
                    SELECT 
                        'institution' as type,
                        institution_id as id,
                        name,
                        email,
                        expiration_date as "expirationDate",
                        is_active as "isActive",
                        NULL::text as "parentName",
                        institution_id as "parentId",
                        phone_number as "phoneNumber",
                        created_at as "createdAt"
                    FROM institutions
                    UNION ALL
                    SELECT 
                        'branch' as type,
                        b.branch_id as id,
                        b.name,
                        b.email,
                        COALESCE(b.expiration_date, i.expiration_date) as "expirationDate",
                        b.is_active as "isActive",
                        i.name as "parentName",
                        b.institution_id as "parentId",
                        b.phone_number as "phoneNumber",
                        b.created_at as "createdAt"
                    FROM branches b
                    LEFT JOIN institutions i ON b.institution_id = i.institution_id
                ),
                filtered_data AS (
                    SELECT * FROM unified_data ${whereClause}
                ),
                global_stats AS (
                    SELECT
                        (SELECT COUNT(*) FROM institutions) as total_institutions,
                        (SELECT COUNT(*) FROM unified_data 
                         WHERE "isActive" = true AND ("expirationDate" > $1 OR "expirationDate" IS NULL)) as active_count,
                        (SELECT COUNT(*) FROM unified_data 
                         WHERE "expirationDate" <= $1) as expired_count,
                        (SELECT COUNT(*) FROM unified_data 
                         WHERE "expirationDate" > $1 AND "expirationDate" <= $2) as expiring_count
                )
                SELECT 
                    (SELECT row_to_json(gs) FROM global_stats gs) as stats,
                    (SELECT COUNT(*) FROM filtered_data) as total,
                    (SELECT json_agg(row_to_json(fd)) FROM (
                        SELECT * FROM filtered_data 
                        ORDER BY "expirationDate" ASC NULLS LAST
                        LIMIT ${limit} OFFSET ${offset}
                    ) fd) as data
            `;

      const result = await this.dataSource.query(combinedQuery, params);
      const row = result[0] || {};

      const statsData = row.stats || {};
      const subscriptionsData = row.data || [];
      const totalCount = parseInt(row.total || 0);

      return {
        stats: {
          totalInstitutions: parseInt(statsData.total_institutions || 0),
          activeSubscriptions: parseInt(statsData.active_count || 0),
          expired: parseInt(statsData.expired_count || 0),
          expiringSoon: parseInt(statsData.expiring_count || 0),
        },
        subscriptions: {
          data: subscriptionsData || [],
          total: totalCount,
          page,
          limit,
        },
      };
    } catch (error) {
      console.error("Error in getUnifiedSubscriptions:", error);
      throw new HttpException(
        "خطأ في جلب بيانات الاشتراكات",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSettings(): Promise<any> {
    // Get settings from system_settings table or return defaults
    const plans = await this.getAllPlans(true);

    return {
      plans,
      currency: "SAR",
      currencySymbol: "ر.س",
      freeTrialEnabled: plans.some((p) => p.isFreeTrial),
      alertDaysBeforeExpiry: 5,
    };
  }

  async updateSettings(settings: any): Promise<any> {
    // Update settings logic here
    return { message: "تم تحديث الإعدادات بنجاح", settings };
  }

  // ==================== SEED DEFAULT PLANS ====================

  async seedDefaultPlans(): Promise<void> {
    const existingPlans = await this.planRepo.count();
    if (existingPlans > 0) return;

    const defaultPlans = [
      {
        name: "شهر واحد",
        nameEn: "1 Month",
        durationMonths: 1,
        price: 100,
        sortOrder: 1,
      },
      {
        name: "3 أشهر",
        nameEn: "3 Months",
        durationMonths: 3,
        price: 250,
        sortOrder: 2,
      },
      {
        name: "6 أشهر",
        nameEn: "6 Months",
        durationMonths: 6,
        price: 450,
        sortOrder: 3,
      },
      {
        name: "سنة كاملة",
        nameEn: "1 Year",
        durationMonths: 12,
        price: 800,
        sortOrder: 4,
      },
    ];

    for (const plan of defaultPlans) {
      await this.planRepo.save(this.planRepo.create(plan));
    }
  }
}
