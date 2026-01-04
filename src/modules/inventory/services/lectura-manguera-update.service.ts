import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { LecturaMangueraDetails } from '../entities/lectura-manguera-details.entity';
import { HistorialLectura } from '../entities/historial-lectura.entity';

@Injectable()
export class LecturaMangueraUpdateService {
  private readonly ROUND_FACTOR = 100;
  private readonly PRECISION_TOLERANCE = 0.01;

  constructor(private prisma: PrismaService) {}

  /**
   * Get complete details of a hose reading
   */
  async getLecturaMangueraDetails(lecturaId: string): Promise<LecturaMangueraDetails> {
    const lectura = await this.prisma.historialLectura.findUnique({
      where: { id: lecturaId },
      include: {
        manguera: {
          include: {
            producto: true,
            surtidor: {
              include: {
                puntoVenta: true
              }
            }
          }
        }
      }
    });

    if (!lectura) {
      throw new NotFoundException(`Reading with ID ${lecturaId} not found`);
    }

    // NOTE: In this system, turnoId in HistorialLectura contains the CierreTurno ID (not Turno ID)
    // This is consistent with existing code in products.service.ts line 1017
    const cierreTurnoId = lectura.turnoId;

    if (!cierreTurnoId) {
      throw new BadRequestException('The reading is not associated with a shift closure');
    }

    return {
      id: lectura.id,
      lecturaAnterior: Number(lectura.lecturaAnterior),
      lecturaActual: Number(lectura.lecturaActual),
      cantidadVendida: Number(lectura.cantidadVendida),
      valorVenta: Number(lectura.valorVenta),
      manguera: {
        id: lectura.manguera.id,
        numero: lectura.manguera.numero,
        producto: {
          id: lectura.manguera.producto.id,
          codigo: lectura.manguera.producto.codigo,
          nombre: lectura.manguera.producto.nombre,
          precioVenta: Number(lectura.manguera.producto.precioVenta),
          unidadMedida: lectura.manguera.producto.unidadMedida
        },
        surtidor: {
          id: lectura.manguera.surtidor.id,
          numero: lectura.manguera.surtidor.numero,
          nombre: lectura.manguera.surtidor.nombre || undefined
        }
      },
      cierreTurnoId
    };
  }

