import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RateLimiterGuard, RateLimit, RATE_LIMITS } from '../../common/rate-limiter';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimiterGuard)
@RateLimit(RATE_LIMITS.GENERAL)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles('Super Admin', 'Institution')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('Super Admin', 'Institution')
  findAll(@Query() paginationDto: PaginationDto) {
    return this.usersService.findAll(paginationDto);
  }

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.usersService.findOne(user.userId);
  }

  @Get(':id')
  @Roles('Super Admin', 'Institution')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Institution')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Institution')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  @Patch(':id/toggle-active')
  @Roles('Super Admin', 'Institution')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toggleActive(id);
  }

  @Post(':id/logout')
  @Roles('Super Admin', 'Institution')
  @HttpCode(HttpStatus.OK)
  async forceLogout(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.clearSessionId(id);
    return { message: 'User session cleared successfully' };
  }
}
