import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "../../entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "../../common/cache";

import { Institution } from "../../entities/institution.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Institution)
    private institutionRepository: Repository<Institution>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private cacheService: CacheService,
    private dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException("Email already exists");
    }

    // Check if phone number already exists
    if (createUserDto.phoneNumber) {
      const existingPhone = await this.usersRepository.findOne({
        where: { phoneNumber: createUserDto.phoneNumber },
      });

      if (existingPhone) {
        throw new ConflictException("Phone number already exists");
      }
    }

    // Check institution capacity if adding to an institution
    if (createUserDto.institutionId) {
      const institution = await this.institutionRepository.findOne({
        where: { institutionId: createUserDto.institutionId },
      });

      if (institution) {
        const currentUsersCount = await this.usersRepository.count({
          where: { institutionId: createUserDto.institutionId, isActive: true },
        });

        if (currentUsersCount >= institution.maxUsers) {
          // EXCEPTION: Allow creating user if it is being created by a Super Admin (we assume Super Admin knows what they are doing, OR better yet, we just block it for everyone strictly as requested).
          // User logic: "The user created with the branch request has no relation to institution users... but manual add should be restricted."
          // The branch request uses a different flow (SubscriptionsService), so this check here strictly affects manual adds via UsersController.
          throw new ForbiddenException(
            `Cannot add user. Institution has reached its maximum capacity of ${institution.maxUsers} users.`,
          );
        }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      passwordHash: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);
    return this.toResponseDto(savedUser);
  }

  /**
   * Get all users with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findAll(
    paginationDto: PaginationDto,
    currentUser?: any,
  ): Promise<PaginatedResult<UserResponseDto>> {
    try {
      const { page = 1, limit = 10, search } = paginationDto;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Multi-tenancy: Restrict Institution admins to their own institution
      const roleName = currentUser?.roleName || currentUser?.role?.roleName;
      if (
        currentUser &&
        roleName === "Institution" &&
        currentUser.institutionId
      ) {
        whereClauses.push(`u.institution_id = $${paramIndex++}`);
        params.push(currentUser.institutionId);
      }

      // Search functionality
      if (search && search.trim()) {
        const searchTerm = `%${search.trim().toLowerCase()}%`;
        whereClauses.push(`(
          LOWER(u.name) LIKE $${paramIndex} OR 
          LOWER(u.email) LIKE $${paramIndex} OR 
          LOWER(r.role_name) LIKE $${paramIndex} OR 
          LOWER(i.name) LIKE $${paramIndex} OR 
          LOWER(b.name) LIKE $${paramIndex} OR 
          u.phone_number LIKE $${paramIndex} OR 
          u.national_id LIKE $${paramIndex}
        )`);
        params.push(searchTerm);
        paramIndex++;
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const combinedQuery = `
        WITH user_data AS (
          SELECT 
            u.user_id as "userId",
            u.role_id as "roleId",
            u.institution_id as "institutionId",
            u.branch_id as "branchId",
            u.name,
            u.email,
            u.phone_number as "phoneNumber",
            u.national_id as "nationalId",
            u.is_active as "isActive",
            u.created_at as "createdAt",
            u.updated_at as "updatedAt",
            r.role_name as "roleName",
            i.name as "institutionName",
            b.name as "branchName",
            COALESCE(b.expiration_date, i.expiration_date) as "expirationDate"
          FROM users u
          LEFT JOIN roles r ON u.role_id = r.role_id
          LEFT JOIN institutions i ON u.institution_id = i.institution_id
          LEFT JOIN branches b ON u.branch_id = b.branch_id
          ${whereClause}
        )
        SELECT 
          (SELECT COUNT(*) FROM user_data) as total,
          (SELECT COALESCE(json_agg(row_to_json(ud)), '[]'::json) FROM (
            SELECT * FROM user_data 
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          ) ud) as data
      `;

      const result = await this.dataSource.query(combinedQuery, params);
      const row = result[0] || {};

      return {
        data: (row.data || []).map((user: any) => new UserResponseDto(user)),
        meta: {
          total: parseInt(row.total || "0"),
          page,
          limit,
          totalPages: Math.ceil(parseInt(row.total || "0") / limit),
        },
      };
    } catch (error) {
      console.error("Error in users findAll:", error);
      throw error;
    }
  }

  async findOne(id: number, useCache = true): Promise<UserResponseDto> {
    const cacheKey = `users:detail:${id}`;

    const fetchUser = async () => {
      const user = await this.usersRepository.findOne({
        where: { userId: id },
        relations: ["role", "institution", "branch"],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return this.toResponseDto(user);
    };

    if (!useCache) {
      return fetchUser();
    }

    return this.cacheService.get(
      cacheKey,
      fetchUser,
      CACHE_TTL.MEDIUM, // 10 minutes
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ["role", "institution", "branch"],
    });
  }

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phoneNumber },
      relations: ["role", "institution", "branch"],
    });
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    // Try email first, then phone, then national ID
    let user = await this.findByEmail(identifier);
    if (!user) {
      user = await this.findByPhone(identifier);
    }
    if (!user) {
      user = await this.usersRepository.findOne({
        where: { nationalId: identifier },
        relations: ["role", "institution", "branch"],
      });
    }
    return user;
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUser?: any,
  ): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { userId: id },
      relations: ["role"],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Security: Restrict Institution Admins to their own users
    if (currentUser && currentUser.roleName === "Institution") {
      if (user.institutionId !== currentUser.institutionId) {
        throw new ForbiddenException(
          "غير مصرح لك بتعديل بيانات مستخدمين خارج مؤسستك",
        );
      }
    }

    // Security: Prevent Super Admins from changing other Super Admin passwords
    if (updateUserDto.password) {
      if (currentUser) {
        // Check if target user is Super Admin (usually roleId 1)
        const isTargetSuperAdmin =
          user.roleId === 1 || user.role?.roleName === "Super Admin";
        const isMasterAdmin = currentUser.email === "admin@q1key.com";

        // Strict Rule: Only 'admin@q1key.com' can change password of ANY Super Admin (including themselves)
        if (isTargetSuperAdmin && !isMasterAdmin) {
          throw new ForbiddenException(
            "Security Restriction: Only the Master Admin (admin@q1key.com) can change Super Admin passwords.",
          );
        }

        // ADDITIONAL STRICT RULE: If changing password for Master Admin (admin@q1key.com), must verify old password
        if (user.email === "admin@q1key.com") {
          if (!updateUserDto.oldPassword) {
            throw new BadRequestException(
              "Old password is required to change the Master Admin password.",
            );
          }
          const isMatch = await bcrypt.compare(
            updateUserDto.oldPassword,
            user.passwordHash,
          );

          if (!isMatch) {
            throw new BadRequestException("Invalid old password.");
          }
          // Clean up so it doesn't try to save to DB
          delete updateUserDto.oldPassword;
        }
      }

      updateUserDto["passwordHash"] = await bcrypt.hash(
        updateUserDto.password,
        10,
      );
      delete updateUserDto.password;
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.usersRepository.save(user);

    // Invalidate caches
    this.cacheService.invalidate(`users:detail:${id}`);

    return this.toResponseDto(updatedUser);
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { userId: id } });
    if (user && user.email === "admin@q1key.com") {
      throw new ForbiddenException("Cannot delete the Master Admin account.");
    }

    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Invalidate cache
    this.cacheService.invalidate(`users:detail:${id}`);
  }

  async toggleActive(id: number): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { userId: id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.email === "admin@q1key.com") {
      throw new ForbiddenException(
        "Cannot deactivate the Master Admin account.",
      );
    }

    user.isActive = !user.isActive;

    // Clear session when deactivating user to prevent continued access
    if (!user.isActive) {
      user.activeSessionId = null;
    }

    const updatedUser = await this.usersRepository.save(user);

    // Invalidate cache
    this.cacheService.invalidate(`users:detail:${id}`);

    return this.toResponseDto(updatedUser);
  }

  async updateSessionId(userId: number, sessionId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      activeSessionId: sessionId,
      lastActivityAt: new Date(),
    });
  }

  async updateLastActivity(userId: number): Promise<void> {
    await this.usersRepository.update(userId, { lastActivityAt: new Date() });
  }

  async clearSessionId(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      activeSessionId: null,
      lastActivityAt: null,
    });
  }

  async forceLogout(id: number, admin: any): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { userId: id },
      relations: ["role"],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Security: Restrict Institution Admins to their own users
    if (admin && admin.roleName === "Institution") {
      if (user.institutionId !== admin.institutionId) {
        throw new ForbiddenException(
          "غير مصرح لك بتسجيل خروج مستخدمين خارج مؤسستك",
        );
      }
    }

    // Security: Only Master Admin (admin@q1key.com) can force logout another Super Admin
    const isTargetSuperAdmin =
      user.roleId === 1 || user.role?.roleName === "Super Admin";
    const isMasterAdmin = admin.email === "admin@q1key.com";

    if (isTargetSuperAdmin && !isMasterAdmin) {
      throw new ForbiddenException(
        "Security Restriction: Only the Master Admin can force logout other Super Admins.",
      );
    }

    await this.clearSessionId(id);

    // Invalidate cache
    this.cacheService.invalidate(`users:detail:${id}`);
  }

  private toResponseDto(user: User): UserResponseDto {
    return new UserResponseDto({
      userId: user.userId,
      roleId: user.roleId,
      institutionId: user.institutionId,
      branchId: user.branchId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      nationalId: user.nationalId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roleName: user.role?.roleName,
      institutionName: user.institution?.name,
      branchName: user.branch?.name,
      expirationDate:
        user.branch?.expirationDate || user.institution?.expirationDate || null,
    });
  }
}
