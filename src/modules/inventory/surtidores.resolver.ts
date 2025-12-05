import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SurtidoresService } from './surtidores.service';
import { PrismaService } from '../../config/prisma/prisma.service';
import { Surtidor, SurtidorListResponse } from './entities/surtidor.entity';
import { CreateSurtidorInput } from './dto/create-surtidor.input';
import { UpdateSurtidorInput } from './dto/update-surtidor.input';
import { MangueraSurtidor } from './entities/manguera-surtidor.entity';
import { UpdateMangueraReadingsInput } from './dto/update-readings.input';
import { HistorialLectura, HistorialLecturaListResponse } from './entities/historial-lectura.entity';
import { SurtidorSalesSummary } from './entities/surtidor-sales-summary.entity';
import { MangueraSalesHistory } from './entities/manguera-sales-history.entity';
import { ConsolidadoVentasGeneral } from './entities/consolidado-ventas.entity';

@Resolver(() => Surtidor)
@UseGuards(JwtAuthGuard)
export class SurtidoresResolver {
  constructor(
    private readonly surtidoresService: SurtidoresService,
    private readonly prisma: PrismaService,
  ) {}

  @Mutation(() => Surtidor)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createSurtidor(@Args('createSurtidorInput') createSurtidorInput: CreateSurtidorInput): Promise<Surtidor> {
    return this.surtidoresService.create(createSurtidorInput);
  }

