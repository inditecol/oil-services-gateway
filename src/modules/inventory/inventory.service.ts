import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TanquesService } from './tanques.service';
import { randomUUID } from 'crypto';
import { InventoryEntryInput } from './dto/inventory-entry.input';
import { InventoryProcessInput } from './dto/inventory-process.input';
import { 
  InventoryEntryResponse,
  TankHeightEntryResult,
  ProductEntryResult,
  CarrotanqueEntryResult
} from './entities/inventory-entry.entity';
import { InventoryProcessResponse, InventoryProcessResult } from './dto/inventory-process.response';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tanquesService: TanquesService,
  ) {}

  /**
   * Procesa una entrada completa de inventario
   * Incluye lecturas de tanques, ingresos de productos y descargas de carrotanques
   */
  async processInventoryEntry(entryInput: InventoryEntryInput): Promise<InventoryEntryResponse> {
    const finishTime = new Date(entryInput.finishTime);

    // Validar que el punto de venta existe ANTES de iniciar la transacción
    const puntoVenta = await this.prisma.puntoVenta.findUnique({
      where: { id: entryInput.puntoVentaId }
    });

    if (!puntoVenta) {
      throw new ConflictException(`Punto de venta con ID ${entryInput.puntoVentaId} no encontrado`);
    }

    // INICIAR TRANSACCIÓN - Todo el proceso será atómico (timeout extendido para procesos largos)
    return await this.prisma.$transaction(async (prisma) => {
      const errores: string[] = [];
      const advertencias: string[] = [];
    
      // Resultados de procesamiento
      const resumenTanques: TankHeightEntryResult[] = [];
      const resumenProductos: ProductEntryResult[] = [];
      const resumenCarrotanques: CarrotanqueEntryResult[] = [];

      let costoTotalTanques = 0;
      let costoTotalProductos = 0;
      let costoTotalCarrotanques = 0;
      let volumenTotalLitros = 0;
      let volumenTotalGalones = 0;
      let cantidadTanquesActualizados = 0;
      let cantidadProductosIngresados = 0;
      let cantidadCarrotanquesDescargados = 0;

      // Crear primero la entrada de inventario (código del proceso)
      let entradaInventario;
      try {
        entradaInventario = await prisma.entradaInventario.create({
          data: {
            puntoVentaId: entryInput.puntoVentaId,
            tipoEntrada: entryInput.tipoEntrada || 'compra',
            codigoProceso: await this.generateProcessCodeInTransaction(entryInput.puntoVentaId, prisma),
            responsable: entryInput.responsable || 'Sistema',
            estado: 'PROCESANDO',
            fechaFin: finishTime,
            costoTotalProceso: entryInput.costoTotalIngreso || 0,
            observacionesGenerales: entryInput.observacionesGenerales
          }
        });
      } catch (error) {
        throw new ConflictException(`Error creando entrada de inventario: ${error.message}`);
      }

      try {
        // 1. PROCESAR LECTURAS DE TANQUES
        if (entryInput.lecturasTanques && entryInput.lecturasTanques.length > 0) {
          for (const lecturaInput of entryInput.lecturasTanques) {
            try {
              // Buscar el tanque
              const tanque = await prisma.tanque.findUnique({
                where: { id: lecturaInput.tanqueId },
                include: { 
                  producto: true,
                  tablaAforo: { orderBy: { altura: 'asc' } }
                }
              });

              if (!tanque) {
                errores.push(`Tanque ${lecturaInput.tanqueId} no encontrado`);
                continue;
              }

              // Calcular volumen basado en diferencia de altura
              const diferenciaAltura = lecturaInput.alturaFluidoNueva - lecturaInput.alturaFluidoAnterior;
              
              // Validaciones especiales para altura nueva = 0
              if (lecturaInput.alturaFluidoNueva === 0) {
                if (lecturaInput.alturaFluidoAnterior > 0) {
                  errores.push(`Tanque ${tanque.nombre}: No se puede establecer altura nueva en 0cm cuando la altura anterior es ${lecturaInput.alturaFluidoAnterior}cm. Esto indicaría vaciado del tanque, no entrada de inventario.`);
                  continue;
                } else if (lecturaInput.alturaFluidoAnterior === 0) {
                  // Caso especial: tanque vacío que sigue vacío (no hay entrada)
                  advertencias.push(`Tanque ${tanque.nombre}: Tanque permanece vacío (0cm → 0cm). No hay entrada de inventario.`);
                  continue;
                }
              }
              
              if (diferenciaAltura <= 0) {
                advertencias.push(`Tanque ${tanque.nombre}: No hay incremento de altura (${diferenciaAltura})`);
              }

              // Calcular volumen usando tabla de aforo si existe
              let volumenCalculado = 0;
              if (tanque.tablaAforo && tanque.tablaAforo.length > 0) {
                try {
                  // Interpolar volumen usando tabla de aforo
                  const volumenAnterior = await this.tanquesService.getVolumeByHeight(lecturaInput.tanqueId, lecturaInput.alturaFluidoAnterior);
                  const volumenNuevo = await this.tanquesService.getVolumeByHeight(lecturaInput.tanqueId, lecturaInput.alturaFluidoNueva);
                  volumenCalculado = volumenNuevo - volumenAnterior;
                } catch (error) {
                  // Si es un error de validación de altura, agregarlo a errores y continuar con el siguiente tanque
                  if (error.message.includes('excede la altura máxima') || error.message.includes('menor que la altura mínima')) {
                    errores.push(`Tanque ${tanque.nombre}: ${error.message}`);
                    continue;
                  } else {
                    // Para otros errores, re-lanzar
                    throw error;
                  }
                }
              } else {
                // Calcular aproximado basado en capacidad y altura máxima
                const alturaMaxima = Number(tanque.capacidadTotal) ? Math.sqrt(Number(tanque.capacidadTotal) / Math.PI) : 200; // Aproximación
                volumenCalculado = (diferenciaAltura / alturaMaxima) * (Number(tanque.capacidadTotal) || 0);
              }

              // Usar el volumen calculado directamente en su unidad original
              const volumenFinal = Math.max(0, volumenCalculado);
              
              // Buscar producto por código si se proporcionó
              let productoAsociado = tanque.producto;
              if (lecturaInput.codigoProducto && (!productoAsociado || productoAsociado.codigo !== lecturaInput.codigoProducto)) {
                productoAsociado = await prisma.producto.findUnique({
                  where: { codigo: lecturaInput.codigoProducto }
                });
                
                if (!productoAsociado) {
                  errores.push(`Producto ${lecturaInput.codigoProducto} no encontrado para tanque ${tanque.nombre}`);
                  productoAsociado = tanque.producto; // Usar el producto del tanque como fallback
                }
              }

              // Calcular costo total del combustible ingresado
              const precioCompra = lecturaInput.precioCompra || 0;
              const costoTotalCombustible = volumenFinal * precioCompra;

              // Calcular volumen real usando tabla de aforo
              let volumenReal = 0;
              try {
                volumenReal = await this.tanquesService.getVolumeByHeight(tanque.id, lecturaInput.alturaFluidoNueva);
              } catch (error) {
                console.warn(`No se pudo calcular volumen por tabla de aforo para tanque ${tanque.id}:`, error.message);
                // Usar cálculo aproximado si no hay tabla de aforo
                volumenReal = volumenFinal;
              }

              // Actualizar nivel del tanque con volumen real calculado
              await prisma.tanque.update({
                where: { id: tanque.id },
                data: {
                  nivelActual: volumenReal,
                  alturaActual: lecturaInput.alturaFluidoNueva
                }
              });

              // Actualizar stock del producto combustible si existe
              if (productoAsociado && volumenFinal > 0) {
                await prisma.producto.update({
                  where: { id: productoAsociado.id },
                  data: {
                    stockActual: {
                      increment: volumenFinal
                    },
                    // Actualizar precio de compra si se proporcionó
                    ...(precioCompra > 0 && { precioCompra: precioCompra })
                  }
                });
              }

              // Registrar el movimiento de inventario completo con toda la trazabilidad
              if (productoAsociado) {
                await prisma.entradaInventarioProcess.create({
                  data: {
                    entradaInventarioId: entradaInventario.id, // Referencia al código de entrada
                    productoId: productoAsociado.id,
                    codigoProducto: lecturaInput.codigoProducto || productoAsociado.codigo,
                    cantidad: volumenFinal,
                    unidadMedida: tanque.unidadMedida || 'GALONES', // Usar la unidad del tanque, defaultear a galones
                    tipoMovimiento: 'entrada',
                    estadoMovimiento: 'COMPLETADO',
                    precioUnitario: precioCompra,
                    costoTotal: costoTotalCombustible,
                    
                    // Información específica de tanques
                    tanqueId: tanque.id,
                    alturaFluidoAnterior: lecturaInput.alturaFluidoAnterior,
                    alturaFluidoNueva: lecturaInput.alturaFluidoNueva,
                    volumenCalculado: volumenFinal,
                    
                    // Información del producto específico (en EntradaInventarioProcess)
                    lote: null, // Para combustibles normalmente no hay lote
                    fechaVencimiento: null, // Para combustibles normalmente no hay vencimiento
                    
                    // Trazabilidad completa
                    observaciones: `Tanque: ${tanque.nombre} | Producto: ${lecturaInput.codigoProducto || productoAsociado.codigo} | Altura: ${lecturaInput.alturaFluidoAnterior}→${lecturaInput.alturaFluidoNueva}cm | Volumen: ${volumenFinal.toFixed(2)}L | Precio: $${precioCompra}/L | ${lecturaInput.observaciones || ''}`,
                    fechaMovimiento: new Date()
                  }
                });
              }

              // Sumar al costo total de tanques
              costoTotalTanques += costoTotalCombustible;

              resumenTanques.push({
                tanqueId: tanque.id,
                nombreTanque: tanque.nombre,
                alturaFluidoAnterior: lecturaInput.alturaFluidoAnterior,
                alturaFluidoNueva: lecturaInput.alturaFluidoNueva,
                diferenciaAltura,
                volumenCalculadoLitros: volumenFinal,
                volumenCalculadoGalones: volumenFinal,
                procesadoExitosamente: true,
                observaciones: lecturaInput.observaciones
              });

              volumenTotalLitros += volumenFinal;
              volumenTotalGalones += volumenFinal;
              cantidadTanquesActualizados++;

            } catch (error) {
              errores.push(`Error procesando tanque ${lecturaInput.tanqueId}: ${error.message}`);
              resumenTanques.push({
                tanqueId: lecturaInput.tanqueId,
                nombreTanque: lecturaInput.nombreTanque || 'ERROR',
                alturaFluidoAnterior: lecturaInput.alturaFluidoAnterior,
                alturaFluidoNueva: lecturaInput.alturaFluidoNueva,
                diferenciaAltura: 0,
                volumenCalculadoLitros: 0,
                volumenCalculadoGalones: 0,
                procesadoExitosamente: false,
                error: error.message,
                observaciones: lecturaInput.observaciones
              });
            }
          }
        }

        // Continúa en la siguiente parte...
        return await this.processRemainingSteps(
          entryInput, prisma, entradaInventario, errores, advertencias,
          resumenTanques, resumenProductos, resumenCarrotanques,
          costoTotalTanques, costoTotalProductos, costoTotalCarrotanques,
          volumenTotalLitros, volumenTotalGalones,
          cantidadTanquesActualizados, cantidadProductosIngresados, cantidadCarrotanquesDescargados,
          finishTime
        );

      } catch (error) {
        console.error('Error en transacción de inventario:', error);

        // Marcar la entrada como fallida si se pudo crear
        if (entradaInventario) {
          await prisma.entradaInventario.update({
            where: { id: entradaInventario.id },
            data: {
              estado: 'FALLIDO'
            }
          });
        }

        throw new ConflictException(`Error procesando entrada de inventario: ${error.message}`);
      }
    });
  }

  /**
   * Procesa los pasos restantes del inventario (productos y carrotanques)
   */
  private async processRemainingSteps(
    entryInput: InventoryEntryInput,
    prisma: any,
    entradaInventario: any,
    errores: string[],
    advertencias: string[],
    resumenTanques: TankHeightEntryResult[],
    resumenProductos: ProductEntryResult[],
    resumenCarrotanques: CarrotanqueEntryResult[],
    costoTotalTanques: number,
    costoTotalProductos: number,
    costoTotalCarrotanques: number,
    volumenTotalLitros: number,
    volumenTotalGalones: number,
    cantidadTanquesActualizados: number,
    cantidadProductosIngresados: number,
    cantidadCarrotanquesDescargados: number,
    finishTime: Date
  ): Promise<InventoryEntryResponse> {
    
    // 2. PROCESAR INGRESOS DE PRODUCTOS (no combustibles)
    if (entryInput.ingresosProductos && entryInput.ingresosProductos.length > 0) {
      for (const ingresoInput of entryInput.ingresosProductos) {
        try {
          // Buscar el producto
          const producto = await prisma.producto.findUnique({
            where: { codigo: ingresoInput.codigoProducto }
          });

          if (!producto) {
            errores.push(`Producto ${ingresoInput.codigoProducto} no encontrado`);
            continue;
          }

          // Calcular costo total
          const costoTotalProducto = ingresoInput.cantidadIngresada * ingresoInput.precioCompra;

          // Actualizar stock del producto
          const stockAnterior = producto.stockActual;
          const nuevoStock = stockAnterior + ingresoInput.cantidadIngresada;

          await prisma.producto.update({
            where: { id: producto.id },
            data: {
              stockActual: nuevoStock,
              // Actualizar precio de compra
              precioCompra: ingresoInput.precioCompra
            }
          });

          // Registrar movimiento de inventario
          await prisma.entradaInventarioProcess.create({
            data: {
              entradaInventarioId: entradaInventario.id,
              productoId: producto.id,
              codigoProducto: ingresoInput.codigoProducto,
              cantidad: ingresoInput.cantidadIngresada,
              unidadMedida: ingresoInput.unidadMedida,
              tipoMovimiento: 'entrada',
              estadoMovimiento: 'COMPLETADO',
              precioUnitario: ingresoInput.precioCompra,
              costoTotal: costoTotalProducto,
              lote: ingresoInput.lote,
              fechaVencimiento: ingresoInput.fechaVencimiento ? new Date(ingresoInput.fechaVencimiento) : null,
              
              // Trazabilidad completa
              observaciones: `Producto: ${producto.nombre} | Código: ${ingresoInput.codigoProducto} | Cantidad: ${ingresoInput.cantidadIngresada} ${ingresoInput.unidadMedida} | Precio: $${ingresoInput.precioCompra} | Lote: ${ingresoInput.lote || 'N/A'} | Proveedor: ${ingresoInput.proveedor || 'N/A'} | ${ingresoInput.observaciones || ''}`,
              fechaMovimiento: new Date()
            }
          });

          // Sumar al costo total de productos
          costoTotalProductos += costoTotalProducto;

          resumenProductos.push({
            codigoProducto: ingresoInput.codigoProducto,
            nombreProducto: producto.nombre,
            unidadMedida: ingresoInput.unidadMedida,
            cantidadIngresada: ingresoInput.cantidadIngresada,
            stockAnterior,
            stockNuevo: nuevoStock,
            precioCompra: ingresoInput.precioCompra,
            costoTotal: costoTotalProducto,
            procesadoExitosamente: true,
            observaciones: ingresoInput.observaciones
          });

          cantidadProductosIngresados++;

        } catch (error) {
          errores.push(`Error procesando producto ${ingresoInput.codigoProducto}: ${error.message}`);
          resumenProductos.push({
            codigoProducto: ingresoInput.codigoProducto,
            nombreProducto: 'ERROR',
            unidadMedida: ingresoInput.unidadMedida,
            cantidadIngresada: 0,
            stockAnterior: 0,
            stockNuevo: 0,
            precioCompra: ingresoInput.precioCompra,
            costoTotal: 0,
            procesadoExitosamente: false,
            error: error.message,
            observaciones: ingresoInput.observaciones
          });
        }
      }
    }

    // 3. PROCESAR DESCARGAS DE CARROTANQUES
    if (entryInput.descargasCarrotanques && entryInput.descargasCarrotanques.length > 0) {
      for (const descargaInput of entryInput.descargasCarrotanques) {
        try {
          // Buscar el carrotanque
          const carrotanque = await prisma.carrotanque.findUnique({
            where: { id: descargaInput.carrotanqueId }
          });

          if (!carrotanque) {
            errores.push(`Carrotanque ${descargaInput.carrotanqueId} no encontrado`);
            continue;
          }

          // Convertir cantidad según unidad de medida
          let cantidadLitros = descargaInput.cantidadDescargada;
          if (descargaInput.unidadMedida === 'litros') {
            cantidadLitros = descargaInput.cantidadDescargada;
          } else if (descargaInput.unidadMedida === 'galones') {
            cantidadLitros = descargaInput.cantidadDescargada * 3.78541;
          }

          // Actualizar nivel del carrotanque
          const nivelAnterior = carrotanque.nivelActual;
          const nivelNuevo = Math.max(0, nivelAnterior - cantidadLitros);

          await prisma.carrotanque.update({
            where: { id: carrotanque.id },
            data: { nivelActual: nivelNuevo }
          });

          // Registrar movimiento de inventario
          await prisma.entradaInventarioProcess.create({
            data: {
              entradaInventarioId: entradaInventario.id,
              carrotanqueId: carrotanque.id,
              codigoProducto: descargaInput.codigoProducto,
              cantidad: descargaInput.cantidadDescargada,
              unidadMedida: descargaInput.unidadMedida,
              tipoMovimiento: 'entrada',
              estadoMovimiento: 'COMPLETADO',
              precioUnitario: descargaInput.precioCompra,
              costoTotal: descargaInput.costoTotal,
              numeroRemision: descargaInput.numeroRemision,
              
              // Trazabilidad completa
              observaciones: `Carrotanque: ${carrotanque.placa} | Producto: ${descargaInput.codigoProducto} | Cantidad: ${descargaInput.cantidadDescargada} ${descargaInput.unidadMedida} | Precio: $${descargaInput.precioCompra} | Nivel: ${Number(nivelAnterior)}→${nivelNuevo} | Remisión: ${descargaInput.numeroRemision || 'N/A'} | ${descargaInput.observaciones || ''}`,
              fechaMovimiento: new Date()
            }
          });

          // Sumar al costo total de carrotanques
          costoTotalCarrotanques += descargaInput.costoTotal;

          resumenCarrotanques.push({
            carrotanqueId: carrotanque.id,
            placa: carrotanque.placa,
            codigoProducto: descargaInput.codigoProducto,
            nombreProducto: descargaInput.codigoProducto, // Asumiendo que es el mismo código
            cantidadDescargada: descargaInput.cantidadDescargada,
            unidadMedida: descargaInput.unidadMedida,
            precioCompra: descargaInput.precioCompra,
            costoTotal: descargaInput.costoTotal,
            nivelAnterior: Number(nivelAnterior),
            nivelNuevo: nivelNuevo,
            procesadoExitosamente: true,
            observaciones: descargaInput.observaciones
          });

          cantidadCarrotanquesDescargados++;

        } catch (error) {
          errores.push(`Error procesando carrotanque ${descargaInput.carrotanqueId}: ${error.message}`);
          resumenCarrotanques.push({
            carrotanqueId: descargaInput.carrotanqueId,
            placa: 'ERROR',
            codigoProducto: descargaInput.codigoProducto,
            nombreProducto: 'ERROR',
            cantidadDescargada: 0,
            unidadMedida: descargaInput.unidadMedida,
            precioCompra: descargaInput.precioCompra,
            costoTotal: 0,
            nivelAnterior: 0,
            nivelNuevo: 0,
            procesadoExitosamente: false,
            error: error.message,
            observaciones: descargaInput.observaciones
          });
        }
      }
    }

    // Calcular costo total del proceso
    const costoTotalProceso = costoTotalTanques + costoTotalProductos + costoTotalCarrotanques;

    // Actualizar el estado y costo total de la entrada
    await prisma.entradaInventario.update({
      where: { id: entradaInventario.id },
      data: {
        estado: errores.length > 0 ? 'COMPLETADO_CON_ERRORES' : 'COMPLETADO',
        costoTotalProceso: costoTotalProceso
      }
    });

    console.log(`✅ Proceso de inventario completado: ${entradaInventario.codigoProceso}`);
    console.log(`📊 Resumen: ${cantidadTanquesActualizados} tanques, ${cantidadProductosIngresados} productos, ${cantidadCarrotanquesDescargados} carrotanques`);
    console.log(`💰 Costo total: $${costoTotalProceso.toFixed(2)}`);

    if (errores.length > 0) {
      console.log(`⚠️ Errores encontrados: ${errores.length}`);
      errores.forEach(error => console.log(`  - ${error}`));
    }

    if (advertencias.length > 0) {
      console.log(`📝 Advertencias: ${advertencias.length}`);
      advertencias.forEach(advertencia => console.log(`  - ${advertencia}`));
    }

    return {
      resumenTanques,
      resumenProductos,
      resumenCarrotanques,
      resumenFinanciero: {
        costoTotalTanques,
        costoTotalProductos,
        costoTotalCarrotanques,
        costoTotalGeneral: costoTotalProceso,
        cantidadTanquesActualizados,
        cantidadProductosIngresados,
        cantidadCarrotanquesDescargados
      },
      resumenInventario: {
        volumenTotalIngresadoLitros: volumenTotalLitros,
        volumenTotalIngresadoGalones: volumenTotalGalones,
        productosNocombustiblesIngresados: cantidadProductosIngresados,
        valorInventarioIncrementado: costoTotalProceso
      },
      fechaProceso: finishTime,
      entradaId: entradaInventario.id,
      responsable: entryInput.responsable || 'Sistema',
      estado: errores.length > 0 ? 'COMPLETADO_CON_ERRORES' : 'COMPLETADO',
      errores: errores.length > 0 ? errores : undefined,
      advertencias: advertencias.length > 0 ? advertencias : undefined,
      observacionesGenerales: entryInput.observacionesGenerales
    };
  }

  /**
   * NUEVA ESTRUCTURA NORMALIZADA
   * Procesa una entrada de inventario usando la estructura separada de proceso y movimientos
   */
  async processInventoryProcess(
    processInput: InventoryProcessInput, 
    user: any
  ): Promise<InventoryProcessResponse> {
    // TODO: Implementar o mover desde ProductsService
    throw new Error('Method not implemented yet');
  }

  /**
   * Obtiene un proceso de inventario por ID
   */
  async getInventoryProcess(procesoId: string): Promise<InventoryProcessResult | null> {
    // TODO: Implementar o mover desde ProductsService
    throw new Error('Method not implemented yet');
  }

  /**
   * Lista procesos de inventario con filtros
   */
  async listInventoryProcesses(filters: {
    puntoVentaId?: string;
    estado?: string;
    tipoEntrada?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Promise<InventoryProcessResult[]> {
    // TODO: Implementar o mover desde ProductsService
    throw new Error('Method not implemented yet');
  }

  /**
   * Obtiene resumen general del inventario
   */
  async getInventoryOverview() {
    const tanks = await this.prisma.producto.findMany({
      where: { esCombustible: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        stockActual: true,
        stockMinimo: true,
        precioVenta: true,
        tanques: {
          select: {
            id: true,
            nombre: true,
            nivelActual: true,
            capacidadTotal: true,
            unidadMedida: true
          }
        }
      }
    });

    return {
      totalTanks: tanks.length,
      tanks: tanks.map(product => ({
        productId: product.id,
        productCode: product.codigo,
        productName: product.nombre,
        currentStock: product.stockActual,
        minStock: product.stockMinimo,
        salePrice: product.precioVenta,
        tanks: product.tanques.map(tank => ({
          tankId: tank.id,
          tankName: tank.nombre,
          currentLevel: tank.nivelActual,
          totalCapacity: tank.capacidadTotal,
          unit: tank.unidadMedida,
          fillPercentage: tank.capacidadTotal ? 
            ((Number(tank.nivelActual) / Number(tank.capacidadTotal)) * 100).toFixed(2) : '0'
        }))
      }))
    };
  }

  /**
   * Obtiene estado de tanques
   */
  async getTankStatus() {
    const tanks = await this.prisma.producto.findMany({
      where: { esCombustible: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        stockActual: true,
        stockMinimo: true,
        precioVenta: true,
        tanques: {
          select: {
            id: true,
            nombre: true,
            nivelActual: true,
            capacidadTotal: true,
            unidadMedida: true
          }
        }
      }
    });

    return tanks.map(product => ({
      productId: product.id,
      productCode: product.codigo,
      productName: product.nombre,
      currentStock: product.stockActual,
      minStock: product.stockMinimo,
      salePrice: product.precioVenta,
      tanks: product.tanques.map(tank => ({
        tankId: tank.id,
        tankName: tank.nombre,
        currentLevel: tank.nivelActual,
        totalCapacity: tank.capacidadTotal,
        unit: tank.unidadMedida,
        fillPercentage: tank.capacidadTotal ? 
          ((Number(tank.nivelActual) / Number(tank.capacidadTotal)) * 100).toFixed(2) : '0'
      }))
    }));
  }

  /**
   * Genera un código único para el proceso usando UUID
   */
  private async generateProcessCodeInTransaction(puntoVentaId: string, prisma: any): Promise<string> {
    // Generar UUID único
    const uuid = randomUUID();
    
    // Formato: INV-UUID
    return `INV-${uuid}`;
  }
} 