import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';

import { Institution } from '../../entities/institution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Institution])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
