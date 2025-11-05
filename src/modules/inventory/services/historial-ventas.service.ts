import { Injectable, NotFoundException } from '@nestjs/common';
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

  async obtenerResumenVentasPorPeriodo(filtros: FiltrosReporteVentasInput): Promise<ResumenVentasProductos> {
    const where: any = {};

    if (filtros.productoId) {
      where.productoId = filtros.productoId;
    }

    if (filtros.puntoVentaId) {
      where.puntoVentaId = filtros.puntoVentaId;
    }

    if (filtros.fechaInicio) {
      where.fechaVenta = { ...where.fechaVenta, gte: filtros.fechaInicio };
    }

    if (filtros.fechaFin) {
      where.fechaVenta = { ...where.fechaVenta, lte: filtros.fechaFin };
    }

    // Obtener estadísticas generales
    const estadisticas = await this.prisma.historialVentasProductos.aggregate({
      where,
      _sum: {
        valorTotal: true,
        cantidadVendida: true
      },
      _count: {
        id: true
      }
    });

    // Obtener productos vendidos consolidados
    const productosVendidos = await this.prisma.historialVentasProductos.groupBy({
      by: ['productoId'],
      where,
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

    // Obtener información de productos
    const productos = await this.prisma.producto.findMany({
      where: {
        id: { in: productosVendidos.map(p => p.productoId) }
      }
    });

    const productosMap = new Map(productos.map(p => [p.id, p]));

    const consolidadoProductos: any[] = productosVendidos.map(p => {
      const producto = productosMap.get(p.productoId);
      const cantidadTotal = p._sum.cantidadVendida || 0;
      const valorTotal = p._sum.valorTotal || 0;
      const precioPromedio = p._avg.precioUnitario || 0;
      const numeroVentas = p._count.id || 0;
      
      // Calcular rentabilidad (margen de ganancia)
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

    const totalVentas = estadisticas._sum.valorTotal || 0;
    const totalCantidad = estadisticas._sum.cantidadVendida || 0;
    const totalTransacciones = estadisticas._count.id || 0;
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
