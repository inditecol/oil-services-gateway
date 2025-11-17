import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateSurtidorInput } from './dto/create-surtidor.input';
import { UpdateSurtidorInput } from './dto/update-surtidor.input';
import { Surtidor, SurtidorListResponse } from './entities/surtidor.entity';
import { MangueraSurtidor } from './entities/manguera-surtidor.entity';

@Injectable()
export class SurtidoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createSurtidorInput: CreateSurtidorInput): Promise<Surtidor> {
    // Verificar si el número ya existe en el punto de venta
    const existingSurtidor = await this.prisma.surtidor.findFirst({
      where: { 
        numero: createSurtidorInput.numero,
        puntoVentaId: createSurtidorInput.puntoVentaId 
      },
    });

    if (existingSurtidor) {
      throw new ConflictException('Ya existe un surtidor con este número en este punto de venta');
    }

    const surtidor = await this.prisma.surtidor.create({
      data: {
        numero: createSurtidorInput.numero,
        nombre: createSurtidorInput.nombre,
        descripcion: createSurtidorInput.descripcion,
        ubicacion: createSurtidorInput.ubicacion,
        cantidadMangueras: createSurtidorInput.cantidadMangueras,
        activo: createSurtidorInput.activo,
        fechaInstalacion: createSurtidorInput.fechaInstalacion 
          ? new Date(createSurtidorInput.fechaInstalacion) 
          : new Date(),
        fechaMantenimiento: createSurtidorInput.fechaMantenimiento 
          ? new Date(createSurtidorInput.fechaMantenimiento) 
          : new Date(),
        observaciones: createSurtidorInput.observaciones,
        puntoVenta: {
          connect: { id: createSurtidorInput.puntoVentaId }
        },
        mangueras: {
          create: createSurtidorInput.mangueras?.map(manguera => ({
            numero: manguera.numero,
            color: manguera.color,
            lecturaAnterior: manguera.lecturaAnterior ?? 0,
            lecturaActual: manguera.lecturaActual ?? 0,
            producto: {
              connect: { id: manguera.productoId }
            },
            activo: manguera.activo ?? true,
          })) || [],
        },
      },
      include: {
        puntoVenta: true,
        mangueras: {
          include: {
            producto: true,
          },
        },
      },
    });

