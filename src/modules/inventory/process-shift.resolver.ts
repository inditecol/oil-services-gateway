import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Int,
  Float,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Producto } from './entities/producto.entity';
import { ActualizacionInventarioResponse } from './entities/shift-closure.entity';
import { CierreTurnoInput } from './dto/shift-closure.input';
import { ProcessShiftService } from './services/process-shift.service';

@Resolver(() => Producto)
@UseGuards(JwtAuthGuard)
export class ProcessShiftResolver {
  constructor(
    private readonly processShiftService: ProcessShiftService
  ) {}

  @Mutation(() => ActualizacionInventarioResponse, {
    name: 'processShiftClosure',
  })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async processShiftClosure(
    @Args('cierreTurnoInput') cierreTurnoInput: CierreTurnoInput,
    @CurrentUser() user: any,
  ): Promise<ActualizacionInventarioResponse> {

    try {
        return this.processShiftService.processShiftClosure(cierreTurnoInput, user);
    } catch (error) {
      console.error('[CIERRE_TURNO] Error general:', error);
      const resumenFinancieroVacio =
        this.processShiftService.crearResumenFinancieroVacio();
      return {
        resumenSurtidores: [],
        resumenTanques: null,
        totalGeneralLitros: 0,
        totalGeneralGalones: 0,
        valorTotalGeneral: 0,
        resumenFinanciero: resumenFinancieroVacio,
        fechaProceso: new Date(),
        turnoId: cierreTurnoInput.puntoVentaId,
        productosActualizados: 0,
        estado: 'fallido',
        errores: [`Error general: ${error.message}`],
      };
    }
  }
}
