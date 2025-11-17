import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserListResponse } from './entities/user-list-response.entity';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateProfileInput } from './dto/update-profile.input';
import { FilterUsersInput } from './dto/filter-users.input';

@Resolver(() => User)
@UseGuards(JwtAuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput): Promise<User> {
    return this.usersService.create(createUserInput);
  }

  @Query(() => [User], { name: 'users' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Query(() => User, { name: 'user' })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }

  @Query(() => User, { name: 'userByUsername' })
  async findByUsername(@Args('username') username: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }

  @Query(() => User, { name: 'me' })
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(id, updateUserInput);
  }

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async removeUser(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.usersService.remove(id);
  }

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async toggleUserStatus(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.usersService.toggleUserStatus(id);
  }

  @Mutation(() => Boolean)
  async changePassword(
    @CurrentUser() user: User,
    @Args('newPassword') newPassword: string,
  ): Promise<boolean> {
    return this.usersService.changePassword(user.id, newPassword);
  }

  @Mutation(() => User)
  async updateMyProfile(
    @CurrentUser() user: User,
    @Args('updateProfileInput') updateProfileInput: UpdateProfileInput,
  ): Promise<User> {
    return this.usersService.updateProfile(user.id, updateProfileInput);
  }

  @Query(() => UserListResponse, { name: 'usersWithFilters' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async usersWithFilters(
    @Args('filters', { nullable: true }) filters?: FilterUsersInput,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10,
  ): Promise<UserListResponse> {
    return this.usersService.findAllWithFilters(filters, page, limit);
  }

  @Query(() => [User], { name: 'usersByRole' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async usersByRole(@Args('roleName') roleName: string): Promise<User[]> {
    return this.usersService.findUsersByRole(roleName);
  }

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async addPointOfSaleToUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('pointOfSaleId', { type: () => ID }) pointOfSaleId: string,
  ): Promise<User> {
    return this.usersService.addPointOfSaleToUser(userId, pointOfSaleId);
  }

  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async removePointOfSaleFromUser(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('pointOfSaleId', { type: () => ID }) pointOfSaleId: string,
  ): Promise<User> {
    return this.usersService.removePointOfSaleFromUser(userId, pointOfSaleId);
  }
} 