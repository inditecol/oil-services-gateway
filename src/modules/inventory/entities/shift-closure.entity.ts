import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { HistorialLectura } from './historial-lectura.entity';
import { HistorialVentasProductos } from './historial-ventas-productos.entity';
import { Caja } from './caja.entity';
import { PointOfSale } from '../../point-of-sale/entities/point-of-sale.entity';
import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';

@ObjectType()
export class MetodoPagoProductoResult {
  @Field()
  metodoPago: string;

  @Field(() => Float)
  monto: number;

  @Field(() => Float)
  porcentaje: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class VentaIndividualResult {
  @Field(() => Float)
  cantidad: number;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => Float)
  valorTotal: number;

  @Field(() => [MetodoPagoProductoResult])
  metodosPago: MetodoPagoProductoResult[];

  @Field()
  procesadoExitosamente: boolean;

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class ProductSaleResult {
  @Field()
  codigoProducto: string;

  @Field()
  nombreProducto: string;

  @Field(() => Float)
  cantidadVendida: number;

  @Field()
  unidadMedida: string;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => Float)
  valorTotalVenta: number;

  @Field(() => Float)
  stockAnterior: number;

  @Field(() => Float)
  stockActual: number;

  @Field()
  procesadoExitosamente: boolean;

  @Field(() => [VentaIndividualResult], { nullable: true })
  ventasIndividuales?: VentaIndividualResult[];

  @Field(() => [MetodoPagoProductoResult], { nullable: true })
  metodosPago?: MetodoPagoProductoResult[];

  @Field({ nullable: true })
  error?: string;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class ResumenVentasProductosTurno {
  @Field(() => Int)
  totalProductosVendidos: number;

  @Field(() => Int)
  productosExitosos: number;

  @Field(() => Int)
  productosConError: number;

  @Field(() => Float)
  valorTotalVentasProductos: number;

  @Field(() => [ProductSaleResult])
  ventasDetalle: ProductSaleResult[];
}

@ObjectType()
export class CalculatedSale {
  @Field()
  codigoProducto: string;

  @Field()
  nombreProducto: string;

  @Field(() => Float)
  cantidadVendidaGalones: number;

  @Field(() => Float)
  cantidadVendidaLitros: number;

  @Field(() => Float)
  precioUnitarioLitro: number;

  @Field(() => Float)
  precioUnitarioGalon: number;

  @Field(() => Float)
  valorTotalVenta: number;

  @Field()
  unidadOriginal: string;

  @Field(() => [MetodoPagoProductoResult], { nullable: true })
  metodosPago?: MetodoPagoProductoResult[];
}

@ObjectType()
export class ResumenSurtidor {
  @Field()
  numeroSurtidor: string;

  @Field(() => [CalculatedSale])
  ventas: CalculatedSale[];

  @Field(() => Float)
  totalVentasLitros: number;

  @Field(() => Float)
  totalVentasGalones: number;

  @Field(() => Float)
  valorTotalSurtidor: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class TankHeightReading {
  @Field()
  tanqueId: string;

  @Field()
  nombreTanque: string;

  @Field(() => Float)
  alturaFluido: number;

  @Field(() => Float)
  volumenCalculado: number;

  @Field(() => Float)
  nivelPorcentaje: number;

  @Field({ nullable: true })
  tipoTanque?: string;

  @Field({ nullable: true })
  nombreProducto?: string;

  @Field({ nullable: true })
  codigoProducto?: string;

  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  fechaLectura: Date;
}

@ObjectType()
export class ResumenTanques {
  @Field(() => Int)
  totalTanques: number;

  @Field(() => Float)
  volumenTotalLitros: number;

  @Field(() => Float)
  volumenTotalGalones: number;

  @Field(() => Float)
  capacidadTotalLitros: number;

  @Field(() => Float)
  porcentajeOcupacionGeneral: number;

  @Field(() => [TankHeightReading])
  lecturasTanques: TankHeightReading[];
}

@ObjectType()
export class MetodoPagoResumen {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field()
  metodoPago: string;

  @Field(() => Float)
  monto: number;

