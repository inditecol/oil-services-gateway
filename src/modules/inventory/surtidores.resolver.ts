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
        fechaGeneracion: new Date(),
      };
    } catch (error) {
      console.error('Error in getAllPumpsSalesConsolidatedReport:', error);
      throw new Error(`Error obteniendo consolidado general: ${error.message}`);
    }
  }
} 