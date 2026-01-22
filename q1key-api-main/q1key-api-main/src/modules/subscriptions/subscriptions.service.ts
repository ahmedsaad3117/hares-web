import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { SubscriptionRequest, SubscriptionRequestStatus, RequesterType } from '../../entities/subscription-request.entity';
import { Institution } from '../../entities/institution.entity';
import { Branch } from '../../entities/branch.entity';
import { CashBox, CashBoxType } from '../../entities/cash-box.entity';
import { CashBoxTransaction, TransactionType } from '../../entities/cash-box-transaction.entity';
import { UsersService } from '../users/users.service';
import { User } from '../../entities/user.entity';

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
    ) { }

    // ==================== PLANS ====================

    async getAllPlans(includeInactive: boolean = false): Promise<SubscriptionPlan[]> {
        const where = includeInactive ? {} : { isActive: true };
        return this.planRepo.find({
            where,
            order: { sortOrder: 'ASC', durationMonths: 'ASC' },
        });
    }

    async getActivePlans(): Promise<SubscriptionPlan[]> {
        return this.planRepo.find({
            where: { isActive: true },
            order: { sortOrder: 'ASC', durationMonths: 'ASC' },
        });
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
        return this.planRepo.save(plan);
    }

    async updatePlan(id: number, dto: any): Promise<SubscriptionPlan> {
        const plan = await this.planRepo.findOne({ where: { id } });
        if (!plan) {
            throw new HttpException('الباقة غير موجودة', HttpStatus.NOT_FOUND);
        }

        Object.assign(plan, dto);
        return this.planRepo.save(plan);
    }

    async togglePlanVisibility(id: number): Promise<SubscriptionPlan> {
        const plan = await this.planRepo.findOne({ where: { id } });
        if (!plan) {
            throw new HttpException('الباقة غير موجودة', HttpStatus.NOT_FOUND);
        }

        plan.isActive = !plan.isActive;
        return this.planRepo.save(plan);
    }

    async deletePlan(id: number): Promise<{ message: string }> {
        const plan = await this.planRepo.findOne({ where: { id } });
        if (!plan) {
            throw new HttpException('الباقة غير موجودة', HttpStatus.NOT_FOUND);
        }

        // Check if plan is used in any request
        const usedCount = await this.requestRepo.count({ where: { planId: id } });
        if (usedCount > 0) {
            throw new HttpException(
                'لا يمكن حذف هذه الباقة لأنها مستخدمة في طلبات سابقة. يمكنك إخفاؤها بدلاً من ذلك.',
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.planRepo.delete(id);
        return { message: 'تم حذف الباقة بنجاح' };
    }

    // ==================== REQUESTS ====================

    async getAllRequests(
        status?: string,
        page: number = 1,
        limit: number = 20,
    ): Promise<{ data: SubscriptionRequest[]; total: number; page: number; limit: number }> {
        const query = this.requestRepo.createQueryBuilder('request')
            .leftJoinAndSelect('request.institution', 'institution')
            .leftJoinAndSelect('institution.users', 'institutionUsers')
            .leftJoinAndSelect('request.branch', 'branch')
            .leftJoinAndSelect('request.plan', 'plan')
            .leftJoinAndSelect('request.processor', 'processor');

        if (status) {
            query.where('request.status = :status', { status });
        }

        query.orderBy('request.createdAt', 'DESC');

        const total = await query.getCount();
        const data = await query
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        return { data, total, page, limit };
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

        if (user.roleName === 'Institution' && user.institutionId) {
            entity = await this.institutionRepo.findOne({
                where: { institutionId: user.institutionId },
            });
            type = RequesterType.INSTITUTION;
        } else if (user.roleName === 'Branch' && user.branchId) {
            entity = await this.branchRepo.findOne({
                where: { branchId: user.branchId },
                relations: ['institution'],
            });
            type = RequesterType.BRANCH;
        }

        if (!entity) {
            throw new HttpException('لم يتم العثور على بيانات الاشتراك', HttpStatus.NOT_FOUND);
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
        let status = 'active';
        if (expirationDate) {
            const today = new Date();
            const expDate = new Date(expirationDate);
            daysRemaining = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysRemaining <= 0) {
                status = 'expired';
            } else if (daysRemaining <= 5) {
                status = 'expiring_soon';
            } else if (daysRemaining <= 30) {
                status = 'expiring';
            }
        }

        // Get pending requests
        let pendingRequest: SubscriptionRequest | null = null;
        if (type === RequesterType.INSTITUTION && user.institutionId) {
            pendingRequest = await this.requestRepo.findOne({
                where: { institutionId: user.institutionId, status: SubscriptionRequestStatus.PENDING },
                relations: ['plan'],
            });
        } else if (type === RequesterType.BRANCH && user.branchId) {
            pendingRequest = await this.requestRepo.findOne({
                where: { branchId: user.branchId, status: SubscriptionRequestStatus.PENDING },
                relations: ['plan'],
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
        if (user.roleName === 'Institution' && user.institutionId) {
            return this.requestRepo.find({
                where: {
                    institutionId: user.institutionId,
                    requesterType: RequesterType.INSTITUTION
                },
                relations: ['plan'],
                order: { createdAt: 'DESC' },
            });
        } else if (user.roleName === 'Branch' && user.branchId) {
            return this.requestRepo.find({
                where: {
                    branchId: user.branchId,
                    requesterType: RequesterType.BRANCH
                },
                relations: ['plan'],
                order: { createdAt: 'DESC' },
            });
        }
        return [];
    }

    async createRequest(user: any, dto: any): Promise<SubscriptionRequest> {
        // Determine requester type and ID
        let requesterType: RequesterType;
        let institutionId: number | undefined = undefined;
        let branchId: number | undefined = undefined;

        if (user.roleName === 'Institution' && user.institutionId) {
            requesterType = RequesterType.INSTITUTION;
            institutionId = user.institutionId;
        } else if (user.roleName === 'Branch' && user.branchId) {
            requesterType = RequesterType.BRANCH;
            branchId = user.branchId;
        } else {
            throw new HttpException('غير مصرح لك بإنشاء طلب اشتراك', HttpStatus.FORBIDDEN);
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
                'لديك طلب اشتراك قيد المعالجة بالفعل. يرجى انتظار معالجته أو إلغائه.',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Get plan details
        let amount = 0;
        let durationMonths = dto.customDurationMonths;

        if (dto.planId) {
            const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
            if (!plan) {
                throw new HttpException('الباقة غير موجودة', HttpStatus.NOT_FOUND);
            }
            if (!plan.isActive) {
                throw new HttpException('هذه الباقة غير متاحة حالياً', HttpStatus.BAD_REQUEST);
            }
            amount = plan.price;
            durationMonths = plan.durationMonths;
        }

        // Get current expiration date to handle extension correctly
        let currentExpiration: Date | null = null;
        if (requesterType === RequesterType.INSTITUTION && institutionId) {
            const inst = await this.institutionRepo.findOne({ where: { institutionId } });
            currentExpiration = inst?.expirationDate || null;
        } else if (requesterType === RequesterType.BRANCH && branchId) {
            const br = await this.branchRepo.findOne({ where: { branchId } });
            currentExpiration = br?.expirationDate || null;
        }

        // Calculate dates
        const now = new Date();
        const baseDate = (currentExpiration && new Date(currentExpiration) > now)
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
            throw new HttpException('يرجى اختيار باقة أو تحديد مدة الاشتراك', HttpStatus.BAD_REQUEST);
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

        return this.requestRepo.save(request);
    }

    async getRequestById(id: number, user: any): Promise<SubscriptionRequest> {
        const request = await this.requestRepo.findOne({
            where: { id },
            relations: ['institution', 'branch', 'plan', 'processor'],
        });

        if (!request) {
            throw new HttpException('الطلب غير موجود', HttpStatus.NOT_FOUND);
        }

        // Check access
        if (user.roleName !== 'Super Admin') {
            const hasAccess =
                (user.institutionId && request.institutionId === user.institutionId) ||
                (user.branchId && request.branchId === user.branchId);

            if (!hasAccess) {
                throw new HttpException('غير مصرح لك بالوصول لهذا الطلب', HttpStatus.FORBIDDEN);
            }
        }

        return request;
    }

    async processRequest(id: number, dto: any, adminUser: any): Promise<SubscriptionRequest> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const request = await this.requestRepo.findOne({
                where: { id },
                relations: ['institution', 'branch', 'plan'],
            });

            if (!request) {
                throw new HttpException('الطلب غير موجود', HttpStatus.NOT_FOUND);
            }

            if (request.status !== SubscriptionRequestStatus.PENDING) {
                throw new HttpException('تم معالجة هذا الطلب مسبقاً', HttpStatus.BAD_REQUEST);
            }

            // Capture NEW registration status BEFORE updating request.institutionId
            const isNewRegistration = !request.institutionId && !request.branchId && !!request.pendingData;

            request.status = dto.status;
            request.adminNotes = dto.adminNotes;
            request.processedBy = adminUser.userId;
            request.processedAt = new Date();

            if (dto.isFree) {
                request.isFree = true;
                request.freeReason = dto.freeReason;
                request.amount = 0;
            }

            if (dto.status === 'Approved') {
                // Handle New Registration (PENDING DATA)
                if (isNewRegistration && request.pendingData) {
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
                            isActive: true, // Activate now
                            expirationDate: request.requestedEndDate,
                        });
                        const savedInstitution = await queryRunner.manager.save(Institution, institution);

                        // Link request to new institution
                        request.institutionId = savedInstitution.institutionId;
                        request.institution = savedInstitution;

                        // Create the admin user (only if not existing)
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
                            });

                            await queryRunner.manager.save(User, newUser);
                        }
                    } catch (e) {
                        console.error('Error creating institution from pending data:', e);
                        throw new HttpException('فشل إنشاء المؤسسة من بيانات الطلب', HttpStatus.INTERNAL_SERVER_ERROR);
                    }
                } else if (request.requesterType === RequesterType.INSTITUTION && request.institutionId) {
                    await queryRunner.manager.update(
                        Institution,
                        { institutionId: request.institutionId },
                        { expirationDate: request.requestedEndDate, isActive: true },
                    );
                } else if (request.requesterType === RequesterType.BRANCH && request.branchId) {
                    // Update Branch Expiration
                    await queryRunner.manager.update(
                        Branch,
                        { branchId: request.branchId },
                        { expirationDate: request.requestedEndDate, isActive: true },
                    );
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
                        const entityName = request.institution?.name || request.branch?.name || 'غير معروف';
                        const planName = request.plan?.name || `${request.customDurationMonths} شهر`;
                        const prefix = isNewRegistration ? "جديد: " : "تجديد: ";

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
            throw new HttpException('الطلب غير موجود', HttpStatus.NOT_FOUND);
        }

        // Check ownership
        const isOwner =
            (user.institutionId && request.institutionId === user.institutionId) ||
            (user.branchId && request.branchId === user.branchId);

        if (!isOwner && user.roleName !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بإلغاء هذا الطلب', HttpStatus.FORBIDDEN);
        }

        if (request.status !== SubscriptionRequestStatus.PENDING) {
            throw new HttpException('لا يمكن إلغاء طلب تمت معالجته', HttpStatus.BAD_REQUEST);
        }

        request.status = SubscriptionRequestStatus.CANCELLED;
        return this.requestRepo.save(request);
    }

    async updateRequest(id: number, dto: any, user: any): Promise<SubscriptionRequest> {
        const request = await this.requestRepo.findOne({ where: { id } });

        if (!request) {
            throw new HttpException('الطلب غير موجود', HttpStatus.NOT_FOUND);
        }

        // Only Super Admin can update
        if (user.roleName !== 'Super Admin') {
            throw new HttpException('غير مصرح لك بتعديل هذا الطلب', HttpStatus.FORBIDDEN);
        }

        if (request.status !== SubscriptionRequestStatus.PENDING) {
            throw new HttpException('لا يمكن تعديل طلب تمت معالجته', HttpStatus.BAD_REQUEST);
        }

        // Update plan if provided
        if (dto.planId) {
            const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
            if (!plan) {
                throw new HttpException('الباقة غير موجودة', HttpStatus.NOT_FOUND);
            }
            request.planId = plan.id;
            request.amount = plan.price;
            request.customDurationMonths = plan.durationMonths;

            // Recalculate end date based on plan duration and extension logic
            let currentExpiration: Date | null = null;
            if (request.requesterType === RequesterType.INSTITUTION && request.institutionId) {
                const inst = await this.institutionRepo.findOne({ where: { institutionId: request.institutionId } });
                currentExpiration = inst?.expirationDate || null;
            } else if (request.requesterType === RequesterType.BRANCH && request.branchId) {
                const br = await this.branchRepo.findOne({ where: { branchId: request.branchId } });
                currentExpiration = br?.expirationDate || null;
            }

            const now = new Date();
            const baseDate = (currentExpiration && new Date(currentExpiration) > now)
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
            if (typeof dto.pendingData === 'object') {
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

    // ==================== SETTINGS ====================

    async getSettings(): Promise<any> {
        // Get settings from system_settings table or return defaults
        const plans = await this.getAllPlans(true);

        return {
            plans,
            currency: 'SAR',
            currencySymbol: 'ر.س',
            freeTrialEnabled: plans.some(p => p.isFreeTrial),
            alertDaysBeforeExpiry: 5,
        };
    }

    async updateSettings(settings: any): Promise<any> {
        // Update settings logic here
        return { message: 'تم تحديث الإعدادات بنجاح', settings };
    }

    // ==================== SEED DEFAULT PLANS ====================

    async seedDefaultPlans(): Promise<void> {
        const existingPlans = await this.planRepo.count();
        if (existingPlans > 0) return;

        const defaultPlans = [
            { name: 'شهر واحد', nameEn: '1 Month', durationMonths: 1, price: 100, sortOrder: 1 },
            { name: '3 أشهر', nameEn: '3 Months', durationMonths: 3, price: 250, sortOrder: 2 },
            { name: '6 أشهر', nameEn: '6 Months', durationMonths: 6, price: 450, sortOrder: 3 },
            { name: 'سنة كاملة', nameEn: '1 Year', durationMonths: 12, price: 800, sortOrder: 4 },
        ];

        for (const plan of defaultPlans) {
            await this.planRepo.save(this.planRepo.create(plan));
        }
    }
}
