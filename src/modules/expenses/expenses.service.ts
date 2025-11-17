import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateGastoInput } from './dto/create-gasto.input';
import { UpdateGastoInput } from './dto/update-gasto.input';
import { FilterGastosInput } from './dto/filter-gastos.input';
import { CreateCategoriaGastoInput } from './dto/create-categoria-gasto.input';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // CATEGORÍAS DE GASTOS
  // ==========================================

  async createCategoria(data: CreateCategoriaGastoInput) {
    return this.prisma.categoriaGasto.create({ data });
  }

  async getCategorias() {
    return this.prisma.categoriaGasto.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async getCategoriaById(id: string) {
    const categoria = await this.prisma.categoriaGasto.findUnique({
      where: { id },
    });

    if (!categoria) {
      throw new NotFoundException(`Categoría de gasto con ID ${id} no encontrada`);
    }

    return categoria;
  }

  // ==========================================
  // GASTOS
  // ==========================================

  async createGasto(data: CreateGastoInput) {
    return this.prisma.gasto.create({
      data: {
        ...data,
        fecha: new Date(data.fecha),
      },
      include: {
        categoria: true,
        puntoVenta: true,
      },
    });
  }

  async getGastos(filter: FilterGastosInput) {
    const where: any = {};

    if (filter.puntoVentaId) {
      where.puntoVentaId = filter.puntoVentaId;
    }

    if (filter.categoriaGastoId) {
      where.categoriaGastoId = filter.categoriaGastoId;
    }

    if (filter.fechaInicio || filter.fechaFin) {
      where.fecha = {};
      if (filter.fechaInicio) {
        where.fecha.gte = new Date(filter.fechaInicio);
      }
      if (filter.fechaFin) {
        where.fecha.lte = new Date(filter.fechaFin);
      }
    }

    if (filter.aprobado !== undefined) {
      where.aprobado = filter.aprobado;
    }

    if (filter.proveedor) {
      where.proveedor = {
        contains: filter.proveedor,
        mode: 'insensitive',
      };
    }

    if (filter.empleado) {
      where.empleado = {
        contains: filter.empleado,
        mode: 'insensitive',
      };
    }

    return this.prisma.gasto.findMany({
      where,
      include: {
        categoria: true,
        puntoVenta: true,
        aprobador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async getGastoById(id: string) {
    const gasto = await this.prisma.gasto.findUnique({
      where: { id },
      include: {
        categoria: true,
        puntoVenta: true,
        aprobador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    if (!gasto) {
      throw new NotFoundException(`Gasto con ID ${id} no encontrado`);
    }

    return gasto;
  }

  async updateGasto(id: string, data: UpdateGastoInput) {
    await this.getGastoById(id); // Verificar que existe

    return this.prisma.gasto.update({
      where: { id },
      data: {
        ...data,
        fecha: data.fecha ? new Date(data.fecha) : undefined,
      },
      include: {
        categoria: true,
        puntoVenta: true,
      },
    });
  }

  async deleteGasto(id: string) {
    await this.getGastoById(id); // Verificar que existe

    return this.prisma.gasto.delete({
      where: { id },
    });
  }

  async aprobarGasto(id: string, userId: string) {
    await this.getGastoById(id); // Verificar que existe

    return this.prisma.gasto.update({
      where: { id },
      data: {
        aprobado: true,
        aprobadoPor: userId,
        fechaAprobacion: new Date(),
      },
      include: {
        categoria: true,
        puntoVenta: true,
      },
    });
  }

  // ==========================================
  // REPORTES Y BALANCE DE UTILIDADES
  // ==========================================

  async getResumenGastosPorCategoria(
    puntoVentaId: string,
    fechaInicio: string,
    fechaFin: string,
  ) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    const gastos = await this.prisma.gasto.groupBy({
      by: ['categoriaGastoId'],
      where: {
        puntoVentaId,
        fecha: { gte: inicio, lte: fin },
        aprobado: true,
      },
      _sum: {
        monto: true,
      },
      _count: true,
    });

    // Obtener nombres de categorías
    const categorias = await this.prisma.categoriaGasto.findMany({
      where: {
        id: { in: gastos.map((g) => g.categoriaGastoId) },
      },
    });

    const categoriaMap = new Map(categorias.map((c) => [c.id, c.nombre]));

    return gastos.map((g) => ({
      categoria: categoriaMap.get(g.categoriaGastoId) || 'Sin categoría',
      total: Number(g._sum.monto || 0),
      cantidad: g._count,
    }));
  }

  async getBalanceUtilidades(
    puntoVentaId: string,
    fechaInicio: string,
    fechaFin: string,
  ) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    // Obtener ventas totales del historial de ventas de productos
    const ventas = await this.prisma.historialVentasProductos.aggregate({
      where: {
        puntoVentaId,
        fechaVenta: { gte: inicio, lte: fin },
      },
      _sum: {
        valorTotal: true,
      },
    });

    const ventasTotales = Number(ventas._sum.valorTotal || 0);

    // Calcular costo de mercancía vendida
    const ventasConCosto = await this.prisma.historialVentasProductos.findMany({
      where: {
        puntoVentaId,
        fechaVenta: { gte: inicio, lte: fin },
      },
      include: {
        producto: {
          select: {
            precioCompra: true,
          },
        },
      },
    });

    const costoMercancia = ventasConCosto.reduce((sum, venta) => {
      const costoUnitario = Number(venta.producto.precioCompra);
      const cantidad = venta.cantidadVendida;
      return sum + (costoUnitario * cantidad);
    }, 0);

    const utilidadBruta = ventasTotales - costoMercancia;

    // Obtener gastos por categoría
    const detalleGastos = await this.getResumenGastosPorCategoria(
      puntoVentaId,
      fechaInicio,
      fechaFin,
    );

    const gastosNomina = detalleGastos
      .filter((g) => g.categoria.toLowerCase().includes('nómina') || 
                     g.categoria.toLowerCase().includes('nomina') ||
                     g.categoria.toLowerCase().includes('seguridad social'))
      .reduce((sum, g) => sum + g.total, 0);

    const gastosProveedores = detalleGastos
      .filter((g) => g.categoria.toLowerCase().includes('proveedor'))
      .reduce((sum, g) => sum + g.total, 0);

    const gastosOperacionales = detalleGastos
      .filter((g) => !g.categoria.toLowerCase().includes('nómina') && 
                     !g.categoria.toLowerCase().includes('nomina') &&
                     !g.categoria.toLowerCase().includes('seguridad social') &&
                     !g.categoria.toLowerCase().includes('proveedor'))
      .reduce((sum, g) => sum + g.total, 0);

    const totalGastos = gastosOperacionales + gastosNomina + gastosProveedores;
    const utilidadNeta = utilidadBruta - totalGastos;
    const margenUtilidad = ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0;

    return {
      ventasTotales,
      costoMercancia,
      utilidadBruta,
      gastosOperacionales,
      gastosNomina,
      gastosProveedores,
      otrosGastos: 0,
      totalGastos,
      utilidadNeta,
      margenUtilidad,
      detalleGastos,
    };
  }

  // ==========================================
  // ESTADÍSTICAS
  // ==========================================

  async getEstadisticasGastos(puntoVentaId: string, anio: number, mes?: number) {
    const where: any = {
      puntoVentaId,
      aprobado: true,
    };

    // Filtrar por año y mes
    const fechaInicio = mes 
      ? new Date(anio, mes - 1, 1) 
      : new Date(anio, 0, 1);
    
    const fechaFin = mes 
      ? new Date(anio, mes, 0, 23, 59, 59) 
      : new Date(anio, 11, 31, 23, 59, 59);

    where.fecha = {
      gte: fechaInicio,
      lte: fechaFin,
    };

    const [totalGastos, gastosPorCategoria] = await Promise.all([
      this.prisma.gasto.aggregate({
        where,
        _sum: { monto: true },
        _count: true,
      }),
      this.prisma.gasto.groupBy({
        by: ['categoriaGastoId'],
        where,
        _sum: { monto: true },
        _count: true,
      }),
    ]);

    return {
      totalMonto: Number(totalGastos._sum.monto || 0),
      totalRegistros: totalGastos._count,
      gastosPorCategoria,
    };
  }
}

