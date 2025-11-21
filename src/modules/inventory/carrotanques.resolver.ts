import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CarrotanquesService } from './carrotanques.service';
import { Carrotanque, CarrotanqueListResponse, CarrotanquesSummary } from './entities/carrotanque.entity';
import { CreateCarrotanqueInput, FilterCarrotanquesInput } from './dto/create-carrotanque.input';
import { UpdateCarrotanqueInput } from './dto/update-carrotanque.input';

@Resolver(() => Carrotanque)
@UseGuards(JwtAuthGuard)
export class CarrotanquesResolver {
  constructor(private readonly carrotanquesService: CarrotanquesService) {}

  @Mutation(() => Carrotanque)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createCarrotanque(@Args('createCarrotanqueInput') createCarrotanqueInput: CreateCarrotanqueInput): Promise<Carrotanque> {
    return this.carrotanquesService.create(createCarrotanqueInput);
  }

  @Query(() => CarrotanqueListResponse, { name: 'carrotanques' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'supervisor', 'employee')
  async findAll(
    @Args('filters', { nullable: true }) filters?: FilterCarrotanquesInput,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10,
  ): Promise<CarrotanqueListResponse> {
    return this.carrotanquesService.findAll(filters, page, limit);
  }

  @Query(() => [Carrotanque], { name: 'carrotanquesActivos' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'supervisor', 'employee')
  async findActive(): Promise<Carrotanque[]> {
    const result = await this.carrotanquesService.findAll({ activo: true }, 1, 100);
    return result.carrotanques;
  }

  @Query(() => Carrotanque, { name: 'carrotanque' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'supervisor', 'employee')
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Carrotanque> {
    return this.carrotanquesService.findOne(id);
  }

  @Query(() => Carrotanque, { name: 'carrotanqueByPlaca' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'supervisor', 'employee')
  async findByPlaca(@Args('placa') placa: string): Promise<Carrotanque> {
    return this.carrotanquesService.findByPlaca(placa);
  }

  @Mutation(() => Carrotanque)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateCarrotanque(@Args('updateCarrotanqueInput') updateCarrotanqueInput: UpdateCarrotanqueInput): Promise<Carrotanque> {
    return this.carrotanquesService.update(updateCarrotanqueInput);
  }

  @Mutation(() => Carrotanque)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async activateCarrotanque(@Args('id', { type: () => ID }) id: string): Promise<Carrotanque> {
    return this.carrotanquesService.activate(id);
  }

  @Mutation(() => Carrotanque)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async deactivateCarrotanque(@Args('id', { type: () => ID }) id: string): Promise<Carrotanque> {
    return this.carrotanquesService.deactivate(id);
  }

  @Mutation(() => Carrotanque)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async removeCarrotanque(@Args('id', { type: () => ID }) id: string): Promise<Carrotanque> {
    return this.carrotanquesService.remove(id);
  }

  @Query(() => CarrotanquesSummary, { name: 'carrotanquesSummary' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'supervisor', 'employee')
  async getActiveCarrotanquesSummary(): Promise<CarrotanquesSummary> {
    return this.carrotanquesService.getActiveCarrotanquesSummary();
  }

} 