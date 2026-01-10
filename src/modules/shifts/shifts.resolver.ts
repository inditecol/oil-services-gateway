import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { ShiftsService } from './shifts.service';
import { Shift, ShiftListResponse } from './entities/shift.entity';
import { CreateShiftInput } from './dto/create-shift.input';
import { UpdateShiftInput } from './dto/update-shift.input';
import { CreateTurnoInput } from './dto/create-turno-legacy.input';
import { UpdateTurnoInput } from './dto/update-turno-legacy.input';

@Resolver(() => Shift)
@UseGuards(JwtAuthGuard)
export class ShiftsResolver {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createShift(
    @Args('createShiftInput') createShiftInput: CreateShiftInput,
    @CurrentUser() currentUser?: any
  ): Promise<Shift> {
    return this.shiftsService.create(createShiftInput);
  }

  @Query(() => ShiftListResponse, { name: 'shifts' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findAllShifts(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('usuarioId', { type: () => ID, nullable: true }) usuarioId?: string,
    @Args('puntoVentaId', { type: () => ID, nullable: true }) puntoVentaId?: string,
    @Args('activo', { nullable: true }) activo?: boolean
  ): Promise<ShiftListResponse> {
    return this.shiftsService.findAll({
      page,
      limit,
      startDate: fechaDesde,
      endDate: fechaHasta,
      userId: usuarioId,
      puntoVentaId: puntoVentaId,
      active: activo
    });
  }

  @Query(() => Shift, { name: 'shift' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findOneShift(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    const shift = await this.shiftsService.findById(id);
    if (!shift) {
      throw new Error('Turno no encontrado');
    }
    return shift;
  }

  @Query(() => [Shift], { name: 'userShifts' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getShiftsByUser(
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
    @CurrentUser() user?: any
  ): Promise<Shift[]> {
    // If no userId provided, use current user's id
    const targetUserId = userId || user.id;
    return this.shiftsService.getShiftsByUser(targetUserId);
  }

  @Query(() => String, { name: 'activeShifts' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getActiveShifts(): Promise<string> {
    const result = await this.shiftsService.getActiveShifts();
    return JSON.stringify(result.shifts.map(shift => ({
      id: shift.id,
      fechaInicio: shift.startDate,
      horaInicio: shift.startTime,
      usuario: shift.user?.nombre + ' ' + shift.user?.apellido
    })));
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateShift(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateShiftInput') updateShiftInput: UpdateShiftInput,
    @CurrentUser() user: any,
  ): Promise<Shift> {
    return this.shiftsService.update(id, updateShiftInput, user?.id);
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async closeShift(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    return this.shiftsService.closeShift(id);
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deleteShift(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    return this.shiftsService.remove(id);
  }

  // Legacy queries for compatibility (keeping Spanish names)
  @Query(() => ShiftListResponse, { name: 'turnos' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findAllTurnos(
    @Args('usuarioId', { type: () => ID, nullable: true }) usuarioId?: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('puntoVentaId', { type: () => ID, nullable: true }) puntoVentaId?: string,
    @Args('activo', { nullable: true }) activo?: boolean,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10
  ): Promise<ShiftListResponse> {
    return this.shiftsService.findAll({
      userId: usuarioId,
      startDate: fechaDesde,
      endDate: fechaHasta,
      puntoVentaId: puntoVentaId,
      active: activo,
      page,
      limit,
    });
  }

  @Query(() => Shift, { name: 'turno' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findOneTurno(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    const shift = await this.shiftsService.findById(id);
    if (!shift) {
      throw new Error('Turno no encontrado');
    }
    return shift;
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createTurno(
    @Args('createTurnoInput') createTurnoInput: CreateTurnoInput,
    @CurrentUser() currentUser?: any
  ): Promise<Shift> {
    return this.shiftsService.create({
      startDate: createTurnoInput.fechaInicio,
      endDate: createTurnoInput.fechaFin,
      startTime: createTurnoInput.horaInicio,
      endTime: createTurnoInput.horaFin,
      observations: createTurnoInput.observaciones,
      userId: createTurnoInput.usuarioId || currentUser?.id,
      puntoVentaId: createTurnoInput.puntoVentaId,
      active: createTurnoInput.activo,
    });
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateTurno(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateTurnoInput') updateTurnoInput: UpdateTurnoInput,
  ): Promise<Shift> {
    return this.shiftsService.updateFromLegacyInput(id, updateTurnoInput);
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async cerrarTurno(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    return this.shiftsService.closeShift(id);
  }

  @Query(() => [Shift], { name: 'turnosUsuario' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getTurnosByUser(
    @Args('usuarioId', { type: () => ID, nullable: true }) usuarioId?: string,
    @CurrentUser() user?: any
  ): Promise<Shift[]> {
    const targetUserId = usuarioId || user.id;
    return this.shiftsService.getShiftsByUser(targetUserId);
  }

  @Query(() => String, { name: 'turnosActivos' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getTurnosActivos(): Promise<string> {
    const shifts = await this.shiftsService.getActiveShifts();
    return JSON.stringify(shifts);
  }

  @Mutation(() => Shift)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deleteTurno(@Args('id', { type: () => ID }) id: string): Promise<Shift> {
    return this.shiftsService.remove(id);
  }
} 