    return this.formatSurtidor(surtidor);
  }

  async findAll(page = 1, limit = 10, activo?: boolean): Promise<SurtidorListResponse> {
    try {
      // Si limit es -1, obtener todos los registros sin paginación
      const usesPagination = limit !== -1;
      const skip = usesPagination ? (page - 1) * limit : 0;
      
      const whereCondition: any = {};
      if (activo !== undefined) {
        whereCondition.activo = activo;
      }

      // Configurar la query
      const queryOptions: any = {
        where: whereCondition,
        include: {
          puntoVenta: {
            include: {
              empresa: true,
            },
          },
          mangueras: {
            include: {
              producto: true,
            },
            orderBy: { numero: 'asc' },
          },
        },
        orderBy: { numero: 'asc' },
      };

      // Solo agregar skip y take si se usa paginación
      if (usesPagination) {
        queryOptions.skip = skip;
        queryOptions.take = limit;
      }

      const [surtidores, total] = await Promise.all([
        this.prisma.surtidor.findMany(queryOptions),
        this.prisma.surtidor.count({ where: whereCondition }),
      ]);

      const actualLimit = usesPagination ? limit : total;
      const actualPage = usesPagination ? page : 1;

      return {
        surtidores: surtidores.map((surtidor) => this.formatSurtidor(surtidor)),
        total,
        page: actualPage,
        limit: actualLimit,
      };
    } catch (error) {
      throw new Error(`Error fetching surtidores: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<Surtidor> {
    try {
      const surtidor = await this.prisma.surtidor.findUnique({
        where: { id },
        include: {
          puntoVenta: {
            include: {
              empresa: true,
            },
          },
          mangueras: {
            include: {
              producto: true,
            },
            orderBy: { numero: 'asc' },
          },
        },
      });

      if (!surtidor) {
        throw new NotFoundException(`Surtidor with ID ${id} not found`);
      }

      return this.formatSurtidor(surtidor);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Error fetching surtidor: ${error.message}`);
    }
  }

  async findByNumero(numero: string, puntoVentaId: string): Promise<Surtidor | null> {
    const surtidor = await this.prisma.surtidor.findUnique({
      where: { 
        puntoVentaId_numero: {
          puntoVentaId: puntoVentaId,
          numero: numero
        }
      },
      include: {
        puntoVenta: {
          include: {
            empresa: true,
          },
        },
        mangueras: {
          include: {
            producto: true,
          },
        },
      },
    });

    return surtidor ? this.formatSurtidor(surtidor) : null;
  }

  async update(id: string, updateSurtidorInput: UpdateSurtidorInput): Promise<Surtidor> {
    try {
      const existingSurtidor = await this.findOne(id);

      // Si se están actualizando mangueras, validar
      if (updateSurtidorInput.mangueras) {
        const cantidadMangueras = updateSurtidorInput.cantidadMangueras ?? existingSurtidor.cantidadMangueras;
        if (updateSurtidorInput.mangueras.length !== cantidadMangueras) {
          throw new BadRequestException(
            `El número de mangueras (${updateSurtidorInput.mangueras.length}) no coincide con la cantidad especificada (${cantidadMangueras})`
          );
        }

        // Verificar que los productos existan
        const productIds = updateSurtidorInput.mangueras.map(m => m.productoId).filter(Boolean);
        if (productIds.length > 0) {
          const productos = await this.prisma.producto.findMany({
            where: { id: { in: productIds } },
          });

          if (productos.length !== productIds.length) {
            const foundIds = productos.map(p => p.id);
            const missingIds = productIds.filter(id => !foundIds.includes(id));
            throw new BadRequestException(`Productos no encontrados: ${missingIds.join(', ')}`);
          }
        }
      }

      const surtidor = await this.prisma.surtidor.update({
        where: { id },
        data: {
          ...updateSurtidorInput,
          mangueras: updateSurtidorInput.mangueras ? {
            deleteMany: {},
            create: updateSurtidorInput.mangueras.map(manguera => ({
              numero: manguera.numero,
              color: manguera.color,
              lecturaAnterior: manguera.lecturaAnterior ?? 0,
              lecturaActual: manguera.lecturaActual ?? 0,
              productoId: manguera.productoId,
              activo: manguera.activo ?? true,
            })),
          } : undefined,
        },
        include: {
          puntoVenta: {
            include: {
              empresa: true,
            },
          },
          mangueras: {
            include: {
              producto: true,
            },
            orderBy: { numero: 'asc' },
          },
        },
      });

      return this.formatSurtidor(surtidor);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Error updating surtidor: ${error.message}`);
    }
  }

  async remove(id: string): Promise<Surtidor> {
    try {
      const existingSurtidor = await this.findOne(id);

      const surtidor = await this.prisma.surtidor.delete({
        where: { id },
        include: {
          puntoVenta: {
            include: {
              empresa: true,
            },
          },
          mangueras: {
            include: {
              producto: true,
            },
          },
        },
      });

      return this.formatSurtidor(surtidor);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Error deleting surtidor: ${error.message}`);
    }
  }

  async validateSurtidorExists(numero: string, puntoVentaId?: string): Promise<boolean> {
    try {
      const whereCondition = puntoVentaId ? {
        puntoVentaId: puntoVentaId,
        numero: numero
      } : {
        numero: numero,
        activo: true,
      };

      const surtidor = await this.prisma.surtidor.findFirst({
        where: whereCondition,
      });
      return !!surtidor;
    } catch (error) {
      return false;
    }
  }

  async validateMangueraExists(numeroSurtidor: string, numeroManguera: string, codigoProducto?: string): Promise<boolean> {
    try {
      const manguera = await this.prisma.mangueraSurtidor.findFirst({
        where: {
          numero: numeroManguera,
          activo: true,
          surtidor: {
            numero: numeroSurtidor,
            activo: true,
          },
          ...(codigoProducto && {
            producto: {
              codigo: codigoProducto,
            },
          }),
        },
      });
      return !!manguera;
    } catch (error) {
      return false;
    }
  }

  async updateMangueraReadings(numeroSurtidor: string, numeroManguera: string, lecturaAnterior: number, lecturaActual: number): Promise<boolean> {
    try {
      const manguera = await this.prisma.mangueraSurtidor.findFirst({
        where: {
          numero: numeroManguera,
          surtidor: {
            numero: numeroSurtidor,
          },
        },
      });

      if (!manguera) {
        return false;
      }

      await this.prisma.mangueraSurtidor.update({
        where: { id: manguera.id },
        data: {
          lecturaAnterior,
          lecturaActual,
        },
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Actualiza las lecturas de una manguera y crea un registro de historial
   * ESTA ES LA LÓGICA CORRECTA PARA USAR EN PROCESS SHIFT CLOSURE
   */
  async updateMangueraReadingsWithHistory(
    numeroSurtidor: string, 
    numeroManguera: string, 
    nuevaLectura: number,
    precio: number,
    tipoOperacion: string = 'cierre_turno',
    usuarioId?: string,
    startTime?: Date,
    finishTime?: Date,
    observaciones?: string,
    cierreTurnoId?: string,
    fechaLectura?: Date,
    puntoVentaId?: string
  ): Promise<{ success: boolean; cantidadVendida: number; valorVenta: number; historialId?: string }> {
    console.log(`[SURTIDORES] updateMangueraReadingsWithHistory iniciado:`, {
      numeroSurtidor,
      numeroManguera,
      nuevaLectura,
      precio,
      tipoOperacion,
      usuarioId,
      puntoVentaId,
      startTime: startTime ? new Date(startTime) : new Date(),
      finishTime: finishTime ? new Date(finishTime) : new Date()
    });

    try {
      // Construir el filtro where con puntoVentaId si se proporciona
      const whereClause: any = {
        numero: numeroManguera,
        surtidor: {
          numero: numeroSurtidor,
          activo: true,
        },
        activo: true,
      };

      // Agregar filtro por puntoVentaId si se proporciona
      if (puntoVentaId) {
        whereClause.surtidor.puntoVentaId = puntoVentaId;
      }

      const manguera = await this.prisma.mangueraSurtidor.findFirst({
        where: whereClause,
        include: {
          producto: true,
        },
      });

      console.log(`[SURTIDORES] Manguera encontrada:`, manguera ? {
        id: manguera.id,
        numero: manguera.numero,
        lecturaAnterior: manguera.lecturaAnterior,
        lecturaActual: manguera.lecturaActual,
        producto: manguera.producto.codigo
      } : 'NO ENCONTRADA');

      if (!manguera) {
        console.error(`[SURTIDORES] Manguera no encontrada: ${numeroSurtidor}/${numeroManguera}`);
        return { success: false, cantidadVendida: 0, valorVenta: 0, historialId: undefined };
      }

      // OBTENER LA LECTURA ACTUAL DE LA BASE DE DATOS (será la "anterior" en el historial)
      const lecturaAnteriorDB = Number(manguera.lecturaActual) || 0;
      const cantidadVendida = Math.max(0, nuevaLectura - lecturaAnteriorDB);
      const valorVenta = cantidadVendida * precio;

      console.log(`[SURTIDORES] Cálculos:`, {
        lecturaAnteriorDB,
        nuevaLectura,
        cantidadVendida,
        valorVenta
      });

      // Actualizar las lecturas en la manguera
      const mangueraActualizada = await this.prisma.mangueraSurtidor.update({
        where: { id: manguera.id },
        data: {
          lecturaAnterior: lecturaAnteriorDB, // La lectura que tenía se vuelve "anterior"
          lecturaActual: nuevaLectura,        // La nueva lectura se vuelve "actual"
        },
      });

      console.log(`[SURTIDORES] Manguera actualizada en BD:`, {
        id: mangueraActualizada.id,
        lecturaAnterior: mangueraActualizada.lecturaAnterior,
        lecturaActual: mangueraActualizada.lecturaActual
      });

      // Crear registro en el historial
      const historialCreado = await this.prisma.historialLectura.create({
        data: {
          mangueraId: manguera.id,
          fechaLectura: fechaLectura || new Date(),
          lecturaAnterior: lecturaAnteriorDB,
          lecturaActual: nuevaLectura,
          cantidadVendida,
          valorVenta,
          tipoOperacion,
          observaciones,
          usuarioId,
          startTime,
          finishTime,
          turnoId: cierreTurnoId || null // Guardamos el ID del cierre de turno en turnoId
        },
      });

      console.log(`[SURTIDORES] Historial creado:`, {
        id: historialCreado.id,
        lecturaAnterior: historialCreado.lecturaAnterior,
        lecturaActual: historialCreado.lecturaActual,
        cantidadVendida: historialCreado.cantidadVendida,
        turnoId: historialCreado.turnoId
      });

      return { success: true, cantidadVendida, valorVenta, historialId: historialCreado.id };
    } catch (error) {
      console.error('[SURTIDORES] Error updating manguera readings with history:', error);
      return { success: false, cantidadVendida: 0, valorVenta: 0, historialId: undefined };
    }
  }

  /**
   * Obtiene el historial de lecturas de una manguera específica
   */
  async getMangueraReadingHistory(
    numeroSurtidor: string,
    numeroManguera: string,
    puntoVentaId: string,
    fechaDesde?: Date,
    fechaHasta?: Date,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const skip = (page - 1) * limit;
      
      const where = {
        manguera: {
          numero: numeroManguera,
          surtidor: {
            numero: numeroSurtidor,
            puntoVentaId: puntoVentaId,
          },
        },
        ...(fechaDesde && fechaHasta && {
          fechaLectura: {
            gte: fechaDesde,
            lte: fechaHasta,
          },
        }),
      };

      const [historialRaw, total] = await Promise.all([
        this.prisma.historialLectura.findMany({
          where,
          include: {
            manguera: {
              include: {
                surtidor: {
                  include: {
                    puntoVenta: true,
                  },
                },
                producto: true,
              },
            },
          },
          orderBy: [
            { fechaLectura: 'desc' },
            { createdAt: 'desc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.historialLectura.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Format the response to match GraphQL types
      const historial = historialRaw.map(item => ({
        id: item.id,
        fechaLectura: item.fechaLectura,
        lecturaAnterior: Number(item.lecturaAnterior),
        lecturaActual: Number(item.lecturaActual),
        cantidadVendida: Number(item.cantidadVendida),
        valorVenta: Number(item.valorVenta),
        tipoOperacion: item.tipoOperacion,
        observaciones: item.observaciones,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        mangueraId: item.mangueraId,
        manguera: {
          id: item.manguera.id,
          numero: item.manguera.numero,
          color: item.manguera.color,
          lecturaAnterior: Number(item.manguera.lecturaAnterior),
          lecturaActual: Number(item.manguera.lecturaActual),
          activo: item.manguera.activo,
          createdAt: item.manguera.createdAt,
          updatedAt: item.manguera.updatedAt,
          surtidorId: item.manguera.surtidorId,
          surtidor: item.manguera.surtidor,
          productoId: item.manguera.productoId,
          producto: {
            id: item.manguera.producto.id,
            codigo: item.manguera.producto.codigo,
            nombre: item.manguera.producto.nombre,
            descripcion: item.manguera.producto.descripcion,
            unidadMedida: item.manguera.producto.unidadMedida,
            precio: Number((item.manguera.producto as any).precioVenta || (item.manguera.producto as any).precio || 0),
            precioCompra: Number((item.manguera.producto as any).precioCompra || 0),
            precioVenta: Number((item.manguera.producto as any).precioVenta || (item.manguera.producto as any).precio || 0),
            moneda: (item.manguera.producto as any).moneda || 'COP',
            porcentajeGanancia: 0, // Calcular después
            costo: 0, // Default value - not in schema
            utilidad: 0, // Default value - not in schema  
            margenUtilidad: 0, // Default value - not in schema
            stockMinimo: item.manguera.producto.stockMinimo,
            stockActual: item.manguera.producto.stockActual,
            esCombustible: item.manguera.producto.esCombustible,
            activo: item.manguera.producto.activo,
            createdAt: item.manguera.producto.createdAt,
            updatedAt: item.manguera.producto.updatedAt,
            categoriaId: item.manguera.producto.categoriaId,
            categoria: {
              id: '',
              nombre: '',
              descripcion: null,
              activo: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
        usuarioId: item.usuarioId,
        startTime: item.startTime,
        finishTime: item.finishTime,
      }));

      return {
        historial,
        total,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      throw new Error(`Error getting reading history: ${error.message}`);
    }
  }

  /**
   * Obtiene todas las lecturas actuales de un surtidor
   */
  async getCurrentReadings(numeroSurtidor: string) {
    try {
      const surtidor = await this.prisma.surtidor.findFirst({
        where: {
          numero: numeroSurtidor,
          activo: true,
        },
        include: {
          mangueras: {
            where: { activo: true },
            include: {
              producto: true,
            },
            orderBy: { numero: 'asc' },
          },
        },
      });

      if (!surtidor) {
        throw new NotFoundException(`Surtidor ${numeroSurtidor} no encontrado`);
      }

      return surtidor.mangueras.map(manguera => ({
        numeroManguera: manguera.numero,
        lecturaAnterior: Number(manguera.lecturaAnterior) || 0,
        lecturaActual: Number(manguera.lecturaActual) || 0,
        producto: {
          codigo: manguera.producto.codigo,
          nombre: manguera.producto.nombre,
          precio: Number((manguera.producto as any).precioVenta || (manguera.producto as any).precio || 0),
        },
      }));
    } catch (error) {
      throw new Error(`Error getting current readings: ${error.message}`);
    }
  }

  private formatSurtidor(surtidor: any): Surtidor {
    return {
      id: surtidor.id,
      numero: surtidor.numero,
      nombre: surtidor.nombre,
      descripcion: surtidor.descripcion,
      ubicacion: surtidor.ubicacion,
      cantidadMangueras: surtidor.cantidadMangueras,
      activo: surtidor.activo,
      fechaInstalacion: surtidor.fechaInstalacion,
      fechaMantenimiento: surtidor.fechaMantenimiento,
      observaciones: surtidor.observaciones,
      createdAt: surtidor.createdAt,
      updatedAt: surtidor.updatedAt,
      puntoVenta: {
        id: surtidor.puntoVenta.id,
        codigo: surtidor.puntoVenta.codigo,
        nombre: surtidor.puntoVenta.nombre,
        descripcion: surtidor.puntoVenta.descripcion,
        direccion: surtidor.puntoVenta.direccion,
        ciudad: surtidor.puntoVenta.ciudad,
        provincia: surtidor.puntoVenta.provincia,
        pais: surtidor.puntoVenta.pais,
        codigoPostal: surtidor.puntoVenta.codigoPostal,
        telefono: surtidor.puntoVenta.telefono,
        telefonoMovil: surtidor.puntoVenta.telefonoMovil,
        email: surtidor.puntoVenta.email,
        horarioApertura: surtidor.puntoVenta.horarioApertura,
        horarioCierre: surtidor.puntoVenta.horarioCierre,
        diasAtencion: surtidor.puntoVenta.diasAtencion,
        coordenadasGPS: surtidor.puntoVenta.coordenadasGPS,
        tipoEstacion: surtidor.puntoVenta.tipoEstacion,
        serviciosAdicionales: surtidor.puntoVenta.serviciosAdicionales,
        capacidadMaxima: surtidor.puntoVenta.capacidadMaxima,
        fechaApertura: surtidor.puntoVenta.fechaApertura,
        activo: surtidor.puntoVenta.activo,
        createdAt: surtidor.puntoVenta.createdAt,
        updatedAt: surtidor.puntoVenta.updatedAt,
        empresaId: surtidor.puntoVenta.empresaId,
        empresa: {
          id: surtidor.puntoVenta.empresa.id,
          rut: surtidor.puntoVenta.empresa.rut,
          razonSocial: surtidor.puntoVenta.empresa.razonSocial,
          nombreComercial: surtidor.puntoVenta.empresa.nombreComercial,
          nombre: surtidor.puntoVenta.empresa.nombre,
          direccion: surtidor.puntoVenta.empresa.direccion,
          ciudad: surtidor.puntoVenta.empresa.ciudad,
          provincia: surtidor.puntoVenta.empresa.provincia,
          pais: surtidor.puntoVenta.empresa.pais,
          codigoPostal: surtidor.puntoVenta.empresa.codigoPostal,
          telefono: surtidor.puntoVenta.empresa.telefono,
          telefonoMovil: surtidor.puntoVenta.empresa.telefonoMovil,
          email: surtidor.puntoVenta.empresa.email,
          sitioWeb: surtidor.puntoVenta.empresa.sitioWeb,
          logo: surtidor.puntoVenta.empresa.logo,
          sector: surtidor.puntoVenta.empresa.sector,
          tipoEmpresa: surtidor.puntoVenta.empresa.tipoEmpresa,
          fechaConstitucion: surtidor.puntoVenta.empresa.fechaConstitucion,
          activo: surtidor.puntoVenta.empresa.activo,
          createdAt: surtidor.puntoVenta.empresa.createdAt,
          updatedAt: surtidor.puntoVenta.empresa.updatedAt,
          puntosVenta: [],
        },
      },
      mangueras: surtidor.mangueras?.map((manguera: any) => ({
        id: manguera.id,
        numero: manguera.numero,
        color: manguera.color,
        lecturaAnterior: Number(manguera.lecturaAnterior) || 0,
        lecturaActual: Number(manguera.lecturaActual) || 0,
        activo: manguera.activo,
        createdAt: manguera.createdAt,
        updatedAt: manguera.updatedAt,
        surtidorId: manguera.surtidorId,
        surtidor: surtidor,
        productoId: manguera.productoId,
        producto: this.formatProductoForGraphQL(manguera.producto),
      })) || [],
    };
  }

  private formatProductoForGraphQL(producto: any) {
    const precioCompra = Number((producto as any).precioCompra || 0);
    const precioVenta = Number((producto as any).precioVenta || (producto as any).precio || 0);
    
    // Calcular campos financieros
    const utilidad = precioVenta - precioCompra;
    const margenUtilidad = precioVenta > 0 ? ((utilidad / precioVenta) * 100) : 0;
    const porcentajeGanancia = precioCompra > 0 ? ((utilidad / precioCompra) * 100) : 0;

    return {
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      unidadMedida: producto.unidadMedida,
      precioCompra: precioCompra,
      precioVenta: precioVenta,
      moneda: (producto as any).moneda || 'COP',
      utilidad: Math.round(utilidad * 100) / 100,
      margenUtilidad: Math.round(margenUtilidad * 100) / 100,
      porcentajeGanancia: Math.round(porcentajeGanancia * 100) / 100,
      stockMinimo: producto.stockMinimo,
      stockActual: producto.stockActual,
      esCombustible: producto.esCombustible,
      activo: producto.activo,
      createdAt: producto.createdAt,
      updatedAt: producto.updatedAt,
      categoriaId: producto.categoriaId,
      categoria: producto.categoria || {
        id: '',
        nombre: '',
        descripcion: null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }
} 