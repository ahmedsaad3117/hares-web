import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Product } from "../../entities/product.entity";
import { Loan } from "../../entities/loan.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductResponseDto } from "./dto/product-response.dto";
import {
  PaginationDto,
  PaginatedResult,
} from "../../common/dto/pagination.dto";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private dataSource: DataSource,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const product = this.productRepository.create(createProductDto);
    const savedProduct = await this.productRepository.save(product);

    // Load relations for the response
    const productWithRelations = await this.productRepository.findOne({
      where: { productId: savedProduct.productId },
      relations: ["institution", "branch"],
    });

    if (!productWithRelations) {
      throw new NotFoundException("Product not found after creation");
    }

    return this.toResponseDto(productWithRelations);
  }

  /**
   * Get all products with pagination
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findAll(
    paginationDto: PaginationDto,
    institutionId?: number,
    branchId?: number,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const offset = (page - 1) * limit;

      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (branchId) {
        // Branch users see: global products + institution products (if visible) + branch-specific products
        whereClauses.push(`(
          p.branch_id = $${paramIndex} OR 
          (p.institution_id = (SELECT institution_id FROM branches WHERE branch_id = $${paramIndex}) AND p.branch_id IS NULL AND p.is_visible_to_branches = true) OR 
          (p.institution_id IS NULL AND p.branch_id IS NULL)
        )`);
        params.push(branchId);
        paramIndex++;
        whereClauses.push(`p.is_active = true`);
      } else if (institutionId) {
        // Institution users see: global products + institution products + all branch products from their institution
        whereClauses.push(`(
          p.institution_id = $${paramIndex} OR 
          (SELECT b.institution_id FROM branches b WHERE b.branch_id = p.branch_id) = $${paramIndex} OR 
          (p.institution_id IS NULL AND p.branch_id IS NULL)
        )`);
        params.push(institutionId);
        paramIndex++;
        whereClauses.push(`p.is_active = true`);
      }
      // Super admin sees all products (no filter)

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const combinedQuery = `
        WITH product_data AS (
          SELECT 
            p.product_id as "productId",
            p.institution_id as "institutionId",
            p.branch_id as "branchId",
            p.name,
            p.description,
            p.is_active as "isActive",
            p.is_visible_to_branches as "isVisibleToBranches",
            p.created_at as "createdAt",
            p.updated_at as "updatedAt",
            i.name as "institutionName",
            b.name as "branchName"
          FROM products p
          LEFT JOIN institutions i ON p.institution_id = i.institution_id
          LEFT JOIN branches b ON p.branch_id = b.branch_id
          ${whereClause}
        )
        SELECT 
          (SELECT COUNT(*) FROM product_data) as total,
          (SELECT COALESCE(json_agg(row_to_json(pd)), '[]'::json) FROM (
            SELECT * FROM product_data 
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          ) pd) as data
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
      console.error("Error in products findAll:", error);
      throw error;
    }
  }

  /**
   * Get active products
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async findActive(
    institutionId?: number,
    branchId?: number,
  ): Promise<ProductResponseDto[]> {
    try {
      const whereClauses: string[] = ["p.is_active = true"];
      const params: any[] = [];
      const paramIndex = 1;

      if (branchId) {
        whereClauses.push(`(
          p.branch_id = $${paramIndex} OR 
          (p.institution_id = (SELECT institution_id FROM branches WHERE branch_id = $${paramIndex}) AND p.branch_id IS NULL AND p.is_visible_to_branches = true) OR 
          (p.institution_id IS NULL AND p.branch_id IS NULL)
        )`);
        params.push(branchId);
      } else if (institutionId) {
        whereClauses.push(`(
          p.institution_id = $${paramIndex} OR 
          (SELECT b.institution_id FROM branches b WHERE b.branch_id = p.branch_id) = $${paramIndex} OR 
          (p.institution_id IS NULL AND p.branch_id IS NULL)
        )`);
        params.push(institutionId);
      }

      const whereClause = `WHERE ${whereClauses.join(" AND ")}`;

      const query = `
        SELECT 
          p.product_id as "productId",
          p.institution_id as "institutionId",
          p.branch_id as "branchId",
          p.name,
          p.description,
          p.is_active as "isActive",
          p.is_visible_to_branches as "isVisibleToBranches",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          i.name as "institutionName",
          b.name as "branchName"
        FROM products p
        LEFT JOIN institutions i ON p.institution_id = i.institution_id
        LEFT JOIN branches b ON p.branch_id = b.branch_id
        ${whereClause}
        ORDER BY p.name ASC
      `;

      return await this.dataSource.query(query, params);
    } catch (error) {
      console.error("Error in products findActive:", error);
      throw error;
    }
  }

  async findOne(id: number): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
      relations: ["institution", "branch"],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.toResponseDto(product);
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
    user: any,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const roleName = user.role?.roleName || user.roleName;

    // Protection for Admin products
    if (product.institutionId === null && product.branchId === null) {
      if (roleName !== "Super Admin") {
        throw new BadRequestException(
          "Modification of products added by the Admin is not allowed",
        );
      }
    }

    // Ownership check for non-Super Admins
    if (roleName !== "Super Admin") {
      if (
        product.institutionId &&
        product.institutionId !== user.institutionId
      ) {
        throw new BadRequestException(
          "You do not have permission to modify this product",
        );
      }
      if (product.branchId && product.branchId !== user.branchId) {
        throw new BadRequestException(
          "You do not have permission to modify this product",
        );
      }
    }

    Object.assign(product, updateProductDto);
    const updatedProduct = await this.productRepository.save(product);
    return this.toResponseDto(updatedProduct);
  }

  async remove(id: number, user: any): Promise<{ message: string }> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const roleName = user.role?.roleName || user.roleName;

    // Protection for Admin products
    if (product.institutionId === null && product.branchId === null) {
      if (roleName !== "Super Admin") {
        throw new BadRequestException(
          "Deletion of products added by the Admin is not allowed",
        );
      }
    }

    // Ownership check for non-Super Admins
    if (roleName !== "Super Admin") {
      if (
        product.institutionId &&
        product.institutionId !== user.institutionId
      ) {
        throw new BadRequestException(
          "You do not have permission to delete this product",
        );
      }
      if (product.branchId && product.branchId !== user.branchId) {
        throw new BadRequestException(
          "You do not have permission to delete this product",
        );
      }
    }

    // Check if product has any associated loans
    const loanCount = await this.loanRepository.count({
      where: { productId: id },
    });

    if (loanCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" because it has ${loanCount} associated loan(s). Please reassign or close these loans before deleting the product.`,
      );
    }

    await this.productRepository.remove(product);
    return { message: "Product deleted successfully" };
  }

  async toggleActive(id: number, user: any): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const roleName = user.role?.roleName || user.roleName;

    // Protection for Admin products
    if (product.institutionId === null && product.branchId === null) {
      if (roleName !== "Super Admin") {
        throw new BadRequestException(
          "Modification of products added by the Admin is not allowed",
        );
      }
    }

    // Ownership check for non-Super Admins
    if (roleName !== "Super Admin") {
      if (
        product.institutionId &&
        product.institutionId !== user.institutionId
      ) {
        throw new BadRequestException(
          "You do not have permission to modify this product",
        );
      }
      if (product.branchId && product.branchId !== user.branchId) {
        throw new BadRequestException(
          "You do not have permission to modify this product",
        );
      }
    }

    product.isActive = !product.isActive;
    const updatedProduct = await this.productRepository.save(product);
    return this.toResponseDto(updatedProduct);
  }

  async getStatistics(id: number) {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const loanCount = await this.loanRepository.count({
      where: { productId: id },
    });

    return {
      productId: product.productId,
      name: product.name,
      totalLoans: loanCount,
    };
  }

  private toResponseDto(product: Product): ProductResponseDto {
    return {
      productId: product.productId,
      institutionId: product.institutionId,
      branchId: product.branchId,
      name: product.name,
      description: product.description,
      isActive: product.isActive,
      isVisibleToBranches: product.isVisibleToBranches,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      institutionName: product.institution?.name,
      branchName: product.branch?.name,
    };
  }
}
