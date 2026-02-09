import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { CacheService, CACHE_KEYS, CACHE_TTL } from '../../common/cache';

import { Institution } from '../../entities/institution.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Institution)
    private institutionRepository: Repository<Institution>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private cacheService: CacheService,
  ) { }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if phone number already exists
    if (createUserDto.phoneNumber) {
      const existingPhone = await this.usersRepository.findOne({
        where: { phoneNumber: createUserDto.phoneNumber },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Check institution capacity if adding to an institution
    if (createUserDto.institutionId) {
      const institution = await this.institutionRepository.findOne({
        where: { institutionId: createUserDto.institutionId }
      });

      if (institution) {
        const currentUsersCount = await this.usersRepository.count({
          where: { institutionId: createUserDto.institutionId, isActive: true }
        });

        if (currentUsersCount >= institution.maxUsers) {
          // EXCEPTION: Allow creating user if it is being created by a Super Admin (we assume Super Admin knows what they are doing, OR better yet, we just block it for everyone strictly as requested).
          // User logic: "The user created with the branch request has no relation to institution users... but manual add should be restricted."
          // The branch request uses a different flow (SubscriptionsService), so this check here strictly affects manual adds via UsersController.
          throw new ForbiddenException(`Cannot add user. Institution has reached its maximum capacity of ${institution.maxUsers} users.`);
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

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<UserResponseDto>> {
    const { page = 1, limit = 10, search } = paginationDto;
    const skip = (page - 1) * limit;

    const query = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.institution', 'institution')
      .leftJoinAndSelect('user.branch', 'branch')
      .skip(skip)
      .take(limit)
      .orderBy('user.createdAt', 'DESC');

    if (search) {
      const terms = search.trim().split(/\s+/);
      terms.forEach((term, index) => {
        const termParam = `search_${index}`;
        const termVal = `%${term.toLowerCase()}%`;

        query.andWhere(new Brackets(qb => {
          qb.where(`LOWER(user.name) LIKE :${termParam}`, { [termParam]: termVal })
            .orWhere(`LOWER(user.email) LIKE :${termParam}`, { [termParam]: termVal })
            .orWhere(`LOWER(role.roleName) LIKE :${termParam}`, { [termParam]: termVal })
            .orWhere(`LOWER(institution.name) LIKE :${termParam}`, { [termParam]: termVal })
            .orWhere(`LOWER(branch.name) LIKE :${termParam}`, { [termParam]: termVal })
            .orWhere(`user.phoneNumber LIKE :${termParam}`, { [termParam]: termVal });

          // If the term is a number, also check for exact User ID match
          if (!isNaN(Number(term))) {
            const idParam = `id_${index}`;
            qb.orWhere(`user.userId = :${idParam}`, { [idParam]: term });
          }
        }));
      });
    }

    const [users, total] = await query.getManyAndCount();

    return {
      data: users.map(user => this.toResponseDto(user)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const cacheKey = `users:detail:${id}`;
    return this.cacheService.get(
      cacheKey,
      async () => {
        const user = await this.usersRepository.findOne({
          where: { userId: id },
          relations: ['role', 'institution', 'branch'],
        });

        if (!user) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }

        return this.toResponseDto(user);
      },
      CACHE_TTL.MEDIUM // 10 minutes
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['role', 'institution', 'branch'],
    });
  }

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { phoneNumber },
      relations: ['role', 'institution', 'branch'],
    });
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    // Try email first, then phone
    let user = await this.findByEmail(identifier);
    if (!user) {
      user = await this.findByPhone(identifier);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, currentUser?: any): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { userId: id },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Security: Restrict Institution Admins to their own users
    if (currentUser && currentUser.roleName === 'Institution') {
      if (user.institutionId !== currentUser.institutionId) {
        throw new ForbiddenException('غير مصرح لك بتعديل بيانات مستخدمين خارج مؤسستك');
      }
    }

    // Security: Prevent Super Admins from changing other Super Admin passwords
    if (updateUserDto.password) {
      if (currentUser) {
        // Check if target user is Super Admin (usually roleId 1)
        const isTargetSuperAdmin = user.roleId === 1 || user.role?.roleName === 'Super Admin';
        const isMasterAdmin = currentUser.email === 'admin@q1key.com';

        // Strict Rule: Only 'admin@q1key.com' can change password of ANY Super Admin (including themselves)
        if (isTargetSuperAdmin && !isMasterAdmin) {
          throw new ForbiddenException('Security Restriction: Only the Master Admin (admin@q1key.com) can change Super Admin passwords.');
        }

        // ADDITIONAL STRICT RULE: If changing password for Master Admin (admin@q1key.com), must verify old password
        if (user.email === 'admin@q1key.com') {
          if (!updateUserDto.oldPassword) {
            throw new BadRequestException('Old password is required to change the Master Admin password.');
          }
          const isMatch = await bcrypt.compare(updateUserDto.oldPassword, user.passwordHash);

          if (!isMatch) {
            throw new BadRequestException('Invalid old password.');
          }
          // Clean up so it doesn't try to save to DB
          delete updateUserDto.oldPassword;
        }
      }

      updateUserDto['passwordHash'] = await bcrypt.hash(updateUserDto.password, 10);
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
    if (user && user.email === 'admin@q1key.com') {
      throw new ForbiddenException('Cannot delete the Master Admin account.');
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

    if (user.email === 'admin@q1key.com') {
      throw new ForbiddenException('Cannot deactivate the Master Admin account.');
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
      lastActivityAt: new Date()
    });
  }

  async updateLastActivity(userId: number): Promise<void> {
    await this.usersRepository.update(userId, { lastActivityAt: new Date() });
  }

  async clearSessionId(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      activeSessionId: null,
      lastActivityAt: null
    });
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
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roleName: user.role?.roleName,
      institutionName: user.institution?.name,
      branchName: user.branch?.name,
      expirationDate: user.branch?.expirationDate || user.institution?.expirationDate || null,
    });
  }
}
