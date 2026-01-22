import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Product } from '../../entities/product.entity';
import { Loan } from '../../entities/loan.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
  ) { }

  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const product = this.productRepository.create(createProductDto);
    const savedProduct = await this.productRepository.save(product);

    // Load relations for the response
    const productWithRelations = await this.productRepository.findOne({
      where: { productId: savedProduct.productId },
      relations: ['institution', 'branch'],
    });

    if (!productWithRelations) {
      throw new NotFoundException('Product not found after creation');
    }

    return this.toResponseDto(productWithRelations);
  }

  async findAll(paginationDto: PaginationDto, institutionId?: number, branchId?: number): Promise<PaginatedResult<ProductResponseDto>> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.institution', 'institution')
      .leftJoinAndSelect('product.branch', 'branch');

    if (branchId) {
      // Branch users see: global products + institution products + branch-specific products
      queryBuilder.andWhere(
        '(product.branchId = :branchId OR ' +
        '(product.institutionId = (SELECT institution_id FROM branches WHERE branch_id = :branchId) AND product.branchId IS NULL) OR ' +
        '(product.institutionId IS NULL AND product.branchId IS NULL))',
        { branchId }
      );
    } else if (institutionId) {
      // Institution users see: global products + institution products + all branch products from their institution
      queryBuilder.andWhere(
        '(product.institutionId = :institutionId OR ' +
        '(SELECT institution_id FROM branches WHERE branch_id = product.branchId) = :institutionId OR ' +
        '(product.institutionId IS NULL AND product.branchId IS NULL))',
        { institutionId }
      );
    }
    // Super admin sees all products (no filter)

    queryBuilder
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products.map((product) => this.toResponseDto(product)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findActive(institutionId?: number, branchId?: number): Promise<ProductResponseDto[]> {
    const queryBuilder = this.productRepository.createQueryBuilder('product')
      .leftJoinAndSelect('product.institution', 'institution')
      .leftJoinAndSelect('product.branch', 'branch')
      .where('product.isActive = :isActive', { isActive: true });

    if (branchId) {
      // Branch users see: global products + institution products + branch-specific products
      queryBuilder.andWhere(
        '(product.branchId = :branchId OR ' +
        '(product.institutionId = (SELECT institution_id FROM branches WHERE branch_id = :branchId) AND product.branchId IS NULL) OR ' +
        '(product.institutionId IS NULL AND product.branchId IS NULL))',
        { branchId }
      );
    } else if (institutionId) {
      // Institution users see: global products + institution products + all branch products from their institution
      queryBuilder.andWhere(
        '(product.institutionId = :institutionId OR ' +
        '(SELECT institution_id FROM branches WHERE branch_id = product.branchId) = :institutionId OR ' +
        '(product.institutionId IS NULL AND product.branchId IS NULL))',
        { institutionId }
      );
    }
    // Super admin sees all active products (no additional filter)

    queryBuilder.orderBy('product.name', 'ASC');

    const products = await queryBuilder.getMany();
    return products.map((product) => this.toResponseDto(product));
  }

  async findOne(id: number): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
      relations: ['institution', 'branch'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.toResponseDto(product);
  }

  async update(
    id: number,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    Object.assign(product, updateProductDto);
    const updatedProduct = await this.productRepository.save(product);
    return this.toResponseDto(updatedProduct);
  }

  async remove(id: number): Promise<{ message: string }> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Check if product has any associated loans
    const loanCount = await this.loanRepository.count({
      where: { productId: id },
    });

    if (loanCount > 0) {
      throw new BadRequestException(
        `Cannot delete product "${product.name}" because it has ${loanCount} associated loan(s). Please reassign or close these loans before deleting the product.`
      );
    }

    await this.productRepository.remove(product);
    return { message: 'Product deleted successfully' };
  }

  async toggleActive(id: number): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { productId: id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
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
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      institutionName: product.institution?.name,
      branchName: product.branch?.name,
    };
  }
}
