import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { LecturaMangueraDetails } from '../entities/lectura-manguera-details.entity';
import { HistorialLectura } from '../entities/historial-lectura.entity';
import { AuditoriaTurnoService, TipoModificacionTurno } from '../../shifts/services/auditoria-turno.service';

@Injectable()
export class LecturaMangueraUpdateService {
  private readonly ROUND_FACTOR = 100;
  private readonly PRECISION_TOLERANCE = 0.01;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuditoriaTurnoService))
    private auditoriaService: AuditoriaTurnoService
  ) {}

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
   * @param actualizarMetodosPagoAutomaticamente - Si es true, actualiza métodos de pago automáticamente.
   * Si es false, solo actualiza la lectura sin modificar métodos de pago (para asignación manual desde frontend).
   */
  async updateHistorialLectura(
    id: string,
    cantidadVendida: number,
    usuarioId?: string,
    actualizarMetodosPagoAutomaticamente: boolean = true
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

      // 2. Actualizar lecturaActual en la tabla mangueras
      // Verificar si este historial es el más reciente para esta manguera
      // Solo actualizamos la manguera si este es el historial más reciente
      const historialMasReciente = await prisma.historialLectura.findFirst({
        where: { mangueraId: lectura.mangueraId },
        orderBy: { fechaLectura: 'desc' },
        select: { id: true, fechaLectura: true }
      });

      if (historialMasReciente && 
          (historialMasReciente.id === id || 
           historialMasReciente.fechaLectura.getTime() === lectura.fechaLectura.getTime())) {
        await prisma.mangueraSurtidor.update({
          where: { id: lectura.mangueraId },
          data: { lecturaActual: nuevaLecturaActual }
        });
      }

      // 3. Actualizar historialVentasProductos relacionados
      await this.updateVentasProductosRelacionadas(
        prisma,
        lectura,
        cierreTurno.turnoId,
        cantidadVendida,
        nuevoValorVenta,
        diferenciaCantidad,
        diferenciaValor
      );

      // 4. Recalcular métodos de pago (solo si está habilitado)
      if (actualizarMetodosPagoAutomaticamente) {
        await this.recalcularMetodosPago(prisma, cierreTurnoId, diferenciaValor);
      }

      // 5. Actualizar totales del cierre
      await this.actualizarTotalesCierre(prisma, cierreTurnoId);

      // 6. Actualizar resumenSurtidores (JSON)
      await this.actualizarResumenSurtidores(
        prisma,
        cierreTurnoId,
        lectura,
        cantidadVendida,
        nuevoValorVenta
      );

      // 7. Actualizar caja si aplica
      if (Math.abs(diferenciaValor) > this.PRECISION_TOLERANCE) {
        await this.actualizarCaja(prisma, cierreTurno, diferenciaValor);
      }

      // 8. Actualizar lecturaAnterior y lecturaActual del siguiente turno (SIEMPRE, independientemente de flags)
      // Necesitamos pasar la lectura anterior original para calcular el delta
      await this.actualizarLecturaAnteriorSiguienteTurno(
        prisma,
        cierreTurno,
        lectura.mangueraId,
        lecturaAnterior, // lectura anterior original
        nuevaLecturaActual // nueva lectura actual
      );

      // 9. Actualizar lecturaActual de la manguera con la lectura del último turno cerrado
      // Esto es necesario porque si se actualiza un turno anterior, la cascada puede cambiar
      // el último turno cerrado, y la manguera debe reflejar siempre la lectura del último turno cerrado
      await this.actualizarLecturaActualManguera(
        prisma,
        lectura.mangueraId,
        cierreTurno.turno.puntoVentaId
      );

      // 10. Registrar cambio en auditoría si hay usuarioId
      if (usuarioId && cierreTurno.turnoId) {
        const datosAnteriores = {
          lecturaAnterior: lecturaAnterior,
          lecturaActual: Number(lectura.lecturaActual),
          cantidadVendida: cantidadAnterior,
          valorVenta: valorVentaAnterior,
          manguera: {
            numero: lectura.manguera.numero,
            producto: {
              id: lectura.manguera.producto.id,
              codigo: lectura.manguera.producto.codigo,
              nombre: lectura.manguera.producto.nombre
            },
            surtidor: {
              numero: lectura.manguera.surtidor.numero,
              nombre: lectura.manguera.surtidor.nombre
            }
          }
        };

        const datosNuevos = {
          lecturaAnterior: lecturaAnterior,
          lecturaActual: nuevaLecturaActual,
          cantidadVendida: cantidadVendida,
          valorVenta: nuevoValorVenta,
          manguera: {
            numero: lectura.manguera.numero,
            producto: {
              id: lectura.manguera.producto.id,
              codigo: lectura.manguera.producto.codigo,
              nombre: lectura.manguera.producto.nombre
            },
            surtidor: {
              numero: lectura.manguera.surtidor.numero,
              nombre: lectura.manguera.surtidor.nombre
            }
          }
        };

        const descripcion = `Actualización de lectura de manguera ${lectura.manguera.numero} (${lectura.manguera.producto.nombre}): Cantidad ${cantidadAnterior} → ${cantidadVendida}, Valor $${valorVentaAnterior} → $${nuevoValorVenta}`;

        await this.auditoriaService.registrarCambio(
          cierreTurno.turnoId,
          usuarioId,
          TipoModificacionTurno.LECTURA_MANGUERA,
          datosAnteriores,
          datosNuevos,
          descripcion,
          prisma
        );
      }

      return this.mapToHistorialLectura(lecturaActualizada);
    });
  }

  private async updateVentasProductosRelacionadas(
    prisma: any,
    lectura: any,
    turnoId: string,
    nuevaCantidadVendida: number,
    nuevoValorVenta: number,
    diferenciaCantidad: number,
    diferenciaValor: number
  ): Promise<void> {
    if (!turnoId) return;

    const ventasRelacionadas = await prisma.historialVentasProductos.findMany({
      where: {
        productoId: lectura.manguera.productoId,
        turnoId: turnoId
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

  private async calcularTotalVentasTurno(prisma: any, cierreTurnoId: string, turnoId: string): Promise<number> {
    const totalVentasLecturas = await prisma.historialLectura.aggregate({
      where: {
        turnoId: cierreTurnoId
      },
      _sum: {
        valorVenta: true
      }
    });

    const totalVentasProductos = await prisma.historialVentasProductos.aggregate({
      where: {
        turnoId: turnoId
      },
      _sum: {
        valorTotal: true
      }
    });

    const sumaVentasLecturas = Number(totalVentasLecturas._sum.valorVenta || 0);
    const sumaVentasProductos = Number(totalVentasProductos._sum.valorTotal || 0);
    const totalVentasTurno = sumaVentasLecturas + sumaVentasProductos;

    return Math.max(0, totalVentasTurno);
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
      where: { cierreTurnoId },
      include: {
        metodoPagoRel: true
      }
    });

    if (metodosPago.length === 0) return;

    const cierreTurno = await prisma.cierreTurno.findUnique({
      where: { id: cierreTurnoId },
      include: {
        turno: true
      }
    });

    if (!cierreTurno) return;

    const totalVentasTurno = await this.calcularTotalVentasTurno(prisma, cierreTurnoId, cierreTurno.turnoId);
    const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
    const nuevoValorTotalGeneral = Math.max(0, valorTotalGeneralActual + diferenciaValor);

    const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

    await Promise.all(
      metodosPago.map(async (metodo: any) => {
        const montoActual = Number(metodo.monto);
        const porcentajeMp = totalVentasTurno > 0
          ? Math.round((montoActual / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
          : 0;

        const metodoStr = metodo.metodoPago?.toUpperCase() || '';
        const metodoLower = metodo.metodoPago?.toLowerCase() || '';

        if (metodoStr === 'EFECTIVO' || metodo.metodoPagoRel?.esEfectivo) {
          totales.efectivo += montoActual;
        } else if (metodoStr.includes('TARJETA') || metodoStr === 'TARJETA_CREDITO' || metodoStr === 'TARJETA_DEBITO' || metodo.metodoPagoRel?.esTarjeta) {
          totales.tarjetas += montoActual;
        } else if (metodoStr.includes('TRANSFERENCIA') || metodoStr === 'TRANSFERENCIA_BANCARIA' || metodo.metodoPagoRel?.esDigital) {
          totales.transferencias += montoActual;
        } else if (metodoStr === 'RUMBO' || metodoLower === 'rumbo') {
          totales.rumbo += montoActual;
        } else if (metodoStr === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
          totales.bonosViveTerpel += montoActual;
        } else {
          totales.otros += montoActual;
        }

        return prisma.cierreTurnoMetodoPago.update({
          where: { id: metodo.id },
          data: {
            porcentaje: porcentajeMp
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
   * Actualizar lecturaAnterior y lecturaActual del siguiente turno en cascada completa
   * Esta función se ejecuta SIEMPRE cuando se actualiza una lectura
   * para mantener la integridad de datos entre turnos.
   * 
   * Propaga los cambios a TODOS los turnos siguientes de forma recursiva.
   * 
   * Lógica CRÍTICA:
   * 1. La cantidadVendida de cada turno debe mantenerse FIJA (no se modifica)
   * 2. Actualiza lecturaAnterior del siguiente turno con la lecturaActual del turno anterior
   * 3. Recalcula lecturaActual = lecturaAnterior + cantidadVendida (usando cantidadVendida original)
   * 4. Recalcula valorVenta con la cantidadVendida original
   * 5. Repite el proceso para el siguiente turno (cascada completa)
   * 
   * IMPORTANTE: La cantidadVendida representa lo vendido en ese turno y NO debe cambiar
   * por actualizaciones de turnos anteriores.
   */
  private async actualizarLecturaAnteriorSiguienteTurno(
    prisma: any,
    cierreTurnoActual: any,
    mangueraId: string,
    lecturaAnteriorOriginal: number,
    nuevaLecturaActual: number
  ): Promise<void> {
    try {

      // Iniciar la cascada: comenzar con el turno actual
      let turnoActual = cierreTurnoActual.turno;
      let lecturaActualDelTurnoAnterior = nuevaLecturaActual;
      
      let turnosActualizados = 0;
      const MAX_TURNOS = 1000; // Límite de seguridad para evitar loops infinitos

      // Iterar hasta que no haya más turnos siguientes
      while (turnosActualizados < MAX_TURNOS) {
        if (!turnoActual) {
          break;
        }

        const puntoVentaId = turnoActual.puntoVentaId;
        const fechaInicioActual = turnoActual.fechaInicio;
        const horaInicioActual = turnoActual.horaInicio;

        // Normalizar fechaInicio para comparación (solo la fecha sin hora)
        const fechaInicioSolo = new Date(fechaInicioActual);
        fechaInicioSolo.setUTCHours(0, 0, 0, 0);
        const fechaInicioFin = new Date(fechaInicioActual);
        fechaInicioFin.setUTCHours(23, 59, 59, 999);

        // Buscar el siguiente turno:
        // - Mismo puntoVentaId
        // - Fecha/hora de inicio posterior al turno actual
        const turnosSiguientes = await prisma.turno.findMany({
          where: {
            puntoVentaId: puntoVentaId,
            OR: [
              {
                // Turno en fecha posterior (después del día actual)
                fechaInicio: {
                  gt: fechaInicioFin
                }
              },
              {
                // Turno en misma fecha pero hora posterior
                AND: [
                  {
                    fechaInicio: {
                      gte: fechaInicioSolo,
                      lte: fechaInicioFin
                    }
                  },
                  {
                    horaInicio: {
                      gt: horaInicioActual
                    }
                  }
                ]
              }
            ]
          },
          orderBy: [
            { fechaInicio: 'asc' },
            { horaInicio: 'asc' }
          ],
          take: 1, // Solo el siguiente turno inmediato
          include: {
            cierres: {
              take: 1,
              orderBy: {
                fechaCierre: 'desc'
              }
            }
          }
        });

        if (turnosSiguientes.length === 0) {
          // No hay más turnos siguientes, terminamos la cascada
          if (turnosActualizados === 0) {
            console.log('[LECTURA_UPDATE] No se encontró siguiente turno para actualizar lecturaAnterior');
          } else {
            console.log(`[LECTURA_UPDATE] Cascada completada. Total de turnos actualizados: ${turnosActualizados}`);
          }
          break;
        }

        const siguienteTurno = turnosSiguientes[0];
        
        if (!siguienteTurno.cierres || siguienteTurno.cierres.length === 0) {
          // El siguiente turno aún no tiene cierre, no hay lectura que actualizar
          // Pero seguimos buscando más turnos siguientes por si acaso
          console.log(`[LECTURA_UPDATE] Turno siguiente (ID: ${siguienteTurno.id}) no tiene cierre aún, continuando con siguiente turno`);
          turnoActual = siguienteTurno;
          continue;
        }

        const siguienteCierreTurno = siguienteTurno.cierres[0];

        // Buscar la lectura de la misma manguera en el siguiente turno
        const lecturaSiguienteTurno = await prisma.historialLectura.findFirst({
          where: {
            turnoId: siguienteCierreTurno.id,
            mangueraId: mangueraId
          },
          include: {
            manguera: {
              include: {
                producto: true
              }
            }
          }
        });

        if (!lecturaSiguienteTurno) {
          // No hay lectura de esta manguera en el siguiente turno
          // Continuamos con el siguiente turno
          console.log(`[LECTURA_UPDATE] No se encontró lectura de la manguera en el siguiente turno (CierreTurno ID: ${siguienteCierreTurno.id}), continuando`);
          turnoActual = siguienteTurno;
          continue;
        }

        // Obtener valores actuales del siguiente turno
        // CRÍTICO: La cantidadVendida debe mantenerse FIJA
        const cantidadVendidaSiguiente = Number(lecturaSiguienteTurno.cantidadVendida);

        // Actualizar lecturaAnterior del siguiente turno con la lecturaActual del turno anterior
        const nuevaLecturaAnteriorSiguiente = lecturaActualDelTurnoAnterior;

        // Recalcular lecturaActual basándose en la cantidadVendida ORIGINAL (que se mantiene fija)
        // lecturaActual = lecturaAnterior + cantidadVendida
        const nuevaLecturaActualSiguiente = nuevaLecturaAnteriorSiguiente + cantidadVendidaSiguiente;

        // Validar que nueva lecturaAnterior <= nueva lecturaActual
        if (nuevaLecturaAnteriorSiguiente > nuevaLecturaActualSiguiente) {
          console.error(
            `[LECTURA_UPDATE] Error: La nueva lecturaAnterior (${nuevaLecturaAnteriorSiguiente}) ` +
            `es mayor que la nueva lecturaActual (${nuevaLecturaActualSiguiente}) en turno ` +
            `(CierreTurno ID: ${siguienteCierreTurno.id}). Deteniendo cascada.`
          );
          break;
        }

        // La cantidadVendida se mantiene FIJA (no se modifica)
        const nuevaCantidadVendidaSiguiente = cantidadVendidaSiguiente;

        // Recalcular valorVenta con el precio actual del producto y la cantidadVendida ORIGINAL
        const precioUnitario = Number(lecturaSiguienteTurno.manguera.producto.precioVenta);
        const nuevoValorVentaSiguiente = Math.round(cantidadVendidaSiguiente * precioUnitario * this.ROUND_FACTOR) / this.ROUND_FACTOR;

        // Actualizar lecturaAnterior y lecturaActual del siguiente turno
        // cantidadVendida se mantiene FIJA (no se modifica)
        await prisma.historialLectura.update({
          where: { id: lecturaSiguienteTurno.id },
          data: {
            lecturaAnterior: nuevaLecturaAnteriorSiguiente,
            lecturaActual: nuevaLecturaActualSiguiente,
            cantidadVendida: cantidadVendidaSiguiente, // Se mantiene fija
            valorVenta: nuevoValorVentaSiguiente,
            observaciones: lecturaSiguienteTurno.observaciones
              ? `${lecturaSiguienteTurno.observaciones} | lecturaAnterior y lecturaActual actualizadas automáticamente (cascada): ${new Date().toISOString()}`
              : `lecturaAnterior y lecturaActual actualizadas automáticamente (cascada): ${new Date().toISOString()}`
          }
        });

        turnosActualizados++;
        console.log(
          `[LECTURA_UPDATE] [Cascada ${turnosActualizados}] Actualizada lecturaAnterior (${nuevaLecturaAnteriorSiguiente}) ` +
          `y lecturaActual (${nuevaLecturaActualSiguiente}) del turno siguiente ` +
          `(CierreTurno ID: ${siguienteCierreTurno.id}, Lectura ID: ${lecturaSiguienteTurno.id}). ` +
          `cantidadVendida mantenida fija: ${cantidadVendidaSiguiente}`
        );

        // Preparar para la siguiente iteración: el turno recién actualizado se convierte en el "actual"
        turnoActual = siguienteTurno;
        lecturaActualDelTurnoAnterior = nuevaLecturaActualSiguiente;
      }

      if (turnosActualizados >= MAX_TURNOS) {
        console.error(
          `[LECTURA_UPDATE] Advertencia: Se alcanzó el límite de ${MAX_TURNOS} turnos en la cascada. ` +
          `Esto puede indicar un loop infinito o una cadena muy larga de turnos.`
        );
      }

      if (turnosActualizados > 0) {
        console.log(
          `[LECTURA_UPDATE] Cascada completa finalizada. Total de turnos actualizados: ${turnosActualizados}. ` +
          `cantidadVendida se mantuvo fija en todos los turnos.`
        );
      }
    } catch (error) {
      // No queremos que un error en esta operación falle toda la transacción
      // Solo registramos el error para diagnóstico
      console.error('[LECTURA_UPDATE] Error al actualizar lecturaAnterior y lecturaActual en cascada:', error);
    }
  }

  /**
   * Actualizar lecturaActual de la manguera con la lectura del último turno cerrado
   * Esto asegura que la manguera siempre refleje la lectura del último turno cerrado,
   * independientemente de si se actualiza directamente el último turno o un turno anterior
   * que afecta al último turno en cascada.
   */
  private async actualizarLecturaActualManguera(
    prisma: any,
    mangueraId: string,
    puntoVentaId: string
  ): Promise<void> {
    try {
      // Buscar el último historial de lectura cerrado (con turnoId/CierreTurno) de esta manguera
      // Ordenar por fechaLectura descendente para obtener el más reciente
      const ultimoHistorialCerrado = await prisma.historialLectura.findFirst({
        where: {
          mangueraId: mangueraId,
          turnoId: { not: null } // Solo turnos cerrados (que tienen CierreTurno)
        },
        orderBy: {
          fechaLectura: 'desc'
        },
        select: {
          id: true,
          lecturaActual: true,
          fechaLectura: true,
          turnoId: true
        }
      });

      if (!ultimoHistorialCerrado) {
        // No hay turnos cerrados para esta manguera, no hay nada que actualizar
        console.log(
          `[LECTURA_UPDATE] No se encontró último turno cerrado para la manguera ${mangueraId}. ` +
          `No se actualizará la lecturaActual de la manguera.`
        );
        return;
      }

      const lecturaActualDelUltimoTurno = Number(ultimoHistorialCerrado.lecturaActual);

      // Actualizar la lecturaActual de la manguera
      await prisma.mangueraSurtidor.update({
        where: { id: mangueraId },
        data: {
          lecturaActual: lecturaActualDelUltimoTurno
        }
      });

      console.log(
        `[LECTURA_UPDATE] Actualizada lecturaActual de la manguera ${mangueraId} ` +
        `a ${lecturaActualDelUltimoTurno} (del último turno cerrado - Historial ID: ${ultimoHistorialCerrado.id}, ` +
        `CierreTurno ID: ${ultimoHistorialCerrado.turnoId})`
      );
    } catch (error) {
      // No queremos que un error en esta operación falle toda la transacción
      // Solo registramos el error para diagnóstico
      console.error(
        `[LECTURA_UPDATE] Error al actualizar lecturaActual de la manguera ${mangueraId}:`,
        error
      );
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

