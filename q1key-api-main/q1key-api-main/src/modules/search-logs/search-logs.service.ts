import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SearchLog } from '../../entities/search-log.entity';
import { CreateSearchLogDto } from './dto/create-search-log.dto';
import { SearchLogResponseDto } from './dto/search-log-response.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class SearchLogsService {
  constructor(
    @InjectRepository(SearchLog)
    private readonly searchLogRepository: Repository<SearchLog>,
  ) { }

  async create(createSearchLogDto: CreateSearchLogDto): Promise<SearchLog> {
    // Check if a similar log exists within the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const existingLog = await this.searchLogRepository.findOne({
      where: {
        customerId: createSearchLogDto.customerId,
        userId: createSearchLogDto.userId,
        searchType: createSearchLogDto.searchType,
        createdAt: MoreThan(thirtyMinutesAgo),
      },
      order: { createdAt: 'DESC' },
    });

    if (existingLog) {
      return existingLog;
    }

    const searchLog = this.searchLogRepository.create(createSearchLogDto);
    return await this.searchLogRepository.save(searchLog);
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<SearchLogResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.searchLogRepository
      .createQueryBuilder('searchLog')
      .leftJoinAndSelect('searchLog.customer', 'customer')
      .leftJoinAndSelect('searchLog.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.institution', 'institution')
      .leftJoinAndSelect('user.branch', 'branch')
      .skip(skip)
      .take(limit)
      .orderBy('searchLog.createdAt', 'DESC');

    // Apply searchType filter if provided
    if (paginationDto['searchType']) {
      queryBuilder.andWhere('searchLog.searchType = :searchType', {
        searchType: paginationDto['searchType'],
      });
    }

    // Apply search query filter if provided (search by customer name or user name)
    if (paginationDto['search']) {
      const searchTerm = `%${paginationDto['search']}%`;
      queryBuilder.andWhere(
        '(customer.name ILIKE :searchTerm OR user.name ILIKE :searchTerm OR user.email ILIKE :searchTerm)',
        { searchTerm },
      );
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      data: logs.map((log) => this.toResponseDto(log)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCustomer(
    customerId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<SearchLogResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.searchLogRepository
      .createQueryBuilder('searchLog')
      .leftJoinAndSelect('searchLog.customer', 'customer')
      .leftJoinAndSelect('searchLog.user', 'user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.institution', 'institution')
      .leftJoinAndSelect('user.branch', 'branch')
      .where('searchLog.customerId = :customerId', { customerId })
      .skip(skip)
      .take(limit)
      .orderBy('searchLog.createdAt', 'DESC');

    // Apply searchType filter if provided
    if (paginationDto['searchType']) {
      queryBuilder.andWhere('searchLog.searchType = :searchType', {
        searchType: paginationDto['searchType'],
      });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      data: logs.map((log) => this.toResponseDto(log)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUser(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<SearchLogResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [logs, total] = await this.searchLogRepository.findAndCount({
      where: { userId },
      relations: ['customer', 'user', 'user.role', 'user.institution', 'user.branch'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: logs.map((log) => this.toResponseDto(log)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(id: number, currentUser: any): Promise<void> {
    // Only Super Admin can delete search logs
    if (currentUser.role.roleName !== 'Super Admin') {
      throw new ForbiddenException('Only Super Admin can delete search logs');
    }

    const log = await this.searchLogRepository.findOne({
      where: { searchLogId: id },
    });

    if (!log) {
      throw new NotFoundException(`Search log with ID ${id} not found`);
    }

    await this.searchLogRepository.remove(log);
  }

  /**
   * Delete all search logs for a given customer (used when hard deleting a customer)
   */
  async deleteByCustomerId(customerId: number): Promise<number> {
    const result = await this.searchLogRepository.delete({ customerId });
    return result.affected || 0;
  }

  private toResponseDto(log: SearchLog): SearchLogResponseDto {
    return {
      searchLogId: log.searchLogId,
      customerId: log.customerId,
      customerName: log.customer?.name || 'Unknown',
      userId: log.userId,
      userName: log.user?.name || 'Unknown',
      userEmail: log.user?.email || 'Unknown',
      searchQuery: log.searchQuery,
      searchType: log.searchType,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      // Institution/Branch contact info
      institutionId: log.user?.institutionId,
      institutionName: log.user?.institution?.name,
      institutionPhone: log.user?.institution?.phoneNumber,
      branchId: log.user?.branchId,
      branchName: log.user?.branch?.name,
      branchPhone: log.user?.branch?.phoneNumber,
    };
  }
}