  /**
   * Update hose reading with cascade updates
   */
  async updateHistorialLectura(
    id: string,
    cantidadVendida: number,
    usuarioId?: string
  ): Promise<HistorialLectura> {
    // Initial validations
    if (cantidadVendida <= 0) {
      throw new BadRequestException('Sold quantity must be greater than 0');
    }

    // Get reading with all its relations
    const lectura = await this.prisma.historialLectura.findUnique({
      where: { id },
      include: {
        manguera: {
          include: {
            producto: true,
            surtidor: {
              include: {
                puntoVenta: true
              }
            }
          }
        },
        usuario: true
      }
    });

    if (!lectura) {
      throw new NotFoundException(`Reading with ID ${id} not found`);
    }

    // NOTE: In this system, turnoId in HistorialLectura contains the CierreTurno ID (not Turno ID)
    const cierreTurnoId = lectura.turnoId;

    if (!cierreTurnoId) {
      throw new BadRequestException('The reading is not associated with a valid shift closure');
    }

    // Get shift closure directly
    const cierreTurno = await this.prisma.cierreTurno.findUnique({
      where: { id: cierreTurnoId },
      include: {
        metodosPago: true,
        turno: {
          include: {
            puntoVenta: true
          }
        }
      }
    });

    if (!cierreTurno) {
      throw new BadRequestException(`Cierre de turno con ID ${cierreTurnoId} no encontrado`);
    }

    // Validar que el cierre no esté bloqueado
    if (cierreTurno.estado === 'bloqueado' || cierreTurno.estado === 'finalizado') {
      throw new ForbiddenException('No se puede editar un cierre de turno bloqueado o finalizado');
    }

    // Calcular nuevos valores
    const lecturaAnterior = Number(lectura.lecturaAnterior);
    const nuevaLecturaActual = lecturaAnterior + cantidadVendida;
    const precioUnitario = Number(lectura.manguera.producto.precioVenta);
    const nuevoValorVenta = Math.round(cantidadVendida * precioUnitario * this.ROUND_FACTOR) / this.ROUND_FACTOR;

    // Validar que lecturaActual >= lecturaAnterior
    if (nuevaLecturaActual < lecturaAnterior) {
      throw new BadRequestException('La lectura actual no puede ser menor a la lectura anterior');
    }

    // Calcular diferencias
    const cantidadAnterior = Number(lectura.cantidadVendida);
    const valorVentaAnterior = Number(lectura.valorVenta);
    const diferenciaCantidad = cantidadVendida - cantidadAnterior;
    const diferenciaValor = nuevoValorVenta - valorVentaAnterior;

    // Ejecutar actualización en transacción
    return await this.prisma.$transaction(async (prisma) => {
      // 1. Actualizar historialLecturas
      const lecturaActualizada = await prisma.historialLectura.update({
        where: { id },
        data: {
          lecturaActual: nuevaLecturaActual,
          cantidadVendida: cantidadVendida,
          valorVenta: nuevoValorVenta,
          observaciones: lectura.observaciones 
            ? `${lectura.observaciones} | Actualizado: ${new Date().toISOString()}`
            : `Actualizado: ${new Date().toISOString()}`
        },
        include: {
          manguera: {
            include: {
              producto: true,
              surtidor: true
            }
          },
          usuario: true
        }
      });

      // 2. Actualizar historialVentasProductos relacionados
      await this.updateVentasProductosRelacionadas(
        prisma,
        lectura,
        cantidadVendida,
        nuevoValorVenta,
        diferenciaCantidad,
        diferenciaValor
      );

      // 3. Recalcular métodos de pago
      await this.recalcularMetodosPago(prisma, cierreTurnoId, diferenciaValor);

      // 4. Actualizar totales del cierre
      await this.actualizarTotalesCierre(prisma, cierreTurnoId);

      // 5. Actualizar resumenSurtidores (JSON)
      await this.actualizarResumenSurtidores(
        prisma,
        cierreTurnoId,
        lectura,
        cantidadVendida,
        nuevoValorVenta
      );

      // 6. Actualizar caja si aplica
      if (Math.abs(diferenciaValor) > this.PRECISION_TOLERANCE) {
        await this.actualizarCaja(prisma, cierreTurno, diferenciaValor);
      }

      return this.mapToHistorialLectura(lecturaActualizada);
    });
  }

  /**
   * Actualizar ventas de productos relacionadas
   */
  private async updateVentasProductosRelacionadas(
    prisma: any,
    lectura: any,
    nuevaCantidadVendida: number,
    nuevoValorVenta: number,
    diferenciaCantidad: number,
    diferenciaValor: number
  ): Promise<void> {
    if (!lectura.turnoId) return;

    // Buscar ventas relacionadas del mismo producto y turno
    const ventasRelacionadas = await prisma.historialVentasProductos.findMany({
      where: {
        productoId: lectura.manguera.productoId,
        turnoId: lectura.turnoId
      },
      orderBy: {
        fechaVenta: 'desc'
      }
    });

    if (ventasRelacionadas.length === 0) return;

    // Actualizar la venta más reciente o la que tenga el mismo método de pago
    // Estrategia: Actualizar la más reciente
    const ventaMasReciente = ventasRelacionadas[0];
    const cantidadActual = Number(ventaMasReciente.cantidadVendida);
    const valorTotalActual = Number(ventaMasReciente.valorTotal);

    // Si hay diferencia, actualizar proporcionalmente o ajustar la venta más reciente
    // Opción: Ajustar solo la venta más reciente
    const nuevaCantidadVenta = Math.max(0, cantidadActual + diferenciaCantidad);
    const nuevoValorTotalVenta = Math.max(0, valorTotalActual + diferenciaValor);

    if (nuevaCantidadVenta > 0 && nuevoValorTotalVenta > 0) {
      await prisma.historialVentasProductos.update({
        where: { id: ventaMasReciente.id },
        data: {
          cantidadVendida: nuevaCantidadVenta,
          valorTotal: nuevoValorTotalVenta
        }
      });
    }
  }

