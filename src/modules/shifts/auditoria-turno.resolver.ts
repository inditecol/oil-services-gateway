import { Resolver, Query, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditoriaTurnoService } from './services/auditoria-turno.service';
import {
  HistorialCambioTurnoListResponse,
  DetalleHistorialCambioTurno,
} from './entities/historial-cambio-turno.entity';

@Resolver()
@UseGuards(JwtAuthGuard)
export class AuditoriaTurnoResolver {
  constructor(private readonly auditoriaService: AuditoriaTurnoService) {}

  /**
   * Query para obtener el listado de lecturas de cambio de turno
   * Usado en la tabla "Lecturas de Turno" del frontend
   */
  @Query(() => HistorialCambioTurnoListResponse, { name: 'obtenerLecturasCambioTurno' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerLecturasCambioTurno(
    @Args('turnoId', { type: () => ID }) turnoId: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number = 20,
  ): Promise<HistorialCambioTurnoListResponse> {
    return this.auditoriaService.obtenerLecturasCambioTurno(turnoId, page, limit);
  }

  /**
   * Query para obtener el detalle completo de un cambio específico
   * Usado cuando se hace click en el icono de acciones (ojo) en la tabla
   */
  @Query(() => DetalleHistorialCambioTurno, { name: 'obtenerDetalleLecturaCambio' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerDetalleLecturaCambio(
    @Args('lecturaId', { type: () => ID }) lecturaId: string,
  ): Promise<DetalleHistorialCambioTurno> {
    return this.auditoriaService.obtenerDetalleLecturaCambio(lecturaId);
  }
}
