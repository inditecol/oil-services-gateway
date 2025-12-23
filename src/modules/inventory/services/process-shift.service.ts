import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { CierreTurnoInput } from '../dto/shift-closure.input';
import { ProductsService } from '../products.service';
import { SurtidoresService } from '../surtidores.service';
import { TanquesService } from '../tanques.service';
import { HistorialVentasService } from './historial-ventas.service';

@Injectable()
export class ProcessShiftService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private surtidoresService: SurtidoresService,
    private tanquesService: TanquesService,
    private historialVentasService: HistorialVentasService,
  ) {}

  public async processShiftClosure(
    cierreTurnoInput: CierreTurnoInput,
    user: any,
  ): Promise<any> {
    const GALONES_TO_LITROS = 3.78541;
    const LITROS_TO_GALONES = 0.264172;

    const errores: string[] = [];
    const advertencias: string[] = [];
    const resumenSurtidores = [];
    let productosActualizados = 0;
    let tanquesActualizados = 0;
    let totalGeneralLitros = 0;
    let totalGeneralGalones = 0;
    let valorTotalGeneral = 0;

    // Variables para estadísticas de ventas
    let ventasCombustiblesCalculadas = 0;
    let ventasProductosCalculadas = 0;
    try {
      // VALIDAR QUE EL PUNTO DE VENTA EXISTE AL INICIO
      const puntoVenta = await this.prisma.puntoVenta.findUnique({
        where: { id: cierreTurnoInput.puntoVentaId },
      });

      if (!puntoVenta) {
        throw new NotFoundException(
          `Punto de venta con ID ${cierreTurnoInput.puntoVentaId} no encontrado. No se puede procesar el cierre de turno.`,
        );
      }

      // ==========================================
      // VALIDAR CONFIGURACIÓN DE MÉTODOS DE PAGO
      // ==========================================
      // Obtener configuración de la empresa desde el JWT
      const seleccionPorProducto = user?.configuracionEmpresa?.seleccionPorProducto ?? false;
      
      console.log('[CIERRE_TURNO] Configuración de métodos de pago:', {
        seleccionPorProducto,
        tieneConfiguracion: !!user?.configuracionEmpresa,
        userId: user?.id,
      });

      // Si seleccionPorProducto = true, validar que NO se envíen métodos de pago por manguera individual
      if (seleccionPorProducto) {
        // Verificar si hay métodos de pago en las mangueras (no permitido cuando seleccionPorProducto = true)
        const tieneMetodosPagoEnMangueras = cierreTurnoInput.lecturasSurtidores?.some(
          (surtidor) =>
            surtidor.mangueras?.some(
              (manguera) => manguera.metodosPago && manguera.metodosPago.length > 0
            )
        );

        if (tieneMetodosPagoEnMangueras) {
          errores.push(
            'La configuración de la empresa requiere métodos de pago por producto consolidado. ' +
            'No se permiten métodos de pago individuales por manguera. ' +
            'Por favor, consolide los métodos de pago por producto en el campo ventasProductos.'
          );
          console.warn('[CIERRE_TURNO] Error: Métodos de pago por manguera detectados cuando seleccionPorProducto = true');
        }

        // Validar que existan métodos de pago consolidados por producto
        const tieneMetodosPagoConsolidados = 
          (cierreTurnoInput.ventasProductos && cierreTurnoInput.ventasProductos.length > 0 &&
            cierreTurnoInput.ventasProductos.some(
              (vp) => vp.metodosPago && vp.metodosPago.length > 0
            )) ||
          (cierreTurnoInput.ventasProductos && cierreTurnoInput.ventasProductos.length > 0 &&
            cierreTurnoInput.ventasProductos.some(
              (vp) => vp.ventasIndividuales && vp.ventasIndividuales.some(
                (vi) => vi.metodosPago && vi.metodosPago.length > 0
              )
            )) ||
          (cierreTurnoInput.resumenVentas?.metodosPago && 
            cierreTurnoInput.resumenVentas.metodosPago.length > 0);

        if (!tieneMetodosPagoConsolidados) {
          advertencias.push(
            'La configuración requiere métodos de pago por producto consolidado. ' +
            'Asegúrese de incluir los métodos de pago en ventasProductos o en resumenVentas.metodosPago.'
          );
          console.warn('[CIERRE_TURNO] Advertencia: No se detectaron métodos de pago consolidados por producto');
        }
      } else {
        // Si seleccionPorProducto = false, el comportamiento es el actual (por manguera o consolidado)
        console.log('[CIERRE_TURNO] Modo: Métodos de pago por manguera individual (comportamiento actual)');
      }

      console.log(
        `[CIERRE_TURNO] Punto de venta validado: ${puntoVenta.nombre} (${puntoVenta.codigo}). Procesando ${cierreTurnoInput.lecturasSurtidores.length} surtidores`,
      );

      // Array para guardar los IDs de las lecturas creadas para actualizarlas después con el cierreTurnoId
      const historialesLecturaIds: string[] = [];

      // 3. PROCESAR CADA SURTIDOR (ya validado que pertenece al punto de venta)
      for (const surtidor of cierreTurnoInput.lecturasSurtidores) {
        const ventasCalculadas = [];
        let totalSurtidorLitros = 0;
        let totalSurtidorGalones = 0;
        let valorTotalSurtidor = 0;

        console.log(
          `[CIERRE_TURNO] Procesando surtidor: ${surtidor.numeroSurtidor} con ${surtidor.mangueras.length} mangueras`,
        );

        // Procesar cada manguera del surtidor
        for (const manguera of surtidor.mangueras) {
          try {
            // Buscar producto
            const product = await this.productsService.findByCode(
              manguera.codigoProducto,
            );
            if (!product) {
              errores.push(
                `Producto no encontrado: ${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}`,
              );
              continue;
            }
            console.log(
              `[CIERRE_TURNO] Producto encontrado: ${product.codigo} - Stock actual: ${product.stockActual}L`,
            );

            // Calcular cantidad vendida
            const cantidadVendida =
              manguera.lecturaActual - manguera.lecturaAnterior;
            if (cantidadVendida < 0) {
              errores.push(
                `Lectura inválida en surtidor ${surtidor.numeroSurtidor}, manguera ${manguera.numeroManguera}: lectura actual menor que anterior`,
              );
              continue;
            }

            if (cantidadVendida === 0) {
              advertencias.push(
                `Sin ventas en surtidor ${surtidor.numeroSurtidor}, manguera ${manguera.numeroManguera}`,
              );
              continue;
            }

            // Contar venta de combustible
            if (product.esCombustible && cantidadVendida > 0) {
              ventasCombustiblesCalculadas++;
            }

            // Convertir a ambas unidades
            let cantidadLitros = cantidadVendida;
            let cantidadGalones = cantidadVendida;

            if (manguera.unidadMedida.toLowerCase() === 'galones') {
              cantidadLitros = cantidadVendida * GALONES_TO_LITROS;
            } else if (manguera.unidadMedida.toLowerCase() === 'litros') {
              cantidadGalones = cantidadVendida * LITROS_TO_GALONES;
            } else {
              errores.push(
                `Unidad no válida: ${manguera.unidadMedida} en surtidor ${surtidor.numeroSurtidor}`,
              );
              continue;
            }

            // Redondear
            cantidadLitros = Math.round(cantidadLitros * 100) / 100;
            cantidadGalones = Math.round(cantidadGalones * 100) / 100;

            console.log(
              `[CIERRE_TURNO] Cantidad a descontar: ${cantidadLitros}L (${cantidadVendida} ${manguera.unidadMedida})`,
            );

            // Calcular precios
            const precioLitro = Number(product.precioVenta);
            const precioGalon =
              Math.round((precioLitro / LITROS_TO_GALONES) * 100) / 100;
            const valorVenta = cantidadLitros * precioLitro;

            // Calcular métodos de pago para este producto desde ventasProductos
            let metodosPagoProducto = [];

            // Si seleccionPorProducto = true, NO procesar métodos de pago por manguera individual
            // Solo usar métodos consolidados por producto
            if (seleccionPorProducto && manguera.metodosPago && manguera.metodosPago.length > 0) {
              advertencias.push(
                `Métodos de pago por manguera ignorados para ${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}. ` +
                `La configuración requiere métodos de pago consolidados por producto.`
              );
              console.warn(
                `[CIERRE_TURNO] Ignorando métodos de pago por manguera (seleccionPorProducto=true): ` +
                `surtidor ${surtidor.numeroSurtidor}, manguera ${manguera.numeroManguera}`
              );
            }

            // Buscar el producto correspondiente en ventasProductos
            if (
              cierreTurnoInput.ventasProductos &&
              cierreTurnoInput.ventasProductos.length > 0
            ) {
              // Buscar todas las entradas de ventasProductos con el mismo codigoProducto
              const ventasProductosMatching =
                cierreTurnoInput.ventasProductos.filter(
                  (vp) => vp.codigoProducto === manguera.codigoProducto,
                );

              // Buscar la venta individual que corresponde a esta manguera específica
              const cantidadVendidaEnUnidad =
                manguera.unidadMedida.toLowerCase() === 'galones'
                  ? cantidadGalones
                  : cantidadLitros;

              let ventaIndividualEncontrada = null;

              // Buscar en todas las entradas de ventasProductos que coincidan con el codigoProducto
              for (const ventaProducto of ventasProductosMatching) {
                if (
                  ventaProducto.ventasIndividuales &&
                  ventaProducto.ventasIndividuales.length > 0
                ) {
                  // Buscar la venta individual que corresponde a esta manguera
                  const ventaIndividual = ventaProducto.ventasIndividuales.find(
                    (vi) => {
                      // Coincidir por cantidad y valorTotal (con tolerancia)
                      const cantidadCoincide =
                        Math.abs(vi.cantidad - cantidadVendidaEnUnidad) < 0.01;
                      const valorCoincide =
                        Math.abs(vi.valorTotal - valorVenta) < 0.01;

                      // También verificar si las observaciones mencionan este surtidor/manguera
                      const observacionesMencionanSurtidor =
                        vi.observaciones &&
                        (vi.observaciones.includes(surtidor.numeroSurtidor) ||
                          vi.observaciones.includes(manguera.numeroManguera));

                      // También verificar si las observaciones de ventaProducto mencionan el surtidor/manguera
                      const observacionesVentaProductoMencionan =
                        ventaProducto.observaciones &&
                        (ventaProducto.observaciones.includes(
                          surtidor.numeroSurtidor,
                        ) ||
                          ventaProducto.observaciones.includes(
                            manguera.numeroManguera,
                          ));

                      return (
                        (cantidadCoincide && valorCoincide) ||
                        observacionesMencionanSurtidor ||
                        observacionesVentaProductoMencionan
                      );
                    },
                  );

                  if (ventaIndividual) {
                    ventaIndividualEncontrada = ventaIndividual;
                    break; // Encontramos la coincidencia, salir del loop
                  }
                }
              }

              // Si encontramos una venta individual, usar sus métodos de pago
              if (
                ventaIndividualEncontrada &&
                ventaIndividualEncontrada.metodosPago &&
                ventaIndividualEncontrada.metodosPago.length > 0
              ) {
                let totalDeclaradoManguera =
                  ventaIndividualEncontrada.metodosPago.reduce(
                    (sum, mp) => sum + mp.monto,
                    0,
                  );

                // Validar que la suma de métodos de pago coincida con el valor de venta
                if (Math.abs(totalDeclaradoManguera - valorVenta) > 0.01) {
                  advertencias.push(
                    `${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}: Suma de métodos de pago ($${totalDeclaradoManguera}) no coincide con valor de venta ($${Math.round(valorVenta * 100) / 100})`,
                  );
                }

                metodosPagoProducto = ventaIndividualEncontrada.metodosPago.map(
                  (mp) => ({
                    metodoPago: mp.metodoPago,
                    monto: Math.round(mp.monto * 100) / 100,
                    porcentaje:
                      totalDeclaradoManguera > 0
                        ? Math.round(
                            (mp.monto / totalDeclaradoManguera) * 100 * 100,
                          ) / 100
                        : 0,
                    observaciones: mp.observaciones,
                  }),
                );
              } else if (ventasProductosMatching.length > 0) {
                // Si no encontramos ventasIndividuales, intentar con el formato anterior (métodos de pago directamente en ventaProducto)
                // Buscar la entrada que mejor coincida con este surtidor/manguera
                const ventaProducto =
                  ventasProductosMatching.find((vp) => {
                    // Preferir la que tenga observaciones que mencionen el surtidor/manguera
                    return (
                      vp.observaciones &&
                      (vp.observaciones.includes(surtidor.numeroSurtidor) ||
                        vp.observaciones.includes(manguera.numeroManguera))
                    );
                  }) || ventasProductosMatching[0]; // Si no encuentra, tomar la primera

                if (
                  ventaProducto &&
                  ventaProducto.metodosPago &&
                  ventaProducto.metodosPago.length > 0
                ) {
                  let totalDeclaradoManguera = ventaProducto.metodosPago.reduce(
                    (sum, mp) => sum + mp.monto,
                    0,
                  );

                  // Validar que la suma de métodos de pago coincida con el valor de venta
                  if (Math.abs(totalDeclaradoManguera - valorVenta) > 0.01) {
                    advertencias.push(
                      `${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}: Suma de métodos de pago ($${totalDeclaradoManguera}) no coincide con valor de venta ($${Math.round(valorVenta * 100) / 100})`,
                    );
                  }

                  metodosPagoProducto = ventaProducto.metodosPago.map((mp) => ({
                    metodoPago: mp.metodoPago,
                    monto: Math.round(mp.monto * 100) / 100,
                    porcentaje:
                      totalDeclaradoManguera > 0
                        ? Math.round(
                            (mp.monto / totalDeclaradoManguera) * 100 * 100,
                          ) / 100
                        : 0,
                    observaciones: mp.observaciones,
                  }));
                }
              }
            }

            // ACTUALIZAR LECTURAS DE LA MANGUERA SIEMPRE
            console.log(
              `[CIERRE_TURNO] Actualizando lecturas: surtidor=${surtidor.numeroSurtidor}, manguera=${manguera.numeroManguera}`,
            );

            try {
              const lecturaActualizada =
                await this.surtidoresService.updateMangueraReadingsWithHistory(
                  surtidor.numeroSurtidor,
                  manguera.numeroManguera,
                  manguera.lecturaActual,
                  precioLitro,
                  'cierre_turno',
                  user.id,
                  new Date(cierreTurnoInput.startTime),
                  new Date(cierreTurnoInput.finishTime),
                  `Cierre de turno ${cierreTurnoInput.puntoVentaId} - Cantidad vendida: ${cantidadLitros}L`,
                  undefined, // cierreTurnoId se actualizará después
                  new Date(cierreTurnoInput.finishTime), // fechaLectura con la fecha del proceso
                  cierreTurnoInput.puntoVentaId, // puntoVentaId para filtrar
                );

              if (!lecturaActualizada.success) {
                advertencias.push(
                  `No se pudo actualizar lecturas para surtidor ${surtidor.numeroSurtidor}, manguera ${manguera.numeroManguera}`,
                );
              } else {
                console.log(
                  `[CIERRE_TURNO] Lecturas actualizadas - Cantidad vendida: ${lecturaActualizada.cantidadVendida}G`,
                );
                // Guardar el ID del historial para actualizarlo después con el cierreTurnoId
                if (lecturaActualizada.historialId) {
                  historialesLecturaIds.push(lecturaActualizada.historialId);
                }
              }
            } catch (lecturaError) {
              console.error(
                `[CIERRE_TURNO] Error actualizando lecturas:`,
                lecturaError,
              );
              advertencias.push(
                `Error actualizando lecturas en surtidor ${surtidor.numeroSurtidor}, manguera ${manguera.numeroManguera}: ${lecturaError.message}`,
              );
            }

            // VERIFICAR STOCK Y ACTUALIZAR INVENTARIO
            let stockActualizado = false;

            // Diferenciar manejo según tipo de producto
            if (product.esCombustible) {
              // PARA COMBUSTIBLES: Verificar stock del tanque específico del punto de venta
              try {
                // Buscar tanque específico del punto de venta para este producto
                const tanque = await this.prisma.tanque.findFirst({
                  where: {
                    productoId: product.id,
                    puntoVentaId: cierreTurnoInput.puntoVentaId,
                    activo: true,
                  },
                });

                if (!tanque) {
                  errores.push(
                    `No se encontró tanque activo para ${product.codigo} en punto de venta ${cierreTurnoInput.puntoVentaId}`,
                  );
                } else {
                  const nivelActualTanque = parseFloat(
                    tanque.nivelActual.toString(),
                  );

                  // Para combustibles, verificar contra el nivel del tanque en litros
                  if (cantidadGalones > nivelActualTanque) {
                    errores.push(
                      `Stock insuficiente en tanque para ${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}: necesario ${cantidadGalones}G, disponible ${nivelActualTanque}G en tanque`,
                    );
                  }
                }
              } catch (tankError) {
                errores.push(
                  `Error verificando tanque de ${manguera.codigoProducto}: ${tankError.message}`,
                );
              }
            } else {
              // PARA PRODUCTOS SIN TANQUE (tienda, lubricantes, etc.): Verificar stock del producto en unidades
              const cantidadUnidades =
                product.unidadMedida.toLowerCase() === 'galones'
                  ? cantidadGalones
                  : cantidadLitros;

              if (cantidadUnidades > product.stockActual) {
                errores.push(
                  `Stock insuficiente para ${manguera.codigoProducto} en surtidor ${surtidor.numeroSurtidor}: necesario ${cantidadUnidades} ${product.unidadMedida}, disponible ${product.stockActual} ${product.unidadMedida}`,
                );
              } else {
                try {
                  await this.productsService.updateStock(
                    product.id,
                    cantidadUnidades,
                    'salida',
                  );
                  productosActualizados++;
                  stockActualizado = true;
                  console.log(
                    `[CIERRE_TURNO] Stock actualizado para ${product.codigo}: -${cantidadUnidades} ${product.unidadMedida}`,
                  );
                } catch (stockError) {
                  errores.push(
                    `Error actualizando stock de ${manguera.codigoProducto}: ${stockError.message}`,
                  );
                }
              }
            }

            // Agregar a resumen
            ventasCalculadas.push({
              codigoProducto: manguera.codigoProducto,
              nombreProducto: product.nombre,
              cantidadVendidaGalones: cantidadGalones,
              cantidadVendidaLitros: cantidadLitros,
              precioUnitarioLitro: precioLitro,
              precioUnitarioGalon: precioGalon,
              valorTotalVenta: Math.round(valorVenta * 100) / 100,
              unidadOriginal: manguera.unidadMedida,
              metodosPago: metodosPagoProducto,
            });

            totalSurtidorLitros += cantidadLitros;
            totalSurtidorGalones += cantidadGalones;
            valorTotalSurtidor += valorVenta;
          } catch (error) {
            errores.push(
              `Error procesando manguera ${manguera.numeroManguera} del surtidor ${surtidor.numeroSurtidor}: ${error.message}`,
            );
          }
        }

        resumenSurtidores.push({
          numeroSurtidor: surtidor.numeroSurtidor,
          ventas: ventasCalculadas,
          totalVentasLitros: Math.round(totalSurtidorLitros * 100) / 100,
          totalVentasGalones: Math.round(totalSurtidorGalones * 100) / 100,
          valorTotalSurtidor: Math.round(valorTotalSurtidor * 100) / 100,
          observaciones: surtidor.observaciones,
        });

        totalGeneralLitros += totalSurtidorLitros;
        totalGeneralGalones += totalSurtidorGalones;
        valorTotalGeneral += valorTotalSurtidor;
      }

      // PROCESAR LECTURAS DE TANQUES (si se proporcionaron)
      let resumenTanques = null;
      if (
        cierreTurnoInput.lecturasTanques &&
        cierreTurnoInput.lecturasTanques.length > 0
      ) {
        console.log(
          `[CIERRE_TURNO] Procesando ${cierreTurnoInput.lecturasTanques.length} lecturas de tanques`,
        );
        console.log(
          `[CIERRE_TURNO] Lecturas recibidas:`,
          JSON.stringify(cierreTurnoInput.lecturasTanques, null, 2),
        );

        const lecturasTanquesProcesadas = [];
        let volumenTotalTanques = 0;
        let capacidadTotalTanques = 0;

        for (const lecturaTanque of cierreTurnoInput.lecturasTanques) {
          try {
            console.log(
              `[CIERRE_TURNO] Procesando tanque ${lecturaTanque.nombreTanque} (${lecturaTanque.tanqueId})`,
            );

            // Validar que el tanque existe y pertenece al punto de venta
            const tanque = await this.tanquesService.findOne(
              lecturaTanque.tanqueId,
            );
            console.log(`[CIERRE_TURNO] Tanque encontrado:`, {
              id: tanque.id,
              nombre: tanque.nombre,
              puntoVentaId: tanque.puntoVentaId,
              nivelActual: tanque.nivelActual,
              alturaActual: tanque.alturaActual,
            });

            if (tanque.puntoVentaId !== cierreTurnoInput.puntoVentaId) {
              errores.push(
                `Tanque ${lecturaTanque.nombreTanque} no pertenece al punto de venta ${cierreTurnoInput.puntoVentaId}`,
              );
              console.log(
                `[CIERRE_TURNO] ERROR: Tanque no pertenece al punto de venta. Esperado: ${cierreTurnoInput.puntoVentaId}, Actual: ${tanque.puntoVentaId}`,
              );
              continue;
            }

            // Actualizar la altura del tanque y calcular volumen
            console.log(
              `[CIERRE_TURNO] Actualizando altura del tanque a ${lecturaTanque.alturaFluido}cm`,
            );
            const updateResult = await this.tanquesService.updateLevelByHeight(
              lecturaTanque.tanqueId,
              lecturaTanque.alturaFluido,
            );

            console.log(`[CIERRE_TURNO] Resultado de actualización:`, {
              success: updateResult.success,
              warnings: updateResult.warnings,
              messages: updateResult.messages,
              status: updateResult.status,
              nivelActual: updateResult.tanque?.nivelActual,
              nivelPorcentaje: updateResult.tanque?.nivelPorcentaje,
            });

            if (updateResult.success) {
              tanquesActualizados++;

              lecturasTanquesProcesadas.push({
                tanqueId: lecturaTanque.tanqueId,
                nombreTanque: lecturaTanque.nombreTanque,
                alturaFluido: lecturaTanque.alturaFluido,
                volumenCalculado: updateResult.tanque.nivelActual,
                nivelPorcentaje: updateResult.tanque.nivelPorcentaje,
                tipoTanque: lecturaTanque.tipoTanque || 'FIJO',
                nombreProducto: updateResult.tanque.producto?.nombre,
                codigoProducto: updateResult.tanque.producto?.codigo,
                observaciones: lecturaTanque.observaciones,
                fechaLectura: new Date(),
              });

              volumenTotalTanques += updateResult.tanque.nivelActual;
              capacidadTotalTanques += updateResult.tanque.capacidadTotal;

              console.log(
                `[CIERRE_TURNO] Tanque procesado exitosamente. Volumen total acumulado: ${volumenTotalTanques}L`,
              );

              // Agregar warnings si los hay
              if (updateResult.warnings.length > 0) {
                advertencias.push(
                  ...updateResult.warnings.map(
                    (w) => `Tanque ${lecturaTanque.nombreTanque}: ${w}`,
                  ),
                );
              }
            } else {
              console.log(
                `[CIERRE_TURNO] ERROR: Fallo al actualizar tanque:`,
                updateResult.messages,
              );
              errores.push(
                `Error actualizando tanque ${lecturaTanque.nombreTanque}: ${updateResult.messages.join(', ')}`,
              );
            }
          } catch (error) {
            console.error(
              `[CIERRE_TURNO] EXCEPCION procesando tanque ${lecturaTanque.nombreTanque}:`,
              error,
            );
            errores.push(
              `Error procesando tanque ${lecturaTanque.nombreTanque}: ${error.message}`,
            );
          }
        }

        // Crear resumen de tanques
        if (lecturasTanquesProcesadas.length > 0) {
          const LITROS_TO_GALONES = 0.264172;

          resumenTanques = {
            totalTanques: lecturasTanquesProcesadas.length,
            volumenTotalLitros: Math.round(volumenTotalTanques * 100) / 100,
            volumenTotalGalones:
              Math.round(volumenTotalTanques * LITROS_TO_GALONES * 100) / 100,
            capacidadTotalLitros: Math.round(capacidadTotalTanques * 100) / 100,
            porcentajeOcupacionGeneral:
              capacidadTotalTanques > 0
                ? Math.round(
                    (volumenTotalTanques / capacidadTotalTanques) * 100 * 100,
                  ) / 100
                : 0,
            lecturasTanques: lecturasTanquesProcesadas,
          };

          console.log(`[CIERRE_TURNO] Resumen tanques creado:`, {
            totalTanques: resumenTanques.totalTanques,
            volumenTotal: resumenTanques.volumenTotalLitros,
            ocupacion: resumenTanques.porcentajeOcupacionGeneral,
            lecturas: resumenTanques.lecturasTanques.length,
          });
        } else {
          console.log(
            `[CIERRE_TURNO] No se procesaron tanques exitosamente. lecturasTanquesProcesadas.length = ${lecturasTanquesProcesadas.length}`,
          );
        }
      } else {
        console.log(
          `[CIERRE_TURNO] No se proporcionaron lecturas de tanques o el array está vacío`,
        );
      }

      // PROCESAR VENTAS DE PRODUCTOS DE TIENDA (si se proporcionaron)
      let resumenVentasProductos = null;
      // Array para almacenar las ventas que se registrarán en HistorialVentasProductos
      // dentro de la transacción después de crear el turno
      const ventasParaRegistrarEnHistorial: Array<{
        productoId: string;
        codigoProducto: string;
        unidadMedida: string;
        ventasIndividuales: Array<{
          cantidad: number;
          precioUnitario: number;
          valorTotal: number;
          observaciones?: string;
          metodosPago: Array<{
            metodoPago: string;
            monto: number;
          }>;
        }>;
      }> = [];

      if (
        cierreTurnoInput.ventasProductos &&
        cierreTurnoInput.ventasProductos.length > 0
      ) {
        console.log(
          `[CIERRE_TURNO] Procesando ${cierreTurnoInput.ventasProductos.length} ventas de productos`,
        );

        const ventasDetalle = [];
        let productosVentaExitosos = 0;
        let productosVentaConError = 0;
        let valorTotalVentasProductos = 0;

        for (const ventaProducto of cierreTurnoInput.ventasProductos) {
          try {
            console.log(
              `[CIERRE_TURNO] Procesando venta de producto: ${ventaProducto.codigoProducto} - Cantidad: ${ventaProducto.cantidad}`,
            );

            // Buscar el producto
            const product = await this.productsService.findByCode(
              ventaProducto.codigoProducto,
            );
            if (!product) {
              errores.push(
                `Producto no encontrado: ${ventaProducto.codigoProducto}`,
              );
              ventasDetalle.push({
                codigoProducto: ventaProducto.codigoProducto,
                nombreProducto: 'PRODUCTO NO ENCONTRADO',
                cantidadVendida: 0,
                unidadMedida: ventaProducto.unidadMedida,
                precioUnitario: ventaProducto.precioUnitario,
                valorTotalVenta: 0,
                stockAnterior: 0,
                stockActual: 0,
                procesadoExitosamente: false,
                error: 'Producto no encontrado',
                observaciones: ventaProducto.observaciones,
              });
              productosVentaConError++;
              continue;
            }

            console.log(
              `[CIERRE_TURNO] Producto encontrado: ${product.codigo} - Stock actual: ${product.stockActual}`,
            );

            let ventasIndividualesDetalle = [];
            let cantidadTotalProducto = 0;
            let valorTotalProducto = 0;
            let metodosPagoConsolidados = [];

            // Determinar si usar formato nuevo (ventasIndividuales) o formato anterior
            if (
              ventaProducto.ventasIndividuales &&
              ventaProducto.ventasIndividuales.length > 0
            ) {
              // FORMATO NUEVO: Ventas individuales por unidad
              console.log(
                `[CIERRE_TURNO] Procesando ${ventaProducto.ventasIndividuales.length} ventas individuales de ${ventaProducto.codigoProducto}`,
              );

              for (const ventaIndividual of ventaProducto.ventasIndividuales) {
                const valorCalculadoIndividual =
                  ventaIndividual.cantidad * ventaIndividual.precioUnitario;

                // Validar valor individual
                if (
                  Math.abs(
                    valorCalculadoIndividual - ventaIndividual.valorTotal,
                  ) > 0.01
                ) {
                  advertencias.push(
                    `${ventaProducto.codigoProducto} (venta individual): Valor calculado (${valorCalculadoIndividual}) no coincide con declarado (${ventaIndividual.valorTotal})`,
                  );
                }

                // Procesar métodos de pago de la venta individual
                let totalDeclaradoVentaIndividual =
                  ventaIndividual.metodosPago.reduce(
                    (sum, mp) => sum + mp.monto,
                    0,
                  );

                if (
                  Math.abs(
                    totalDeclaradoVentaIndividual - ventaIndividual.valorTotal,
                  ) > 0.01
                ) {
                  advertencias.push(
                    `${ventaProducto.codigoProducto} (venta individual): Suma de métodos de pago ($${totalDeclaradoVentaIndividual}) no coincide con valor total ($${ventaIndividual.valorTotal})`,
                  );
                }

                const metodosPagoVentaIndividual =
                  ventaIndividual.metodosPago.map((mp) => ({
                    metodoPago: mp.metodoPago,
                    monto: Math.round(mp.monto * 100) / 100,
                    porcentaje:
                      totalDeclaradoVentaIndividual > 0
                        ? Math.round(
                            (mp.monto / totalDeclaradoVentaIndividual) *
                              100 *
                              100,
                          ) / 100
                        : 0,
                    observaciones: mp.observaciones,
                  }));

                // Agregar a totales
                cantidadTotalProducto += ventaIndividual.cantidad;
                valorTotalProducto += ventaIndividual.valorTotal;

                // Consolidar métodos de pago
                for (const mp of ventaIndividual.metodosPago) {
                  const existente = metodosPagoConsolidados.find(
                    (consolidado) => consolidado.metodoPago === mp.metodoPago,
                  );
                  if (existente) {
                    existente.monto += mp.monto;
                  } else {
                    metodosPagoConsolidados.push({
                      metodoPago: mp.metodoPago,
                      monto: mp.monto,
                      observaciones: mp.observaciones,
                    });
                  }
                }

                ventasIndividualesDetalle.push({
                  cantidad: ventaIndividual.cantidad,
                  precioUnitario: ventaIndividual.precioUnitario,
                  valorTotal: ventaIndividual.valorTotal,
                  metodosPago: metodosPagoVentaIndividual,
                  procesadoExitosamente: true,
                  error: null,
                  observaciones: ventaIndividual.observaciones,
                });
              }
            } else if (
              ventaProducto.cantidad &&
              ventaProducto.precioUnitario &&
              ventaProducto.valorTotal
            ) {
              // FORMATO ANTERIOR: Una sola venta consolidada
              console.log(
                `[CIERRE_TURNO] Procesando venta consolidada de ${ventaProducto.codigoProducto}`,
              );

              cantidadTotalProducto = ventaProducto.cantidad;
              valorTotalProducto = ventaProducto.valorTotal;

              // Validar valor total
              const valorCalculado =
                ventaProducto.cantidad * ventaProducto.precioUnitario;
              if (Math.abs(valorCalculado - ventaProducto.valorTotal) > 0.01) {
                advertencias.push(
                  `${ventaProducto.codigoProducto}: Valor total no coincide. Calculado: ${valorCalculado}, Declarado: ${ventaProducto.valorTotal}`,
                );
              }

              // Procesar métodos de pago del producto (formato anterior)
              if (
                ventaProducto.metodosPago &&
                ventaProducto.metodosPago.length > 0
              ) {
                let totalDeclaradoProducto = ventaProducto.metodosPago.reduce(
                  (sum, mp) => sum + mp.monto,
                  0,
                );

                if (
                  Math.abs(totalDeclaradoProducto - ventaProducto.valorTotal) >
                  0.01
                ) {
                  advertencias.push(
                    `${ventaProducto.codigoProducto}: Suma de métodos de pago ($${totalDeclaradoProducto}) no coincide con valor total ($${ventaProducto.valorTotal})`,
                  );
                }

                metodosPagoConsolidados = ventaProducto.metodosPago.map(
                  (mp) => ({
                    metodoPago: mp.metodoPago,
                    monto: Math.round(mp.monto * 100) / 100,
                    observaciones: mp.observaciones,
                  }),
                );
              }
            } else {
              errores.push(
                `${ventaProducto.codigoProducto}: Debe especificar ventasIndividuales o los campos cantidad/precioUnitario/valorTotal`,
              );
              ventasDetalle.push({
                codigoProducto: ventaProducto.codigoProducto,
                nombreProducto: product.nombre,
                cantidadVendida: 0,
                unidadMedida: ventaProducto.unidadMedida,
                precioUnitario: 0,
                valorTotalVenta: 0,
                stockAnterior: product.stockActual,
                stockActual: product.stockActual,
                procesadoExitosamente: false,
                error: 'Datos de venta incompletos',
                observaciones: ventaProducto.observaciones,
              });
              productosVentaConError++;
              continue;
            }

            // Verificar stock disponible
            if (product.stockActual < cantidadTotalProducto) {
              const error = `Stock insuficiente. Disponible: ${product.stockActual}, Solicitado: ${cantidadTotalProducto}`;
              errores.push(`${ventaProducto.codigoProducto}: ${error}`);
              ventasDetalle.push({
                codigoProducto: ventaProducto.codigoProducto,
                nombreProducto: product.nombre,
                cantidadVendida: 0,
                unidadMedida: ventaProducto.unidadMedida,
                precioUnitario: ventaProducto.precioUnitario || 0,
                valorTotalVenta: 0,
                stockAnterior: product.stockActual,
                stockActual: product.stockActual,
                procesadoExitosamente: false,
                ventasIndividuales:
                  ventasIndividualesDetalle.length > 0
                    ? ventasIndividualesDetalle
                    : undefined,
                error,
                observaciones: ventaProducto.observaciones,
              });
              productosVentaConError++;
              continue;
            }

            // Actualizar stock del producto
            try {
              await this.productsService.updateStock(
                product.id,
                cantidadTotalProducto,
                'salida',
              );
              productosActualizados++;

              // Contar venta de producto
              ventasProductosCalculadas++;

              console.log(
                `[CIERRE_TURNO] Stock actualizado para ${product.codigo}: -${cantidadTotalProducto} ${product.unidadMedida}`,
              );

              // Guardar información para registrar después en la transacción con el turno correcto
              // IMPORTANTE: Solo registrar productos tipo BEBIDA y LUBRICANTE (NO combustibles)
              // Cuando seleccionPorProducto = true, también registrar combustibles si vienen en ventasProductos
              if (!product.esCombustible || seleccionPorProducto) {
                // Si tiene ventasIndividuales, usar ese formato
                if (ventasIndividualesDetalle.length > 0) {
                  // Verificar que el producto sea bebida, lubricante, o combustible (si flag activo)
                  const debeRegistrar = 
                    product.tipoProducto?.toLowerCase() === 'bebida' ||
                    product.tipoProducto?.toLowerCase() === 'lubricante' ||
                    (seleccionPorProducto && product.esCombustible) ||
                    (!product.esCombustible && product.tipoProducto); // Si no es combustible y tiene tipoProducto
                  
                  if (debeRegistrar) {
                    ventasParaRegistrarEnHistorial.push({
                      productoId: product.id,
                      codigoProducto: product.codigo,
                      unidadMedida: ventaProducto.unidadMedida,
                      ventasIndividuales: ventasIndividualesDetalle.map((vi) => ({
                        cantidad: vi.cantidad,
                        precioUnitario: vi.precioUnitario,
                        valorTotal: vi.valorTotal,
                        observaciones: vi.observaciones,
                        metodosPago: vi.metodosPago.map((mp) => ({
                          metodoPago: mp.metodoPago,
                          monto: mp.monto,
                        })),
                      })),
                    });
                    console.log(
                      `[CIERRE_TURNO] Venta preparada para registro (${product.tipoProducto || 'combustible'}): ${product.codigo} - ${ventasIndividualesDetalle.length} venta(s) individual(es)`,
                    );
                  } else {
                    console.warn(
                      `[CIERRE_TURNO] Producto ${product.codigo} omitido: esCombustible=${product.esCombustible}, tipoProducto=${product.tipoProducto}. Solo se registran bebidas, lubricantes${seleccionPorProducto ? ' y combustibles (flag activo)' : ''}.`,
                    );
                  }
                } 
                // Si NO tiene ventasIndividuales pero tiene métodos de pago consolidados (formato anterior o cuando flag activo)
                else if (metodosPagoConsolidados.length > 0 && (seleccionPorProducto || !product.esCombustible)) {
                  // Crear una venta individual consolidada para guardar en historial
                  const debeRegistrar = 
                    product.tipoProducto?.toLowerCase() === 'bebida' ||
                    product.tipoProducto?.toLowerCase() === 'lubricante' ||
                    (seleccionPorProducto && product.esCombustible) ||
                    (!product.esCombustible && product.tipoProducto);
                  
                  if (debeRegistrar) {
                    ventasParaRegistrarEnHistorial.push({
                      productoId: product.id,
                      codigoProducto: product.codigo,
                      unidadMedida: ventaProducto.unidadMedida,
                      ventasIndividuales: [{
                        cantidad: cantidadTotalProducto,
                        precioUnitario: valorTotalProducto / cantidadTotalProducto,
                        valorTotal: valorTotalProducto,
                        observaciones: ventaProducto.observaciones,
                        metodosPago: metodosPagoConsolidados.map((mp) => ({
                          metodoPago: mp.metodoPago,
                          monto: mp.monto,
                        })),
                      }],
                    });
                    console.log(
                      `[CIERRE_TURNO] Venta consolidada preparada para registro (${product.tipoProducto || 'combustible'}): ${product.codigo} - ${cantidadTotalProducto} ${ventaProducto.unidadMedida}`,
                    );
                  }
                }
              } else if (product.esCombustible && !seleccionPorProducto) {
                console.warn(
                  `[CIERRE_TURNO] Producto ${product.codigo} es combustible y NO se registrará en HistorialVentasProductos. Los combustibles se registran en HistorialLectura.`,
                );
              }

              // Calcular métodos de pago consolidados con porcentajes
              const metodosPagoProductoFinal = metodosPagoConsolidados.map(
                (mp) => ({
                  metodoPago: mp.metodoPago,
                  monto: Math.round(mp.monto * 100) / 100,
                  porcentaje:
                    valorTotalProducto > 0
                      ? Math.round(
                          (mp.monto / valorTotalProducto) * 100 * 100,
                        ) / 100
                      : 0,
                  observaciones: mp.observaciones,
                }),
              );

              ventasDetalle.push({
                codigoProducto: ventaProducto.codigoProducto,
                nombreProducto: product.nombre,
                cantidadVendida: cantidadTotalProducto,
                unidadMedida: ventaProducto.unidadMedida,
                precioUnitario: valorTotalProducto / cantidadTotalProducto, // Precio promedio
                valorTotalVenta: valorTotalProducto,
                stockAnterior: product.stockActual,
                stockActual: product.stockActual - cantidadTotalProducto,
                procesadoExitosamente: true,
                ventasIndividuales:
                  ventasIndividualesDetalle.length > 0
                    ? ventasIndividualesDetalle
                    : undefined,
                metodosPago: metodosPagoProductoFinal,
                error: null,
                observaciones: ventaProducto.observaciones,
              });

              productosVentaExitosos++;
              valorTotalVentasProductos += valorTotalProducto;

              // Agregar al valor total general
              valorTotalGeneral += valorTotalProducto;

              // Advertencia si el stock queda muy bajo
              const stockFinal = product.stockActual - cantidadTotalProducto;
              if (stockFinal <= product.stockMinimo && stockFinal > 0) {
                advertencias.push(
                  `${ventaProducto.codigoProducto}: Stock bajo después de la venta (${stockFinal} <= ${product.stockMinimo})`,
                );
              } else if (stockFinal === 0) {
                advertencias.push(
                  `${ventaProducto.codigoProducto}: Producto agotado después de la venta`,
                );
              }
            } catch (stockError) {
              errores.push(
                `Error actualizando stock de ${ventaProducto.codigoProducto}: ${stockError.message}`,
              );
              ventasDetalle.push({
                codigoProducto: ventaProducto.codigoProducto,
                nombreProducto: product.nombre,
                cantidadVendida: 0,
                unidadMedida: ventaProducto.unidadMedida,
                precioUnitario: ventaProducto.precioUnitario || 0,
                valorTotalVenta: 0,
                stockAnterior: product.stockActual,
                stockActual: product.stockActual,
                procesadoExitosamente: false,
                ventasIndividuales:
                  ventasIndividualesDetalle.length > 0
                    ? ventasIndividualesDetalle
                    : undefined,
                error: stockError.message,
                observaciones: ventaProducto.observaciones,
              });
              productosVentaConError++;
            }
          } catch (error) {
            console.error(
              `[CIERRE_TURNO] EXCEPCION procesando venta de producto ${ventaProducto.codigoProducto}:`,
              error,
            );
            errores.push(
              `Error procesando venta de ${ventaProducto.codigoProducto}: ${error.message}`,
            );
            ventasDetalle.push({
              codigoProducto: ventaProducto.codigoProducto,
              nombreProducto: 'ERROR',
              cantidadVendida: 0,
              unidadMedida: ventaProducto.unidadMedida,
              precioUnitario: ventaProducto.precioUnitario,
              valorTotalVenta: 0,
              stockAnterior: 0,
              stockActual: 0,
              procesadoExitosamente: false,
              error: error.message,
              observaciones: ventaProducto.observaciones,
            });
            productosVentaConError++;
          }
        }

        // Crear resumen de ventas de productos
        resumenVentasProductos = {
          totalProductosVendidos: cierreTurnoInput.ventasProductos.length,
          productosExitosos: productosVentaExitosos,
          productosConError: productosVentaConError,
          valorTotalVentasProductos:
            Math.round(valorTotalVentasProductos * 100) / 100,
          ventasDetalle,
        };

        console.log(`[CIERRE_TURNO] Resumen ventas productos creado:`, {
          totalProductos: resumenVentasProductos.totalProductosVendidos,
          exitosos: resumenVentasProductos.productosExitosos,
          conError: resumenVentasProductos.productosConError,
          valorTotal: resumenVentasProductos.valorTotalVentasProductos,
        });
      } else {
        console.log(`[CIERRE_TURNO] No se proporcionaron ventas de productos`);
      }

      const estado = errores.length > 0 ? 'con_errores' : 'exitoso';

      console.log(`[CIERRE_TURNO] Procesamiento completado:`, {
        puntoVenta: cierreTurnoInput.puntoVentaId,
        totalLitros: totalGeneralLitros,
        totalGalones: totalGeneralGalones,
        valorTotal: valorTotalGeneral,
        productosActualizados,
        tanquesActualizados,
        estado,
      });

      // CONSOLIDAR MÉTODOS DE PAGO DESDE ventasProductos
      const metodosPagoConsolidadosGlobal: any[] = [];
      
      if (cierreTurnoInput.ventasProductos && cierreTurnoInput.ventasProductos.length > 0) {
        for (const ventaProducto of cierreTurnoInput.ventasProductos) {
          if (ventaProducto.ventasIndividuales && ventaProducto.ventasIndividuales.length > 0) {
            for (const ventaIndividual of ventaProducto.ventasIndividuales) {
              if (ventaIndividual.metodosPago && ventaIndividual.metodosPago.length > 0) {
                for (const mp of ventaIndividual.metodosPago) {
                  const existente = metodosPagoConsolidadosGlobal.find(
                    (consolidado) => consolidado.metodoPago === mp.metodoPago,
                  );
                  if (existente) {
                    existente.monto += mp.monto || 0;
                  } else {
                    metodosPagoConsolidadosGlobal.push({
                      metodoPago: mp.metodoPago,
                      monto: mp.monto || 0,
                      observaciones: mp.observaciones || '',
                    });
                  }
                }
              }
            }
          } else if (ventaProducto.metodosPago && ventaProducto.metodosPago.length > 0) {
            // Formato anterior: métodos de pago directamente en ventaProducto
            for (const mp of ventaProducto.metodosPago) {
              const existente = metodosPagoConsolidadosGlobal.find(
                (consolidado) => consolidado.metodoPago === mp.metodoPago,
              );
              if (existente) {
                existente.monto += mp.monto || 0;
              } else {
                metodosPagoConsolidadosGlobal.push({
                  metodoPago: mp.metodoPago,
                  monto: mp.monto || 0,
                  observaciones: mp.observaciones || '',
                });
              }
            }
          }
        }
      }

      // Si hay métodos de pago consolidados desde ventasProductos, usarlos
      // Solo usar resumenVentas.metodosPago si NO hay métodos consolidados o si es DETALLADO_POR_PRODUCTO
      let metodosPagoAProcesar = cierreTurnoInput.resumenVentas?.metodosPago || [];
      
      // Si seleccionPorProducto = true, priorizar métodos consolidados por producto
      if (seleccionPorProducto && metodosPagoConsolidadosGlobal.length > 0) {
        console.log(
          '[CIERRE_TURNO] Modo: Métodos de pago por producto consolidado. ' +
          `Usando ${metodosPagoConsolidadosGlobal.length} métodos consolidados.`
        );
        metodosPagoAProcesar = metodosPagoConsolidadosGlobal;
      } else if (metodosPagoConsolidadosGlobal.length > 0) {
        // Verificar si resumenVentas tiene DETALLADO_POR_PRODUCTO
        const tieneDetalladoPorProducto = metodosPagoAProcesar.some(
          (mp: any) => mp.metodoPago === 'DETALLADO_POR_PRODUCTO'
        );
        
        if (tieneDetalladoPorProducto) {
          // Usar los métodos consolidados de ventasProductos en lugar de DETALLADO_POR_PRODUCTO
          metodosPagoAProcesar = metodosPagoConsolidadosGlobal;
          console.log('[CIERRE_TURNO] Usando métodos de pago consolidados desde ventasProductos:', metodosPagoConsolidadosGlobal);
        } else {
          // Combinar ambos: primero los de resumenVentas, luego consolidar con los de ventasProductos
          const metodosPagoCombinados = [...metodosPagoAProcesar];
          for (const mpConsolidado of metodosPagoConsolidadosGlobal) {
            const existente = metodosPagoCombinados.find(
              (mp: any) => mp.metodoPago === mpConsolidado.metodoPago
            );
            if (existente) {
              existente.monto += mpConsolidado.monto;
            } else {
              metodosPagoCombinados.push(mpConsolidado);
            }
          }
          metodosPagoAProcesar = metodosPagoCombinados;
        }
      }

      // VALIDAR Y PROCESAR MÉTODOS DE PAGO
      console.log('[CIERRE_TURNO] Procesando métodos de pago:', {
        resumenVentas: cierreTurnoInput.resumenVentas,
        tieneMetodosPago: cierreTurnoInput.resumenVentas?.metodosPago?.length || 0,
        metodosPagoConsolidadosGlobal: metodosPagoConsolidadosGlobal.length,
        metodosPagoAProcesar: metodosPagoAProcesar.length,
        valorTotalGeneral,
      });

      // Crear un objeto resumenVentas modificado con los métodos de pago consolidados
      const resumenVentasProcesado = {
        ...cierreTurnoInput.resumenVentas,
        metodosPago: metodosPagoAProcesar,
      };

      const resumenFinanciero = this.procesarMetodosPagoTurno(
        resumenVentasProcesado,
        valorTotalGeneral,
        errores,
        advertencias,
      );

      console.log('[CIERRE_TURNO] Resumen financiero procesado:', {
        totalDeclarado: resumenFinanciero.totalDeclarado,
        totalCalculado: resumenFinanciero.totalCalculado,
        diferencia: resumenFinanciero.diferencia,
        cantidadMetodosPago: resumenFinanciero.metodosPago?.length || 0,
        metodosPago: resumenFinanciero.metodosPago,
      });

      // CALCULAR ESTADÍSTICAS DE VENTAS
      const cantidadVentasDeclaradas =
        cierreTurnoInput.cantidadVentasRealizadas || 0;
      const cantidadVentasCalculadas =
        ventasCombustiblesCalculadas + ventasProductosCalculadas;

      const estadisticasVentas = {
        cantidadVentasDeclaradas,
        cantidadVentasCalculadas,
        ventasCombustibles: ventasCombustiblesCalculadas,
        ventasProductos: ventasProductosCalculadas,
        promedioVentaPorTransaccion:
          cantidadVentasCalculadas > 0
            ? Math.round((valorTotalGeneral / cantidadVentasCalculadas) * 100) /
              100
            : 0,
        observaciones:
          cantidadVentasDeclaradas !== cantidadVentasCalculadas
            ? `Diferencia entre ventas declaradas (${cantidadVentasDeclaradas}) y calculadas (${cantidadVentasCalculadas})`
            : 'Las ventas declaradas coinciden con las calculadas',
      };

      // Agregar advertencia si hay diferencia en cantidad de ventas
      if (cantidadVentasDeclaradas > 0 &&
        cantidadVentasDeclaradas !== cantidadVentasCalculadas
      ) {
        advertencias.push(
          `Diferencia en cantidad de ventas: Declaradas=${cantidadVentasDeclaradas}, Calculadas=${cantidadVentasCalculadas}`,
        );
      }

      // GUARDAR EN BASE DE DATOS - OPERACIÓN TRANSACCIONAL
      const resultado = await this.prisma.$transaction(async (prisma) => {
        // Función auxiliar para extraer hora en formato HH:mm
        const extraerHoraEnFormatoHHmm = (isoString: string): string => {
          const date = new Date(isoString);
          const hours = date.getUTCHours().toString().padStart(2, '0');
          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
          return `${hours}:${minutes}`;
        };

        // Extraer fecha y horas de startTime y finishTime
        const fechaInicio = new Date(cierreTurnoInput.startTime);
        const fechaFin = new Date(cierreTurnoInput.finishTime);
        const fechaInicioSolo = fechaInicio.toISOString().split('T')[0]; // Solo la fecha "2025-09-01"
        const horaInicio = extraerHoraEnFormatoHHmm(cierreTurnoInput.startTime); // "06:00"
        const horaFin = extraerHoraEnFormatoHHmm(cierreTurnoInput.finishTime); // "14:00"

        // Normalizar fechaInicio para comparar solo la fecha (sin hora)
        const fechaInicioInicio = new Date(fechaInicio);
        fechaInicioInicio.setUTCHours(0, 0, 0, 0);
        const fechaInicioFin = new Date(fechaInicio);
        fechaInicioFin.setUTCHours(23, 59, 59, 999);

        // Buscar turno existente considerando TODOS los campos únicos
        // Criterio de unicidad: fechaInicio (solo fecha) + puntoVentaId + horaInicio + horaFin
        const turnoExistente = await prisma.turno.findFirst({
          where: {
            fechaInicio: {
              gte: fechaInicioInicio,
              lte: fechaInicioFin,
            },
            puntoVentaId: cierreTurnoInput.puntoVentaId,
            horaInicio: horaInicio,
            horaFin: horaFin,
          },
        });

        // SIEMPRE crear nuevo turno, NUNCA actualizar existente
        // Si existe un turno con los mismos datos, lanzar error
        if (turnoExistente) {
          throw new ConflictException(
            `Ya existe un turno para esta fecha (${fechaInicioSolo}), punto de venta y horas (${horaInicio} - ${horaFin}). Turno ID: ${turnoExistente.id}`
          );
        }

        // Crear NUEVO turno
        const turno = await prisma.turno.create({
            data: {
            fechaInicio: fechaInicio,
            fechaFin: fechaFin,
            horaInicio: horaInicio, // Formato "HH:mm" (ej: "06:00", "14:00")
            horaFin: horaFin, // Formato "HH:mm" (ej: "14:00", "22:00")
              puntoVentaId: cierreTurnoInput.puntoVentaId,
              usuarioId: user.id,
            observaciones: cierreTurnoInput.observacionesGenerales || `Turno automático para cierre de ${cierreTurnoInput.puntoVentaId}`,
            activo: true,
            },
          });

        // REGISTRAR VENTAS DE PRODUCTOS (BEBIDAS Y LUBRICANTES) EN HistorialVentasProductos
        // Ahora que tenemos el turno creado, registramos las ventas con el turno correcto
        if (ventasParaRegistrarEnHistorial.length > 0) {
          console.log(
            `[CIERRE_TURNO] Registrando ${ventasParaRegistrarEnHistorial.length} productos en HistorialVentasProductos con turno ${turno.id}`,
          );

          for (const ventaProducto of ventasParaRegistrarEnHistorial) {
            // Validación adicional: Verificar que el producto NO sea combustible
            const productoDb = await prisma.producto.findUnique({
              where: { id: ventaProducto.productoId },
              select: { id: true, codigo: true, esCombustible: true, tipoProducto: true },
            });

            if (!productoDb) {
              console.warn(
                `[CIERRE_TURNO] Producto no encontrado: ${ventaProducto.productoId}`,
              );
              advertencias.push(
                `Producto no encontrado: ${ventaProducto.codigoProducto}`,
              );
              continue;
            }

            // Verificar que el producto sea válido para registrar
            // Si seleccionPorProducto = true, también permitir combustibles
            // Si seleccionPorProducto = false, solo bebidas y lubricantes
            const esBebidaOLubricante =
              productoDb.tipoProducto?.toLowerCase() === 'bebida' ||
              productoDb.tipoProducto?.toLowerCase() === 'lubricante';

            const esCombustibleYFlagActivo = productoDb.esCombustible && seleccionPorProducto;

            if (productoDb.esCombustible && !seleccionPorProducto) {
              console.warn(
                `[CIERRE_TURNO] Producto ${productoDb.codigo} es combustible y NO se registrará en HistorialVentasProductos. Los combustibles se registran en HistorialLectura.`,
              );
              continue;
            }

            if (!esBebidaOLubricante && !esCombustibleYFlagActivo) {
              console.warn(
                `[CIERRE_TURNO] Producto ${productoDb.codigo} (tipo: ${productoDb.tipoProducto}, esCombustible: ${productoDb.esCombustible}) NO es válido para registrar. Solo se registran bebidas, lubricantes${seleccionPorProducto ? ' y combustibles (flag activo)' : ''} en HistorialVentasProductos.`,
              );
              continue;
            }

            for (const ventaIndividual of ventaProducto.ventasIndividuales) {
              for (const metodoPago of ventaIndividual.metodosPago) {
                try {
                  // Buscar el método de pago por código
                  const metodoPagoDb = await prisma.metodoPago.findUnique({
                    where: { codigo: metodoPago.metodoPago },
                  });

                  if (metodoPagoDb) {
                    // Calcular un punto medio entre fechaInicio y fechaFin del turno
                    // Esto asegura que el producto quede dentro del rango específico del turno
                    // y no aparezca en turnos anteriores o posteriores que puedan solaparse en los límites
                    const fechaInicioTurno = new Date(turno.fechaInicio);
                    const fechaFinTurno = new Date(turno.fechaFin);
                    const puntoMedioTurno = new Date(
                      (fechaInicioTurno.getTime() + fechaFinTurno.getTime()) / 2
                    );
                    
                    await prisma.historialVentasProductos.create({
                      data: {
                        fechaVenta: puntoMedioTurno, // ✅ Usar punto medio del turno para que quede dentro del rango específico
                        cantidadVendida: ventaIndividual.cantidad,
                        precioUnitario: ventaIndividual.precioUnitario,
                        valorTotal: ventaIndividual.valorTotal,
                        unidadMedida: ventaProducto.unidadMedida,
                        observaciones:
                          ventaIndividual.observaciones ||
                          `Venta registrada en cierre de turno - ${metodoPago.metodoPago}`,
                        productoId: ventaProducto.productoId,
                        metodoPagoId: metodoPagoDb.id,
                        usuarioId: user.id,
                        turnoId: turno.id, // ✅ Usando el turno recién creado
                        puntoVentaId: cierreTurnoInput.puntoVentaId,
                      },
                    });
                    console.log(
                      `[CIERRE_TURNO] Venta registrada en historial (${productoDb.tipoProducto}): ${ventaProducto.codigoProducto} - ${ventaIndividual.cantidad} ${ventaProducto.unidadMedida} - ${metodoPago.metodoPago} - Turno: ${turno.id}`,
                    );
                  } else {
                    console.warn(
                      `[CIERRE_TURNO] Método de pago no encontrado: ${metodoPago.metodoPago}`,
                    );
                    advertencias.push(
                      `Método de pago no encontrado: ${metodoPago.metodoPago} para producto ${ventaProducto.codigoProducto}`,
                    );
                  }
                } catch (error) {
                  console.error(
                    `[CIERRE_TURNO] Error al registrar venta individual en historial:`,
                    error,
                  );
                  advertencias.push(
                    `Error al registrar venta de ${ventaProducto.codigoProducto} en historial: ${error.message}`,
                  );
                }
              }
            }
          }
          console.log(
            `[CIERRE_TURNO] ${ventasParaRegistrarEnHistorial.length} productos registrados exitosamente en HistorialVentasProductos con turno ${turno.id}`,
          );
        } else {
          console.log(
            `[CIERRE_TURNO] No hay ventas de productos para registrar en HistorialVentasProductos`,
          );
        }

        // CREAR ESTRUCTURA COMPLETA CON TODA LA INFORMACIÓN
        const datosCompletosCierre = {
          // === DATOS DE ENTRADA ORIGINALES ===
          datosEntrada: {
            puntoVentaId: cierreTurnoInput.puntoVentaId,
            startTime: cierreTurnoInput.startTime,
            finishTime: cierreTurnoInput.finishTime,
            observacionesGenerales: cierreTurnoInput.observacionesGenerales,
            cantidadVentasRealizadas: cierreTurnoInput.cantidadVentasRealizadas,

            // Lecturas de surtidores ORIGINALES (tal como se enviaron)
            lecturasSurtidores: cierreTurnoInput.lecturasSurtidores.map(
              (surtidor) => ({
                numeroSurtidor: surtidor.numeroSurtidor,
                observaciones: surtidor.observaciones,
                mangueras: surtidor.mangueras.map((manguera) => ({
                  numeroManguera: manguera.numeroManguera,
                  codigoProducto: manguera.codigoProducto,
                  lecturaAnterior: manguera.lecturaAnterior,
                  lecturaActual: manguera.lecturaActual,
                  unidadMedida: manguera.unidadMedida,
                  observaciones: manguera.observaciones,
                })),
              }),
            ),

            // Lecturas de tanques ORIGINALES (tal como se enviaron)
            lecturasTanques:
              cierreTurnoInput.lecturasTanques?.map((tanque) => ({
                tanqueId: tanque.tanqueId,
                nombreTanque: tanque.nombreTanque,
                alturaFluido: tanque.alturaFluido,
                tipoTanque: tanque.tipoTanque,
                observaciones: tanque.observaciones,
              })) || [],

            // Ventas de productos ORIGINALES (tal como se enviaron)
            ventasProductos:
              cierreTurnoInput.ventasProductos?.map((venta) => ({
                codigoProducto: venta.codigoProducto,
                cantidad: venta.cantidad,
                unidadMedida: venta.unidadMedida,
                precioUnitario: venta.precioUnitario,
                valorTotal: venta.valorTotal,
                observaciones: venta.observaciones,
              })) || [],

            // Resumen de ventas ORIGINAL (tal como se envió)
            resumenVentas: {
              totalVentasTurno: cierreTurnoInput.resumenVentas.totalVentasTurno,
              observaciones: cierreTurnoInput.resumenVentas.observaciones,
              metodosPago: cierreTurnoInput.resumenVentas.metodosPago.map(
                (pago) => ({
                  metodoPago: pago.metodoPago,
                  monto: pago.monto,
                  observaciones: pago.observaciones,
                }),
              ),
            },
          },

          // === DATOS PROCESADOS Y CALCULADOS ===
          datosProcesados: {
            // Resumen de surtidores PROCESADO
            resumenSurtidores: resumenSurtidores,

            // Resumen de tanques PROCESADO (si existe)
            resumenTanques: resumenTanques,

            // Resumen de ventas de productos PROCESADO (si existe)
            resumenVentasProductos: resumenVentasProductos,

            // Estadísticas de ventas CALCULADAS
            estadisticasVentas: estadisticasVentas,

            // Resumen financiero PROCESADO
            resumenFinanciero: resumenFinanciero,

            // Totales calculados
            totales: {
              totalGeneralLitros: Math.round(totalGeneralLitros * 100) / 100,
              totalGeneralGalones: Math.round(totalGeneralGalones * 100) / 100,
              valorTotalGeneral: Math.round(valorTotalGeneral * 100) / 100,
              productosActualizados: productosActualizados,
              tanquesActualizados: tanquesActualizados,
            },
          },

          // === METADATOS DEL PROCESAMIENTO ===
          metadatosProcesamiento: {
            fechaProceso: new Date(),
            usuarioId: user.id,
            usuarioNombre: `${user.nombre} ${user.apellido}`,
            usuarioEmail: user.email,
            estado: estado,
            errores: errores,
            advertencias: advertencias,
            tiempoProcesamiento:
              new Date().getTime() -
              new Date(cierreTurnoInput.startTime).getTime(),
            versionProcesador: '1.0.0',
          },
        };

        // Crear el cierre de turno con toda la información completa
        const cierre = await prisma.cierreTurno.create({
          data: {
            turnoId: turno.id,
            usuarioId: user.id,
            fechaCierre: new Date(),
            totalVentasLitros: totalGeneralLitros,
            totalVentasGalones: totalGeneralGalones,
            valorTotalGeneral: valorTotalGeneral,

            // Datos financieros principales
            totalDeclarado: resumenFinanciero.totalDeclarado,
            diferencia: resumenFinanciero.diferencia,
            totalEfectivo: resumenFinanciero.totalEfectivo,
            totalTarjetas: resumenFinanciero.totalTarjetas,
            totalTransferencias: resumenFinanciero.totalTransferencias,
            totalRumbo: resumenFinanciero.totalRumbo,
            totalBonosViveTerpel: resumenFinanciero.totalBonosViveTerpel,
            totalOtros: resumenFinanciero.totalOtros,
            observacionesFinancieras: resumenFinanciero.observaciones,

            productosActualizados,
            tanquesActualizados,
            estado,
            errores: errores.length > 0 ? errores : [],
            advertencias: advertencias.length > 0 ? advertencias : [],

            // *** AQUÍ SE ALMACENA TODA LA INFORMACIÓN COMPLETA ***
            resumenSurtidores: datosCompletosCierre,

            observacionesGenerales:
              cierreTurnoInput.observacionesGenerales ||
              `Cierre procesado - Total declarado: $${resumenFinanciero.totalDeclarado}, Total calculado: $${resumenFinanciero.totalCalculado}, Diferencia: $${resumenFinanciero.diferencia}`,
          },
        });

        // Crear registros detallados de métodos de pago
        console.log('[CIERRE_TURNO] Intentando guardar métodos de pago:', {
          tieneMetodosPago: !!resumenFinanciero.metodosPago,
          cantidad: resumenFinanciero.metodosPago?.length || 0,
          metodosPago: resumenFinanciero.metodosPago,
        });

        if (
          resumenFinanciero.metodosPago &&
          resumenFinanciero.metodosPago.length > 0
        ) {
          console.log(`[CIERRE_TURNO] Guardando ${resumenFinanciero.metodosPago.length} métodos de pago en la base de datos`);
          await Promise.all(
            resumenFinanciero.metodosPago.map((pago) =>
              prisma.cierreTurnoMetodoPago.create({
                data: {
                  cierreTurnoId: cierre.id,
                  metodoPago: pago.metodoPago,
                  monto: pago.monto,
                  porcentaje: pago.porcentaje,
                  observaciones: pago.observaciones,
                },
              }),
            ),
          );
          console.log('[CIERRE_TURNO] Métodos de pago guardados exitosamente');
        } else {
          console.warn('[CIERRE_TURNO] No se guardaron métodos de pago porque el array está vacío o no existe');
        }

        // Registrar movimientos de efectivo
        let movimientosEfectivo = [];

        // 1. Registrar ingreso de efectivo por ventas (si existe)
        if (resumenFinanciero.totalEfectivo > 0) {
          movimientosEfectivo.push({
            tipo: 'INGRESO',
            monto: resumenFinanciero.totalEfectivo,
            concepto: 'Venta en efectivo',
            detalle: `Ingreso por ventas del turno`,
            observaciones: `Total de ventas en efectivo registrado en el cierre`,
          });
        }

        // 2. Registrar movimientos de efectivo adicionales del input
        if (cierreTurnoInput.movimientosEfectivo &&
          cierreTurnoInput.movimientosEfectivo.length > 0
        ) {
          cierreTurnoInput.movimientosEfectivo.forEach((movimiento) => {
            movimientosEfectivo.push({
              tipo: movimiento.tipo,
              monto: movimiento.monto,
              concepto: movimiento.concepto,
              detalle: movimiento.detalle,
              observaciones: movimiento.observaciones,
            });
          });
        }

        // Validación: Comparar montos del BACKEND vs FRONTEND
        // Reglas:
        // - Si los montos son iguales: solo se guarda el movimiento del frontend
        // - Si los montos son diferentes: no se guarda ningún movimiento de INGRESO
        if (resumenFinanciero.totalEfectivo > 0) {
          // Paso 1: Buscar el movimiento automático del backend
          const indiceMovimientoBackend = movimientosEfectivo.findIndex(
            (movimiento) =>
              movimiento.tipo === 'INGRESO' &&
              movimiento.observaciones === 'Total de ventas en efectivo registrado en el cierre',
          );

          // Paso 2: Buscar los movimientos de INGRESO del frontend (excluyendo el del backend)
          const movimientosIngresoFrontend = movimientosEfectivo.filter(
            (movimiento, indice) =>
              movimiento.tipo === 'INGRESO' && indice !== indiceMovimientoBackend,
          );

          // Paso 3: Validar si hay movimientos del frontend y del backend para comparar
          const hayMovimientosParaComparar =
            indiceMovimientoBackend !== -1 && movimientosIngresoFrontend.length > 0;

          if (hayMovimientosParaComparar) {
            // Paso 4: Comparar si algún movimiento del frontend tiene el mismo monto que el backend
            const montoBackend = Number(resumenFinanciero.totalEfectivo);
            const hayMontoIgual = movimientosIngresoFrontend.some((movimiento) => {
              const montoFrontend = Number(movimiento.monto);
              const diferencia = Math.abs(montoFrontend - montoBackend);
              return diferencia < 0.01; // Tolerancia para comparación de decimales
            });

            if (hayMontoIgual) {
              // CASO 1: Los montos son iguales → Solo guardar el del frontend
              movimientosEfectivo = movimientosEfectivo.filter(
                (movimiento, indice) => indice !== indiceMovimientoBackend,
              );
              console.log(
                `[CIERRE_TURNO] Montos iguales detectados: solo se guarda el movimiento del frontend ($${resumenFinanciero.totalEfectivo}). Movimiento automático del backend omitido.`,
              );
            } else {
              // CASO 2: Los montos son diferentes → No guardar ningún movimiento de INGRESO
              const montosFrontend = movimientosIngresoFrontend.map((m) => m.monto).join(', $');
              movimientosEfectivo = movimientosEfectivo.filter(
                (movimiento) => movimiento.tipo !== 'INGRESO',
              );
              console.log(
                `[CIERRE_TURNO] Montos diferentes detectados: Frontend ($${montosFrontend}) vs Backend ($${resumenFinanciero.totalEfectivo}). No se guarda ningún movimiento de efectivo.`,
              );
            }
          }
        }

        // 3. Crear los registros de movimientos de efectivo en la base de datos
        let resumenCaja = null;
        const fechaMovimiento = new Date(cierreTurnoInput.finishTime);
        if (movimientosEfectivo.length > 0) {
          await Promise.all(
            movimientosEfectivo.map((movimiento) =>
              prisma.movimientoEfectivo.create({
                data: {
                  cierreTurnoId: cierre.id,
                  fecha: fechaMovimiento,
                  tipo: movimiento.tipo,
                  monto: movimiento.monto,
                  concepto: movimiento.concepto,
                  detalle: movimiento.detalle,
                  observaciones: movimiento.observaciones,
                },
              }),
            ),
          );
          console.log(
            `[CIERRE_TURNO] ${movimientosEfectivo.length} movimientos de efectivo registrados`,
          );

          // 4. Actualizar el saldo de la caja del punto de venta
          // Obtener o crear la caja del punto de venta
          let caja = await prisma.caja.findUnique({
            where: { puntoVentaId: cierreTurnoInput.puntoVentaId },
          });

          if (!caja) {
            // Crear la caja si no existe
            caja = await prisma.caja.create({
              data: {
                puntoVentaId: cierreTurnoInput.puntoVentaId,
                saldoActual: 0,
                saldoInicial: 0,
                activa: true,
              },
            });
            console.log(
              `[CIERRE_TURNO] Caja creada para el punto de venta ${cierreTurnoInput.puntoVentaId}`,
            );
          }

          // Calcular el cambio en el saldo basado en los movimientos
          const saldoAnterior = Number(caja.saldoActual);
          let totalIngresos = 0;
          let totalEgresos = 0;
          let cambioSaldo = 0;

          movimientosEfectivo.forEach((movimiento) => {
            if (movimiento.tipo === 'INGRESO') {
              totalIngresos += Number(movimiento.monto);
              cambioSaldo += Number(movimiento.monto);
            } else if (movimiento.tipo === 'EGRESO') {
              totalEgresos += Number(movimiento.monto);
              cambioSaldo -= Number(movimiento.monto);
            }
          });

          // Actualizar el saldo de la caja
          const nuevoSaldo = saldoAnterior + cambioSaldo;
          await prisma.caja.update({
            where: { id: caja.id },
            data: {
              saldoActual: nuevoSaldo,
              fechaUltimoMovimiento: fechaMovimiento,
            },
          });
          console.log(
            `[CIERRE_TURNO] Caja actualizada: Saldo anterior $${saldoAnterior} → Saldo nuevo $${nuevoSaldo} (Cambio: ${cambioSaldo > 0 ? '+' : ''}$${cambioSaldo})`,
          );

          // Crear resumen de caja
          resumenCaja = {
            saldoAnterior,
            saldoNuevo: nuevoSaldo,
            totalIngresos,
            totalEgresos,
            movimientosRegistrados: movimientosEfectivo.length,
            observaciones: `Cierre de turno - ${movimientosEfectivo.length} movimiento(s) registrado(s)`,
          };
        }

        // 5. Actualizar los historiales de lectura con el cierreTurnoId
        if (historialesLecturaIds.length > 0) {
          await Promise.all(
            historialesLecturaIds.map((historialId) =>
              prisma.historialLectura.update({
                where: { id: historialId },
                data: {
                  turnoId: cierre.id, // Actualizar con el ID del cierre de turno
                },
              }),
            ),
          );
          console.log(
            `[CIERRE_TURNO] ${historialesLecturaIds.length} historiales de lectura actualizados con cierreTurnoId: ${cierre.id}`,
          );
        }

        return {
          cierre,
          resumenCaja,
        };
      });

      const cierreTurnoGuardado = resultado.cierre;
      const resumenCajaFinal = resultado.resumenCaja;

      console.log(
        `[CIERRE_TURNO] Datos guardados en BD con ID: ${cierreTurnoGuardado.id}`,
      );

      return {
        resumenSurtidores,
        resumenTanques,
        resumenVentasProductos,
        estadisticasVentas,
        totalGeneralLitros: Math.round(totalGeneralLitros * 100) / 100,
        totalGeneralGalones: Math.round(totalGeneralGalones * 100) / 100,
        valorTotalGeneral: Math.round(valorTotalGeneral * 100) / 100,
        resumenFinanciero,
        resumenCaja: resumenCajaFinal,
        fechaProceso: new Date(),
        turnoId: cierreTurnoGuardado.id, // Retornamos el ID del cierre creado
        productosActualizados,
        estado,
        cantidadVentasDeclaradas,
        cantidadVentasCalculadas,
        errores: errores.length > 0 ? errores : undefined,
        advertencias:
          advertencias.length > 0
            ? [
                ...advertencias,
                `Punto de venta: ${cierreTurnoInput.puntoVentaId}`,
                `Tanques actualizados: ${tanquesActualizados}`,
                `Cierre guardado: ${cierreTurnoGuardado.id}`,
              ]
            : [
                `Punto de venta: ${cierreTurnoInput.puntoVentaId}`,
                `Tanques actualizados: ${tanquesActualizados}`,
                `Cierre guardado: ${cierreTurnoGuardado.id}`,
              ],
      };
    } catch (error) {
      console.error('[CIERRE_TURNO] Error general:', error);
      const resumenFinancieroVacio = this.crearResumenFinancieroVacio();
      return {
        resumenSurtidores: [],
        resumenTanques: null,
        totalGeneralLitros: 0,
        totalGeneralGalones: 0,
        valorTotalGeneral: 0,
        resumenFinanciero: resumenFinancieroVacio,
        fechaProceso: new Date(),
        turnoId: cierreTurnoInput.puntoVentaId,
        productosActualizados: 0,
        estado: 'fallido',
        errores: [`Error general: ${error.message}`],
      };
    }
  }

  public crearResumenFinancieroVacio(): any {
    return {
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
      observaciones: 'No se procesaron métodos de pago',
    };
  }

  public procesarMetodosPagoTurno(
    resumenVentas: any,
    valorTotalGeneral: number,
    errores: string[],
    advertencias: string[],
  ): any {
    console.log('[PROCESAR_METODOS_PAGO] Iniciando procesamiento:', {
      resumenVentas,
      tieneResumenVentas: !!resumenVentas,
      tieneMetodosPago: !!resumenVentas?.metodosPago,
      esArray: Array.isArray(resumenVentas?.metodosPago),
      cantidadMetodosPago: resumenVentas?.metodosPago?.length || 0,
    });

    if (
      !resumenVentas ||
      !resumenVentas.metodosPago ||
      !Array.isArray(resumenVentas.metodosPago)
    ) {
      const mensajeError = !resumenVentas
        ? 'resumenVentas no está definido'
        : !resumenVentas.metodosPago
          ? 'resumenVentas.metodosPago no está definido'
          : !Array.isArray(resumenVentas.metodosPago)
            ? 'resumenVentas.metodosPago no es un array'
            : 'Información de métodos de pago no válida';
      
      console.error('[PROCESAR_METODOS_PAGO] Error:', mensajeError);
      errores.push(`Información de métodos de pago no válida: ${mensajeError}`);
      return this.crearResumenFinancieroVacio();
    }

    if (resumenVentas.metodosPago.length === 0) {
      console.warn('[PROCESAR_METODOS_PAGO] Array de métodos de pago está vacío');
      advertencias.push('No se proporcionaron métodos de pago en el resumen de ventas');
    }

    const totalDeclarado = resumenVentas.totalVentasTurno || 0;
    const totalCalculado = valorTotalGeneral;
    const diferencia = totalDeclarado - totalCalculado;

    // Validar que la suma de métodos de pago coincida con el total declarado
    const sumaPagos = resumenVentas.metodosPago.reduce(
      (sum: number, pago: any) => sum + pago.monto,
      0,
    );
    if (Math.abs(sumaPagos - totalDeclarado) > 0.01) {
      errores.push(
        `La suma de métodos de pago ($${sumaPagos}) no coincide con el total declarado ($${totalDeclarado})`,
      );
    }

    // Calcular totales por método de pago
    let totalEfectivo = 0;
    let totalTarjetas = 0;
    let totalTransferencias = 0;
    let totalRumbo = 0;
    let totalBonosViveTerpel = 0;
    let totalOtros = 0;

    const metodosPagoResumen = resumenVentas.metodosPago.map((pago: any) => {
      const monto = pago.monto || 0;
      const porcentaje =
        totalDeclarado > 0 ? (monto / totalDeclarado) * 100 : 0;

      // Clasificar por tipo de método de pago
      switch (pago.metodoPago) {
        case 'EFECTIVO':
          totalEfectivo += monto;
          break;
        case 'TARJETA_CREDITO':
        case 'TARJETA_DEBITO':
          totalTarjetas += monto;
          break;
        case 'TRANSFERENCIA':
          totalTransferencias += monto;
          break;
        case 'Rumbo':
          totalRumbo += monto;
          break;
        case 'Bonos vive terpel':
          totalBonosViveTerpel += monto;
          break;
        default:
          totalOtros += monto;
      }

      return {
        metodoPago: pago.metodoPago,
        monto: Math.round(monto * 100) / 100,
        porcentaje: Math.round(porcentaje * 100) / 100,
        observaciones: pago.observaciones,
      };
    });

    return {
      totalDeclarado: Math.round(totalDeclarado * 100) / 100,
      totalCalculado: Math.round(totalCalculado * 100) / 100,
      diferencia: Math.round(diferencia * 100) / 100,
      metodosPago: metodosPagoResumen,
      totalEfectivo: Math.round(totalEfectivo * 100) / 100,
      totalTarjetas: Math.round(totalTarjetas * 100) / 100,
      totalTransferencias: Math.round(totalTransferencias * 100) / 100,
      totalRumbo: Math.round(totalRumbo * 100) / 100,
      totalBonosViveTerpel: Math.round(totalBonosViveTerpel * 100) / 100,
      totalOtros: Math.round(totalOtros * 100) / 100,
      observaciones: resumenVentas.observaciones,
    };
  }
}