  @Field(() => Float)
  porcentaje: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class ResumenFinanciero {
  @Field(() => Float)
  totalDeclarado: number;

  @Field(() => Float)
  totalCalculado: number;

  @Field(() => Float)
  diferencia: number;

  @Field(() => [MetodoPagoResumen])
  metodosPago: MetodoPagoResumen[];

  @Field(() => Float)
  totalEfectivo: number;

  @Field(() => Float)
  totalTarjetas: number;

  @Field(() => Float)
  totalTransferencias: number;

  @Field(() => Float)
  totalRumbo: number;

  @Field(() => Float)
  totalBonosViveTerpel: number;

  @Field(() => Float)
  totalOtros: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class ResumenCaja {
  @Field(() => Float)
  saldoAnterior: number;

  @Field(() => Float)
  saldoNuevo: number;

  @Field(() => Float)
  totalIngresos: number;

  @Field(() => Float)
  totalEgresos: number;

  @Field(() => Int)
  movimientosRegistrados: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class EstadisticasVentas {
  @Field(() => Int)
  cantidadVentasDeclaradas: number;

  @Field(() => Int)
  cantidadVentasCalculadas: number;

  @Field(() => Int)
  ventasCombustibles: number;

  @Field(() => Int)
  ventasProductos: number;

  @Field(() => Float)
  promedioVentaPorTransaccion: number;

  @Field({ nullable: true })
  observaciones?: string;
}

@ObjectType()
export class ActualizacionInventarioResponse {
  @Field(() => [ResumenSurtidor])
  resumenSurtidores: ResumenSurtidor[];

  @Field(() => ResumenTanques, { nullable: true })
  resumenTanques?: ResumenTanques;

  @Field(() => ResumenVentasProductosTurno, { nullable: true })
  resumenVentasProductos?: ResumenVentasProductosTurno;

  @Field(() => EstadisticasVentas, { nullable: true })
  estadisticasVentas?: EstadisticasVentas;

  @Field(() => Float)
  totalGeneralLitros: number;

  @Field(() => Float)
  totalGeneralGalones: number;

  @Field(() => Float)
  valorTotalGeneral: number;

  @Field(() => ResumenFinanciero)
  resumenFinanciero: ResumenFinanciero;

  @Field(() => ResumenCaja, { nullable: true })
  resumenCaja?: ResumenCaja;

  @Field()
  fechaProceso: Date;

  @Field()
  turnoId: string;

  @Field(() => Int)
  productosActualizados: number;

  @Field()
  estado: string;

  @Field(() => [String], { nullable: true })
  errores?: string[];

  @Field(() => [String], { nullable: true })
  advertencias?: string[];

  @Field(() => Int, { nullable: true })
  cantidadVentasDeclaradas?: number;

  @Field(() => Int, { nullable: true })
  cantidadVentasCalculadas?: number;
}

@ObjectType()
export class CierreTurno {
  @Field(() => ID)
  id: string;

  @Field()
  fechaCierre: Date;

  @Field(() => Float)
  totalVentasLitros: number;

  @Field(() => Float)
  totalVentasGalones: number;

  @Field(() => Float)
  valorTotalGeneral: number;

  @Field(() => Int)
  productosActualizados: number;

  @Field(() => Int)
  tanquesActualizados: number;

  @Field()
  estado: string;

  @Field(() => [String], { nullable: true })
  errores?: string[];

  @Field(() => [String], { nullable: true })
  advertencias?: string[];

  @Field(() => [ResumenSurtidor])
  resumenSurtidores: ResumenSurtidor[];

  @Field(() => ResumenTanques, { nullable: true })
  resumenTanques?: ResumenTanques;

  @Field({ nullable: true })
  observacionesGenerales?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  turnoId: string;

  @Field(() => ID)
  usuarioId: string;
}

@ObjectType()
export class CierreTurnoListResponse {
  @Field(() => [CierreTurno])
  cierres: CierreTurno[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

// Keep Spanish versions for backward compatibility
export { CierreTurno as ShiftClosure };
export { CierreTurnoListResponse as ShiftClosureListResponse };

// === NUEVOS TIPOS PARA BÚSQUEDA COMPLETA DE CIERRES ===

@ObjectType()
export class FiltrosBusquedaCierres {
  @Field({ nullable: true })
  fechaDesde?: Date;

  @Field({ nullable: true })
  fechaHasta?: Date;

  @Field({ nullable: true })
  puntoVentaId?: string;

  @Field({ nullable: true })
  usuarioId?: string;

  @Field({ nullable: true })
  estado?: string;
}

@ObjectType()
export class OpcionesBusquedaCierres {
  @Field()
  incluirDatosOriginales: boolean;

  @Field()
  incluirDatosProcesados: boolean;
}

@ObjectType()
export class MetadatosBusquedaCierres {
  @Field(() => Int)
  totalRegistros: number;

  @Field(() => Int)
  paginaActual: number;

  @Field(() => Int)
  registrosPorPagina: number;

  @Field(() => Int)
  totalPaginas: number;

  @Field()
  fechaBusqueda: Date;

  @Field(() => FiltrosBusquedaCierres)
  filtrosAplicados: FiltrosBusquedaCierres;

  @Field(() => OpcionesBusquedaCierres)
  opciones: OpcionesBusquedaCierres;
}

@ObjectType()
export class ResumenEstadisticoCierres {
  @Field(() => Float)
  totalValorGeneral: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  totalDeclarado: number;

  @Field(() => Float)
  totalDiferencias: number;

  @Field(() => Int)
  productosActualizadosTotal: number;

  @Field(() => Int)
  tanquesActualizadosTotal: number;

  @Field(() => String)
  distribucionEstados: string; // JSON string of state distribution
}

@ObjectType()
export class ResumenFinancieroCierre {
  @Field(() => Float)
  valorTotalGeneral: number;

  @Field(() => Float)
  totalDeclarado: number;

  @Field(() => Float)
  diferencia: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalGalones: number;
}

@ObjectType()
export class EstadisticasCierre {
  @Field(() => Int)
  productosActualizados: number;

  @Field(() => Int)
  tanquesActualizados: number;

  @Field(() => Int)
  cantidadErrores: number;

  @Field(() => Int)
  cantidadAdvertencias: number;
}

@ObjectType()
export class CierreCompletoInfo {
  @Field()
  id: string;

  @Field()
  fechaCierre: Date;

  @Field()
  estado: string;

  @Field()
  usuario: string;

  @Field()
  puntoVenta: string;

  @Field()
  puntoVentaId: string;

  @Field(() => ResumenFinancieroCierre)
  resumenFinanciero: ResumenFinancieroCierre;

  @Field(() => EstadisticasCierre)
  estadisticas: EstadisticasCierre;

  @Field()
  puedeReconstruirQuery: boolean;

  @Field(() => String, { nullable: true })
  datosOriginalesCompletos?: string; // JSON string of original data

  @Field(() => String, { nullable: true })
  datosProcesadosCompletos?: string; // JSON string of processed data
}

@ObjectType()
export class BusquedaCierresCompletosResponse {
  @Field(() => MetadatosBusquedaCierres)
  metadatos: MetadatosBusquedaCierres;

  @Field(() => ResumenEstadisticoCierres)
  resumenEstadistico: ResumenEstadisticoCierres;

  @Field(() => [CierreCompletoInfo])
  cierres: CierreCompletoInfo[];
}

// === TIPOS PARA ESTADÍSTICAS POR PERÍODO ===

@ObjectType()
export class MetadatosEstadisticasPeriodo {
  @Field()
  fechaDesde: Date;

  @Field()
  fechaHasta: Date;

  @Field()
  agruparPor: string;

  @Field(() => Int)
  periodosEncontrados: number;

  @Field()
  fechaGeneracion: Date;
}

@ObjectType()
export class TotalesGeneralesPeriodo {
  @Field(() => Int)
  totalCierres: number;

  @Field(() => Float)
  valorTotalGeneral: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  diferenciasAcumuladas: number;

  @Field(() => Int)
  cierresExitosos: number;

  @Field(() => Int)
  cierresConErrores: number;

  @Field(() => Int)
  cierresFallidos: number;
}

@ObjectType()
export class CierreDetallePeriodo {
  @Field()
  id: string;

  @Field()
  fechaCierre: Date;

  @Field()
  estado: string;

  @Field(() => Float)
  valorTotal: number;

  @Field()
  usuario: string;

  @Field()
  puntoVenta: string;
}

@ObjectType()
export class EstadisticaPeriodo {
  @Field()
  periodo: string;

  @Field(() => Int)
  totalCierres: number;

  @Field(() => Float)
  valorTotalGeneral: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  totalDeclarado: number;

  @Field(() => Float)
  diferenciasAcumuladas: number;

  @Field(() => Int)
  productosActualizados: number;

  @Field(() => Int)
  tanquesActualizados: number;

  @Field(() => Int)
  cierresExitosos: number;

  @Field(() => Int)
  cierresConErrores: number;

  @Field(() => Int)
  cierresFallidos: number;

  @Field(() => [String])
  puntosVentaUnicos: string[];

  @Field(() => [String])
  usuariosUnicos: string[];

  @Field(() => Int)
  cantidadPuntosVentaUnicos: number;

  @Field(() => Int)
  cantidadUsuariosUnicos: number;

  @Field(() => Float)
  promedioValorPorCierre: number;

  @Field(() => Float)
  porcentajeExitosos: number;

  @Field(() => [CierreDetallePeriodo])
  cierresDetalle: CierreDetallePeriodo[];
}

@ObjectType()
export class EstadisticasCierresPorPeriodoResponse {
  @Field(() => MetadatosEstadisticasPeriodo)
  metadatos: MetadatosEstadisticasPeriodo;

  @Field(() => TotalesGeneralesPeriodo)
  totalesGenerales: TotalesGeneralesPeriodo;

  @Field(() => [EstadisticaPeriodo])
  estadisticasPorPeriodo: EstadisticaPeriodo[];
}

// === TIPOS PARA ESTADÍSTICAS DE MÉTODOS DE PAGO ===

@ObjectType()
export class MetodoPagoEstadistica {
  @Field()
  metodoPago: string;

  @Field(() => Float)
  montoTotal: number;

  @Field(() => Int)
  cantidadTransacciones: number;

  @Field(() => Float)
  porcentajeDelTotal: number;

  @Field(() => Float)
  montoPromedioPorTransaccion: number;

  @Field(() => [String])
  productosVendidos: string[]; // Lista de productos únicos

  @Field(() => Int)
  cantidadProductosUnicos: number;
}

@ObjectType()
export class MetodoPagoPorProducto {
  @Field()
  codigoProducto: string;

  @Field()
  nombreProducto: string;

  @Field()
  metodoPago: string;

  @Field(() => Float)
  montoTotal: number;

  @Field(() => Int)
  cantidadVentas: number;

  @Field(() => Float)
  cantidadVendida: number;

  @Field()
  unidadMedida: string;
}

@ObjectType()
export class EstadisticasMetodosPagoResponse {
  @Field()
  fechaDesde: Date;

  @Field()
  fechaHasta: Date;

  @Field(() => Float)
  montoTotalPeriodo: number;

  @Field(() => Int)
  totalTransacciones: number;

  @Field(() => Int)
  totalCierres: number;

  @Field(() => [MetodoPagoEstadistica])
  resumenPorMetodoPago: MetodoPagoEstadistica[];

  @Field(() => [MetodoPagoPorProducto])
  detallesPorProducto: MetodoPagoPorProducto[];

  @Field()
  fechaGeneracion: Date;
}

// === TIPOS PARA MOVIMIENTOS DE EFECTIVO ===

@ObjectType()
export class MovimientoEfectivo {
  @Field(() => ID)
  id: string;

  @Field()
  tipo: string; // "INGRESO" o "EGRESO"

  @Field(() => Float)
  monto: number;

  @Field()
  concepto: string;

  @Field({ nullable: true })
  detalle?: string;

  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  fecha: Date;

  @Field()
  nombreResponsable: string; // Nombre completo del usuario responsable
}

@ObjectType()
export class MovimientosEfectivoResponse {
  @Field(() => Float)
  totalIngresos: number;

  @Field(() => Float)
  totalEgresos: number;

  @Field(() => [MovimientoEfectivo])
  movimientos: MovimientoEfectivo[];
}

@ObjectType()
export class ShiftClosureDataResponse {
  @Field(() => Shift, { nullable: true })
  turno?: Shift;

  @Field(() => CierreTurno, { nullable: true })
  cierreTurno?: CierreTurno;

  @Field(() => [MetodoPagoResumen], { nullable: true })
  metodosPago?: MetodoPagoResumen[];

  @Field(() => [HistorialLectura], { nullable: true })
  historialLecturas?: HistorialLectura[];

  @Field(() => [HistorialVentasProductos], { nullable: true })
  historialVentasProductos?: HistorialVentasProductos[];

  @Field(() => [MovimientoEfectivo], { nullable: true })
  movimientosEfectivo?: MovimientoEfectivo[];

  @Field(() => Caja, { nullable: true })
  caja?: Caja;

  @Field(() => PointOfSale, { nullable: true })
  puntoVenta?: PointOfSale;

  @Field(() => User, { nullable: true })
  usuario?: User;
} 