  /**
   * Recalcular métodos de pago del cierre
   */
  private async recalcularMetodosPago(
    prisma: any,
    cierreTurnoId: string,
    diferenciaValor: number
  ): Promise<void> {
    if (Math.abs(diferenciaValor) < this.PRECISION_TOLERANCE) return;

    const metodosPago = await prisma.cierreTurnoMetodoPago.findMany({
      where: { cierreTurnoId }
    });

    if (metodosPago.length === 0) return;

    const cierreTurno = await prisma.cierreTurno.findUnique({
      where: { id: cierreTurnoId }
    });

    const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
    const nuevoValorTotalGeneral = Math.max(0, valorTotalGeneralActual + diferenciaValor);

    // Estrategia: Redistribuir proporcionalmente basado en los porcentajes actuales
    // Si hay un método de pago asociado a la venta, actualizar ese específicamente
    // Por ahora, redistribuimos proporcionalmente

    const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

    await Promise.all(
      metodosPago.map(async (metodo: any) => {
        const montoActual = Number(metodo.monto);
        // Mantener el porcentaje y ajustar el monto proporcionalmente
        const porcentajeActual = Number(metodo.porcentaje);
        const nuevoMonto = nuevoValorTotalGeneral > 0
          ? Math.round((nuevoValorTotalGeneral * porcentajeActual / 100) * this.ROUND_FACTOR) / this.ROUND_FACTOR
          : montoActual;

        const metodoStr = metodo.metodoPago?.toUpperCase() || '';
        const metodoLower = metodo.metodoPago?.toLowerCase() || '';

        if (metodoStr === 'EFECTIVO') {
          totales.efectivo += nuevoMonto;
        } else if (metodoStr.includes('TARJETA') || metodoStr === 'TARJETA_CREDITO' || metodoStr === 'TARJETA_DEBITO') {
          totales.tarjetas += nuevoMonto;
        } else if (metodoStr.includes('TRANSFERENCIA') || metodoStr === 'TRANSFERENCIA_BANCARIA') {
          totales.transferencias += nuevoMonto;
        } else if (metodoStr === 'RUMBO' || metodoLower === 'rumbo') {
          totales.rumbo += nuevoMonto;
        } else if (metodoStr === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
          totales.bonosViveTerpel += nuevoMonto;
        } else {
          totales.otros += nuevoMonto;
        }

        return prisma.cierreTurnoMetodoPago.update({
          where: { id: metodo.id },
          data: {
            monto: nuevoMonto,
            porcentaje: nuevoValorTotalGeneral > 0
              ? Math.round((nuevoMonto / nuevoValorTotalGeneral) * 100 * this.ROUND_FACTOR) / this.ROUND_FACTOR
              : porcentajeActual
          }
        });
      })
    );

    await prisma.cierreTurno.update({
      where: { id: cierreTurnoId },
      data: {
        totalEfectivo: Math.round(totales.efectivo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalTarjetas: Math.round(totales.tarjetas * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalTransferencias: Math.round(totales.transferencias * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalRumbo: Math.round(totales.rumbo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalBonosViveTerpel: Math.round(totales.bonosViveTerpel * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalOtros: Math.round(totales.otros * this.ROUND_FACTOR) / this.ROUND_FACTOR
      }
    });
  }

  /**
   * Actualizar totales del cierre de turno
   */
  private async actualizarTotalesCierre(prisma: any, cierreTurnoId: string): Promise<void> {
    // Obtener todas las lecturas del cierre
    const cierreTurno = await prisma.cierreTurno.findUnique({
      where: { id: cierreTurnoId },
      include: {
        turno: true
      }
    });

    if (!cierreTurno) return;

    // NOTA: turnoId en HistorialLectura contiene el ID del CierreTurno
    // Obtener todas las lecturas del cierre
    const lecturas = await prisma.historialLectura.findMany({
      where: { turnoId: cierreTurnoId },
      include: {
        manguera: {
          include: {
            producto: true
          }
        }
      }
    });

    // Calcular totales
    let totalVentasLitros = 0;
    let totalVentasGalones = 0;
    let valorTotalGeneral = 0;

    const LITROS_TO_GALONES = 0.264172;

    for (const lectura of lecturas) {
      const cantidad = Number(lectura.cantidadVendida);
      const valor = Number(lectura.valorVenta);
      const unidadMedida = lectura.manguera.producto.unidadMedida?.toLowerCase() || 'litros';

      if (unidadMedida === 'litros' || unidadMedida === 'l') {
        totalVentasLitros += cantidad;
        totalVentasGalones += cantidad * LITROS_TO_GALONES;
      } else if (unidadMedida === 'galones' || unidadMedida === 'gal') {
        totalVentasGalones += cantidad;
        totalVentasLitros += cantidad / LITROS_TO_GALONES;
      }

      valorTotalGeneral += valor;
    }

    // Obtener ventas de productos del turno (usando el turnoId del cierre)
    const ventasProductos = await prisma.historialVentasProductos.findMany({
      where: { turnoId: cierreTurno.turnoId }
    });

    for (const venta of ventasProductos) {
      valorTotalGeneral += Number(venta.valorTotal);
    }

    await prisma.cierreTurno.update({
      where: { id: cierreTurnoId },
      data: {
        totalVentasLitros: Math.round(totalVentasLitros * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        totalVentasGalones: Math.round(totalVentasGalones * this.ROUND_FACTOR) / this.ROUND_FACTOR,
        valorTotalGeneral: Math.round(valorTotalGeneral * this.ROUND_FACTOR) / this.ROUND_FACTOR
      }
    });
  }

  /**
   * Actualizar resumen de surtidores (JSON)
   */
  private async actualizarResumenSurtidores(
    prisma: any,
    cierreTurnoId: string,
    lectura: any,
    nuevaCantidadVendida: number,
    nuevoValorVenta: number
  ): Promise<void> {
    const cierreTurno = await prisma.cierreTurno.findUnique({
      where: { id: cierreTurnoId }
    });

    if (!cierreTurno) return;

    let resumenSurtidores: any = {};
    try {
      resumenSurtidores = typeof cierreTurno.resumenSurtidores === 'string'
        ? JSON.parse(cierreTurno.resumenSurtidores)
        : cierreTurno.resumenSurtidores;
    } catch (error) {
      console.warn('[LECTURA_UPDATE] Error parseando resumenSurtidores, creando nuevo resumen');
      resumenSurtidores = { resumenSurtidores: [], totalesGenerales: {} };
    }

    // Buscar el surtidor en el resumen
    const numeroSurtidor = lectura.manguera.surtidor.numero;
    const codigoProducto = lectura.manguera.producto.codigo;

    if (!resumenSurtidores.resumenSurtidores) {
      resumenSurtidores.resumenSurtidores = [];
    }

    let surtidorResumen = resumenSurtidores.resumenSurtidores.find(
      (s: any) => s.numeroSurtidor === numeroSurtidor
    );

    if (!surtidorResumen) {
      surtidorResumen = {
        numeroSurtidor,
        nombreSurtidor: lectura.manguera.surtidor.nombre || `Surtidor ${numeroSurtidor}`,
        totalVentasGalones: 0,
        valorTotalSurtidor: 0,
        ventas: []
      };
      resumenSurtidores.resumenSurtidores.push(surtidorResumen);
    }

    // Buscar o crear venta del producto
    let ventaProducto = surtidorResumen.ventas?.find(
      (v: any) => v.codigoProducto === codigoProducto
    );

    if (!ventaProducto) {
      ventaProducto = {
        codigoProducto,
        nombreProducto: lectura.manguera.producto.nombre,
        cantidadVendidaGalones: 0,
        valorTotalVenta: 0
      };
      if (!surtidorResumen.ventas) {
        surtidorResumen.ventas = [];
      }
      surtidorResumen.ventas.push(ventaProducto);
    }

    // Actualizar valores
    const unidadMedida = lectura.manguera.producto.unidadMedida?.toLowerCase() || 'litros';
    const LITROS_TO_GALONES = 0.264172;

    if (unidadMedida === 'litros' || unidadMedida === 'l') {
      ventaProducto.cantidadVendidaGalones = nuevaCantidadVendida * LITROS_TO_GALONES;
    } else {
      ventaProducto.cantidadVendidaGalones = nuevaCantidadVendida;
    }

    ventaProducto.valorTotalVenta = nuevoValorVenta;

    // Recalcular totales del surtidor
    surtidorResumen.totalVentasGalones = surtidorResumen.ventas.reduce(
      (sum: number, v: any) => sum + (v.cantidadVendidaGalones || 0),
      0
    );
    surtidorResumen.valorTotalSurtidor = surtidorResumen.ventas.reduce(
      (sum: number, v: any) => sum + (v.valorTotalVenta || 0),
      0
    );

    // Recalcular totales generales
    if (!resumenSurtidores.totalesGenerales) {
      resumenSurtidores.totalesGenerales = {};
    }

    resumenSurtidores.totalesGenerales.totalGalones = resumenSurtidores.resumenSurtidores.reduce(
      (sum: number, s: any) => sum + (s.totalVentasGalones || 0),
      0
    );
    resumenSurtidores.totalesGenerales.totalValor = resumenSurtidores.resumenSurtidores.reduce(
      (sum: number, s: any) => sum + (s.valorTotalSurtidor || 0),
      0
    );

    // Guardar JSON actualizado
    await prisma.cierreTurno.update({
      where: { id: cierreTurnoId },
      data: {
        resumenSurtidores: resumenSurtidores
      }
    });
  }

  /**
   * Actualizar caja si aplica
   */
  private async actualizarCaja(prisma: any, cierreTurno: any, diferenciaValor: number): Promise<void> {
    if (!cierreTurno.turno?.puntoVenta?.id) return;

    const puntoVentaId = cierreTurno.turno.puntoVenta.id;

    // Buscar movimientos de efectivo relacionados con ventas
    const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
      where: {
        cierreTurnoId: cierreTurno.id,
        tipo: 'INGRESO'
      }
    });

    const movimientoVentasEfectivo = movimientosEfectivo.find((mov: any) => {
      const concepto = mov.concepto?.toLowerCase() || '';
      return concepto.includes('venta') ||
        mov.detalle?.toLowerCase().includes('ventas') ||
        mov.observaciones?.toLowerCase().includes('ventas en efectivo') ||
        mov.concepto === 'Venta en efectivo' ||
        mov.concepto === 'Ingreso por ventas en efectivo';
    });

    if (movimientoVentasEfectivo) {
      const montoActual = Number(movimientoVentasEfectivo.monto);
      const nuevoMonto = Math.max(0, montoActual + diferenciaValor);
      const diferenciaMovimiento = nuevoMonto - montoActual;

      await prisma.movimientoEfectivo.update({
        where: { id: movimientoVentasEfectivo.id },
        data: { monto: nuevoMonto }
      });

      if (Math.abs(diferenciaMovimiento) > this.PRECISION_TOLERANCE) {
        const cajaExistente = await prisma.caja.findUnique({
          where: { puntoVentaId }
        });

        const nuevoSaldo = cajaExistente
          ? Math.max(0, Number(cajaExistente.saldoActual) + diferenciaMovimiento)
          : Math.max(0, diferenciaMovimiento);

        if (cajaExistente) {
          await prisma.caja.update({
            where: { id: cajaExistente.id },
            data: {
              saldoActual: nuevoSaldo,
              fechaUltimoMovimiento: new Date()
            }
          });
        } else {
          await prisma.caja.create({
            data: {
              puntoVentaId,
              saldoActual: nuevoSaldo,
              saldoInicial: 0,
              activa: true,
              fechaUltimoMovimiento: new Date()
            }
          });
        }
      }
    }
  }

  /**
   * Mapear resultado de Prisma a HistorialLectura GraphQL
   */
  private mapToHistorialLectura(lectura: any): HistorialLectura {
    return {
      id: lectura.id,
      fechaLectura: lectura.fechaLectura,
      lecturaAnterior: Number(lectura.lecturaAnterior),
      lecturaActual: Number(lectura.lecturaActual),
      cantidadVendida: Number(lectura.cantidadVendida),
      valorVenta: Number(lectura.valorVenta),
      tipoOperacion: lectura.tipoOperacion,
      observaciones: lectura.observaciones,
      createdAt: lectura.createdAt,
      updatedAt: lectura.updatedAt,
      mangueraId: lectura.mangueraId,
      manguera: lectura.manguera,
      usuarioId: lectura.usuarioId,
      turnoId: lectura.turnoId,
      cierreTurnoId: lectura.cierreTurnoId || null
    };
  }
}

