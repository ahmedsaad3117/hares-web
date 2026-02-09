import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) { }

  @Post()
  @Roles('Super Admin', 'Institution', 'Branch')
  create(@Body() createProductDto: CreateProductDto, @Request() req) {
    // Auto-set institution/branch based on user role
    const user = req.user;
    const roleName = user.role?.roleName || user.roleName;

    console.log('Create Product - User:', {
      roleName,
      institutionId: user.institutionId,
      branchId: user.branchId
    });
    console.log('Create Product - DTO before:', createProductDto);

    // Institution users: products belong to their institution
    if (roleName === 'Institution' && user.institutionId) {
      createProductDto.institutionId = user.institutionId;
      delete createProductDto.branchId; // Ensure branch is not set
    }
    // Branch users: products belong to their specific branch
    else if (roleName === 'Branch' && user.branchId) {
      createProductDto.branchId = user.branchId;
      delete createProductDto.institutionId; // Ensure institution is not set directly
    }
    // Super Admin: can create global products (both undefined) or specify institution/branch

    console.log('Create Product - DTO after:', createProductDto);

    return this.productsService.create(createProductDto);
  }

  @Get()
  @Roles('Super Admin', 'Institution', 'Branch')
  findAll(@Query() paginationDto: PaginationDto, @Request() req) {
    const user = req.user;
    return this.productsService.findAll(
      paginationDto,
      user.institutionId,
      user.branchId
    );
  }

  @Get('active')
  @Roles('Super Admin', 'Institution', 'Branch')
  findActive(@Request() req) {
    const user = req.user;
    return this.productsService.findActive(user.institutionId, user.branchId);
  }

  @Get(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Get(':id/statistics')
  @Roles('Super Admin', 'Institution', 'Branch')
  getStatistics(@Param('id') id: string) {
    return this.productsService.getStatistics(+id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Request() req) {
    return this.productsService.update(+id, updateProductDto, req.user);
  }

  @Patch(':id/toggle-active')
  @Roles('Super Admin', 'Institution', 'Branch')
  toggleActive(@Param('id') id: string, @Request() req) {
    return this.productsService.toggleActive(+id, req.user);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Institution', 'Branch')
  remove(@Param('id') id: string, @Request() req) {
    return this.productsService.remove(+id, req.user);
  }
}