  @Query(() => SurtidorListResponse, { name: 'surtidores' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findAllSurtidores(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
    @Args('activo', { type: () => Boolean, nullable: true }) activo?: boolean,
  ): Promise<SurtidorListResponse> {
    return this.surtidoresService.findAll(page, limit, activo);
  }

  @Query(() => Surtidor, { name: 'surtidor' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findOneSurtidor(@Args('id', { type: () => ID }) id: string): Promise<Surtidor> {
    return this.surtidoresService.findOne(id);
  }

  @Query(() => Surtidor, { name: 'surtidorByNumber', nullable: true })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findSurtidorByNumber(
    @Args('numero') numero: string,
    @Args('puntoVentaId') puntoVentaId: string
  ): Promise<Surtidor | null> {
    return this.surtidoresService.findByNumero(numero, puntoVentaId);
  }

  @Mutation(() => Surtidor)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateSurtidor(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateSurtidorInput') updateSurtidorInput: UpdateSurtidorInput,
  ): Promise<Surtidor> {
    return this.surtidoresService.update(id, updateSurtidorInput);
  }

  @Mutation(() => Boolean)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateMangueraReadings(
    @Args('input') input: UpdateMangueraReadingsInput,
  ): Promise<boolean> {
    return this.surtidoresService.updateMangueraReadings(
      input.numeroSurtidor,
      input.numeroManguera,
      input.lecturaAnterior,
      input.lecturaActual
    );
  }

  @Mutation(() => Surtidor)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async removeSurtidor(@Args('id', { type: () => ID }) id: string): Promise<Surtidor> {
    return this.surtidoresService.remove(id);
  }

  @Query(() => HistorialLecturaListResponse)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getMangueraReadingHistory(
    @Args('numeroSurtidor') numeroSurtidor: string,
    @Args('numeroManguera') numeroManguera: string,
    @Args('puntoVentaId') puntoVentaId: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number = 20,
  ): Promise<HistorialLecturaListResponse> {
    return this.surtidoresService.getMangueraReadingHistory(
      numeroSurtidor,
      numeroManguera,
      puntoVentaId,
      fechaDesde,
      fechaHasta,
      page,
      limit
    );
  }

  @Query(() => String, { name: 'getCurrentReadings' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getCurrentReadings(
    @Args('numeroSurtidor') numeroSurtidor: string,
  ): Promise<string> {
    const readings = await this.surtidoresService.getCurrentReadings(numeroSurtidor);
    return JSON.stringify(readings);
  }

  @Query(() => String, { name: 'debugMangueraReadings' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async debugMangueraReadings(
    @Args('numeroSurtidor') numeroSurtidor: string,
    @Args('numeroManguera') numeroManguera: string,
  ): Promise<string> {
    try {
      const manguera = await this.surtidoresService['prisma'].mangueraSurtidor.findFirst({
        where: {
          numero: numeroManguera,
          surtidor: {
            numero: numeroSurtidor,
          },
        },
        include: {
          producto: true,
          surtidor: true,
        },
      });

      if (!manguera) {
        return JSON.stringify({ error: `Manguera ${numeroManguera} no encontrada en surtidor ${numeroSurtidor}` });
      }

      return JSON.stringify({
        id: manguera.id,
        numero: manguera.numero,
        lecturaAnterior: Number(manguera.lecturaAnterior),
        lecturaActual: Number(manguera.lecturaActual),
        activo: manguera.activo,
        surtidor: {
          numero: manguera.surtidor.numero,
          nombre: manguera.surtidor.nombre,
        },
        producto: {
          codigo: manguera.producto.codigo,
          nombre: manguera.producto.nombre,
        },
        updatedAt: manguera.updatedAt,
      });
    } catch (error) {
      return JSON.stringify({ error: error.message });
    }
  }

  @Query(() => MangueraSalesHistory, { name: 'getMangueraSalesHistory' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getMangueraSalesHistory(
    @Args('numeroSurtidor') numeroSurtidor: string,
    @Args('numeroManguera') numeroManguera: string,
    @Args('puntoVentaId') puntoVentaId: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number = 20,
  ): Promise<MangueraSalesHistory> {
    try {
      const LITROS_TO_GALONES = 0.264172;
      
      const historial = await this.surtidoresService.getMangueraReadingHistory(
        numeroSurtidor,
        numeroManguera,
        puntoVentaId,
        fechaDesde,
        fechaHasta,
        page,
        limit
      );

      // Convertir y formatear los datos (galones como primario)
      const ventasConConversiones = historial.historial.map(venta => ({
        fecha: venta.fechaLectura,
        lecturaAnterior: venta.lecturaAnterior,
        lecturaActual: venta.lecturaActual,
        galonesVendidos: Math.round(venta.cantidadVendida * LITROS_TO_GALONES * 100) / 100,
        litrosVendidos: venta.cantidadVendida,
        valorVenta: venta.valorVenta,
        tipoOperacion: venta.tipoOperacion,
        observaciones: venta.observaciones,
      }));

      // Calcular totales (galones como primario)
      const totalLitros = ventasConConversiones.reduce((sum, v) => sum + v.litrosVendidos, 0);
      const totalGalones = Math.round(totalLitros * LITROS_TO_GALONES * 100) / 100;
      const totalValor = ventasConConversiones.reduce((sum, v) => sum + v.valorVenta, 0);

      return {
        manguera: {
          numeroSurtidor,
          numeroManguera,
        },
        periodo: {
          desde: fechaDesde,
          hasta: fechaHasta,
        },
        ventas: ventasConConversiones,
        totales: {
          totalGalones: Math.round(totalGalones * 100) / 100,
          totalLitros: Math.round(totalLitros * 100) / 100,
          totalValor: Math.round(totalValor * 100) / 100,
          numeroVentas: ventasConConversiones.length,
        },
        paginacion: {
          currentPage: historial.currentPage,
          totalPages: historial.totalPages,
          total: historial.total,
        },
      };
    } catch (error) {
      console.error('Error in getMangueraSalesHistory:', error);
      throw new Error(`Error obteniendo historial de ventas: ${error.message}`);
    }
  }

  @Query(() => SurtidorSalesSummary, { name: 'getSurtidorSalesSummary' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getSurtidorSalesSummary(
    @Args('numeroSurtidor') numeroSurtidor: string,
    @Args('puntoVentaId') puntoVentaId: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
  ): Promise<SurtidorSalesSummary> {
    const LITROS_TO_GALONES = 0.264172;

    // Obtener todas las mangueras del surtidor
    const surtidor = await this.surtidoresService.findByNumero(numeroSurtidor, puntoVentaId);
    if (!surtidor) {
      throw new Error(`Surtidor ${numeroSurtidor} no encontrado`);
    }

    const resumenMangueras = [];
    let totalGeneralGalones = 0;
    let totalGeneralLitros = 0;
    let totalGeneralValor = 0;

    for (const manguera of surtidor.mangueras) {
      const historial = await this.surtidoresService.getMangueraReadingHistory(
        numeroSurtidor,
        manguera.numero,
        puntoVentaId,
        fechaDesde,
        fechaHasta,
        1,
        1000 // Obtener todos los registros
      );

      const totalLitros = historial.historial.reduce((sum, h) => sum + h.cantidadVendida, 0);
      const totalGalones = Math.round(totalLitros * LITROS_TO_GALONES * 100) / 100;
      const totalValor = historial.historial.reduce((sum, h) => sum + h.valorVenta, 0);

      resumenMangueras.push({
        numeroManguera: manguera.numero,
        color: manguera.color,
        producto: {
          codigo: manguera.producto.codigo,
          nombre: manguera.producto.nombre,
        },
        ventas: {
          totalGalones: Math.round(totalGalones * 100) / 100,
          totalLitros: Math.round(totalLitros * 100) / 100,
          totalValor: Math.round(totalValor * 100) / 100,
          numeroTransacciones: historial.historial.length,
        },
        ultimaVenta: historial.historial[0] ? {
          fecha: historial.historial[0].fechaLectura,
          galones: Math.round(historial.historial[0].cantidadVendida * LITROS_TO_GALONES * 100) / 100,
          litros: historial.historial[0].cantidadVendida,
          valor: historial.historial[0].valorVenta,
        } : null,
      });

      totalGeneralGalones += totalGalones;
      totalGeneralLitros += totalLitros;
      totalGeneralValor += totalValor;
    }

    return {
      surtidor: {
        numero: surtidor.numero,
        nombre: surtidor.nombre,
        ubicacion: surtidor.ubicacion,
      },
      periodo: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
      mangueras: resumenMangueras,
      totalesSurtidor: {
        totalGalones: Math.round(totalGeneralGalones * 100) / 100,
        totalLitros: Math.round(totalGeneralLitros * 100) / 100,
        totalValor: Math.round(totalGeneralValor * 100) / 100,
      },
    };
  }

  @Query(() => ConsolidadoVentasGeneral, { name: 'getAllPumpsSalesConsolidatedReport' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getAllPumpsSalesConsolidatedReport(
    @CurrentUser() user: any,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('incluirInactivos', { type: () => Boolean, defaultValue: false }) incluirInactivos: boolean = false,
    @Args('codigoPuntoVenta', { nullable: true }) codigoPuntoVenta?: string,
  ): Promise<ConsolidadoVentasGeneral> {
    try {
      // Constantes de conversión (datos almacenados en litros, convertir a galones como primario)
      const LITROS_TO_GALONES = 0.264172;

      // Obtener empresaId del usuario para validación de permisos
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: user.id },
        select: { empresaId: true },
      });

      if (!usuario || !usuario.empresaId) {
        throw new UnauthorizedException('Usuario no tiene empresa asociada');
      }

      let puntoVentaIdFiltro: string | undefined = undefined;
      let puntosVentaIdsEmpresa: string[] | undefined = undefined;

      if (codigoPuntoVenta) {
        const cleanedCodigoPuntoVenta = codigoPuntoVenta.trim();
        let puntoVenta = await this.prisma.puntoVenta.findUnique({
          where: { codigo: cleanedCodigoPuntoVenta },
          select: { id: true, empresaId: true },
        });

        if (!puntoVenta) {
          // Intentar búsqueda case-insensitive si no se encuentra exacto
          const puntosVentaFuzzy = await this.prisma.puntoVenta.findMany({
            where: {
              codigo: {
                contains: cleanedCodigoPuntoVenta,
                mode: 'insensitive',
              },
            },
            select: { id: true, codigo: true, empresaId: true },
          });

          if (puntosVentaFuzzy.length === 1) {
            puntoVenta = puntosVentaFuzzy[0];
          } else if (puntosVentaFuzzy.length > 1) {
            throw new BadRequestException(
              `Múltiples puntos de venta encontrados con código similar a "${codigoPuntoVenta}". Use el código exacto.`,
            );
          } else {
            throw new NotFoundException(
              `Punto de venta con código "${codigoPuntoVenta}" no encontrado. Verifique que el código sea correcto.`,
            );
          }
        }

        if (puntoVenta.empresaId !== usuario.empresaId) {
          throw new UnauthorizedException(
            'No tiene permisos para acceder a este punto de venta',
          );
        }
        puntoVentaIdFiltro = puntoVenta.id;
      } else {
        // Si no se proporciona codigoPuntoVenta, obtener todos los puntos de venta de la empresa del usuario
        const puntosVenta = await this.prisma.puntoVenta.findMany({
          where: { empresaId: usuario.empresaId },
          select: { id: true },
        });
        puntosVentaIdsEmpresa = puntosVenta.map((pv) => pv.id);
      }

      // Obtener todos los surtidores según el filtro
      // Si incluirInactivos es true, obtener todos (undefined)
      // Si incluirInactivos es false, obtener solo activos (true)
      const activoFilter = incluirInactivos ? undefined : true;
      let surtidoresResponse = await this.surtidoresService.findAll(1, -1, activoFilter);
      let surtidores = surtidoresResponse.surtidores;

      // Filtrar por punto de venta si se especificó
      if (puntoVentaIdFiltro) {
        surtidores = surtidores.filter((s) => s.puntoVenta?.id === puntoVentaIdFiltro);
      } else if (puntosVentaIdsEmpresa && puntosVentaIdsEmpresa.length > 0) {
        surtidores = surtidores.filter((s) => s.puntoVenta?.id && puntosVentaIdsEmpresa.includes(s.puntoVenta.id));
      }

      console.log(`[CONSOLIDADO] Obtenidos ${surtidores.length} surtidores (incluirInactivos: ${incluirInactivos})`);
      console.log('[CONSOLIDADO] Surtidores:', surtidores.map(s => `${s.numero} (${s.nombre}) - Activo: ${s.activo}`));

      const surtidoresResumen = [];
      let totalGeneralGalones = 0;
      let totalGeneralLitros = 0;
      let totalGeneralValor = 0;
      let totalGeneralTransacciones = 0;
      let totalManguerasActivas = 0;

      for (const surtidor of surtidores) {
        let totalSurtidorGalones = 0;
        let totalSurtidorLitros = 0;
        let totalSurtidorValor = 0;

        const manguerasResumen = [];
        const manguerasActivas = surtidor.mangueras.filter(m => incluirInactivos || m.activo);
        totalManguerasActivas += manguerasActivas.length;

        console.log(`[CONSOLIDADO] Surtidor ${surtidor.numero}: ${manguerasActivas.length} mangueras activas de ${surtidor.mangueras.length} totales`);

        for (const manguera of manguerasActivas) {
          const historial = await this.surtidoresService.getMangueraReadingHistory(
            surtidor.numero,
            manguera.numero,
            surtidor.puntoVenta?.id || '',
            fechaDesde,
            fechaHasta,
            1,
            10000 // Obtener todos los registros
          );

          // Los datos están en galones, convertir a litros
          const totalGalones = historial.historial.reduce((sum, h) => sum + h.cantidadVendida, 0);
          const totalLitros = Math.round(totalGalones / LITROS_TO_GALONES * 100) / 100;
          const totalValor = historial.historial.reduce((sum, h) => sum + h.valorVenta, 0);

          console.log(`[CONSOLIDADO] Manguera ${surtidor.numero}-${manguera.numero}: ${historial.historial.length} registros, ${totalGalones} gal (${totalLitros}L), $${totalValor}`);

          manguerasResumen.push({
            numeroManguera: manguera.numero,
            color: manguera.color,
            producto: {
              codigo: manguera.producto.codigo,
              nombre: manguera.producto.nombre,
            },
            ventas: {
              totalGalones: Math.round(totalGalones * 100) / 100,
              totalLitros: Math.round(totalLitros * 100) / 100,
              totalValor: Math.round(totalValor * 100) / 100,
              numeroTransacciones: historial.historial.length,
            },
            ultimaVenta: historial.historial[0] ? {
              fecha: historial.historial[0].fechaLectura,
              galones: historial.historial[0].cantidadVendida,
              litros: Math.round(historial.historial[0].cantidadVendida / LITROS_TO_GALONES * 100) / 100,
              valor: historial.historial[0].valorVenta,
            } : null,
          });

          totalSurtidorGalones += totalGalones;
          totalSurtidorLitros += totalLitros;
          totalSurtidorValor += totalValor;
          totalGeneralTransacciones += historial.historial.length;
        }

        surtidoresResumen.push({
          numero: surtidor.numero,
          nombre: surtidor.nombre,
          ubicacion: surtidor.ubicacion,
          mangueras: manguerasResumen,
          totales: {
            totalGalones: Math.round(totalSurtidorGalones * 100) / 100,
            totalLitros: Math.round(totalSurtidorLitros * 100) / 100,
            totalValor: Math.round(totalSurtidorValor * 100) / 100,
          },
        });

        totalGeneralGalones += totalSurtidorGalones;
        totalGeneralLitros += totalSurtidorLitros;
        totalGeneralValor += totalSurtidorValor;

        console.log(`[CONSOLIDADO] Surtidor ${surtidor.numero} totales: ${totalSurtidorGalones} gal (${totalSurtidorLitros}L), $${totalSurtidorValor}`);
      }

      console.log(`[CONSOLIDADO] Totales generales: ${totalGeneralGalones} gal (${totalGeneralLitros}L), $${totalGeneralValor}, ${totalGeneralTransacciones} transacciones`);

      // Calcular resumen financiero consolidado
      let resumenFinanciero: any = {
        totalDeclarado: 0,
        totalCalculado: 0,
        diferencia: 0,
        metodosPago: [],
        totalEfectivo: 0,
        totalTarjetas: 0,
        totalTransferencias: 0,
        totalRumbo: 0,
        totalBonosViveTerpel: 0,
        totalOtros: 0,
        observaciones: `Resumen financiero consolidado del período ${fechaDesde ? new Date(fechaDesde).toLocaleDateString() : 'sin inicio'} al ${fechaHasta ? new Date(fechaHasta).toLocaleDateString() : 'sin fin'}`,
      };
      
      try {
        // ESTRATEGIA: Calcular desde las mismas ventas que usa totalesGenerales
        // 1. Ventas de productos (tienda): desde tablas Venta e HistorialVentasProductos
        // 2. Ventas de combustible: desde historialLectura filtrado por fechaLectura,
        //    luego distribuir proporcionalmente según métodos de pago del CierreTurno
        
        // IMPORTANTE: El problema es que cuando GraphQL recibe una fecha, la convierte
        // y puede cambiar el día debido a timezone. Necesitamos extraer la fecha que
        // el frontend realmente quiere, no la fecha convertida por timezone.
        
        console.log(`[CONSOLIDADO] ========== INICIO PROCESAMIENTO FECHAS ==========`);
        console.log(`[CONSOLIDADO] Fechas recibidas del frontend (raw):`);
        console.log(`[CONSOLIDADO]   fechaDesde: ${fechaDesde} (tipo: ${typeof fechaDesde})`);
        console.log(`[CONSOLIDADO]   fechaHasta: ${fechaHasta} (tipo: ${typeof fechaHasta})`);
        
        // SOLUCIÓN CORREGIDA: Extraer la fecha usando métodos UTC para evitar problemas de timezone
        // Esto garantiza que obtenemos la fecha correcta independientemente de la zona horaria
        let fechaDesdeSolo: string | null = null;
        let fechaHastaSolo: string | null = null;
        
        if (fechaDesde) {
          const fechaDesdeDate = new Date(fechaDesde);
          // Usar métodos UTC directamente para extraer la fecha sin conversiones de timezone
          // Esto garantiza que si el frontend quiere el día 2, obtengamos el día 2
          const year = fechaDesdeDate.getUTCFullYear();
          const month = String(fechaDesdeDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(fechaDesdeDate.getUTCDate()).padStart(2, '0');
          fechaDesdeSolo = `${year}-${month}-${day}`;
          
          console.log(`[CONSOLIDADO]   fechaDesde (original): ${fechaDesde}`);
          console.log(`[CONSOLIDADO]   fechaDesde (Date ISO): ${fechaDesdeDate.toISOString()}`);
          console.log(`[CONSOLIDADO]   fechaDesdeSolo (extraída UTC): ${fechaDesdeSolo}`);
        }
        
        if (fechaHasta) {
          const fechaHastaDate = new Date(fechaHasta);
          // Usar métodos UTC directamente para extraer la fecha sin conversiones de timezone
          const year = fechaHastaDate.getUTCFullYear();
          const month = String(fechaHastaDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(fechaHastaDate.getUTCDate()).padStart(2, '0');
          fechaHastaSolo = `${year}-${month}-${day}`;
          
          console.log(`[CONSOLIDADO]   fechaHasta (original): ${fechaHasta}`);
          console.log(`[CONSOLIDADO]   fechaHasta (Date ISO): ${fechaHastaDate.toISOString()}`);
          console.log(`[CONSOLIDADO]   fechaHastaSolo (extraída UTC): ${fechaHastaSolo}`);
        }
        
        // IMPORTANTE: Usar las fechas ORIGINALES con hora (no solo la fecha)
        // El frontend envía fechas con hora específica (ej: "2025-09-01T22:00:00.000Z")
        // No debemos perder esa hora al filtrar
        const fechaDesdeFinal = fechaDesde ? new Date(fechaDesde) : null;
        const fechaHastaFinal = fechaHasta ? new Date(fechaHasta) : null;
        
        // Función auxiliar para extraer hora en formato HH:mm (igual que movimientos_efectivo)
        const extraerHoraHHmm = (dateInput: Date | string): string => {
          const date = new Date(dateInput);
          const hours = date.getUTCHours().toString().padStart(2, '0');
          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        };
        
        // Extraer hora de las fechas originales
        const horaDesde = fechaDesdeFinal ? extraerHoraHHmm(fechaDesdeFinal) : null;
        const horaHasta = fechaHastaFinal ? extraerHoraHHmm(fechaHastaFinal) : null;
        
        console.log(`[CONSOLIDADO] Fechas finales para filtros:`);
        console.log(`[CONSOLIDADO]   fechaDesdeSolo: ${fechaDesdeSolo}`);
        console.log(`[CONSOLIDADO]   fechaHastaSolo: ${fechaHastaSolo}`);
        console.log(`[CONSOLIDADO]   fechaDesdeFinal (con hora original): ${fechaDesdeFinal?.toISOString()}`);
        console.log(`[CONSOLIDADO]   fechaHastaFinal (con hora original): ${fechaHastaFinal?.toISOString()}`);
        console.log(`[CONSOLIDADO]   horaDesde: ${horaDesde || 'ninguna'}`);
        console.log(`[CONSOLIDADO]   horaHasta: ${horaHasta || 'ninguna'}`);
        console.log(`[CONSOLIDADO] ================================================`);
        
        // Inicializar totales
        let totalEfectivo = 0;
        let totalTarjetas = 0;
        let totalTransferencias = 0;
        let totalRumbo = 0;
        let totalBonosViveTerpel = 0;
        let totalOtros = 0;
        let totalDeclarado = 0;
        let totalCalculado = 0;

        // Map para consolidar métodos de pago detallados
        const metodosPagoMap = new Map<string, { monto: number; porcentaje: number; observaciones: string | null }>();

        // 1. OBTENER VENTAS DE PRODUCTOS (Venta)
        // IMPORTANTE: Usar fechas originales con hora para filtrar ventas
        const filtroVentas: any = {
          estado: 'completada', // Solo ventas completadas
        };

        if (fechaDesde && fechaHasta) {
          filtroVentas.fechaVenta = {
            gte: new Date(fechaDesde),
            lte: new Date(fechaHasta),
          };
        } else if (fechaDesde) {
          filtroVentas.fechaVenta = { gte: new Date(fechaDesde) };
        } else if (fechaHasta) {
          filtroVentas.fechaVenta = { lte: new Date(fechaHasta) };
        }

        if (puntoVentaIdFiltro) {
          filtroVentas.puntoVentaId = puntoVentaIdFiltro;
        } else if (puntosVentaIdsEmpresa && puntosVentaIdsEmpresa.length > 0) {
          filtroVentas.puntoVentaId = {
            in: puntosVentaIdsEmpresa,
          };
        }

        const ventas = await this.prisma.venta.findMany({
          where: filtroVentas,
          select: {
            total: true,
            metodoPago: true,
            fechaVenta: true,
            puntoVentaId: true,
          },
        });

        console.log(`[CONSOLIDADO] Ventas encontradas: ${ventas.length}`);
        console.log(`[CONSOLIDADO] Filtro ventas:`, JSON.stringify(filtroVentas, null, 2));
        if (ventas.length > 0) {
          console.log(`[CONSOLIDADO] Primeras 3 ventas:`, ventas.slice(0, 3).map(v => ({
            total: Number(v.total),
            metodoPago: v.metodoPago,
            fechaVenta: v.fechaVenta,
          })));
        }

        // Procesar ventas de productos
        for (const venta of ventas) {
          const monto = Number(venta.total || 0);
          totalDeclarado += monto;
          totalCalculado += monto;

          // Clasificar por método de pago (usar formato original)
          const metodoPagoStr = (venta.metodoPago || '').trim();
          const metodoPagoUpper = metodoPagoStr.toUpperCase();
          
          console.log(`[CONSOLIDADO] Procesando venta: monto=$${monto}, metodoPago="${metodoPagoStr}" (upper: "${metodoPagoUpper}")`);
          
          // Clasificar según la lógica existente
          if (metodoPagoUpper === 'EFECTIVO') {
            totalEfectivo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como EFECTIVO`);
          } else if (metodoPagoUpper === 'TARJETA_CREDITO' || metodoPagoUpper === 'TARJETA_DEBITO' || metodoPagoUpper === 'TARJETA' || metodoPagoUpper.includes('TARJETA')) {
            totalTarjetas += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TARJETAS`);
          } else if (metodoPagoUpper === 'TRANSFERENCIA' || metodoPagoUpper === 'TRANSFERENCIA_BANCARIA' || metodoPagoUpper.includes('TRANSFERENCIA')) {
            totalTransferencias += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TRANSFERENCIAS`);
          } else if (metodoPagoStr === 'Rumbo' || metodoPagoUpper === 'RUMBO') {
            totalRumbo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como RUMBO`);
          } else if (metodoPagoStr === 'Bonos vive terpel' || metodoPagoStr.toLowerCase().includes('bonos') || metodoPagoStr.toLowerCase().includes('vive terpel')) {
            totalBonosViveTerpel += monto;
            console.log(`[CONSOLIDADO] → Clasificado como BONOS VIVE TERPEL`);
          } else {
            totalOtros += monto;
            console.log(`[CONSOLIDADO] → Clasificado como OTROS (método desconocido: "${metodoPagoStr}")`);
          }

          // Consolidar en map para detalle
          if (metodosPagoMap.has(metodoPagoStr)) {
            const existente = metodosPagoMap.get(metodoPagoStr)!;
            existente.monto += monto;
          } else {
            metodosPagoMap.set(metodoPagoStr, {
              monto,
              porcentaje: 0,
              observaciones: null,
            });
          }
        }

        // 2. OBTENER VENTAS DE PRODUCTOS (HistorialVentasProductos)
        // IMPORTANTE: Usar fechas originales con hora para filtrar historial de ventas
        const filtroHistorialVentas: any = {};

        if (fechaDesde && fechaHasta) {
          filtroHistorialVentas.fechaVenta = {
            gte: new Date(fechaDesde),
            lte: new Date(fechaHasta),
          };
        } else if (fechaDesde) {
          filtroHistorialVentas.fechaVenta = { gte: new Date(fechaDesde) };
        } else if (fechaHasta) {
          filtroHistorialVentas.fechaVenta = { lte: new Date(fechaHasta) };
        }

        if (puntoVentaIdFiltro) {
          filtroHistorialVentas.puntoVentaId = puntoVentaIdFiltro;
        } else if (puntosVentaIdsEmpresa && puntosVentaIdsEmpresa.length > 0) {
          filtroHistorialVentas.puntoVentaId = {
            in: puntosVentaIdsEmpresa,
          };
        }

        const historialVentas = await this.prisma.historialVentasProductos.findMany({
          where: filtroHistorialVentas,
          select: {
            valorTotal: true,
            fechaVenta: true,
            metodoPago: {
              select: {
                codigo: true,
                nombre: true,
              },
            },
          },
        });

        console.log(`[CONSOLIDADO] Historial ventas encontrado: ${historialVentas.length}`);
        console.log(`[CONSOLIDADO] Filtro historial ventas:`, JSON.stringify(filtroHistorialVentas, null, 2));
        if (historialVentas.length > 0) {
          console.log(`[CONSOLIDADO] Primeras 3 historial ventas:`, historialVentas.slice(0, 3).map(v => ({
            valorTotal: v.valorTotal,
            metodoPagoCodigo: v.metodoPago?.codigo,
            metodoPagoNombre: v.metodoPago?.nombre,
            fechaVenta: v.fechaVenta,
          })));
        }

        // Procesar historial de ventas de productos
        for (const venta of historialVentas) {
          const monto = Number(venta.valorTotal || 0);
          totalDeclarado += monto;
          totalCalculado += monto;

          // Clasificar por método de pago (usar formato original)
          const metodoPagoNombre = (venta.metodoPago?.nombre || venta.metodoPago?.codigo || '').trim();
          const metodoPagoUpper = metodoPagoNombre.toUpperCase();
          
          console.log(`[CONSOLIDADO] Procesando historial venta: monto=$${monto}, metodoPagoNombre="${metodoPagoNombre}" (upper: "${metodoPagoUpper}"), codigo="${venta.metodoPago?.codigo}"`);
          
          // Clasificar según la lógica existente
          if (metodoPagoUpper === 'EFECTIVO') {
            totalEfectivo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como EFECTIVO`);
          } else if (metodoPagoUpper === 'TARJETA_CREDITO' || metodoPagoUpper === 'TARJETA_DEBITO' || metodoPagoUpper === 'TARJETA' || metodoPagoUpper.includes('TARJETA')) {
            totalTarjetas += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TARJETAS`);
          } else if (metodoPagoUpper === 'TRANSFERENCIA' || metodoPagoUpper === 'TRANSFERENCIA_BANCARIA' || metodoPagoUpper.includes('TRANSFERENCIA')) {
            totalTransferencias += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TRANSFERENCIAS`);
          } else if (metodoPagoNombre === 'Rumbo' || metodoPagoUpper === 'RUMBO' || venta.metodoPago?.codigo === 'Rumbo') {
            totalRumbo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como RUMBO`);
          } else if (metodoPagoNombre === 'Bonos vive terpel' || metodoPagoNombre.toLowerCase().includes('bonos') || metodoPagoNombre.toLowerCase().includes('vive terpel') || venta.metodoPago?.codigo === 'Bonos vive terpel') {
            totalBonosViveTerpel += monto;
            console.log(`[CONSOLIDADO] → Clasificado como BONOS VIVE TERPEL`);
          } else {
            totalOtros += monto;
            console.log(`[CONSOLIDADO] → Clasificado como OTROS (método desconocido: nombre="${metodoPagoNombre}", codigo="${venta.metodoPago?.codigo}")`);
          }

          // Consolidar en map
          if (metodosPagoMap.has(metodoPagoNombre)) {
            const existente = metodosPagoMap.get(metodoPagoNombre)!;
            existente.monto += monto;
          } else {
            metodosPagoMap.set(metodoPagoNombre, {
              monto,
              porcentaje: 0,
              observaciones: null,
            });
          }
        }

        // 3. OBTENER VENTAS DE COMBUSTIBLE desde CIERRES DE TURNO
        // IMPORTANTE: Filtrar por fechaInicio y fechaFin del TURNO (no por fechaCierre)
        // El frontend envía fecha inicio (ej: 01/09/2025 12:00 AM = 00:00:00) y fecha fin (ej: 01/09/2025 11:59 PM = 23:59:59)
        // Se deben mostrar todos los cierres de turnos que se solapen con ese rango
        // Un turno se solapa si: fechaInicio <= fechaHasta AND (fechaFin IS NULL OR fechaFin >= fechaDesde)
        
        console.log(`[CONSOLIDADO] Filtrando por fechas del TURNO (fechaInicio y fechaFin):`);
        console.log(`[CONSOLIDADO]   fechaDesde: ${fechaDesdeSolo} (${fechaDesdeFinal?.toISOString()})`);
        console.log(`[CONSOLIDADO]   fechaHasta: ${fechaHastaSolo} (${fechaHastaFinal?.toISOString()})`);
        console.log(`[CONSOLIDADO]   fechaDesdeFinal (con hora): ${fechaDesdeFinal?.toISOString()}`);
        console.log(`[CONSOLIDADO]   fechaHastaFinal (con hora): ${fechaHastaFinal?.toISOString()}`);

        // Construir query usando Prisma.$queryRaw con template literals
        // Filtrar por fechas del turno con lógica de solapamiento
        let cierreIds: string[] = [];

        if (fechaDesdeFinal || fechaHastaFinal || puntoVentaIdFiltro || (puntosVentaIdsEmpresa && puntosVentaIdsEmpresa.length > 0)) {
          // Construir condiciones WHERE dinámicamente
          // ORDEN: Primero filtrar por puntoVentaId, luego por fecha y hora
          const conditions: string[] = [];

          // 1. PRIMERO: Filtrar por punto de venta
          if (puntoVentaIdFiltro) {
            conditions.push(`t."puntoVentaId" = '${puntoVentaIdFiltro.replace(/'/g, "''")}'`);
          } else if (puntosVentaIdsEmpresa && puntosVentaIdsEmpresa.length > 0) {
            const puntosVentaList = puntosVentaIdsEmpresa.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
            conditions.push(`t."puntoVentaId" IN (${puntosVentaList})`);
          }

          // 2. SEGUNDO: Filtrar por fechas del turno con lógica de solapamiento
          // Un turno se solapa con el rango si:
          // - El turno inicia antes o igual al final del rango (t."fechaInicio" <= fechaHasta)
          // - Y el turno termina después o igual al inicio del rango (t."fechaFin" >= fechaDesde o es NULL)
          if (fechaDesdeFinal && fechaHastaFinal) {
            // Rango completo: usar lógica de solapamiento con fecha Y hora
            const fechaDesdeISO = fechaDesdeFinal.toISOString();
            const fechaHastaISO = fechaHastaFinal.toISOString();
            conditions.push(`t."fechaInicio" <= '${fechaHastaISO}'::timestamp`);
            conditions.push(`(t."fechaFin" IS NULL OR t."fechaFin" >= '${fechaDesdeISO}'::timestamp)`);
            
            // 3. TERCERO: Filtrar por hora (horaInicio y horaFin del turno)
            // Solo aplicar filtro de hora si se proporcionaron horas válidas
            if (horaDesde && horaHasta) {
              // LÓGICA CORRECTA DE SOLAPAMIENTO:
              // Un turno se solapa con el rango si hay intersección real (no solo tocar límites)
              // Condición: horaInicio < horaHasta AND horaFin > horaDesde
              // Esto EXCLUYE turnos que solo tocan los límites sin solaparse realmente
              // 
              // Ejemplos:
              // - Rango 06:00-14:00, Turno 06:00-14:00 → 06:00 < 14:00 ✓ AND 14:00 > 06:00 ✓ → SÍ
              // - Rango 06:00-14:00, Turno 14:00-22:00 → 14:00 < 14:00 ✗ → NO (solo toca límite)
              // - Rango 14:00-22:00, Turno 06:00-14:00 → 06:00 < 22:00 ✓ AND 14:00 > 14:00 ✗ → NO (solo toca límite)
              // - Rango 14:00-22:00, Turno 14:00-22:00 → 14:00 < 22:00 ✓ AND 22:00 > 14:00 ✓ → SÍ
              // - Rango 22:00-22:00, Turno 14:00-22:00 → 14:00 < 22:00 ✓ AND 22:00 > 22:00 ✗ → NO (solo toca límite)
              // 
              // CASO ESPECIAL: Si horaDesde === horaHasta (rango de un solo punto)
              // Entonces incluimos turnos que contengan ese punto exacto
              if (horaDesde === horaHasta) {
                // Rango de un solo punto: incluir turnos que contengan ese punto
                conditions.push(`(
                  t."horaInicio" <= '${horaHasta}' 
                  AND (t."horaFin" IS NULL OR t."horaFin" >= '${horaDesde}')
                )`);
                console.log(`[CONSOLIDADO] Filtrando por rango de fechas Y HORAS del turno (rango de un punto: ${horaDesde})`);
              } else {
                // Rango normal: usar solapamiento estricto (excluir límites)
                // IMPORTANTE: Si horaFin es NULL, el turno está activo y termina al final del día
                // Para que se solape, debe cumplir: horaInicio < horaHasta
                // Y si tiene horaFin, debe cumplir: horaFin > horaDesde
                conditions.push(`(
                  t."horaInicio" < '${horaHasta}' 
                  AND (
                    t."horaFin" IS NULL 
                    OR t."horaFin" > '${horaDesde}'
                  )
                )`);
                console.log(`[CONSOLIDADO] Filtrando por rango de fechas Y HORAS del turno (solapamiento estricto)`);
                console.log(`[CONSOLIDADO]   - Condición: horaInicio < ${horaHasta} AND (horaFin IS NULL OR horaFin > ${horaDesde})`);
              }
              console.log(`[CONSOLIDADO]   - horaDesde: ${horaDesde}, horaHasta: ${horaHasta}`);
              
              // QUERY DE DIAGNÓSTICO: Verificar qué turnos se están incluyendo
              const diagnosticoTurnosQuery = `
                SELECT 
                  t.id,
                  t."horaInicio",
                  t."horaFin",
                  t."fechaInicio",
                  t."fechaFin"
                FROM turnos.turnos t
                WHERE 
                  ${conditions.join(' AND ')}
                ORDER BY t."horaInicio"
                LIMIT 10
              `;
              
              try {
                const turnosDiagnostico: any[] = await this.prisma.$queryRawUnsafe(diagnosticoTurnosQuery);
                console.log(`[CONSOLIDADO] ========== DIAGNÓSTICO TURNOS INCLUIDOS ==========`);
                console.log(`[CONSOLIDADO] Turnos que cumplen el filtro: ${turnosDiagnostico.length}`);
                turnosDiagnostico.forEach((t, idx) => {
                  console.log(`[CONSOLIDADO] Turno ${idx + 1}:`);
                  console.log(`[CONSOLIDADO]   - ID: ${t.id}`);
                  console.log(`[CONSOLIDADO]   - horaInicio: ${t.horaInicio}`);
                  console.log(`[CONSOLIDADO]   - horaFin: ${t.horaFin || 'NULL'}`);
                  console.log(`[CONSOLIDADO]   - fechaInicio: ${t.fechaInicio}`);
                  console.log(`[CONSOLIDADO]   - fechaFin: ${t.fechaFin || 'NULL'}`);
                  
                  // Verificar si realmente se solapa
                  if (horaDesde && horaHasta && horaDesde !== horaHasta) {
                    const horaInicioTurno = t.horaInicio;
                    const horaFinTurno = t.horaFin;
                    const seSolapa = horaInicioTurno < horaHasta && (horaFinTurno ? horaFinTurno > horaDesde : horaInicioTurno < horaHasta);
                    console.log(`[CONSOLIDADO]   - ¿Se solapa con ${horaDesde}-${horaHasta}? ${seSolapa ? 'SÍ' : 'NO'}`);
                    if (!seSolapa) {
                      console.warn(`[CONSOLIDADO]     ⚠️ Este turno NO debería incluirse pero está en el resultado`);
                    }
                  }
                });
                console.log(`[CONSOLIDADO] ================================================`);
              } catch (error) {
                console.error(`[CONSOLIDADO] Error en diagnóstico de turnos:`, error);
              }
            } else {
              console.log(`[CONSOLIDADO] Filtrando por rango de fechas del turno (solapamiento, sin hora)`);
            }
          } else {
            // Si solo hay una fecha, aplicar filtros individuales
            if (fechaDesdeFinal) {
              const fechaDesdeISO = fechaDesdeFinal.toISOString();
              // El turno debe terminar después o igual a fechaDesde (o no tener fechaFin)
              conditions.push(`(t."fechaFin" IS NULL OR t."fechaFin" >= '${fechaDesdeISO}'::timestamp)`);
              if (horaDesde) {
                conditions.push(`(t."horaFin" IS NULL OR t."horaFin" >= '${horaDesde}')`);
              }
            }
            if (fechaHastaFinal) {
              const fechaHastaISO = fechaHastaFinal.toISOString();
              // El turno debe iniciar antes o igual a fechaHasta
              conditions.push(`t."fechaInicio" <= '${fechaHastaISO}'::timestamp`);
              if (horaHasta) {
                conditions.push(`t."horaInicio" <= '${horaHasta}'`);
              }
            }
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          const querySql = `
            SELECT c.id
            FROM turnos.cierres_turno c
            INNER JOIN turnos.turnos t ON c."turnoId" = t.id
            ${whereClause}
          `;

          console.log(`[CONSOLIDADO] ========== QUERY SQL (FECHAS DEL TURNO) ==========`);
          console.log(`[CONSOLIDADO] Query completa:`);
          console.log(querySql.trim());
          console.log(`[CONSOLIDADO] Filtro aplicado:`);
          console.log(`  - fechaDesde: ${fechaDesdeFinal?.toISOString() || 'ninguna'}`);
          console.log(`  - fechaHasta: ${fechaHastaFinal?.toISOString() || 'ninguna'}`);
          console.log(`  - puntoVentaIdFiltro: ${puntoVentaIdFiltro || 'ninguno'}`);
          console.log(`[CONSOLIDADO] ==============================================`);
          
          // Ejecutar query raw usando $queryRawUnsafe (sin parámetros, valores directos)
          try {
            const cierresIdsRaw: any[] = await this.prisma.$queryRawUnsafe(querySql);
            cierreIds = cierresIdsRaw.map((c: any) => c.id);
            console.log(`[CONSOLIDADO] IDs de cierres encontrados: ${cierreIds.length}`);
            
            if (cierreIds.length > 0) {
              console.log(`[CONSOLIDADO] Primeros 5 IDs:`, cierreIds.slice(0, 5));
            }
          } catch (error) {
            console.error(`[CONSOLIDADO] Error ejecutando query raw:`, error);
            throw error;
          }
        }


        // Procesar ventas de productos
        for (const venta of ventas) {
          const monto = Number(venta.total || 0);
          totalDeclarado += monto;
          totalCalculado += monto;

          // Clasificar por método de pago (usar formato original)
          const metodoPagoStr = (venta.metodoPago || '').trim();
          const metodoPagoUpper = metodoPagoStr.toUpperCase();
          
          console.log(`[CONSOLIDADO] Procesando venta: monto=$${monto}, metodoPago="${metodoPagoStr}" (upper: "${metodoPagoUpper}")`);
          
          // Clasificar según la lógica existente
          if (metodoPagoUpper === 'EFECTIVO') {
            totalEfectivo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como EFECTIVO`);
          } else if (metodoPagoUpper === 'TARJETA_CREDITO' || metodoPagoUpper === 'TARJETA_DEBITO' || metodoPagoUpper === 'TARJETA' || metodoPagoUpper.includes('TARJETA')) {
            totalTarjetas += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TARJETAS`);
          } else if (metodoPagoUpper === 'TRANSFERENCIA' || metodoPagoUpper === 'TRANSFERENCIA_BANCARIA' || metodoPagoUpper.includes('TRANSFERENCIA')) {
            totalTransferencias += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TRANSFERENCIAS`);
          } else if (metodoPagoStr === 'Rumbo' || metodoPagoUpper === 'RUMBO') {
            totalRumbo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como RUMBO`);
          } else if (metodoPagoStr === 'Bonos vive terpel' || metodoPagoStr.toLowerCase().includes('bonos') || metodoPagoStr.toLowerCase().includes('vive terpel')) {
            totalBonosViveTerpel += monto;
            console.log(`[CONSOLIDADO] → Clasificado como BONOS VIVE TERPEL`);
          } else {
            totalOtros += monto;
            console.log(`[CONSOLIDADO] → Clasificado como OTROS (método desconocido: "${metodoPagoStr}")`);
          }

          // Consolidar en map para detalle
          if (metodosPagoMap.has(metodoPagoStr)) {
            const existente = metodosPagoMap.get(metodoPagoStr)!;
            existente.monto += monto;
          } else {
            metodosPagoMap.set(metodoPagoStr, {
              monto,
              porcentaje: 0,
              observaciones: null,
            });
          }
        }


        // Procesar historial de ventas de productos
        for (const venta of historialVentas) {
          const monto = Number(venta.valorTotal || 0);
          totalDeclarado += monto;
          totalCalculado += monto;

          // Clasificar por método de pago (usar formato original)
          const metodoPagoNombre = (venta.metodoPago?.nombre || venta.metodoPago?.codigo || '').trim();
          const metodoPagoUpper = metodoPagoNombre.toUpperCase();
          
          console.log(`[CONSOLIDADO] Procesando historial venta: monto=$${monto}, metodoPagoNombre="${metodoPagoNombre}" (upper: "${metodoPagoUpper}"), codigo="${venta.metodoPago?.codigo}"`);
          
          // Clasificar según la lógica existente
          if (metodoPagoUpper === 'EFECTIVO') {
            totalEfectivo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como EFECTIVO`);
          } else if (metodoPagoUpper === 'TARJETA_CREDITO' || metodoPagoUpper === 'TARJETA_DEBITO' || metodoPagoUpper === 'TARJETA' || metodoPagoUpper.includes('TARJETA')) {
            totalTarjetas += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TARJETAS`);
          } else if (metodoPagoUpper === 'TRANSFERENCIA' || metodoPagoUpper === 'TRANSFERENCIA_BANCARIA' || metodoPagoUpper.includes('TRANSFERENCIA')) {
            totalTransferencias += monto;
            console.log(`[CONSOLIDADO] → Clasificado como TRANSFERENCIAS`);
          } else if (metodoPagoNombre === 'Rumbo' || metodoPagoUpper === 'RUMBO' || venta.metodoPago?.codigo === 'Rumbo') {
            totalRumbo += monto;
            console.log(`[CONSOLIDADO] → Clasificado como RUMBO`);
          } else if (metodoPagoNombre === 'Bonos vive terpel' || metodoPagoNombre.toLowerCase().includes('bonos') || metodoPagoNombre.toLowerCase().includes('vive terpel') || venta.metodoPago?.codigo === 'Bonos vive terpel') {
            totalBonosViveTerpel += monto;
            console.log(`[CONSOLIDADO] → Clasificado como BONOS VIVE TERPEL`);
          } else {
            totalOtros += monto;
            console.log(`[CONSOLIDADO] → Clasificado como OTROS (método desconocido: nombre="${metodoPagoNombre}", codigo="${venta.metodoPago?.codigo}")`);
          }

          // Consolidar en map
          if (metodosPagoMap.has(metodoPagoNombre)) {
            const existente = metodosPagoMap.get(metodoPagoNombre)!;
            existente.monto += monto;
          } else {
            metodosPagoMap.set(metodoPagoNombre, {
              monto,
              porcentaje: 0,
              observaciones: null,
            });
          }
        }

        // 3. OBTENER VENTAS DE COMBUSTIBLE desde CIERRES DE TURNO
        // Si no hay cierres, inicializar array vacío
        let cierres: any[] = [];
        
        if (cierreIds.length > 0) {
          // Obtener cierres completos con métodos de pago usando los IDs encontrados
          cierres = await this.prisma.cierreTurno.findMany({
            where: {
              id: { in: cierreIds },
            },
            select: {
              id: true,
              fechaCierre: true,
              totalEfectivo: true,
              totalTarjetas: true,
              totalTransferencias: true,
              totalRumbo: true,
              totalBonosViveTerpel: true,
              totalOtros: true,
              valorTotalGeneral: true,
              totalDeclarado: true,
              diferencia: true,
              metodosPago: {
                select: {
                  metodoPago: true,
                  monto: true,
                  porcentaje: true,
                  observaciones: true,
                },
              },
            },
          });
        }

        console.log(`[CONSOLIDADO] Cierres encontrados: ${cierres.length}`);
        
        // Log de diagnóstico: mostrar fechas de cierres encontrados
        if (cierres.length > 0) {
          console.log(`[CONSOLIDADO] ===== DIAGNÓSTICO DE CIERRES ENCONTRADOS =====`);
          console.log(`[CONSOLIDADO] Filtro aplicado (por fechas del turno): fechaDesde=${fechaDesdeFinal?.toISOString() || 'ninguna'}, fechaHasta=${fechaHastaFinal?.toISOString() || 'ninguna'}`);
          
          // Agrupar cierres por fecha para ver si hay días anteriores
          const cierresPorFecha = new Map<string, number>();
          
          cierres.forEach((c, index) => {
            const fechaCierreUTC = new Date(c.fechaCierre);
            const fechaSolo = `${fechaCierreUTC.getUTCFullYear()}-${String(fechaCierreUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(fechaCierreUTC.getUTCDate()).padStart(2, '0')}`;
            
            // Contar por fecha
            if (cierresPorFecha.has(fechaSolo)) {
              cierresPorFecha.set(fechaSolo, cierresPorFecha.get(fechaSolo)! + 1);
            } else {
              cierresPorFecha.set(fechaSolo, 1);
            }
            
            if (index < 5) { // Solo mostrar los primeros 5 para no saturar logs
              console.log(`[CONSOLIDADO] Cierre ${index + 1}:`);
              console.log(`[CONSOLIDADO]   - ID: ${c.id}`);
              console.log(`[CONSOLIDADO]   - fechaCierre (ISO): ${c.fechaCierre.toISOString()}`);
              console.log(`[CONSOLIDADO]   - fechaCierre (solo fecha): ${fechaSolo}`);
              console.log(`[CONSOLIDADO]   - totalEfectivo: ${Number(c.totalEfectivo || 0)}`);
              console.log(`[CONSOLIDADO]   - totalTarjetas: ${Number(c.totalTarjetas || 0)}`);
              console.log(`[CONSOLIDADO]   - totalRumbo: ${Number(c.totalRumbo || 0)}`);
            }
          });
          
          console.log(`[CONSOLIDADO] Cierres agrupados por fecha:`);
          cierresPorFecha.forEach((count, fecha) => {
            console.log(`[CONSOLIDADO]   - ${fecha}: ${count} cierre(s)`);
          });
          
          console.log(`[CONSOLIDADO] ================================================`);
        } else {
          console.warn(`[CONSOLIDADO] ⚠️ No se encontraron cierres con el filtro aplicado`);
          console.warn(`[CONSOLIDADO]   Filtro (por fechas del turno): fechaDesde=${fechaDesdeFinal?.toISOString() || 'ninguna'}, fechaHasta=${fechaHastaFinal?.toISOString() || 'ninguna'}`);
        }

        // Sumar directamente los totales de los cierres
        for (const cierre of cierres) {
          totalEfectivo += Number(cierre.totalEfectivo || 0);
          totalTarjetas += Number(cierre.totalTarjetas || 0);
          totalTransferencias += Number(cierre.totalTransferencias || 0);
          totalRumbo += Number(cierre.totalRumbo || 0);
          totalBonosViveTerpel += Number(cierre.totalBonosViveTerpel || 0);
          totalOtros += Number(cierre.totalOtros || 0);
          totalDeclarado += Number(cierre.totalDeclarado || 0);
          totalCalculado += Number(cierre.valorTotalGeneral || 0);

          // Consolidar métodos de pago detallados
          for (const metodo of cierre.metodosPago) {
            const key = metodo.metodoPago;
            if (metodosPagoMap.has(key)) {
              const existente = metodosPagoMap.get(key)!;
              existente.monto += Number(metodo.monto || 0);
            } else {
              metodosPagoMap.set(key, {
                monto: Number(metodo.monto || 0),
                porcentaje: Number(metodo.porcentaje || 0),
                observaciones: metodo.observaciones,
              });
            }
          }
        }

        console.log(`[CONSOLIDADO] Totales desde cierres:`, {
          totalEfectivo: Math.round(totalEfectivo * 100) / 100,
          totalTarjetas: Math.round(totalTarjetas * 100) / 100,
          totalTransferencias: Math.round(totalTransferencias * 100) / 100,
          totalRumbo: Math.round(totalRumbo * 100) / 100,
          totalBonosViveTerpel: Math.round(totalBonosViveTerpel * 100) / 100,
          totalOtros: Math.round(totalOtros * 100) / 100,
        });

        // Calcular porcentajes para métodos de pago
        const metodosPagoConsolidados = Array.from(metodosPagoMap.entries()).map(([metodoPago, data]) => ({
          metodoPago,
          monto: Math.round(data.monto * 100) / 100,
          porcentaje: totalDeclarado > 0 
            ? Math.round((data.monto / totalDeclarado) * 100 * 100) / 100 
            : 0,
          observaciones: data.observaciones,
        }));

        // Calcular diferencia
        const diferencia = totalDeclarado - totalCalculado;

        resumenFinanciero = {
          totalDeclarado: Math.round(totalDeclarado * 100) / 100,
          totalCalculado: Math.round(totalCalculado * 100) / 100,
          diferencia: Math.round(diferencia * 100) / 100,
          metodosPago: metodosPagoConsolidados,
          totalEfectivo: Math.round(totalEfectivo * 100) / 100,
          totalTarjetas: Math.round(totalTarjetas * 100) / 100,
          totalTransferencias: Math.round(totalTransferencias * 100) / 100,
          totalRumbo: Math.round(totalRumbo * 100) / 100,
          totalBonosViveTerpel: Math.round(totalBonosViveTerpel * 100) / 100,
          totalOtros: Math.round(totalOtros * 100) / 100,
          observaciones: `Resumen financiero consolidado del período ${fechaDesde ? new Date(fechaDesde).toLocaleDateString() : 'sin inicio'} al ${fechaHasta ? new Date(fechaHasta).toLocaleDateString() : 'sin fin'}`,
        };

        console.log(`[CONSOLIDADO] ========== RESUMEN FINANCIERO ==========`);
        console.log(`[CONSOLIDADO] Ventas productos (Venta): ${ventas.length}`);
        console.log(`[CONSOLIDADO] Historial ventas productos: ${historialVentas.length}`);
        console.log(`[CONSOLIDADO] Cierres de turno: ${cierres.length}`);
        console.log(`[CONSOLIDADO] -----------------------------------------`);
        console.log(`[CONSOLIDADO] Totales calculados:`, {
          totalEfectivo: resumenFinanciero.totalEfectivo,
          totalTarjetas: resumenFinanciero.totalTarjetas,
          totalTransferencias: resumenFinanciero.totalTransferencias,
          totalRumbo: resumenFinanciero.totalRumbo,
          totalBonosViveTerpel: resumenFinanciero.totalBonosViveTerpel,
          totalOtros: resumenFinanciero.totalOtros,
          totalDeclarado: resumenFinanciero.totalDeclarado,
          totalCalculado: resumenFinanciero.totalCalculado,
        });
        console.log(`[CONSOLIDADO] =========================================`);
      } catch (error) {
        console.error('[CONSOLIDADO] Error calculando resumen financiero:', error);
        // No lanzar error, solo dejar resumenFinanciero como null
      }

      return {
        periodo: {
          desde: fechaDesde,
          hasta: fechaHasta,
        },
        surtidores: surtidoresResumen,
        totalesGenerales: {
          totalGalones: Math.round(totalGeneralGalones * 100) / 100,
          totalLitros: Math.round(totalGeneralLitros * 100) / 100,
          totalValor: Math.round(totalGeneralValor * 100) / 100,
          totalTransacciones: totalGeneralTransacciones,
          totalSurtidores: surtidores.length,
          totalMangueras: totalManguerasActivas,
        },
        resumenFinanciero: resumenFinanciero,
        fechaGeneracion: new Date(),
      };
    } catch (error) {
      console.error('Error in getAllPumpsSalesConsolidatedReport:', error);
      throw new Error(`Error obteniendo consolidado general: ${error.message}`);
    }
  }
} 