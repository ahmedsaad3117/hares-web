import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Or, In, Not, IsNull } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { CustomerRelation } from '../../entities/customer-relation.entity';
import { TrustStatus } from '../../entities/trust-status.enum';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateTrustStatusDto } from './dto/update-trust-status.dto';
import { SearchCustomerDto } from './dto/search-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { SearchLogsService } from '../search-logs/search-logs.service';

@Injectable()
export class CustomersService implements OnModuleInit {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(CustomerRelation)
    private readonly relationRepository: Repository<CustomerRelation>,
    private readonly searchLogsService: SearchLogsService,
  ) { }

  async onModuleInit() {
    await this.migrateLegacyCustomers();
  }

  async migrateLegacyCustomers() {
    try {
      const legacyCustomers = await this.customerRepository.find({
        where: { institutionId: Not(IsNull()) }
      });
      let count = 0;
      for (const cust of legacyCustomers) {
        if (!cust.institutionId) continue;
        const exists = await this.relationRepository.findOne({
          where: { customerId: cust.customerId, institutionId: cust.institutionId }
        });
        if (!exists) {
          await this.relationRepository.save({
            customerId: cust.customerId,
            institutionId: cust.institutionId,
            // If we have a createdBy user, we might be able to infer branch, but let's keep it safe with null
            branchId: null,
          });
          count++;
        }
      }
      if (count > 0) this.logger.log(`Migrated ${count} legacy customers to relations.`);
    } catch (e) {
      this.logger.error('Migration failed', e);
    }
  }

  async create(createCustomerDto: CreateCustomerDto, user: any): Promise<CustomerResponseDto> {
    // 1. Check Global Existence by National ID
    let customer = await this.customerRepository.findOne({
      where: { nationalId: createCustomerDto.nationalId },
    });

    if (customer) {
      // Customer exists globally

      // If user has no institution (Super Admin?), return details directly
      if (!user.institutionId) {
        return this.toResponseDto(customer);
      }

      // Check for existing relation in current scope
      const relation = await this.relationRepository.findOne({
        where: {
          customerId: customer.customerId,
          institutionId: user.institutionId,
          // If user is Branch Admin, check exact branch match? 
          // Requirement: "Customer can be linked to multiple branches".
          // So we should check if linked to THIS branch.
          ...(user.branchId ? { branchId: user.branchId } : {})
        },
        withDeleted: true,
      });

      if (relation) {
        if (relation.deletedAt) {
          // Exists but deleted -> Suggest Restore?
          // We can treat this as "Exists globally" but with a flag? 
          // Or just let the Link flow handle restore.
          // Let's stick to consistent "Exists Global" response.
        }
        else {
          // Already active in this scope
          throw new ConflictException({
            message: 'Customer already linked and active in this scope',
            code: 'CUSTOMER_EXISTS_LOCAL',
            customer: this.toResponseDto(customer)
          });
        }
      }

      // Throw special error for Frontend to handle "Link" permission/prompt
      throw new ConflictException({
        message: 'Customer exists in global system',
        code: 'CUSTOMER_EXISTS_GLOBAL',
        customer: this.toResponseDto(customer),
      });
    }

    // 2. New Customer - Check Phone Uniqueness
    const existingPhone = await this.customerRepository.findOne({
      where: { phoneNumber: createCustomerDto.phoneNumber },
    });
    if (existingPhone) {
      throw new ConflictException('Customer with this phone number already exists');
    }

    // 3. Create Global Record
    // We store origin institutionId just for reference, but relations handle access
    customer = this.customerRepository.create({
      ...createCustomerDto,
      institutionId: user.institutionId, // Origin
      createdBy: user.userId,
    });
    const savedCustomer = await this.customerRepository.save(customer);

    // 4. Create Relation
    if (user.institutionId) {
      const relation = this.relationRepository.create({
        customerId: savedCustomer.customerId,
        institutionId: user.institutionId,
        branchId: user.branchId || null,
      });
      await this.relationRepository.save(relation);
    }

    return this.toResponseDto(savedCustomer);
  }

  async findAll(paginationDto: PaginationDto, user?: any, deleted: boolean = false): Promise<PaginatedResult<CustomerResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    // Get role name from user object (role can be object or string depending on context)
    const roleName = user?.role?.roleName || user?.roleName;

    // For deleted customers, we need a different approach because TypeORM's soft-delete
    // filtering interferes with our joins on customer_relations
    if (deleted) {
      return this.findDeletedCustomers(paginationDto, user, roleName);
    }

    // For active customers, use the standard approach
    const queryBuilder = this.customerRepository.createQueryBuilder('customer')
      .leftJoinAndSelect('customer.loans', 'loan')
      .leftJoinAndSelect('loan.branch', 'branch')
      .orderBy('customer.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (user && roleName !== 'Super Admin' && user.institutionId) {
      // Branch: see only their own customers
      // Institution: see their own AND their branches' customers
      let branchCondition = '';
      if (user.branchId) {
        // Branch user: only their branch
        branchCondition = 'AND rel.branch_id = :branchId ';
      }

      // Use raw innerJoin for active customers (deleted_at IS NULL)
      queryBuilder.innerJoin(
        'customer_relations',
        'rel',
        'rel.customer_id = customer.customer_id ' +
        'AND rel.institution_id = :instId ' +
        branchCondition +
        'AND rel.deleted_at IS NULL',
        { instId: user.institutionId, branchId: user.branchId || null }
      );
    }

    const [customers, total] = await queryBuilder.getManyAndCount();

    return {
      data: customers.map((customer) => this.toResponseDto(customer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find deleted customers using raw SQL to bypass TypeORM's soft-delete filtering
   */
  private async findDeletedCustomers(
    paginationDto: PaginationDto,
    user?: any,
    roleName?: string
  ): Promise<PaginatedResult<CustomerResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];

    if (user && roleName !== 'Super Admin' && user.institutionId) {
      whereClause = 'WHERE cr.institution_id = $1 AND cr.deleted_at IS NOT NULL';
      params.push(user.institutionId);

      if (user.branchId) {
        whereClause += ' AND cr.branch_id = $2';
        params.push(user.branchId);
      }
    } else {
      // Super Admin - see all deleted
      whereClause = 'WHERE cr.deleted_at IS NOT NULL';
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT c.customer_id) as count
      FROM customers c
      INNER JOIN customer_relations cr ON cr.customer_id = c.customer_id
      ${whereClause}
    `;

    const countResult = await this.customerRepository.query(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Data query with pagination
    const dataQuery = `
      SELECT DISTINCT 
        c.customer_id as "customerId",
        c.name,
        c.national_id as "nationalId",
        c.phone_number as "phoneNumber",
        c.trust_status as "trustStatus",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        cr.deleted_at as "deletedAt",
        cr.deleted_by as "deletedBy",
        cr.branch_id as "branchId",
        cr.institution_id as "institutionId",
        u.name as "deletedByName",
        b.name as "branchName",
        i.name as "institutionName"
      FROM customers c
      INNER JOIN customer_relations cr ON cr.customer_id = c.customer_id
      LEFT JOIN users u ON u.user_id = cr.deleted_by
      LEFT JOIN branches b ON b.branch_id = cr.branch_id
      LEFT JOIN institutions i ON i.institution_id = cr.institution_id
      ${whereClause}
      ORDER BY cr.deleted_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    const rawCustomers = await this.customerRepository.query(dataQuery, params);

    // Map raw results to CustomerResponseDto format
    const data: CustomerResponseDto[] = rawCustomers.map((row: any) => ({
      customerId: row.customerId,
      name: row.name,
      nationalId: row.nationalId,
      phoneNumber: row.phoneNumber,
      trustStatus: row.trustStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      loans: [],
      // Additional deleted-specific fields
      deletedAt: row.deletedAt,
      deletedBy: row.deletedBy,
      deletedByName: row.deletedByName,
      branchId: row.branchId,
      branchName: row.branchName,
      institutionId: row.institutionId,
      institutionName: row.institutionName,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async restore(id: number, user: any, relationId?: number): Promise<void> {
    // Super Admin can restore any relation by ID
    // Get role name
    const roleName = user?.role?.roleName || user?.roleName;

    if (roleName === 'Super Admin') {
      if (relationId) {
        const relation = await this.relationRepository.findOne({
          where: { id: relationId },
          withDeleted: true
        });
        if (!relation) throw new NotFoundException('Relation not found');
        await this.relationRepository.restore(relation.id);
        this.logger.log(`RESTORE: Relation ${relationId} restored by Super Admin ${user.userId}`);
        return;
      }
      // If no relationId, restore all deleted relations for this customer
      const relations = await this.relationRepository.find({
        where: { customerId: id },
        withDeleted: true
      });
      for (const rel of relations) {
        if (rel.deletedAt) {
          await this.relationRepository.restore(rel.id);
        }
      }
      this.logger.log(`RESTORE: All relations for customer ${id} restored by Super Admin ${user.userId}`);
      return;
    }

    // Institution/Branch: restore within their scope
    if (!user.institutionId) throw new ConflictException('Scope needed');

    const whereCondition: any = {
      customerId: id,
      institutionId: user.institutionId,
    };

    // Branch can only restore their own relations
    if (user.branchId) {
      whereCondition.branchId = user.branchId;
    }
    // Institution can restore their own AND their branches' relations

    const relation = await this.relationRepository.findOne({
      where: whereCondition,
      withDeleted: true
    });

    if (!relation) throw new NotFoundException('Relation not found in your scope');
    if (!relation.deletedAt) throw new ConflictException('Customer is not deleted');

    await this.relationRepository.restore(relation.id);
    this.logger.log(`RESTORE: Customer ${id} restored by user ${user.userId}`);
  }

  async softDelete(id: number, user: any): Promise<{ message: string }> {
    this.logger.log(`SOFT DELETE: Starting soft delete for customer ${id} by user ${user.userId}`);

    const customer = await this.customerRepository.findOne({
      where: { customerId: id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // For Super Admin without institution, we need to create/update a relation
    const roleName = user?.role?.roleName || user?.roleName;

    if (roleName === 'Super Admin' && !user.institutionId) {
      // Find any existing relation for this customer
      const existingRelation = await this.relationRepository.findOne({
        where: { customerId: id },
      });

      if (existingRelation) {
        // Soft delete existing relation
        existingRelation.deletedBy = user.userId;
        await this.relationRepository.save(existingRelation);
        await this.relationRepository.softDelete(existingRelation.id);
      } else {
        // No existing relation - need to create one
        // If customer has no institutionId, we cannot create a valid relation
        // So we'll mark it in a different way or create with the customer's origin institution
        if (!customer.institutionId) {
          // Customer was created by Super Admin without institution
          // We need at least one institution to create a deletable relation
          // For now, throw an error - Super Admin should hard delete such customers
          throw new ConflictException('Customer has no institution. Use permanent delete instead.');
        }

        // Create a new relation with the customer's origin institution
        const newRelation = this.relationRepository.create({
          customerId: id,
          institutionId: customer.institutionId,
          branchId: null,
          deletedBy: user.userId,
        });
        const savedRelation = await this.relationRepository.save(newRelation);
        await this.relationRepository.softDelete(savedRelation.id);
      }

      this.logger.log(`SOFT DELETE: Customer ${id} soft deleted by Super Admin ${user.userId}`);
      return { message: 'Customer moved to deleted list' };
    }

    // For normal users with institution
    if (!user.institutionId) {
      throw new ConflictException('User scope undefined');
    }

    const whereCondition: any = {
      customerId: id,
      institutionId: user.institutionId,
    };

    if (user.branchId) {
      whereCondition.branchId = user.branchId;
    }

    const relation = await this.relationRepository.findOne({
      where: whereCondition,
    });

    if (!relation) {
      throw new NotFoundException('Customer not found in your scope');
    }

    relation.deletedBy = user.userId;
    await this.relationRepository.save(relation);
    await this.relationRepository.softDelete(relation.id);

    this.logger.log(`SOFT DELETE: Customer ${id} unlinked from institution ${user.institutionId} by user ${user.userId}`);
    return { message: 'Customer moved to deleted list' };
  }

  async findOne(id: number, user?: any): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { customerId: id },
      relations: ['loans', 'loans.branch', 'loans.branch.institution', 'institution', 'creator'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Log this view
    if (user) {
      try {
        await this.searchLogsService.create({
          customerId: id,
          userId: user.userId,
          searchQuery: `View customer #${id}`,
          searchType: 'view',
        });
      } catch (error) {
        console.error('Failed to log customer view:', error);
      }
    }

    // Check if linked to current user's institution
    let isLinked = false;
    if (user && user.institutionId) {
      if (customer.institutionId === user.institutionId) {
        isLinked = true; // Owned by institution
      } else {
        const relation = await this.relationRepository.findOne({
          where: {
            customerId: id,
            institutionId: user.institutionId
          },
          withDeleted: false
        });
        isLinked = !!relation;
      }
    }

    const response = this.toResponseDto(customer);
    response.isLinked = isLinked;
    return response;
  }

  async search(searchDto: SearchCustomerDto, user?: any): Promise<CustomerResponseDto[]> {
    const whereConditions: any[] = [];

    // Use EXACT match for national ID - full ID required
    if (searchDto.nationalId) {
      whereConditions.push({ nationalId: searchDto.nationalId });
    }

    // Use EXACT match for phone number - full number required
    if (searchDto.phoneNumber) {
      whereConditions.push({ phoneNumber: searchDto.phoneNumber });
    }

    // Name search disabled - only exact ID/phone searches allowed

    // If no search criteria provided, return empty array
    if (whereConditions.length === 0) {
      return [];
    }

    // Global search - no institution filter
    const customers = await this.customerRepository.find({
      where: whereConditions,
      order: { createdAt: 'DESC' },
    });

    const dtos: CustomerResponseDto[] = [];

    for (const customer of customers) {
      // Log search
      if (user) {
        try {
          await this.searchLogsService.create({
            customerId: customer.customerId,
            userId: user.userId,
            searchQuery: JSON.stringify(searchDto),
            searchType: 'search',
          });
        } catch (error) {
          console.error('Failed to log customer search:', error);
        }
      }

      const dto = this.toResponseDto(customer);

      // Check if linked to current user's institution
      if (user && user.institutionId) {
        if (customer.institutionId === user.institutionId) {
          dto.isLinked = true; // Owned by institution
        } else {
          const relation = await this.relationRepository.findOne({
            where: {
              customerId: customer.customerId,
              institutionId: user.institutionId
            },
            withDeleted: false
          });
          dto.isLinked = !!relation;
        }
      }

      dtos.push(dto);
    }

    return dtos;
  }

  async update(
    id: number,
    updateCustomerDto: UpdateCustomerDto,
    user?: any,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { customerId: id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    // Check permissions: only creator or Super Admin can update
    // Get role name
    const userRoleName = user?.role?.roleName || user?.roleName;
    if (user && userRoleName !== 'Super Admin' && customer.createdBy !== user.userId) {
      throw new ConflictException('You do not have permission to update this customer');
    }

    // Check for duplicate national ID if updating
    if (updateCustomerDto.nationalId && updateCustomerDto.nationalId !== customer.nationalId) {
      const existingNationalId = await this.customerRepository.findOne({
        where: { nationalId: updateCustomerDto.nationalId },
      });
      if (existingNationalId) {
        throw new ConflictException('Customer with this national ID already exists');
      }
    }

    // Check for duplicate phone number if updating
    if (updateCustomerDto.phoneNumber && updateCustomerDto.phoneNumber !== customer.phoneNumber) {
      const existingPhone = await this.customerRepository.findOne({
        where: { phoneNumber: updateCustomerDto.phoneNumber },
      });
      if (existingPhone) {
        throw new ConflictException('Customer with this phone number already exists');
      }
    }

    Object.assign(customer, updateCustomerDto);
    const updatedCustomer = await this.customerRepository.save(customer);
    return this.toResponseDto(updatedCustomer);
  }

  async link(customerId: number, user: any): Promise<void> {
    const relation = await this.relationRepository.findOne({
      where: {
        customerId,
        institutionId: user.institutionId,
        ...(user.branchId ? { branchId: user.branchId } : {}),
      },
      withDeleted: true,
    });

    if (relation) {
      if (relation.deletedAt) {
        await this.relationRepository.restore(relation.id);
        return;
      }
      throw new ConflictException('Customer already linked to this scope');
    }

    const newRel = this.relationRepository.create({
      customerId,
      institutionId: user.institutionId,
      branchId: user.branchId || null,
    });
    await this.relationRepository.save(newRel);
  }

  async remove(id: number, user?: any): Promise<{ message: string }> {
    try {
      this.logger.log(`REMOVE: Starting delete for customer ${id}`);
      this.logger.log(`REMOVE: User object: ${JSON.stringify(user)}`);

      const customer = await this.customerRepository.findOne({
        where: { customerId: id },
        relations: ['loans'],
      });

      if (!customer) {
        throw new NotFoundException(`Customer with ID ${id} not found`);
      }

      this.logger.log(`REMOVE: Customer found: ${customer.name}, loans count: ${customer.loans?.length || 0}`);

      // Super Admin: Hard Delete
      // Get role name - handle both object and flattened formats
      const roleName = user?.role?.roleName || user?.roleName;

      this.logger.log(`REMOVE: Role name resolved to: ${roleName}`);

      if (user && roleName === 'Super Admin') {
        this.logger.log(`REMOVE: Super Admin detected, proceeding with hard delete`);

        if (customer.loans && customer.loans.length > 0) {
          throw new ConflictException('Cannot delete customer with existing loans.');
        }

        // Delete related records first to avoid foreign key constraint violations
        // 1. Delete search logs
        const deletedSearchLogs = await this.searchLogsService.deleteByCustomerId(id);
        this.logger.log(`REMOVE: Deleted ${deletedSearchLogs} search logs for customer ${id}`);

        // 2. Delete customer relations (hard delete, not soft delete)
        await this.relationRepository.delete({ customerId: id });
        this.logger.log(`REMOVE: Deleted customer relations for customer ${id}`);

        // 3. Now delete the customer
        await this.customerRepository.remove(customer);
        this.logger.warn(`HARD DELETE: Customer ${id} (${customer.name}) deleted by Super Admin ${user.userId}`);
        return { message: 'Customer permanently deleted' };
      }

      this.logger.log(`REMOVE: Not Super Admin, proceeding with soft delete`);

      // Institution/Branch: Soft Delete (Unlink)
      if (!user?.institutionId) {
        throw new ConflictException('User scope undefined');
      }

      const whereCondition: any = {
        customerId: id,
        institutionId: user.institutionId,
      };

      // Branch can only delete their own relations
      if (user.branchId) {
        whereCondition.branchId = user.branchId;
      }

      const relation = await this.relationRepository.findOne({
        where: whereCondition
      });

      if (!relation) {
        throw new NotFoundException('Customer not found in your scope');
      }

      // Record who deleted and when
      relation.deletedBy = user.userId;
      await this.relationRepository.save(relation);

      // Soft delete relation
      await this.relationRepository.softDelete(relation.id);

      this.logger.log(`SOFT DELETE: Customer ${id} unlinked from institution ${user.institutionId} by user ${user.userId}`);

      return { message: 'Customer unlinked successfully' };
    } catch (error) {
      this.logger.error(`REMOVE ERROR: ${error.message}`);
      this.logger.error(`REMOVE ERROR STACK: ${error.stack}`);
      throw error;
    }
  }

  async updateTrustStatus(
    customerId: number,
    updateTrustStatusDto: UpdateTrustStatusDto,
    userId: number,
  ): Promise<CustomerResponseDto> {
    const customer = await this.customerRepository.findOne({
      where: { customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    const oldStatus = customer.trustStatus;
    const newStatus = updateTrustStatusDto.trust_status;

    // Update trust status
    customer.trustStatus = newStatus;
    const updatedCustomer = await this.customerRepository.save(customer);

    // Log the trust status change for audit trail
    this.logger.log(
      `Trust status updated for customer ${customerId}: ${oldStatus} → ${newStatus} by user ${userId}`,
    );

    return this.toResponseDto(updatedCustomer);
  }

  private toResponseDto(customer: Customer): CustomerResponseDto {
    const baseDto = {
      customerId: customer.customerId,
      name: customer.name,
      nationalId: customer.nationalId,
      phoneNumber: customer.phoneNumber,
      trustStatus: customer.trustStatus,
      institutionId: customer.institutionId,
      institutionName: customer.institution?.name,
      createdBy: customer.createdBy,
      createdByName: customer.creator?.name,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    if (customer.relations && customer.relations.length > 0) {
      const rel = customer.relations[0];
      if (rel.deletedAt) {
        return {
          ...baseDto,
          deletedAt: rel.deletedAt,
          deletedBy: rel.deletedBy,
          deletedByName: rel.deleter?.name,
          branchName: rel.branch?.name || rel.institution?.name
        };
      }
    }
    return baseDto;
  }
}
