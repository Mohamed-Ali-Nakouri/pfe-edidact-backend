import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Roles } from '../roles/entities/roles.entity';
import { RolesGuard } from '../roles/guards/rôles.guard';
import { RolesModule } from '../roles/roles.module';
import { RolesService } from '../roles/roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Roles]), RolesModule],
  exports: [TypeOrmModule, UsersService],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard, RolesService, RolesGuard],
})
export class UsersModule {}
