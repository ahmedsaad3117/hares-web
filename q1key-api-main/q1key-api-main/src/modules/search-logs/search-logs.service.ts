import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, DataSource } from "typeorm";
import { SearchLog } from "../../entities/search-log.entity";
import { User } from "../../entities/user.entity";
import { CreateSearchLogDto } from "./dto/create-search-log.dto";
import { SearchLogResponseDto } from "./dto/search-log-response.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";

@Injectable()
export class SearchLogsService {
  constructor(
    @InjectRepository(SearchLog)
    private readonly searchLogRepository: Repository<SearchLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async create(createSearchLogDto: CreateSearchLogDto): Promise<SearchLog> {
    // 1. Get current user's entity membership (Institution/Branch)
    const currentUser = await this.userRepository.findOne({
      where: { userId: createSearchLogDto.userId },
      relations: ["role"],
    });

    if (!currentUser) {
      // Fallback if user doesn't exist (shouldn't happen)
      const searchLog = this.searchLogRepository.create(createSearchLogDto);
      return await this.searchLogRepository.save(searchLog);
    }

    // 2. Define the "Entity" check criteria
    // Rule: Same operation from same entity (Branch or Institution) within 60 minutes
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Use Raw SQL for the duplicate check
    let duplicateCheckQuery = `
      SELECT sl.search_log_id 
      FROM search_logs sl
      INNER JOIN users u ON sl.user_id = u.user_id
      WHERE sl.customer_id = $1 
        AND sl.search_type = $2 
        AND sl.created_at > $3
    `;
    const params: any[] = [
      createSearchLogDto.customerId,
      createSearchLogDto.searchType,
      sixtyMinutesAgo,
    ];
    const paramIndex = 4;

    // Apply entity scope filtering
    if (currentUser.branchId) {
      duplicateCheckQuery += ` AND u.branch_id = $${paramIndex}`;
      params.push(currentUser.branchId);
    } else if (currentUser.institutionId) {
      duplicateCheckQuery += ` AND u.institution_id = $${paramIndex}`;
      params.push(currentUser.institutionId);
    } else {
      duplicateCheckQuery += ` AND sl.user_id = $${paramIndex}`;
      params.push(createSearchLogDto.userId);
    }

    duplicateCheckQuery += " LIMIT 1";

    const existingLogs = await this.dataSource.query(
      duplicateCheckQuery,
      params,
    );

    if (existingLogs && existingLogs.length > 0) {
      // Similar search found within 60 mins from same entity - return existing
      const existingLog = await this.searchLogRepository.findOne({
        where: { searchLogId: existingLogs[0].search_log_id },
      });
      if (existingLog) return existingLog;
    }

    const searchLog = this.searchLogRepository.create(createSearchLogDto);
    return await this.searchLogRepository.save(searchLog);
  }

  /**
   * Get all search logs with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<SearchLogResponseDto>> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply searchType filter if provided
      if (paginationDto.searchType) {
        whereClauses.push(`sl.search_type = $${paramIndex++}`);
        params.push(paginationDto.searchType);
      }

      // Apply search query filter if provided
      if (paginationDto.search) {
        const searchTerm = `%${paginationDto.search}%`;
        whereClauses.push(
          `(c.name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
        );
        params.push(searchTerm);
        paramIndex++;
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const combinedQuery = `
        WITH log_data AS (
          SELECT 
            sl.search_log_id as "searchLogId",
            sl.customer_id as "customerId",
            c.name as "customerName",
            sl.user_id as "userId",
            u.name as "userName",
            u.email as "userEmail",
            sl.search_query as "searchQuery",
            sl.search_type as "searchType",
            sl.ip_address as "ipAddress",
            sl.created_at as "createdAt",
            u.institution_id as "institutionId",
            i.name as "institutionName",
            i.phone_number as "institutionPhone",
            u.branch_id as "branchId",
            b.name as "branchName",
            b.phone_number as "branchPhone"
          FROM search_logs sl
          LEFT JOIN customers c ON sl.customer_id = c.customer_id
          LEFT JOIN users u ON sl.user_id = u.user_id
          LEFT JOIN roles r ON u.role_id = r.role_id
          LEFT JOIN institutions i ON u.institution_id = i.institution_id
          LEFT JOIN branches b ON u.branch_id = b.branch_id
          ${whereClause}
        )
        SELECT 
          (SELECT COUNT(*) FROM log_data) as total,
          (SELECT COALESCE(json_agg(row_to_json(ld)), '[]'::json) FROM (
            SELECT * FROM log_data 
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          ) ld) as data
      `;

      const result = await this.dataSource.query(combinedQuery, params);
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
      console.error("Error in searchLogs findAll:", error);
      throw error;
    }
  }

  /**
   * Get search logs by customer with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findByCustomer(
    customerId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<SearchLogResponseDto>> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [`sl.customer_id = $1`];
      const params: any[] = [customerId];
      let paramIndex = 2;

      // Apply filters
      if (paginationDto.searchType) {
        whereClauses.push(`sl.search_type = $${paramIndex++}`);
        params.push(paginationDto.searchType);
      }

      if (paginationDto.search) {
        const searchTerm = `%${paginationDto.search}%`;
        whereClauses.push(
          `(c.name ILIKE $${paramIndex} OR u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
        );
        params.push(searchTerm);
        paramIndex++;
      }

      const whereClause = `WHERE ${whereClauses.join(" AND ")}`;

      const combinedQuery = `
        WITH log_data AS (
          SELECT 
            sl.search_log_id as "searchLogId",
            sl.customer_id as "customerId",
            c.name as "customerName",
            sl.user_id as "userId",
            u.name as "userName",
            u.email as "userEmail",
            sl.search_query as "searchQuery",
            sl.search_type as "searchType",
            sl.ip_address as "ipAddress",
            sl.created_at as "createdAt",
            u.institution_id as "institutionId",
            i.name as "institutionName",
            i.phone_number as "institutionPhone",
            u.branch_id as "branchId",
            b.name as "branchName",
            b.phone_number as "branchPhone"
          FROM search_logs sl
          LEFT JOIN customers c ON sl.customer_id = c.customer_id
          LEFT JOIN users u ON sl.user_id = u.user_id
          LEFT JOIN roles r ON u.role_id = r.role_id
          LEFT JOIN institutions i ON u.institution_id = i.institution_id
          LEFT JOIN branches b ON u.branch_id = b.branch_id
          ${whereClause}
        )
        SELECT 
          (SELECT COUNT(*) FROM log_data) as total,
          (SELECT COALESCE(json_agg(row_to_json(ld)), '[]'::json) FROM (
            SELECT * FROM log_data 
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          ) ld) as data
      `;

      const result = await this.dataSource.query(combinedQuery, params);
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
      console.error("Error in searchLogs findByCustomer:", error);
      throw error;
    }
  }

  async findByUser(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<SearchLogResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [logs, total] = await this.searchLogRepository.findAndCount({
      where: { userId },
      relations: [
        "customer",
        "user",
        "user.role",
        "user.institution",
        "user.branch",
      ],
      skip,
      take: limit,
      order: { createdAt: "DESC" },
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
    if (currentUser.role.roleName !== "Super Admin") {
      throw new ForbiddenException("Only Super Admin can delete search logs");
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
      customerName: log.customer?.name || "Unknown",
      userId: log.userId,
      userName: log.user?.name || "Unknown",
      userEmail: log.user?.email || "Unknown",
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
