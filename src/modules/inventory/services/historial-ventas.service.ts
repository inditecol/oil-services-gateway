import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { HistorialVentasProductos as HistorialVentasProductosGraphQL } from '../entities/historial-ventas-productos.entity';
import { ConsolidadoProductosVendidos, ResumenVentasProductos } from '../entities/consolidado-productos-ventas.entity';
import { RegistrarVentaProductoInput, FiltrosVentasProductosInput, FiltrosReporteVentasInput } from '../dto/registrar-venta-producto.input';

@Injectable()
export class HistorialVentasService {
  constructor(private prisma: PrismaService) {}

  async registrarVentaProducto(input: RegistrarVentaProductoInput): Promise<any> {
    // Obtener el método de pago por código
    const metodoPago = await this.prisma.metodoPago.findUnique({
      where: { codigo: input.metodoPagoCodigo }
    });

    if (!metodoPago) {
      throw new NotFoundException(`Método de pago con código ${input.metodoPagoCodigo} no encontrado`);
    }

    // Verificar que el producto existe
    const producto = await this.prisma.producto.findUnique({
      where: { id: input.productoId }
    });

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${input.productoId} no encontrado`);
    }

    // Verificar stock disponible
    if (producto.stockActual < input.cantidadVendida) {
      throw new NotFoundException(`Stock insuficiente. Disponible: ${producto.stockActual}, Solicitado: ${input.cantidadVendida}`);
    }

    // Calcular valor total
    const valorTotal = input.cantidadVendida * input.precioUnitario;

    // Crear registro de venta
    const venta = await this.prisma.historialVentasProductos.create({
      data: {
        fechaVenta: new Date(),
        cantidadVendida: input.cantidadVendida,
        precioUnitario: input.precioUnitario,
        valorTotal: valorTotal,
        unidadMedida: input.unidadMedida,
        observaciones: input.observaciones,
        productoId: input.productoId,
        metodoPagoId: metodoPago.id,
        clienteId: input.clienteId,
        usuarioId: input.usuarioId,
        turnoId: input.turnoId,
        puntoVentaId: input.puntoVentaId
      },
      include: {
        producto: true,
        metodoPago: true,
        cliente: true,
        usuario: true,
        turno: true,
        puntoVenta: true
      }
    });

    // Actualizar stock del producto
    await this.prisma.producto.update({
      where: { id: input.productoId },
      data: {
        stockActual: { decrement: input.cantidadVendida }
      }
    });

    return venta;
  }

  async obtenerVentasPorProducto(productoId: string, filtros?: FiltrosVentasProductosInput): Promise<any[]> {
    const where: any = { productoId };

    if (filtros?.fechaInicio) {
      where.fechaVenta = { ...where.fechaVenta, gte: filtros.fechaInicio };
    }

    if (filtros?.fechaFin) {
      where.fechaVenta = { ...where.fechaVenta, lte: filtros.fechaFin };
    }

    if (filtros?.metodoPagoCodigo) {
      const metodoPago = await this.prisma.metodoPago.findUnique({
        where: { codigo: filtros.metodoPagoCodigo }
      });
      if (metodoPago) {
        where.metodoPagoId = metodoPago.id;
      }
    }

    return this.prisma.historialVentasProductos.findMany({
      where,
      include: {
        producto: true,
        metodoPago: true,
        cliente: true,
        usuario: true,
        turno: true,
        puntoVenta: true
      },
      orderBy: { fechaVenta: 'desc' },
      take: filtros?.limit || 10,
      skip: filtros?.offset || 0
    });
  }

  async obtenerVentasPaginadas(filtros?: FiltrosVentasProductosInput): Promise<any[]> {
    const where: any = {};

    if (filtros?.productoId) {
      where.productoId = filtros.productoId;
    }

    if (filtros?.clienteId) {
      where.clienteId = filtros.clienteId;
    }

    if (filtros?.usuarioId) {
      where.usuarioId = filtros.usuarioId;
    }

    if (filtros?.turnoId) {
      where.turnoId = filtros.turnoId;
    }

    if (filtros?.puntoVentaId) {
      where.puntoVentaId = filtros.puntoVentaId;
    }

    if (filtros?.fechaInicio) {
      where.fechaVenta = { ...where.fechaVenta, gte: filtros.fechaInicio };
    }

    if (filtros?.fechaFin) {
      where.fechaVenta = { ...where.fechaVenta, lte: filtros.fechaFin };
    }

    if (filtros?.metodoPagoCodigo) {
      const metodoPago = await this.prisma.metodoPago.findUnique({
        where: { codigo: filtros.metodoPagoCodigo }
      });
      if (metodoPago) {
        where.metodoPagoId = metodoPago.id;
      }
    }

    return this.prisma.historialVentasProductos.findMany({
      where,
      include: {
        producto: true,
        metodoPago: true,
        cliente: true,
        usuario: true,
        turno: true,
        puntoVenta: true
      },
      orderBy: { fechaVenta: 'desc' },
      take: filtros?.limit || 10,
      skip: filtros?.offset || 0
    });
  }

  async obtenerResumenVentasPorPeriodo(filtros: FiltrosReporteVentasInput, empresaId?: string): Promise<ResumenVentasProductos> {
    const GALONES_TO_LITROS = 3.78541;
    const LITROS_TO_GALONES = 0.264172;

    let puntoVentaIdFiltro: string | undefined = filtros.puntoVentaId;
    let puntosVentaIds: string[] | undefined = undefined;

    if (filtros.codigoPuntoVenta) {
      const cleanedCodigoPuntoVenta = filtros.codigoPuntoVenta.trim();
      let puntoVenta = await this.prisma.puntoVenta.findUnique({
        where: { codigo: cleanedCodigoPuntoVenta },
        select: { id: true, empresaId: true },
      });

      if (!puntoVenta) {
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
            `Múltiples puntos de venta encontrados con código similar a "${filtros.codigoPuntoVenta}". Use el código exacto.`,
          );
        } else {
          throw new NotFoundException(
            `Punto de venta con código "${filtros.codigoPuntoVenta}" no encontrado. Verifique que el código sea correcto.`,
          );
        }
      }

      if (empresaId && puntoVenta.empresaId !== empresaId) {
        throw new UnauthorizedException('No tiene permisos para acceder a este punto de venta');
      }
      puntoVentaIdFiltro = puntoVenta.id;
    } else if (empresaId && !filtros.puntoVentaId) {
      const puntosVentaEmpresa = await this.prisma.puntoVenta.findMany({
        where: { empresaId: empresaId },
        select: { id: true },
      });
      puntosVentaIds = puntosVentaEmpresa.map((pv) => pv.id);
    }

    // === VENTAS DE PRODUCTOS DE TIENDA ===
    const whereTienda: any = {};

    if (filtros.productoId) {
      whereTienda.productoId = filtros.productoId;
    }

    if (puntoVentaIdFiltro) {
      whereTienda.puntoVentaId = puntoVentaIdFiltro;
    } else if (puntosVentaIds && puntosVentaIds.length > 0) {
      whereTienda.puntoVentaId = { in: puntosVentaIds };
    }

    if (filtros.fechaInicio) {
      whereTienda.fechaVenta = { ...whereTienda.fechaVenta, gte: filtros.fechaInicio };
    }

    if (filtros.fechaFin) {
      whereTienda.fechaVenta = { ...whereTienda.fechaVenta, lte: filtros.fechaFin };
    }

    // Obtener estadísticas generales de productos de tienda
    const estadisticasTienda = await this.prisma.historialVentasProductos.aggregate({
      where: whereTienda,
      _sum: {
        valorTotal: true,
        cantidadVendida: true
      },
      _count: {
        id: true
      }
    });

    // Obtener productos vendidos consolidados de tienda
    const productosVendidosTienda = await this.prisma.historialVentasProductos.groupBy({
      by: ['productoId'],
      where: whereTienda,
      _sum: {
        cantidadVendida: true,
        valorTotal: true
      },
      _count: {
        id: true
      },
      _avg: {
        precioUnitario: true
      }
    });

    // === VENTAS DE COMBUSTIBLE (HISTORIAL DE LECTURAS) ===
    const whereCombustibleManguera: any = {
      producto: {
        esCombustible: true
      }
    };

    // Filtrar por punto de venta a través de la relación manguera -> surtidor -> puntoVenta
    if (puntoVentaIdFiltro) {
      whereCombustibleManguera.surtidor = {
        puntoVentaId: puntoVentaIdFiltro,
      };
    } else if (puntosVentaIds && puntosVentaIds.length > 0) {
      whereCombustibleManguera.surtidor = {
        puntoVentaId: { in: puntosVentaIds },
      };
    } else if (empresaId && puntosVentaIds && puntosVentaIds.length === 0) {
      // Si no hay puntos de venta, no habrá ventas de combustible
      whereCombustibleManguera.surtidor = {
        puntoVentaId: { in: [] }, // Filtro que no devolverá resultados
      };
    }

    // Filtrar por producto si está especificado
    if (filtros.productoId) {
      whereCombustibleManguera.productoId = filtros.productoId;
    }

    const whereCombustible: any = {
      manguera: whereCombustibleManguera
    };

    // Filtrar por fechas
    if (filtros.fechaInicio || filtros.fechaFin) {
      whereCombustible.fechaLectura = {};
      if (filtros.fechaInicio) {
        whereCombustible.fechaLectura.gte = filtros.fechaInicio;
      }
      if (filtros.fechaFin) {
        whereCombustible.fechaLectura.lte = filtros.fechaFin;
      }
    }

    // Obtener historial de lecturas con información de manguera y producto
    const historialLecturas = await this.prisma.historialLectura.findMany({
      where: whereCombustible,
      include: {
        manguera: {
          include: {
            producto: true,
            surtidor: true
          }
        }
      }
    });

    // Agrupar ventas de combustible por producto
    const ventasCombustiblePorProducto = new Map<string, {
      cantidadTotal: number;
      valorTotal: number;
      numeroVentas: number;
      productos: { cantidad: number; valor: number }[];
    }>();

    historialLecturas.forEach(lectura => {
      const productoId = lectura.manguera.productoId;
      const cantidadVendida = Number(lectura.cantidadVendida);
      const valorVenta = Number(lectura.valorVenta);
      
      // Convertir a litros si la unidad de medida del producto es galones
      let cantidadLitros = cantidadVendida;
      if (lectura.manguera.producto.unidadMedida.toLowerCase() === 'galones') {
        cantidadLitros = cantidadVendida * GALONES_TO_LITROS;
      }

      if (!ventasCombustiblePorProducto.has(productoId)) {
        ventasCombustiblePorProducto.set(productoId, {
          cantidadTotal: 0,
          valorTotal: 0,
          numeroVentas: 0,
          productos: []
        });
      }

      const productoData = ventasCombustiblePorProducto.get(productoId)!;
      productoData.cantidadTotal += cantidadLitros;
      productoData.valorTotal += valorVenta;
      productoData.numeroVentas += 1;
      productoData.productos.push({
        cantidad: cantidadLitros,
        valor: valorVenta
      });
    });

    // === COMBINAR RESULTADOS ===
    // Obtener información de todos los productos involucrados
    const productosIdsTienda = productosVendidosTienda.map(p => p.productoId);
    const productosIdsCombustible = Array.from(ventasCombustiblePorProducto.keys());
    const todosProductosIds = [...new Set([...productosIdsTienda, ...productosIdsCombustible])];

    const productos = await this.prisma.producto.findMany({
      where: {
        id: { in: todosProductosIds }
      }
    });

    const productosMap = new Map(productos.map(p => [p.id, p]));

    // Consolidar productos de tienda
    const consolidadoProductosTienda = productosVendidosTienda.map(p => {
      const producto = productosMap.get(p.productoId);
      const cantidadTotal = Number(p._sum.cantidadVendida || 0);
      const valorTotal = Number(p._sum.valorTotal || 0);
      const precioPromedio = Number(p._avg.precioUnitario || 0);
      const numeroVentas = p._count.id || 0;
      
      const costoTotal = cantidadTotal * Number(producto?.precioCompra || 0);
      const rentabilidad = costoTotal > 0 ? ((valorTotal - costoTotal) / costoTotal) * 100 : 0;

      return {
        productoId: p.productoId,
        producto: producto!,
        cantidadTotalVendida: cantidadTotal,
        valorTotalVentas: valorTotal,
        precioPromedio: precioPromedio,
        numeroVentas: numeroVentas,
        rentabilidad: rentabilidad
      };
    });

    // Consolidar productos de combustible
    const consolidadoProductosCombustible = Array.from(ventasCombustiblePorProducto.entries()).map(([productoId, datos]) => {
      const producto = productosMap.get(productoId);
      const cantidadTotal = datos.cantidadTotal;
      const valorTotal = datos.valorTotal;
      const precioPromedio = datos.numeroVentas > 0 ? valorTotal / cantidadTotal : 0;
      const numeroVentas = datos.numeroVentas;
      
      const costoTotal = cantidadTotal * Number(producto?.precioCompra || 0);
      const rentabilidad = costoTotal > 0 ? ((valorTotal - costoTotal) / costoTotal) * 100 : 0;

      return {
        productoId: productoId,
        producto: producto!,
        cantidadTotalVendida: cantidadTotal,
        valorTotalVentas: valorTotal,
        precioPromedio: precioPromedio,
        numeroVentas: numeroVentas,
        rentabilidad: rentabilidad
      };
    });

    // Combinar ambos tipos de productos
    const consolidadoProductosMap = new Map<string, any>();
    
    // Agregar productos de tienda
    consolidadoProductosTienda.forEach(p => {
      consolidadoProductosMap.set(p.productoId, p);
    });

    // Agregar o combinar productos de combustible
    consolidadoProductosCombustible.forEach(p => {
      if (consolidadoProductosMap.has(p.productoId)) {
        // Si el producto ya existe (ventas de tienda y combustible), combinar
        const existente = consolidadoProductosMap.get(p.productoId)!;
        existente.cantidadTotalVendida += p.cantidadTotalVendida;
        existente.valorTotalVentas += p.valorTotalVentas;
        existente.numeroVentas += p.numeroVentas;
        existente.precioPromedio = existente.cantidadTotalVendida > 0 
          ? existente.valorTotalVentas / existente.cantidadTotalVendida 
          : 0;
        const costoTotal = existente.cantidadTotalVendida * Number(existente.producto.precioCompra || 0);
        existente.rentabilidad = costoTotal > 0 
          ? ((existente.valorTotalVentas - costoTotal) / costoTotal) * 100 
          : 0;
      } else {
        // Si es solo combustible, agregar
        consolidadoProductosMap.set(p.productoId, p);
      }
    });

    const consolidadoProductos = Array.from(consolidadoProductosMap.values());

    // Calcular totales combinados
    const totalVentasTienda = Number(estadisticasTienda._sum.valorTotal || 0);
    const totalVentasCombustible = consolidadoProductosCombustible.reduce((sum, p) => sum + p.valorTotalVentas, 0);
    const totalVentas = totalVentasTienda + totalVentasCombustible;

    const totalCantidadTienda = Number(estadisticasTienda._sum.cantidadVendida || 0);
    const totalCantidadCombustible = consolidadoProductosCombustible.reduce((sum, p) => sum + p.cantidadTotalVendida, 0);
    const totalCantidad = totalCantidadTienda + totalCantidadCombustible;

    const totalTransaccionesTienda = estadisticasTienda._count.id || 0;
    const totalTransaccionesCombustible = consolidadoProductosCombustible.reduce((sum, p) => sum + p.numeroVentas, 0);
    const totalTransacciones = totalTransaccionesTienda + totalTransaccionesCombustible;

    const promedioPorVenta = totalTransacciones > 0 ? totalVentas / totalTransacciones : 0;

    return {
      totalVentas,
      totalCantidad,
      totalTransacciones,
      promedioPorVenta,
      productosVendidos: consolidadoProductos
    };
  }

  async obtenerEstadisticasGenerales(): Promise<any> {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioAño = new Date(hoy.getFullYear(), 0, 1);

    // Estadísticas del día
    const ventasHoy = await this.prisma.historialVentasProductos.aggregate({
      where: {
        fechaVenta: {
          gte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
        }
      },
      _sum: { valorTotal: true, cantidadVendida: true },
      _count: { id: true }
    });

    // Estadísticas del mes
    const ventasMes = await this.prisma.historialVentasProductos.aggregate({
      where: {
        fechaVenta: { gte: inicioMes }
      },
      _sum: { valorTotal: true, cantidadVendida: true },
      _count: { id: true }
    });

    // Estadísticas del año
    const ventasAño = await this.prisma.historialVentasProductos.aggregate({
      where: {
        fechaVenta: { gte: inicioAño }
      },
      _sum: { valorTotal: true, cantidadVendida: true },
      _count: { id: true }
    });

    return {
      hoy: {
        totalVentas: ventasHoy._sum.valorTotal || 0,
        totalCantidad: ventasHoy._sum.cantidadVendida || 0,
        totalTransacciones: ventasHoy._count.id || 0
      },
      mes: {
        totalVentas: ventasMes._sum.valorTotal || 0,
        totalCantidad: ventasMes._sum.cantidadVendida || 0,
        totalTransacciones: ventasMes._count.id || 0
      },
      año: {
        totalVentas: ventasAño._sum.valorTotal || 0,
        totalCantidad: ventasAño._sum.cantidadVendida || 0,
        totalTransacciones: ventasAño._count.id || 0
      }
    };
  }
}
