import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { UpdateHistorialVentaProductoInput } from '../dto/registrar-venta-producto.input';
import { UpdateCierreTurnoMetodoPagoInput } from '../dto/update-cierre-turno-metodo-pago.input';
import { CreateCierreTurnoMetodoPagoInput } from '../dto/create-cierre-turno-metodo-pago.input';
import { UpdateMovimientoEfectivoInput } from '../dto/update-movimiento-efectivo.input';

@Injectable()
export class HistorialVentaUpdateService {
  private readonly PRECISION_TOLERANCE = 0.01;
  private readonly ROUND_FACTOR = 100;

  constructor(private prisma: PrismaService) {}

  private async calcularTotalVentasTurno(cierreTurnoId: string, turnoId: string): Promise<number> {
    const totalVentasLecturas = await this.prisma.historialLectura.aggregate({
      where: {
        turnoId: cierreTurnoId
      },
      _sum: {
        valorVenta: true
      }
    });

    const totalVentasProductos = await this.prisma.historialVentasProductos.aggregate({
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

  async updateHistorialVentaProducto(input: UpdateHistorialVentaProductoInput): Promise<any> {
    const registroExistente = await this.prisma.historialVentasProductos.findUnique({
      where: { id: input.id },
      include: {
        producto: true,
        metodoPago: true,
        turno: {
          include: {
            cierres: {
              take: 1,
              include: {
                metodosPago: true
              }
            }
          }
        }
      }
    });

    if (!registroExistente) {
      throw new NotFoundException(`Registro de venta de producto con ID ${input.id} no encontrado`);
    }

    if (!registroExistente.turno || !registroExistente.turno.cierres || registroExistente.turno.cierres.length === 0) {
      throw new BadRequestException(`El registro no pertenece a un turno con cierre asociado`);
    }

    const cierreTurno = registroExistente.turno.cierres[0];
    const cantidadAnterior = registroExistente.cantidadVendida;
    const valorTotalAnterior = registroExistente.valorTotal;
    
    let nuevaCantidad = cantidadAnterior;
    let nuevoPrecio = registroExistente.precioUnitario;

    if (input.cantidadVendida !== undefined) {
      if (input.cantidadVendida <= 0) {
        throw new BadRequestException('La cantidad vendida debe ser mayor a 0');
      }
      nuevaCantidad = input.cantidadVendida;
    }

    if (input.precioUnitario !== undefined) {
      if (input.precioUnitario <= 0) {
        throw new BadRequestException('El precio unitario debe ser mayor a 0');
      }
      nuevoPrecio = input.precioUnitario;
    }

    const nuevoValorTotal = Math.round((nuevaCantidad * nuevoPrecio) * this.ROUND_FACTOR) / this.ROUND_FACTOR;
    const diferenciaCantidad = nuevaCantidad - cantidadAnterior;
    const diferenciaValor = Math.round((nuevoValorTotal - valorTotalAnterior) * this.ROUND_FACTOR) / this.ROUND_FACTOR;

    if (diferenciaCantidad > 0 && Number(registroExistente.producto.stockActual) < diferenciaCantidad) {
      throw new BadRequestException(
        `Stock insuficiente. Stock disponible: ${registroExistente.producto.stockActual}, requerido: ${diferenciaCantidad}`
      );
    }

    return await this.prisma.$transaction(async (prisma) => {
      if (diferenciaCantidad !== 0) {
        const operation = diferenciaCantidad > 0 
          ? { decrement: diferenciaCantidad }
          : { increment: Math.abs(diferenciaCantidad) };

        await prisma.producto.update({
          where: { id: registroExistente.productoId },
          data: { stockActual: operation }
        });
      }

      const datosActualizacion = {
        valorTotal: nuevoValorTotal,
        ...(input.cantidadVendida !== undefined && { cantidadVendida: input.cantidadVendida }),
        ...(input.precioUnitario !== undefined && { precioUnitario: input.precioUnitario }),
        ...(input.observaciones !== undefined && { observaciones: input.observaciones })
      };

      const registroActualizado = await prisma.historialVentasProductos.update({
        where: { id: input.id },
        data: datosActualizacion,
        include: {
          producto: true,
          metodoPago: true,
          cliente: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              username: true,
              email: true
            }
          },
          turno: {
            include: {
              puntoVenta: {
                select: {
                  id: true,
                  codigo: true,
                  nombre: true
                }
              }
            }
          },
          puntoVenta: {
            select: {
              id: true,
              codigo: true,
              nombre: true
            }
          }
        }
      });

      if (Math.abs(diferenciaValor) > this.PRECISION_TOLERANCE) {
        const codigoMetodoPago = registroExistente.metodoPago.codigo;
        const metodoPagoId = registroExistente.metodoPagoId;

        const metodosPagoCierre = await prisma.cierreTurnoMetodoPago.findMany({
          where: { cierreTurnoId: cierreTurno.id }
        });

        const metodoPagoEnCierre = metodosPagoCierre.find(mp => 
          mp.metodoPagoId === metodoPagoId ||
          mp.metodoPago === codigoMetodoPago ||
          mp.metodoPago?.toUpperCase() === codigoMetodoPago.toUpperCase()
        );

        if (metodoPagoEnCierre) {
          const montoActual = Number(metodoPagoEnCierre.monto);
          const nuevoMonto = montoActual + diferenciaValor;
          const montoFinal = Math.max(0, nuevoMonto);

        const totalVentasTurno = await this.calcularTotalVentasTurno(cierreTurno.id, registroExistente.turnoId);
        const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
          const nuevoValorTotalGeneral = valorTotalGeneralActual + diferenciaValor;

          await prisma.cierreTurnoMetodoPago.update({
            where: { id: metodoPagoEnCierre.id },
            data: { monto: montoFinal }
          });

          const todosMetodosPago = await prisma.cierreTurnoMetodoPago.findMany({
            where: { cierreTurnoId: cierreTurno.id },
            include: {
              metodoPagoRel: true
            }
          });

          const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

          await Promise.all(
            todosMetodosPago.map((mp) => {
              const montoMp = Number(mp.monto);
              const porcentajeMp = totalVentasTurno > 0
                ? Math.round((montoMp / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
                : 0;
              const metodo = mp.metodoPago?.toUpperCase() || '';
              const metodoLower = mp.metodoPago?.toLowerCase() || '';
              
              if (metodo === 'EFECTIVO') {
                totales.efectivo += montoMp;
              } else if (metodo.includes('TARJETA') || metodo === 'TARJETA_CREDITO' || metodo === 'TARJETA_DEBITO') {
                totales.tarjetas += montoMp;
              } else if (metodo.includes('TRANSFERENCIA') || metodo === 'TRANSFERENCIA_BANCARIA') {
                totales.transferencias += montoMp;
              } else if (metodo === 'RUMBO' || metodoLower === 'rumbo') {
                totales.rumbo += montoMp;
              } else if (metodo === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
                totales.bonosViveTerpel += montoMp;
              } else {
                totales.otros += montoMp;
              }

              return prisma.cierreTurnoMetodoPago.update({
                where: { id: mp.id },
                data: { porcentaje: porcentajeMp }
              });
            })
          );

          await prisma.cierreTurno.update({
            where: { id: cierreTurno.id },
            data: {
              valorTotalGeneral: nuevoValorTotalGeneral,
              totalEfectivo: Math.round(totales.efectivo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
              totalTarjetas: Math.round(totales.tarjetas * this.ROUND_FACTOR) / this.ROUND_FACTOR,
              totalTransferencias: Math.round(totales.transferencias * this.ROUND_FACTOR) / this.ROUND_FACTOR,
              totalRumbo: Math.round(totales.rumbo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
              totalBonosViveTerpel: Math.round(totales.bonosViveTerpel * this.ROUND_FACTOR) / this.ROUND_FACTOR,
              totalOtros: Math.round(totales.otros * this.ROUND_FACTOR) / this.ROUND_FACTOR
            }
          });

          if (registroExistente.metodoPago.esEfectivo || registroExistente.metodoPago.codigo?.toUpperCase() === 'EFECTIVO') {
            const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
              where: {
                cierreTurnoId: cierreTurno.id,
                tipo: 'INGRESO'
              }
            });

            const movimientoVentasEfectivo = movimientosEfectivo.find(mov => {
              const concepto = mov.concepto?.toLowerCase() || '';
              return concepto.includes('venta') || 
                     mov.detalle?.toLowerCase().includes('ventas') ||
                     mov.observaciones?.toLowerCase().includes('ventas en efectivo') ||
                     mov.concepto === 'Venta en efectivo' ||
                     mov.concepto === 'Ingreso por ventas en efectivo';
            });

            if (movimientoVentasEfectivo && registroExistente.puntoVentaId) {
              const montoFinalMovimiento = Math.max(0, montoFinal);
              const diferenciaMovimientoEfectivo = montoFinalMovimiento - Number(movimientoVentasEfectivo.monto);

              await prisma.movimientoEfectivo.update({
                where: { id: movimientoVentasEfectivo.id },
                data: { monto: montoFinalMovimiento }
              });

              if (Math.abs(diferenciaMovimientoEfectivo) > this.PRECISION_TOLERANCE) {
                const cajaExistente = await prisma.caja.findUnique({
                  where: { puntoVentaId: registroExistente.puntoVentaId }
                });

                const nuevoSaldo = cajaExistente 
                  ? Math.max(0, Number(cajaExistente.saldoActual) + diferenciaMovimientoEfectivo)
                  : Math.max(0, diferenciaMovimientoEfectivo);

                if (cajaExistente) {
                  await prisma.caja.update({
                    where: { id: cajaExistente.id },
                    data: { saldoActual: nuevoSaldo, fechaUltimoMovimiento: new Date() }
                  });
                } else {
                  await prisma.caja.create({
                    data: {
                      puntoVentaId: registroExistente.puntoVentaId,
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
        }
      }

      return registroActualizado;
    });
  }

  async createCierreTurnoMetodoPago(input: CreateCierreTurnoMetodoPagoInput): Promise<any> {
    // Validar que el cierre de turno existe
    const cierreTurno = await this.prisma.cierreTurno.findUnique({
      where: { id: input.cierreTurnoId },
      include: {
        turno: {
          include: {
            puntoVenta: true
          }
        }
      }
    });

    if (!cierreTurno) {
      throw new NotFoundException(`Cierre de turno con ID ${input.cierreTurnoId} no encontrado`);
    }

    // Validar que el turno no esté bloqueado/finalizado
    if (cierreTurno.estado === 'finalizado' || cierreTurno.estado === 'bloqueado') {
      throw new BadRequestException(`No se puede agregar métodos de pago a un cierre de turno con estado ${cierreTurno.estado}`);
    }

    // Validar que el método de pago existe y está activo
    const metodoPago = await this.prisma.metodoPago.findUnique({
      where: { id: input.metodoPagoId }
    });

    if (!metodoPago) {
      throw new NotFoundException(`Método de pago con ID ${input.metodoPagoId} no encontrado`);
    }

    if (!metodoPago.activo) {
      throw new BadRequestException(`El método de pago ${metodoPago.nombre} no está activo`);
    }

    // Validar que no exista ya un registro con el mismo cierreTurnoId y metodoPagoId
    const metodoPagoExistente = await this.prisma.cierreTurnoMetodoPago.findFirst({
      where: {
        cierreTurnoId: input.cierreTurnoId,
        metodoPagoId: input.metodoPagoId
      }
    });

    if (metodoPagoExistente) {
      throw new BadRequestException(`Ya existe un método de pago ${metodoPago.nombre} en este cierre de turno. Use la mutación de actualización en su lugar.`);
    }

    // Validar que monto >= 0
    if (input.monto < 0) {
      throw new BadRequestException('El monto debe ser mayor o igual a 0');
    }

    return await this.prisma.$transaction(async (prisma) => {
      const totalVentasTurno = await this.calcularTotalVentasTurno(cierreTurno.id, cierreTurno.turnoId);
      const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
      const nuevoValorTotalGeneral = Math.max(0, valorTotalGeneralActual + input.monto);

      const nuevoMetodoPago = await prisma.cierreTurnoMetodoPago.create({
        data: {
          cierreTurnoId: input.cierreTurnoId,
          metodoPagoId: input.metodoPagoId,
          metodoPago: metodoPago.nombre,
          monto: input.monto,
          porcentaje: totalVentasTurno > 0
            ? Math.round((input.monto / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
            : 0,
          observaciones: input.observaciones
        },
        include: {
          metodoPagoRel: true
        }
      });

      const todosMetodosPago = await prisma.cierreTurnoMetodoPago.findMany({
        where: { cierreTurnoId: cierreTurno.id },
        include: {
          metodoPagoRel: true
        }
      });

      const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

      await Promise.all(
        todosMetodosPago.map((mp) => {
          const montoMp = Number(mp.monto);
          const porcentajeMp = totalVentasTurno > 0
            ? Math.round((montoMp / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
            : 0;
          const metodo = mp.metodoPago?.toUpperCase() || '';
          const metodoLower = mp.metodoPago?.toLowerCase() || '';
          
          if (metodo === 'EFECTIVO' || mp.metodoPagoRel?.esEfectivo) {
            totales.efectivo += montoMp;
          } else if (metodo.includes('TARJETA') || metodo === 'TARJETA_CREDITO' || metodo === 'TARJETA_DEBITO' || mp.metodoPagoRel?.esTarjeta) {
            totales.tarjetas += montoMp;
          } else if (metodo.includes('TRANSFERENCIA') || metodo === 'TRANSFERENCIA_BANCARIA' || mp.metodoPagoRel?.esDigital) {
            totales.transferencias += montoMp;
          } else if (metodo === 'RUMBO' || metodoLower === 'rumbo') {
            totales.rumbo += montoMp;
          } else if (metodo === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
            totales.bonosViveTerpel += montoMp;
          } else {
            totales.otros += montoMp;
          }

          return prisma.cierreTurnoMetodoPago.update({
            where: { id: mp.id },
            data: { porcentaje: porcentajeMp }
          });
        })
      );

      await prisma.cierreTurno.update({
        where: { id: cierreTurno.id },
        data: {
          valorTotalGeneral: nuevoValorTotalGeneral,
          totalEfectivo: Math.round(totales.efectivo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalTarjetas: Math.round(totales.tarjetas * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalTransferencias: Math.round(totales.transferencias * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalRumbo: Math.round(totales.rumbo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalBonosViveTerpel: Math.round(totales.bonosViveTerpel * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalOtros: Math.round(totales.otros * this.ROUND_FACTOR) / this.ROUND_FACTOR
        }
      });

      const esEfectivo = nuevoMetodoPago.metodoPagoRel?.esEfectivo || 
                        nuevoMetodoPago.metodoPago?.toUpperCase() === 'EFECTIVO';

      if (esEfectivo && cierreTurno.turno.puntoVenta) {
        const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
          where: {
            cierreTurnoId: cierreTurno.id,
            tipo: 'INGRESO'
          }
        });

        const movimientoVentasEfectivo = movimientosEfectivo.find(mov => {
          const concepto = mov.concepto?.toLowerCase() || '';
          return concepto.includes('venta') || 
                 mov.detalle?.toLowerCase().includes('ventas') ||
                 mov.observaciones?.toLowerCase().includes('ventas en efectivo') ||
                 mov.concepto === 'Venta en efectivo' ||
                 mov.concepto === 'Ingreso por ventas en efectivo';
        });

        if (movimientoVentasEfectivo) {
          const montoFinalMovimiento = Math.max(0, Number(movimientoVentasEfectivo.monto) + input.monto);
          const diferenciaMovimientoEfectivo = input.monto;

          await prisma.movimientoEfectivo.update({
            where: { id: movimientoVentasEfectivo.id },
            data: { monto: montoFinalMovimiento }
          });

          if (Math.abs(diferenciaMovimientoEfectivo) > this.PRECISION_TOLERANCE) {
            const puntoVentaId = cierreTurno.turno.puntoVenta.id;
            const cajaExistente = await prisma.caja.findUnique({
              where: { puntoVentaId }
            });

            const nuevoSaldo = cajaExistente 
              ? Math.max(0, Number(cajaExistente.saldoActual) + diferenciaMovimientoEfectivo)
              : Math.max(0, diferenciaMovimientoEfectivo);

            if (cajaExistente) {
              await prisma.caja.update({
                where: { id: cajaExistente.id },
                data: { saldoActual: nuevoSaldo, fechaUltimoMovimiento: new Date() }
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

      // Obtener el método de pago creado con todas sus relaciones
      const metodoPagoCreado = await prisma.cierreTurnoMetodoPago.findUnique({
        where: { id: nuevoMetodoPago.id },
        include: {
          metodoPagoRel: true
        }
      });

      return {
        id: metodoPagoCreado.id,
        metodoPago: metodoPagoCreado.metodoPago || metodoPagoCreado.metodoPagoRel?.nombre || '',
        monto: Number(metodoPagoCreado.monto),
        porcentaje: Number(metodoPagoCreado.porcentaje),
        observaciones: metodoPagoCreado.observaciones,
        createdAt: metodoPagoCreado.createdAt,
        updatedAt: metodoPagoCreado.createdAt // El modelo no tiene updatedAt, usar createdAt
      };
    });
  }

  async updateCierreTurnoMetodoPago(input: UpdateCierreTurnoMetodoPagoInput): Promise<any> {
    const metodoPagoExistente = await this.prisma.cierreTurnoMetodoPago.findUnique({
      where: { id: input.id },
      include: {
        cierreTurno: {
          include: {
            turno: {
              include: {
                puntoVenta: true
              }
            }
          }
        },
        metodoPagoRel: true
      }
    });

    if (!metodoPagoExistente) {
      throw new NotFoundException(`Método de pago del cierre con ID ${input.id} no encontrado`);
    }

    if (input.monto === undefined && input.observaciones === undefined) {
      throw new BadRequestException('Debe proporcionar al menos el monto o las observaciones para actualizar');
    }

    const montoAnterior = Number(metodoPagoExistente.monto);
    const nuevoMonto = input.monto !== undefined ? Math.max(0, input.monto) : montoAnterior;
    const diferenciaValor = nuevoMonto - montoAnterior;

      return await this.prisma.$transaction(async (prisma) => {
      const cierreTurno = metodoPagoExistente.cierreTurno;
      const totalVentasTurno = await this.calcularTotalVentasTurno(cierreTurno.id, cierreTurno.turnoId);
      const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
      const nuevoValorTotalGeneral = Math.max(0, valorTotalGeneralActual + diferenciaValor);

      const dataUpdate: any = {};
      if (input.monto !== undefined) {
        dataUpdate.monto = nuevoMonto;
      }
      if (input.observaciones !== undefined) {
        dataUpdate.observaciones = input.observaciones;
      }

      await prisma.cierreTurnoMetodoPago.update({
        where: { id: input.id },
        data: dataUpdate
      });

      if (input.monto !== undefined && Math.abs(diferenciaValor) > this.PRECISION_TOLERANCE) {
        const todosMetodosPago = await prisma.cierreTurnoMetodoPago.findMany({
          where: { cierreTurnoId: cierreTurno.id },
          include: {
            metodoPagoRel: true
          }
        });

        const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

        await Promise.all(
          todosMetodosPago.map((mp) => {
            const montoMp = Number(mp.monto);
            const porcentajeMp = totalVentasTurno > 0
              ? Math.round((montoMp / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
              : 0;
            const metodo = mp.metodoPago?.toUpperCase() || '';
            const metodoLower = mp.metodoPago?.toLowerCase() || '';
            
            if (metodo === 'EFECTIVO') {
              totales.efectivo += montoMp;
            } else if (metodo.includes('TARJETA') || metodo === 'TARJETA_CREDITO' || metodo === 'TARJETA_DEBITO') {
              totales.tarjetas += montoMp;
            } else if (metodo.includes('TRANSFERENCIA') || metodo === 'TRANSFERENCIA_BANCARIA') {
              totales.transferencias += montoMp;
            } else if (metodo === 'RUMBO' || metodoLower === 'rumbo') {
              totales.rumbo += montoMp;
            } else if (metodo === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
              totales.bonosViveTerpel += montoMp;
            } else {
              totales.otros += montoMp;
            }

            return prisma.cierreTurnoMetodoPago.update({
              where: { id: mp.id },
              data: { porcentaje: porcentajeMp }
            });
          })
        );

        await prisma.cierreTurno.update({
          where: { id: cierreTurno.id },
          data: {
            valorTotalGeneral: nuevoValorTotalGeneral,
            totalEfectivo: Math.round(totales.efectivo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
            totalTarjetas: Math.round(totales.tarjetas * this.ROUND_FACTOR) / this.ROUND_FACTOR,
            totalTransferencias: Math.round(totales.transferencias * this.ROUND_FACTOR) / this.ROUND_FACTOR,
            totalRumbo: Math.round(totales.rumbo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
            totalBonosViveTerpel: Math.round(totales.bonosViveTerpel * this.ROUND_FACTOR) / this.ROUND_FACTOR,
            totalOtros: Math.round(totales.otros * this.ROUND_FACTOR) / this.ROUND_FACTOR
          }
        });

        const esEfectivo = metodoPagoExistente.metodoPagoRel?.esEfectivo || 
                          metodoPagoExistente.metodoPago?.toUpperCase() === 'EFECTIVO';

        if (esEfectivo && cierreTurno.turno.puntoVenta) {
          const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
            where: {
              cierreTurnoId: cierreTurno.id,
              tipo: 'INGRESO'
            }
          });

          const movimientoVentasEfectivo = movimientosEfectivo.find(mov => {
            const concepto = mov.concepto?.toLowerCase() || '';
            return concepto.includes('venta') || 
                   mov.detalle?.toLowerCase().includes('ventas') ||
                   mov.observaciones?.toLowerCase().includes('ventas en efectivo') ||
                   mov.concepto === 'Venta en efectivo' ||
                   mov.concepto === 'Ingreso por ventas en efectivo';
          });

          if (movimientoVentasEfectivo) {
            const montoFinalMovimiento = Math.max(0, nuevoMonto);
            const diferenciaMovimientoEfectivo = montoFinalMovimiento - Number(movimientoVentasEfectivo.monto);

            await prisma.movimientoEfectivo.update({
              where: { id: movimientoVentasEfectivo.id },
              data: { monto: montoFinalMovimiento }
            });

            if (Math.abs(diferenciaMovimientoEfectivo) > this.PRECISION_TOLERANCE) {
              const puntoVentaId = cierreTurno.turno.puntoVenta.id;
              const cajaExistente = await prisma.caja.findUnique({
                where: { puntoVentaId }
              });

              const nuevoSaldo = cajaExistente 
                ? Math.max(0, Number(cajaExistente.saldoActual) + diferenciaMovimientoEfectivo)
                : Math.max(0, diferenciaMovimientoEfectivo);

              if (cajaExistente) {
                await prisma.caja.update({
                  where: { id: cajaExistente.id },
                  data: { saldoActual: nuevoSaldo, fechaUltimoMovimiento: new Date() }
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
      }

      const metodoPagoActualizado = await prisma.cierreTurnoMetodoPago.findUnique({
        where: { id: input.id },
        include: {
          cierreTurno: true,
          metodoPagoRel: true
        }
      });

      return {
        id: metodoPagoActualizado.id,
        metodoPago: metodoPagoActualizado.metodoPago || metodoPagoActualizado.metodoPagoRel?.nombre || '',
        monto: Number(metodoPagoActualizado.monto),
        porcentaje: Number(metodoPagoActualizado.porcentaje),
        observaciones: metodoPagoActualizado.observaciones,
        createdAt: metodoPagoActualizado.createdAt,
        updatedAt: metodoPagoActualizado.createdAt // El modelo no tiene updatedAt, usar createdAt
      };
    });
  }

  async deleteCierreTurnoMetodoPago(id: string): Promise<any> {
    // Validar que el método de pago existe
    const metodoPagoExistente = await this.prisma.cierreTurnoMetodoPago.findUnique({
      where: { id },
      include: {
        cierreTurno: {
          include: {
            turno: {
              include: {
                puntoVenta: true
              }
            }
          }
        },
        metodoPagoRel: true
      }
    });

    if (!metodoPagoExistente) {
      throw new NotFoundException(`Método de pago del cierre con ID ${id} no encontrado`);
    }

    // Validar que el cierre de turno no esté bloqueado/finalizado
    if (metodoPagoExistente.cierreTurno.estado === 'finalizado' || metodoPagoExistente.cierreTurno.estado === 'bloqueado') {
      throw new BadRequestException(`No se puede eliminar métodos de pago de un cierre de turno con estado ${metodoPagoExistente.cierreTurno.estado}`);
    }

    // Guardar información antes de eliminar para retornarla
    const metodoPagoEliminado = {
      id: metodoPagoExistente.id,
      metodoPago: metodoPagoExistente.metodoPago || metodoPagoExistente.metodoPagoRel?.nombre || '',
      monto: Number(metodoPagoExistente.monto),
      porcentaje: Number(metodoPagoExistente.porcentaje),
      observaciones: metodoPagoExistente.observaciones,
      esEfectivo: metodoPagoExistente.metodoPagoRel?.esEfectivo || 
                  metodoPagoExistente.metodoPago?.toUpperCase() === 'EFECTIVO'
    };

    return await this.prisma.$transaction(async (prisma) => {
      const cierreTurno = metodoPagoExistente.cierreTurno;
      const montoEliminado = metodoPagoEliminado.monto;
      
      const totalVentasTurno = await this.calcularTotalVentasTurno(cierreTurno.id, cierreTurno.turnoId);
      const valorTotalGeneralActual = Number(cierreTurno.valorTotalGeneral);
      const nuevoValorTotalGeneral = Math.max(0, valorTotalGeneralActual - montoEliminado);

      await prisma.cierreTurnoMetodoPago.delete({
        where: { id }
      });

      const todosMetodosPago = await prisma.cierreTurnoMetodoPago.findMany({
        where: { cierreTurnoId: cierreTurno.id },
        include: {
          metodoPagoRel: true
        }
      });

      const totales = { efectivo: 0, tarjetas: 0, transferencias: 0, rumbo: 0, bonosViveTerpel: 0, otros: 0 };

      await Promise.all(
        todosMetodosPago.map((mp) => {
          const montoMp = Number(mp.monto);
          const porcentajeMp = totalVentasTurno > 0
            ? Math.round((montoMp / totalVentasTurno) * this.ROUND_FACTOR * this.ROUND_FACTOR) / this.ROUND_FACTOR
            : 0;
          const metodo = mp.metodoPago?.toUpperCase() || '';
          const metodoLower = mp.metodoPago?.toLowerCase() || '';
          
          if (metodo === 'EFECTIVO' || mp.metodoPagoRel?.esEfectivo) {
            totales.efectivo += montoMp;
          } else if (metodo.includes('TARJETA') || metodo === 'TARJETA_CREDITO' || metodo === 'TARJETA_DEBITO' || mp.metodoPagoRel?.esTarjeta) {
            totales.tarjetas += montoMp;
          } else if (metodo.includes('TRANSFERENCIA') || metodo === 'TRANSFERENCIA_BANCARIA' || mp.metodoPagoRel?.esDigital) {
            totales.transferencias += montoMp;
          } else if (metodo === 'RUMBO' || metodoLower === 'rumbo') {
            totales.rumbo += montoMp;
          } else if (metodo === 'BONOS VIVE TERPEL' || metodoLower.includes('bonos') || metodoLower.includes('vive terpel')) {
            totales.bonosViveTerpel += montoMp;
          } else {
            totales.otros += montoMp;
          }

          return prisma.cierreTurnoMetodoPago.update({
            where: { id: mp.id },
            data: { porcentaje: porcentajeMp }
          });
        })
      );

      await prisma.cierreTurno.update({
        where: { id: cierreTurno.id },
        data: {
          valorTotalGeneral: nuevoValorTotalGeneral,
          totalEfectivo: Math.round(totales.efectivo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalTarjetas: Math.round(totales.tarjetas * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalTransferencias: Math.round(totales.transferencias * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalRumbo: Math.round(totales.rumbo * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalBonosViveTerpel: Math.round(totales.bonosViveTerpel * this.ROUND_FACTOR) / this.ROUND_FACTOR,
          totalOtros: Math.round(totales.otros * this.ROUND_FACTOR) / this.ROUND_FACTOR
        }
      });

      if (metodoPagoEliminado.esEfectivo && cierreTurno.turno.puntoVenta) {
        const movimientosEfectivo = await prisma.movimientoEfectivo.findMany({
          where: {
            cierreTurnoId: cierreTurno.id,
            tipo: 'INGRESO'
          }
        });

        const movimientoVentasEfectivo = movimientosEfectivo.find(mov => {
          const concepto = mov.concepto?.toLowerCase() || '';
          return concepto.includes('venta') || 
                 mov.detalle?.toLowerCase().includes('ventas') ||
                 mov.observaciones?.toLowerCase().includes('ventas en efectivo') ||
                 mov.concepto === 'Venta en efectivo' ||
                 mov.concepto === 'Ingreso por ventas en efectivo';
        });

        if (movimientoVentasEfectivo) {
          const montoFinalMovimiento = Math.max(0, Number(movimientoVentasEfectivo.monto) - montoEliminado);
          const diferenciaMovimientoEfectivo = -montoEliminado;

          await prisma.movimientoEfectivo.update({
            where: { id: movimientoVentasEfectivo.id },
            data: { monto: montoFinalMovimiento }
          });

          if (Math.abs(diferenciaMovimientoEfectivo) > this.PRECISION_TOLERANCE) {
            const puntoVentaId = cierreTurno.turno.puntoVenta.id;
            const cajaExistente = await prisma.caja.findUnique({
              where: { puntoVentaId }
            });

            const nuevoSaldo = cajaExistente 
              ? Math.max(0, Number(cajaExistente.saldoActual) + diferenciaMovimientoEfectivo)
              : Math.max(0, diferenciaMovimientoEfectivo);

            if (cajaExistente) {
              await prisma.caja.update({
                where: { id: cajaExistente.id },
                data: { saldoActual: nuevoSaldo, fechaUltimoMovimiento: new Date() }
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

      return {
        id: metodoPagoEliminado.id,
        metodoPago: metodoPagoEliminado.metodoPago,
        monto: metodoPagoEliminado.monto
      };
    });
  }

  async updateMovimientoEfectivo(input: UpdateMovimientoEfectivoInput): Promise<any> {
    const movimientoExistente = await this.prisma.movimientoEfectivo.findUnique({
      where: { id: input.id },
      include: {
        cierreTurno: {
          include: {
            turno: {
              include: {
                puntoVenta: true
              }
            }
          }
        }
      }
    });

    if (!movimientoExistente) {
      throw new NotFoundException(`Movimiento de efectivo con ID ${input.id} no encontrado`);
    }

    if (movimientoExistente.tipo !== 'EGRESO') {
      throw new BadRequestException(`Solo se pueden actualizar movimientos de efectivo tipo EGRESO. Este movimiento es de tipo ${movimientoExistente.tipo}`);
    }

    const hasChanges = 
      (input.monto !== undefined && input.monto !== Number(movimientoExistente.monto)) ||
      (input.concepto !== undefined && input.concepto !== movimientoExistente.concepto) ||
      (input.detalle !== undefined && input.detalle !== movimientoExistente.detalle) ||
      (input.observaciones !== undefined && input.observaciones !== movimientoExistente.observaciones);

    if (!hasChanges) {
      throw new BadRequestException('Debe proporcionar al menos un campo diferente al valor actual para actualizar');
    }

    const montoAnterior = Number(movimientoExistente.monto);
    const nuevoMonto = input.monto !== undefined ? Math.max(0, input.monto) : montoAnterior;
    const diferenciaMonto = nuevoMonto - montoAnterior;

    return await this.prisma.$transaction(async (prisma) => {
      const dataUpdate: any = {};
      if (input.monto !== undefined) {
        dataUpdate.monto = nuevoMonto;
      }
      if (input.concepto !== undefined) {
        dataUpdate.concepto = input.concepto;
      }
      if (input.detalle !== undefined) {
        dataUpdate.detalle = input.detalle;
      }
      if (input.observaciones !== undefined) {
        dataUpdate.observaciones = input.observaciones;
      }

      await prisma.movimientoEfectivo.update({
        where: { id: input.id },
        data: dataUpdate
      });

      if (input.monto !== undefined && Math.abs(diferenciaMonto) > this.PRECISION_TOLERANCE) {
        const puntoVentaId = movimientoExistente.cierreTurno.turno.puntoVenta?.id;
        
        if (!puntoVentaId) {
          throw new BadRequestException('No se puede actualizar la caja: punto de venta no encontrado');
        }

        const cajaExistente = await prisma.caja.findUnique({
          where: { puntoVentaId }
        });

        if (!cajaExistente) {
          throw new NotFoundException(`Caja no encontrada para el punto de venta ${puntoVentaId}`);
        }

        const saldoAnterior = Number(cajaExistente.saldoActual);
        const nuevoSaldo = Math.max(0, saldoAnterior - diferenciaMonto);

        await prisma.caja.update({
          where: { id: cajaExistente.id },
          data: {
            saldoActual: nuevoSaldo,
            fechaUltimoMovimiento: new Date()
          }
        });
      }

      const movimientoActualizado = await prisma.movimientoEfectivo.findUnique({
        where: { id: input.id },
        include: {
          cierreTurno: {
            include: {
              usuario: {
                select: {
                  nombre: true,
                  apellido: true
                }
              }
            }
          }
        }
      });

      const nombreResponsable = movimientoActualizado.cierreTurno.usuario
        ? `${movimientoActualizado.cierreTurno.usuario.nombre} ${movimientoActualizado.cierreTurno.usuario.apellido || ''}`.trim()
        : 'Usuario no disponible';

      return {
        id: movimientoActualizado.id,
        tipo: movimientoActualizado.tipo,
        monto: Number(movimientoActualizado.monto),
        concepto: movimientoActualizado.concepto,
        detalle: movimientoActualizado.detalle,
        observaciones: movimientoActualizado.observaciones,
        fecha: movimientoActualizado.fecha,
        nombreResponsable
      };
    });
  }
}

