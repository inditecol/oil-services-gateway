import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { ProductsService } from './products.service';
import { SurtidoresService } from './surtidores.service';
import { PrismaService } from '../../config/prisma/prisma.service';
import { Producto, ProductListResponse } from './entities/producto.entity';
import { 
  ProductWithConversionsResponse, 
  StockConversion, 
  Equivalencias,
  InventorySummaryResponse,
  TotalesInventario
} from './entities/conversion-response.entity';
import {
  CierreTurno,
  CierreTurnoListResponse,
  ActualizacionInventarioResponse,
  BusquedaCierresCompletosResponse,
  EstadisticasCierresPorPeriodoResponse,
  EstadisticasMetodosPagoResponse,
  ResumenCaja,
  MovimientoEfectivo,
  MovimientosEfectivoResponse,
  ShiftClosureDataResponse,
  MetodoPagoResumen
} from './entities/shift-closure.entity';
import {
  CierreTurnoInput,
  LecturaMangueraInput,
  FiltrosMovimientosEfectivoInput
} from './dto/shift-closure.input';
import { InventoryEntryInput } from './dto/inventory-entry.input';
import { InventoryEntryResponse } from './entities/inventory-entry.entity';
import {
  InventoryProcessInput,
  TankMovementInput,
  ProductMovementInput,
  CarrotanqueMovementInput
} from './dto/inventory-process.input';
import {
  InventoryProcessResponse,
  InventoryProcessResult,
  InventoryMovementResult
} from './dto/inventory-process.response';
import { SimpleStockUpdateInput } from './dto/simple-stock-update.input';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { WriteOffExpiredProductsInput } from './dto/write-off-expired.input';
import { WriteOffExpiredProductsResponse } from './entities/write-off-response.entity';
import { TanquesService } from './tanques.service';
import { InventoryService } from './inventory.service';

// Nuevas importaciones para el sistema de ventas de productos
import { MetodoPago } from './entities/metodo-pago.entity';
import { HistorialVentasProductos } from './entities/historial-ventas-productos.entity';
import { ConsolidadoProductosVendidos, ResumenVentasProductos } from './entities/consolidado-productos-ventas.entity';
import { RegistrarVentaProductoInput, FiltrosVentasProductosInput, FiltrosReporteVentasInput, UpdateHistorialVentaProductoInput } from './dto/registrar-venta-producto.input';
import { UpdateCierreTurnoMetodoPagoInput } from './dto/update-cierre-turno-metodo-pago.input';
import { UpdateMovimientoEfectivoInput } from './dto/update-movimiento-efectivo.input';
import { CrearMetodoPagoInput, ActualizarMetodoPagoInput, FiltrosMetodosPagoInput } from './dto/metodo-pago.input';
import { MetodosPagoService } from './services/metodos-pago.service';
import { HistorialVentasService } from './services/historial-ventas.service';
import { MovimientosEfectivoService } from './services/movimientos-efectivo.service';
import { HistorialPrecios, HistorialPreciosResponse } from './entities/historial-precios.entity';
import { Caja } from './entities/caja.entity';
import { LecturaMangueraDetails } from './entities/lectura-manguera-details.entity';
import { HistorialLectura } from './entities/historial-lectura.entity';
import { LecturaMangueraUpdateService } from './services/lectura-manguera-update.service';

@Resolver(() => Producto)
@UseGuards(JwtAuthGuard)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly surtidoresService: SurtidoresService,
    private readonly prisma: PrismaService,
    private readonly tanquesService: TanquesService,
    private readonly inventoryService: InventoryService,
    private readonly metodosPagoService: MetodosPagoService,
    private readonly historialVentasService: HistorialVentasService,
    private readonly movimientosEfectivoService: MovimientosEfectivoService,
    private readonly lecturaMangueraUpdateService: LecturaMangueraUpdateService
  ) {}

  @Mutation(() => Producto)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createProduct(@Args('createProductInput') createProductInput: CreateProductInput): Promise<Producto> {
    return this.productsService.create(createProductInput);
  }

  @Query(() => ProductListResponse, { name: 'products' })
  async findAllProducts(
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10,
    @Args('searchTerm', { nullable: true }) searchTerm?: string,
    @Args('categoriaId', { type: () => ID, nullable: true }) categoriaId?: string,
    @Args('activo', { nullable: true }) activo?: boolean,
    @Args('esCombustible', { nullable: true }) esCombustible?: boolean,
    @Args('puntoVentaId', { type: () => ID, nullable: true }) puntoVentaId?: string,
  ): Promise<ProductListResponse> {
    return this.productsService.findAll({
      page,
      limit,
      searchTerm,
      categoriaId,
      activo,
      esCombustible,
      puntoVentaId,
    });
  }

  @Query(() => Producto, { name: 'product' })
  async findOneProduct(@Args('id', { type: () => ID }) id: string): Promise<Producto> {
    const product = await this.productsService.findById(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  @Query(() => Producto, { name: 'productByCode' })
  async findProductByCode(@Args('codigo') codigo: string): Promise<Producto> {
    const product = await this.productsService.findByCode(codigo);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  @Query(() => [Producto], { name: 'productsByCategory' })
  async findProductsByCategory(@Args('categoriaId', { type: () => ID }) categoriaId: string): Promise<Producto[]> {
    return this.productsService.findByCategory(categoriaId);
  }

  @Query(() => [Producto], { name: 'productsByPointOfSale' })
  async findProductsByPointOfSale(
    @Args('puntoVentaId', { type: () => ID }) puntoVentaId: string,
  ): Promise<Producto[]> {
    return this.productsService.findByPointOfSale(puntoVentaId);
  }

  @Query(() => [Producto], { name: 'activeProducts' })
  async findActiveProducts(): Promise<Producto[]> {
    return this.productsService.findActive();
  }

  @Query(() => [Producto], { name: 'lowStockProducts' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async findLowStockProducts(): Promise<Producto[]> {
    return this.productsService.findLowStock();
  }

  @Query(() => Caja, { name: 'getCajaSaldo' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getCajaSaldo(
    @Args('puntoVentaId') puntoVentaId: string
  ): Promise<Caja> {
    return this.productsService.getCajaSaldo(puntoVentaId);
  }

  @Query(() => [Producto], { name: 'fuelProducts' })
  async findFuelProducts(): Promise<Producto[]> {
    return this.productsService.findFuel();
  }

  @Query(() => [ProductWithConversionsResponse], { name: 'fuelProductsWithConversions' })
  async findFuelProductsWithConversions(): Promise<ProductWithConversionsResponse[]> {
    const products = await this.productsService.findFuel();
    
    const LITERS_TO_GALLONS = 0.264172; // 1 litro = 0.264172 galones
    
    return products.map(product => ({
      ...product,
      precioVenta: Number(product.precioVenta),
      stockEnLitros: {
        cantidad: product.stockActual,
        unidad: 'litros',
        formatted: `${product.stockActual} litros`
      } as StockConversion,
      stockEnGalones: {
        cantidad: Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100,
        unidad: 'galones',
        formatted: `${Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100} galones`
      } as StockConversion,
      precioLitro: Number(product.precioVenta),
      precioGalon: Math.round(Number(product.precioVenta) / LITERS_TO_GALLONS * 100) / 100
    }));
  }

  @Query(() => ProductWithConversionsResponse, { name: 'productWithConversions' })
  async findProductWithConversions(@Args('codigo') codigo: string): Promise<ProductWithConversionsResponse> {
    const product = await this.productsService.findByCode(codigo);
    
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    
    const LITERS_TO_GALLONS = 0.264172;
    
    return {
      ...product,
      stockEnLitros: {
        cantidad: product.stockActual,
        unidad: 'litros',
        formatted: `${product.stockActual} litros`
      } as StockConversion,
      stockEnGalones: {
        cantidad: Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100,
        unidad: 'galones',
        formatted: `${Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100} galones`
      } as StockConversion,
      precioLitro: Number(product.precioVenta),
      precioGalon: Math.round(Number(product.precioVenta) / LITERS_TO_GALLONS * 100) / 100,
      equivalencias: {
        litro_a_galones: "0.264172 galones",
        galon_a_litros: "3.78541 litros"
      } as Equivalencias
    };
  }

  @Query(() => [Producto], { name: 'searchProducts' })
  async searchProducts(@Args('searchTerm') searchTerm: string): Promise<Producto[]> {
    return this.productsService.searchProducts(searchTerm);
  }

  @Mutation(() => Producto)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateProduct(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateProductInput') updateProductInput: UpdateProductInput,
    @CurrentUser() user: any
  ): Promise<Producto> {
    const userRole = user?.rol?.nombre || user?.rol || user?.role || user?.userRole || 'employee';

    if (userRole === 'employee') {
      const existingProduct = await this.productsService.findById(id);
      
      if (!existingProduct) {
        throw new NotFoundException('Producto no encontrado');
      }

      const validation = this.productsService.validateEmployeeUpdatePermissions(existingProduct, updateProductInput);
      
      if (!validation.isValid) {
        if (validation.error?.includes('no permitidos')) {
          throw new ForbiddenException(validation.error);
        }
        if (validation.error?.includes('precio de venta debe ser mayor')) {
          throw new BadRequestException(validation.error);
        }
        throw new ForbiddenException(validation.error);
      }

      return this.productsService.update(id, validation.filteredInput!, user.id, true);
    }

    return this.productsService.update(id, updateProductInput, user.id);
  }

  @Mutation(() => Producto)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateProductStock(
    @Args('id', { type: () => ID }) id: string,
    @Args('cantidad', { type: () => Int }) cantidad: number,
    @Args('tipo') tipo: 'entrada' | 'salida',
  ): Promise<Producto> {
    return this.productsService.updateStock(id, cantidad, tipo);
  }

  @Mutation(() => Producto)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async removeProduct(@Args('id', { type: () => ID }) id: string): Promise<Producto> {
    return this.productsService.remove(id);
  }

  @Mutation(() => Producto)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async toggleProductStatus(@Args('id', { type: () => ID }) id: string): Promise<Producto> {
    return this.productsService.toggleProductStatus(id);
  }

  @Query(() => String, { name: 'productStats' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async getProductStats(): Promise<string> {
    const stats = await this.productsService.getProductStats();
    return JSON.stringify(stats);
  }

  @Query(() => InventorySummaryResponse, { name: 'inventorySummaryWithConversions' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getInventorySummaryWithConversions(): Promise<InventorySummaryResponse> {
    const products = await this.productsService.findFuel();
    
    const LITERS_TO_GALLONS = 0.264172;
    
    const productosConConversiones = products.map(product => ({
      ...product,
      stockEnLitros: {
        cantidad: product.stockActual,
        unidad: 'litros',
        formatted: `${product.stockActual} litros`
      } as StockConversion,
      stockEnGalones: {
        cantidad: Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100,
        unidad: 'galones',
        formatted: `${Math.round(product.stockActual * LITERS_TO_GALLONS * 100) / 100} galones`
      } as StockConversion,
      precioLitro: Number(product.precioVenta),
      precioGalon: Math.round(Number(product.precioVenta) / LITERS_TO_GALLONS * 100) / 100
    }));

    // Calcular totales
    const totalLitros = products.reduce((sum, product) => sum + product.stockActual, 0);
    const totalGalones = Math.round(totalLitros * LITERS_TO_GALLONS * 100) / 100;
    
    const valorTotalLitros = products.reduce((sum, product) => 
      sum + (product.stockActual * Number(product.precioVenta)), 0
    );
    const valorTotalGalones = Math.round(valorTotalLitros / LITERS_TO_GALLONS * 100) / 100;

    return {
      productos: productosConConversiones,
      totales: {
        totalLitros,
        totalGalones,
        valorTotalLitros: Math.round(valorTotalLitros * 100) / 100,
        valorTotalGalones: Math.round(valorTotalGalones * 100) / 100
      } as TotalesInventario,
      fechaConsulta: new Date(),
      totalProductos: products.length
    };
  }

  @Mutation(() => Producto, { name: 'updateStockWithConversion' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateStockWithConversion(
    @Args('codigoProducto') codigoProducto: string,
    @Args('cantidad', { type: () => Float }) cantidad: number,
    @Args('unidadEntrada') unidadEntrada: string,
    @Args('tipo') tipo: 'entrada' | 'salida',
    @Args('observaciones', { nullable: true }) observaciones?: string
  ): Promise<Producto> {
    const GALONES_TO_LITROS = 3.78541; // 1 galón = 3.78541 litros
    
    // Buscar producto
    const product = await this.productsService.findByCode(codigoProducto);
    if (!product) {
      throw new Error(`Producto no encontrado: ${codigoProducto}`);
    }

    // Convertir cantidad a litros si viene en galones
    let cantidadEnLitros = cantidad;
    if (unidadEntrada.toLowerCase() === 'galones') {
      cantidadEnLitros = cantidad * GALONES_TO_LITROS;
    } else if (unidadEntrada.toLowerCase() !== 'litros') {
      throw new Error(`Unidad no soportada: ${unidadEntrada}. Use 'litros' o 'galones'`);
    }

    // Actualizar stock
    return this.productsService.updateStock(product.id, Math.round(cantidadEnLitros * 100) / 100, tipo);
  }



  @Query(() => CierreTurnoListResponse, { name: 'getShiftClosures' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getShiftClosures(
    @Args('turnoId', { type: () => ID, nullable: true }) turnoId?: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('estado', { nullable: true }) estado?: string,
    @Args('usuarioId', { type: () => ID, nullable: true }) usuarioId?: string,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10
  ): Promise<CierreTurnoListResponse> {
    return this.productsService.getShiftClosures({
      turnoId,
      fechaDesde,
      fechaHasta,
      estado,
      usuarioId,
      page,
      limit
    });
  }

  @Query(() => CierreTurno, { name: 'getShiftClosure' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getShiftClosure(@Args('id', { type: () => ID }) id: string): Promise<CierreTurno> {
    return this.productsService.getShiftClosureById(id);
  }

  @Query(() => ShiftClosureDataResponse, { name: 'getShiftClosureData' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getShiftClosureData(
    @Args('turnoId', { type: () => ID }) turnoId: string
  ): Promise<any> {
    return this.productsService.getShiftClosureDataByTurnoId(turnoId);
  }

  @Query(() => [CierreTurno], { name: 'getShiftClosuresByDate' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getShiftClosuresByDate(
    @Args('fecha') fecha: Date
  ): Promise<CierreTurno[]> {
    const fechaInicio = new Date(fecha);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const fechaFin = new Date(fecha);
    fechaFin.setHours(23, 59, 59, 999);

    const result = await this.productsService.getShiftClosures({
      fechaDesde: fechaInicio,
      fechaHasta: fechaFin,
      limit: 100 // Para obtener todos los cierres del día
    });

    return result.cierres;
  }

  @Mutation(() => Producto, { name: 'updateStockSimple' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateStockSimple(
    @Args('input') input: SimpleStockUpdateInput
  ): Promise<Producto> {
    const product = await this.productsService.findByCode(input.codigoProducto);
    if (!product) {
      throw new NotFoundException(`Producto no encontrado: ${input.codigoProducto}`);
    }

    const conversion = this.productsService.validateAndConvertUnit(input.cantidad, input.unidadMedida);
    if (conversion.error) {
      throw new BadRequestException(conversion.error);
    }

    return this.productsService.updateStock(
      product.id, 
      Math.round(conversion.cantidadEnLitros * 100) / 100, 
      input.tipo as 'entrada' | 'salida'
    );
  }

  @Query(() => String, { name: 'tankStatus' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getTankStatus(): Promise<string> {
    const tanks = await this.productsService.getTankStatus();
    return JSON.stringify(tanks);
  }

  @Query(() => String, { name: 'debugProductStock' })
  @UseGuards(RolesGuard) 
  @Roles('admin', 'manager', 'employee')
  async debugProductStock(@Args('codigo') codigo: string): Promise<string> {
    const product = await this.productsService.findByCode(codigo);
    if (!product) {
      return JSON.stringify({ error: `Producto ${codigo} no encontrado` });
    }
    
    return JSON.stringify({
      codigo: product.codigo,
      nombre: product.nombre,
      stockActual: product.stockActual,
      stockMinimo: product.stockMinimo,
      unidadMedida: product.unidadMedida,
      precioVenta: Number(product.precioVenta),
      esCombustible: product.esCombustible,
      activo: product.activo
    });
  }

  @Query(() => String, { name: 'getCierreFinanciero' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getCierreFinanciero(@Args('cierreId', { type: () => ID }) cierreId: string): Promise<string> {
    const cierre = await this.prisma.cierreTurno.findUnique({
      where: { id: cierreId },
      include: {
        usuario: true,
        turno: {
          include: {
            puntoVenta: true
          }
        }
      }
    });

    if (!cierre) {
      throw new Error('Cierre de turno no encontrado');
    }

    // Extraer información financiera del JSON
    const resumenCompleto = cierre.resumenSurtidores as any;
    const resumenFinanciero = resumenCompleto?.financiero || {
      totalDeclarado: 0,
      totalCalculado: Number(cierre.valorTotalGeneral),
      diferencia: 0 - Number(cierre.valorTotalGeneral),
      metodosPago: [],
      totalEfectivo: 0,
      totalTarjetas: 0,
      totalTransferencias: 0,
      totalRumbo: 0,
      totalBonosViveTerpel: 0,
      totalOtros: 0
    };

    const cierreDetallado = {
      id: cierre.id,
      fechaCierre: cierre.fechaCierre,
      usuario: {
        nombre: cierre.usuario.nombre,
        apellido: cierre.usuario.apellido,
        email: cierre.usuario.email
      },
      puntoVenta: cierre.turno?.puntoVenta?.nombre || 'No identificado',
      
      // RESUMEN FÍSICO
      ventasFisicas: {
        totalLitros: Number(cierre.totalVentasLitros),
        totalGalones: Number(cierre.totalVentasGalones),
        valorCalculado: Number(cierre.valorTotalGeneral)
      },

      // RESUMEN FINANCIERO
      ventasFinancieras: {
        totalDeclarado: resumenFinanciero.totalDeclarado,
        totalCalculado: resumenFinanciero.totalCalculado,
        diferencia: resumenFinanciero.diferencia,
        metodosPago: resumenFinanciero.metodosPago,
        desglosePorTipo: {
          efectivo: resumenFinanciero.totalEfectivo,
          tarjetas: resumenFinanciero.totalTarjetas,
          transferencias: resumenFinanciero.totalTransferencias,
          rumbo: resumenFinanciero.totalRumbo,
          bonosViveTerpel: resumenFinanciero.totalBonosViveTerpel,
          otros: resumenFinanciero.totalOtros
        }
      },

      // ESTADÍSTICAS
      estadisticas: {
        productosActualizados: cierre.productosActualizados,
        tanquesActualizados: cierre.tanquesActualizados,
        estado: cierre.estado,
        tieneErrores: cierre.errores.length > 0,
        tieneAdvertencias: cierre.advertencias.length > 0
      },

      errores: cierre.errores,
      advertencias: cierre.advertencias,
      observaciones: cierre.observacionesGenerales
    };

    return JSON.stringify(cierreDetallado, null, 2);
  }

  @Query(() => String, { name: 'getCierresFinancierosHoy' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getCierresFinancierosHoy(): Promise<string> {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const cierres = await this.prisma.cierreTurno.findMany({
      where: {
        fechaCierre: {
          gte: hoy,
          lt: manana
        }
      },
      include: {
        usuario: true,
        turno: {
          include: {
            puntoVenta: true
          }
        }
      },
      orderBy: { fechaCierre: 'desc' }
    });

    const resumenDiario = {
      fecha: hoy,
      totalCierres: cierres.length,
      resumenGeneral: {
        totalVentasLitros: 0,
        totalVentasGalones: 0,
        valorTotalCalculado: 0,
        totalDeclarado: 0,
        diferenciaAcumulada: 0,
        totalEfectivo: 0,
        totalTarjetas: 0,
        totalTransferencias: 0,
        totalRumbo: 0,
        totalBonosViveTerpel: 0,
        totalOtros: 0
      },
      cierres: cierres.map(cierre => {
        const resumenCompleto = cierre.resumenSurtidores as any;
        const resumenFinanciero = resumenCompleto?.financiero || {};

        // Acumular totales
        resumenDiario.resumenGeneral.totalVentasLitros += Number(cierre.totalVentasLitros);
        resumenDiario.resumenGeneral.totalVentasGalones += Number(cierre.totalVentasGalones);
        resumenDiario.resumenGeneral.valorTotalCalculado += Number(cierre.valorTotalGeneral);
        resumenDiario.resumenGeneral.totalDeclarado += resumenFinanciero.totalDeclarado || 0;
        resumenDiario.resumenGeneral.diferenciaAcumulada += resumenFinanciero.diferencia || 0;
        resumenDiario.resumenGeneral.totalEfectivo += resumenFinanciero.totalEfectivo || 0;
        resumenDiario.resumenGeneral.totalTarjetas += resumenFinanciero.totalTarjetas || 0;
        resumenDiario.resumenGeneral.totalTransferencias += resumenFinanciero.totalTransferencias || 0;
        resumenDiario.resumenGeneral.totalRumbo += resumenFinanciero.totalRumbo || 0;
        resumenDiario.resumenGeneral.totalBonosViveTerpel += resumenFinanciero.totalBonosViveTerpel || 0;
        resumenDiario.resumenGeneral.totalOtros += resumenFinanciero.totalOtros || 0;

        return {
          id: cierre.id,
          fechaCierre: cierre.fechaCierre,
          usuario: `${cierre.usuario.nombre} ${cierre.usuario.apellido}`,
          puntoVenta: cierre.turno?.puntoVenta?.nombre || 'No identificado',
          valorCalculado: Number(cierre.valorTotalGeneral),
          totalDeclarado: resumenFinanciero.totalDeclarado || 0,
          diferencia: resumenFinanciero.diferencia || 0,
          estado: cierre.estado,
          cantidadMetodosPago: resumenFinanciero.metodosPago?.length || 0
        };
      })
    };
    return JSON.stringify(resumenDiario, null, 2);
  }

  @Mutation(() => WriteOffExpiredProductsResponse, { name: 'writeOffExpiredProducts' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async writeOffExpiredProducts(
    @Args('input') input: WriteOffExpiredProductsInput,
    @CurrentUser() user: any
  ): Promise<WriteOffExpiredProductsResponse> {
    // Agregar información del usuario responsable si no se proporciona
    const inputWithUser = {
      ...input,
      responsable: input.responsable || `${user.nombre} ${user.apellido} (${user.username})`
    };

    return this.productsService.writeOffExpiredProducts(inputWithUser);
  }

  @Query(() => String, { name: 'getCierreCompletoDetallado' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getCierreCompletoDetallado(@Args('cierreId', { type: () => ID }) cierreId: string): Promise<string> {
    const cierre = await this.prisma.cierreTurno.findUnique({
      where: { id: cierreId },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            username: true
          }
        },
        turno: {
          include: {
            puntoVenta: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                direccion: true
              }
            }
          }
        },
        metodosPago: true
      }
    });

    if (!cierre) {
      throw new Error('Cierre de turno no encontrado');
    }

    // Extraer toda la información completa del JSON
    const datosCompletos = cierre.resumenSurtidores as any;
    
    const cierreCompletoDetallado = {
      // === INFORMACIÓN BÁSICA DEL CIERRE ===
      informacionBasica: {
        id: cierre.id,
        fechaCierre: cierre.fechaCierre,
        estado: cierre.estado,
        createdAt: cierre.createdAt,
        updatedAt: cierre.updatedAt
      },

      // === INFORMACIÓN DEL TURNO Y PUNTO DE VENTA ===
      contexto: {
        turno: {
          id: cierre.turno.id,
          fechaInicio: cierre.turno.fechaInicio,
          fechaFin: cierre.turno.fechaFin,
          horaInicio: cierre.turno.horaInicio,
          horaFin: cierre.turno.horaFin,
          observaciones: cierre.turno.observaciones,
          activo: cierre.turno.activo
        },
        puntoVenta: cierre.turno.puntoVenta ? {
          id: cierre.turno.puntoVenta.id,
          codigo: cierre.turno.puntoVenta.codigo,
          nombre: cierre.turno.puntoVenta.nombre,
          direccion: cierre.turno.puntoVenta.direccion
        } : null,
        usuario: {
          id: cierre.usuario.id,
          nombre: cierre.usuario.nombre,
          apellido: cierre.usuario.apellido,
          email: cierre.usuario.email,
          username: cierre.usuario.username
        }
      },

      // === DATOS ORIGINALES ENVIADOS EN LA QUERY ===
      datosOriginalesEnviados: datosCompletos?.datosEntrada || {
        mensaje: "Datos originales no disponibles (cierre procesado con versión anterior)"
      },

      // === DATOS PROCESADOS Y CALCULADOS ===
      datosCalculados: datosCompletos?.datosProcesados || {
        mensaje: "Datos procesados no disponibles en formato detallado"
      },

      // === METADATOS DEL PROCESAMIENTO ===
      metadatosProcesamiento: datosCompletos?.metadatosProcesamiento || {
        mensaje: "Metadatos no disponibles (cierre procesado con versión anterior)"
      },

      // === RESUMEN FINANCIERO DESDE CAMPOS DIRECTOS ===
      resumenFinancieroDirecto: {
        totalVentasLitros: Number(cierre.totalVentasLitros),
        totalVentasGalones: Number(cierre.totalVentasGalones),
        valorTotalGeneral: Number(cierre.valorTotalGeneral),
        totalDeclarado: Number(cierre.totalDeclarado),
        diferencia: Number(cierre.diferencia),
        totalEfectivo: Number(cierre.totalEfectivo),
        totalTarjetas: Number(cierre.totalTarjetas),
        totalTransferencias: Number(cierre.totalTransferencias),
        totalRumbo: Number(cierre.totalRumbo),
        totalBonosViveTerpel: Number(cierre.totalBonosViveTerpel),
        totalOtros: Number(cierre.totalOtros),
        observacionesFinancieras: cierre.observacionesFinancieras,
        metodosPagoDetallados: cierre.metodosPago.map(pago => ({
          id: pago.id,
          metodoPago: pago.metodoPago,
          monto: Number(pago.monto),
          porcentaje: Number(pago.porcentaje),
          observaciones: pago.observaciones,
          createdAt: pago.createdAt
        }))
      },

      // === ESTADÍSTICAS DEL PROCESAMIENTO ===
      estadisticas: {
        productosActualizados: cierre.productosActualizados,
        tanquesActualizados: cierre.tanquesActualizados,
        cantidadErrores: cierre.errores.length,
        cantidadAdvertencias: cierre.advertencias.length,
        errores: cierre.errores,
        advertencias: cierre.advertencias
      },

      // === OBSERVACIONES ===
      observaciones: {
        generales: cierre.observacionesGenerales,
        financieras: cierre.observacionesFinancieras
      },

      // === INSTRUCCIONES PARA RECONSTRUIR LA QUERY ORIGINAL ===
      instruccionesReconstruccion: {
        descripcion: "Para reconstruir la query original, usa los datos en 'datosOriginalesEnviados'",
        ejemplo: datosCompletos?.datosEntrada ? {
          query: "mutation ProcessShiftClosure",
          variables: {
            cierreTurnoInput: datosCompletos.datosEntrada
          }
        } : "Datos originales no disponibles para reconstrucción",
        nota: "Los datos originales incluyen exactamente lo que se envió en la mutation original"
      }
    };

    return JSON.stringify(cierreCompletoDetallado, null, 2);
  }

  @Query(() => BusquedaCierresCompletosResponse, { name: 'buscarCierresCompletosConFiltros' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async buscarCierresCompletosConFiltros(
    @Args('fechaDesde', { nullable: true }) fechaDesde?: Date,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: Date,
    @Args('puntoVentaId', { type: () => ID, nullable: true }) puntoVentaId?: string,
    @Args('usuarioId', { type: () => ID, nullable: true }) usuarioId?: string,
    @Args('estado', { nullable: true }) estado?: string,
    @Args('incluirDatosOriginales', { defaultValue: true }) incluirDatosOriginales: boolean = true,
    @Args('incluirDatosProcesados', { defaultValue: false }) incluirDatosProcesados: boolean = false,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10
  ): Promise<BusquedaCierresCompletosResponse> {
    const skip = (page - 1) * limit;
    
    // Construir filtros
    const whereClause: any = {};
    
    if (fechaDesde || fechaHasta) {
      whereClause.fechaCierre = {};
      if (fechaDesde) whereClause.fechaCierre.gte = fechaDesde;
      if (fechaHasta) whereClause.fechaCierre.lte = fechaHasta;
    }
    
    if (usuarioId) {
      whereClause.usuarioId = usuarioId;
    }
    
    if (estado) {
      whereClause.estado = estado;
    }
    
    if (puntoVentaId) {
      whereClause.turno = {
        puntoVentaId: puntoVentaId
      };
    }

    // Obtener total de registros
    const total = await this.prisma.cierreTurno.count({ where: whereClause });

    // Obtener cierres con toda la información
    const cierres = await this.prisma.cierreTurno.findMany({
      where: whereClause,
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            username: true
          }
        },
        turno: {
          include: {
            puntoVenta: {
              select: {
                id: true,
                codigo: true,
                nombre: true,
                direccion: true
              }
            }
          }
        },
        metodosPago: true
      },
      orderBy: { fechaCierre: 'desc' },
      skip: skip,
      take: limit
    });

    // Calcular distribución de estados como JSON string
    const distribucionEstados = cierres.reduce((acc, c) => {
      acc[c.estado] = (acc[c.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Construir respuesta tipada
    const resultadoBusqueda: BusquedaCierresCompletosResponse = {
      // === METADATOS DE LA BÚSQUEDA ===
      metadatos: {
        totalRegistros: total,
        paginaActual: page,
        registrosPorPagina: limit,
        totalPaginas: Math.ceil(total / limit),
        fechaBusqueda: new Date(),
        filtrosAplicados: {
          fechaDesde,
          fechaHasta,
          puntoVentaId,
          usuarioId,
          estado
        },
        opciones: {
          incluirDatosOriginales,
          incluirDatosProcesados
        }
      },

      // === RESUMEN ESTADÍSTICO ===
      resumenEstadistico: {
        totalValorGeneral: cierres.reduce((sum, c) => sum + Number(c.valorTotalGeneral), 0),
        totalLitros: cierres.reduce((sum, c) => sum + Number(c.totalVentasLitros), 0),
        totalGalones: cierres.reduce((sum, c) => sum + Number(c.totalVentasGalones), 0),
        totalDeclarado: cierres.reduce((sum, c) => sum + Number(c.totalDeclarado), 0),
        totalDiferencias: cierres.reduce((sum, c) => sum + Number(c.diferencia), 0),
        productosActualizadosTotal: cierres.reduce((sum, c) => sum + c.productosActualizados, 0),
        tanquesActualizadosTotal: cierres.reduce((sum, c) => sum + c.tanquesActualizados, 0),
        distribucionEstados: JSON.stringify(distribucionEstados)
      },

      // === CIERRES ENCONTRADOS ===
      cierres: cierres.map(cierre => {
        const datosCompletos = cierre.resumenSurtidores as any;
        
        const cierreInfo: any = {
          // Información básica
          id: cierre.id,
          fechaCierre: cierre.fechaCierre,
          estado: cierre.estado,
          
          // Contexto
          usuario: `${cierre.usuario.nombre} ${cierre.usuario.apellido}`,
          puntoVenta: cierre.turno.puntoVenta?.nombre || 'No identificado',
          puntoVentaId: cierre.turno.puntoVentaId,
          
          // Datos financieros resumidos
          resumenFinanciero: {
            valorTotalGeneral: Number(cierre.valorTotalGeneral),
            totalDeclarado: Number(cierre.totalDeclarado),
            diferencia: Number(cierre.diferencia),
            totalLitros: Number(cierre.totalVentasLitros),
            totalGalones: Number(cierre.totalVentasGalones)
          },
          
          // Estadísticas
          estadisticas: {
            productosActualizados: cierre.productosActualizados,
            tanquesActualizados: cierre.tanquesActualizados,
            cantidadErrores: cierre.errores.length,
            cantidadAdvertencias: cierre.advertencias.length
          },

          // Capacidad de reconstrucción
          puedeReconstruirQuery: Boolean(datosCompletos?.datosEntrada)
        };

        // Incluir datos originales si se solicita
        if (incluirDatosOriginales && datosCompletos?.datosEntrada) {
          cierreInfo.datosOriginalesCompletos = JSON.stringify(datosCompletos.datosEntrada);
        }

        // Incluir datos procesados si se solicita
        if (incluirDatosProcesados && datosCompletos?.datosProcesados) {
          cierreInfo.datosProcesadosCompletos = JSON.stringify(datosCompletos.datosProcesados);
        }

        return cierreInfo;
      })
    };

    return resultadoBusqueda;
  }

  @Query(() => EstadisticasCierresPorPeriodoResponse, { name: 'getEstadisticasCierresPorPeriodo' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getEstadisticasCierresPorPeriodo(
    @Args('fechaDesde') fechaDesde: Date,
    @Args('fechaHasta') fechaHasta: Date,
    @Args('agruparPor', { defaultValue: 'dia' }) agruparPor: string = 'dia' // 'dia', 'semana', 'mes'
  ): Promise<EstadisticasCierresPorPeriodoResponse> {
    const cierres = await this.prisma.cierreTurno.findMany({
      where: {
        fechaCierre: {
          gte: fechaDesde,
          lte: fechaHasta
        }
      },
      include: {
        turno: {
          include: {
            puntoVenta: {
              select: { id: true, nombre: true }
            }
          }
        },
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        }
      },
      orderBy: { fechaCierre: 'asc' }
    });

    // Agrupar datos según el criterio
    const datosAgrupados = cierres.reduce((acc, cierre) => {
      let clave: string;
      const fecha = new Date(cierre.fechaCierre);
      
      switch (agruparPor) {
        case 'semana':
          const inicioSemana = new Date(fecha);
          inicioSemana.setDate(fecha.getDate() - fecha.getDay());
          clave = inicioSemana.toISOString().split('T')[0];
          break;
        case 'mes':
          clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
          break;
        default: // dia
          clave = fecha.toISOString().split('T')[0];
      }

      if (!acc[clave]) {
        acc[clave] = {
          periodo: clave,
          totalCierres: 0,
          valorTotalGeneral: 0,
          totalLitros: 0,
          totalGalones: 0,
          totalDeclarado: 0,
          diferenciasAcumuladas: 0,
          productosActualizados: 0,
          tanquesActualizados: 0,
          cierresExitosos: 0,
          cierresConErrores: 0,
          cierresFallidos: 0,
          puntosVentaUnicos: new Set(),
          usuariosUnicos: new Set(),
          cierresDetalle: []
        };
      }

      const grupo = acc[clave];
      grupo.totalCierres++;
      grupo.valorTotalGeneral += Number(cierre.valorTotalGeneral);
      grupo.totalLitros += Number(cierre.totalVentasLitros);
      grupo.totalGalones += Number(cierre.totalVentasGalones);
      grupo.totalDeclarado += Number(cierre.totalDeclarado);
      grupo.diferenciasAcumuladas += Number(cierre.diferencia);
      grupo.productosActualizados += cierre.productosActualizados;
      grupo.tanquesActualizados += cierre.tanquesActualizados;

      // Contar estados
      if (cierre.estado === 'exitoso') grupo.cierresExitosos++;
      else if (cierre.estado === 'con_errores') grupo.cierresConErrores++;
      else grupo.cierresFallidos++;

      // Agregar puntos de venta y usuarios únicos
      if (cierre.turno.puntoVenta) {
        grupo.puntosVentaUnicos.add(cierre.turno.puntoVenta.nombre);
      }
      grupo.usuariosUnicos.add(`${cierre.usuario.nombre} ${cierre.usuario.apellido}`);

      // Agregar detalle del cierre
      grupo.cierresDetalle.push({
        id: cierre.id,
        fechaCierre: cierre.fechaCierre,
        estado: cierre.estado,
        valorTotal: Number(cierre.valorTotalGeneral),
        usuario: `${cierre.usuario.nombre} ${cierre.usuario.apellido}`,
        puntoVenta: cierre.turno.puntoVenta?.nombre || 'No identificado'
      });

      return acc;
    }, {} as Record<string, any>);

    // Convertir Sets a arrays y calcular estadísticas finales
    const estadisticasPorPeriodo = Object.values(datosAgrupados).map((grupo: any) => ({
      periodo: grupo.periodo,
      totalCierres: grupo.totalCierres,
      valorTotalGeneral: grupo.valorTotalGeneral,
      totalLitros: grupo.totalLitros,
      totalGalones: grupo.totalGalones,
      totalDeclarado: grupo.totalDeclarado,
      diferenciasAcumuladas: grupo.diferenciasAcumuladas,
      productosActualizados: grupo.productosActualizados,
      tanquesActualizados: grupo.tanquesActualizados,
      cierresExitosos: grupo.cierresExitosos,
      cierresConErrores: grupo.cierresConErrores,
      cierresFallidos: grupo.cierresFallidos,
      puntosVentaUnicos: Array.from(grupo.puntosVentaUnicos) as string[],
      usuariosUnicos: Array.from(grupo.usuariosUnicos) as string[],
      cantidadPuntosVentaUnicos: grupo.puntosVentaUnicos.size,
      cantidadUsuariosUnicos: grupo.usuariosUnicos.size,
      promedioValorPorCierre: grupo.totalCierres > 0 ? grupo.valorTotalGeneral / grupo.totalCierres : 0,
      porcentajeExitosos: grupo.totalCierres > 0 ? (grupo.cierresExitosos / grupo.totalCierres) * 100 : 0,
      cierresDetalle: grupo.cierresDetalle
    }));

    const resumenGeneral: EstadisticasCierresPorPeriodoResponse = {
      // === METADATOS ===
      metadatos: {
        fechaDesde,
        fechaHasta,
        agruparPor,
        periodosEncontrados: estadisticasPorPeriodo.length,
        fechaGeneracion: new Date()
      },

      // === TOTALES GENERALES ===
      totalesGenerales: {
        totalCierres: estadisticasPorPeriodo.reduce((sum, p) => sum + p.totalCierres, 0),
        valorTotalGeneral: estadisticasPorPeriodo.reduce((sum, p) => sum + p.valorTotalGeneral, 0),
        totalLitros: estadisticasPorPeriodo.reduce((sum, p) => sum + p.totalLitros, 0),
        totalGalones: estadisticasPorPeriodo.reduce((sum, p) => sum + p.totalGalones, 0),
        diferenciasAcumuladas: estadisticasPorPeriodo.reduce((sum, p) => sum + p.diferenciasAcumuladas, 0),
        cierresExitosos: estadisticasPorPeriodo.reduce((sum, p) => sum + p.cierresExitosos, 0),
        cierresConErrores: estadisticasPorPeriodo.reduce((sum, p) => sum + p.cierresConErrores, 0),
        cierresFallidos: estadisticasPorPeriodo.reduce((sum, p) => sum + p.cierresFallidos, 0)
      },

      // === ESTADÍSTICAS POR PERÍODO ===
      estadisticasPorPeriodo: estadisticasPorPeriodo
    };

    return resumenGeneral;
  }

  @Query(() => EstadisticasMetodosPagoResponse, { name: 'getEstadisticasMetodosPago' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getEstadisticasMetodosPago(
    @Args('fechaDesde') fechaDesde: Date,
    @Args('fechaHasta') fechaHasta: Date,
    @Args('puntoVentaId', { type: () => ID, nullable: true }) puntoVentaId?: string,
    @Args('metodoPago', { nullable: true }) metodoPago?: string,
    @Args('codigoProducto', { nullable: true }) codigoProducto?: string
  ): Promise<EstadisticasMetodosPagoResponse> {
    
    // Función auxiliar para extraer hora en formato HH:mm (igual que movimientos_efectivo)
    const extraerHoraHHmm = (dateInput: Date | string): string => {
      const date = new Date(dateInput);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };

    // Extraer fecha y hora de los parámetros (igual que movimientos_efectivo)
    const fechaDesdeDate = new Date(fechaDesde);
    const fechaHastaDate = new Date(fechaHasta);
    const horaDesde = extraerHoraHHmm(fechaDesde); // "06:00"
    const horaHasta = extraerHoraHHmm(fechaHasta); // "14:00"
    
    console.log('[ESTADISTICAS_METODOS_PAGO] Filtros recibidos:');
    console.log('[ESTADISTICAS_METODOS_PAGO]   - fechaDesde:', fechaDesde, 'horaDesde:', horaDesde);
    console.log('[ESTADISTICAS_METODOS_PAGO]   - fechaHasta:', fechaHasta, 'horaHasta:', horaHasta);
    
    // Construir filtros
    // Filtrar por fechaInicio y fechaFin del TURNO (no por fechaCierre)
    // Y también por horaInicio y horaFin del turno
    // El frontend envía fecha inicio (ej: 01/09/2025 12:00 AM = 00:00:00) y fecha fin (ej: 01/09/2025 11:59 PM = 23:59:59)
    // Se deben mostrar todos los cierres de turnos que se solapen con ese rango (fecha + hora)
    const turnoFilters: any = {
      AND: [
        // Filtro por fecha (solapamiento)
        {
          fechaInicio: {
            lte: fechaHasta
          }
        },
        {
          OR: [
            {
              fechaFin: {
                gte: fechaDesde
              }
            },
            {
              fechaFin: null
            }
          ]
        },
        // Filtro por hora (solapamiento)
        {
          OR: [
            // Turno que inicia dentro del rango
            {
              AND: [
                { horaInicio: { gte: horaDesde } },
                { horaInicio: { lte: horaHasta } }
              ]
            },
            // Turno que termina dentro del rango
            {
              AND: [
                { horaFin: { gte: horaDesde } },
                { horaFin: { lte: horaHasta } }
              ]
            },
            // Turno que contiene todo el rango (inicia antes y termina después)
            {
              AND: [
                { horaInicio: { lte: horaDesde } },
                { horaFin: { gte: horaHasta } }
              ]
            },
            // Rango que contiene todo el turno (inicia después y termina antes)
            {
              AND: [
                { horaInicio: { gte: horaDesde } },
                { horaFin: { lte: horaHasta } }
              ]
            }
          ]
        }
      ]
    };

    if (puntoVentaId) {
      turnoFilters.AND.push({
        puntoVentaId: puntoVentaId
      });
    }

    const whereClause: any = {
      turno: turnoFilters
    };

    // Obtener todos los cierres del período
    const cierres = await this.prisma.cierreTurno.findMany({
      where: whereClause,
      include: {
        turno: {
          include: {
            puntoVenta: {
              select: { id: true, nombre: true }
            }
          }
        },
        usuario: {
          select: { id: true, nombre: true, apellido: true }
        }
      },
      orderBy: { fechaCierre: 'asc' }
    });

    // Estructuras para acumular datos
    const metodosPagoStats = new Map<string, {
      montoTotal: number;
      cantidadTransacciones: number;
      productosVendidos: Set<string>;
    }>();

    const productosPorMetodo = new Map<string, {
      codigoProducto: string;
      nombreProducto: string;
      metodoPago: string;
      montoTotal: number;
      cantidadVentas: number;
      cantidadVendida: number;
      unidadMedida: string;
    }>();

    let montoTotalPeriodo = 0;
    let totalTransacciones = 0;

    // Procesar cada cierre
    for (const cierre of cierres) {
      const datosCompletos = cierre.resumenSurtidores as any;
      
      // Procesar datos de combustibles (desde surtidores)
      if (datosCompletos?.datosProcesados?.resumenSurtidores) {
        for (const surtidor of datosCompletos.datosProcesados.resumenSurtidores) {
          for (const venta of surtidor.ventas || []) {
            if (venta.metodosPago) {
              for (const mp of venta.metodosPago) {
                // Filtrar por método de pago si se especifica
                if (metodoPago && mp.metodoPago !== metodoPago) continue;
                // Filtrar por producto si se especifica
                if (codigoProducto && venta.codigoProducto !== codigoProducto) continue;

                // Acumular estadísticas por método de pago
                if (!metodosPagoStats.has(mp.metodoPago)) {
                  metodosPagoStats.set(mp.metodoPago, {
                    montoTotal: 0,
                    cantidadTransacciones: 0,
                    productosVendidos: new Set()
                  });
                }

                const stats = metodosPagoStats.get(mp.metodoPago)!;
                stats.montoTotal += mp.monto;
                stats.cantidadTransacciones += 1;
                stats.productosVendidos.add(venta.codigoProducto);

                // Acumular por producto y método de pago
                const key = `${venta.codigoProducto}_${mp.metodoPago}`;
                if (!productosPorMetodo.has(key)) {
                  productosPorMetodo.set(key, {
                    codigoProducto: venta.codigoProducto,
                    nombreProducto: venta.nombreProducto,
                    metodoPago: mp.metodoPago,
                    montoTotal: 0,
                    cantidadVentas: 0,
                    cantidadVendida: 0,
                    unidadMedida: venta.unidadOriginal || 'galones'
                  });
                }

                const productStats = productosPorMetodo.get(key)!;
                productStats.montoTotal += mp.monto;
                productStats.cantidadVentas += 1;
                productStats.cantidadVendida += venta.cantidadVendidaGalones || venta.cantidadVendidaLitros || 0;

                montoTotalPeriodo += mp.monto;
                totalTransacciones += 1;
              }
            }
          }
        }
      }

      // Procesar datos de productos de tienda
      if (datosCompletos?.datosProcesados?.resumenVentasProductos?.ventasDetalle) {
        for (const producto of datosCompletos.datosProcesados.resumenVentasProductos.ventasDetalle) {
          // Procesar ventas individuales si existen
          if (producto.ventasIndividuales) {
            for (const ventaInd of producto.ventasIndividuales) {
              if (ventaInd.metodosPago) {
                for (const mp of ventaInd.metodosPago) {
                  // Filtros
                  if (metodoPago && mp.metodoPago !== metodoPago) continue;
                  if (codigoProducto && producto.codigoProducto !== codigoProducto) continue;

                  // Acumular estadísticas por método de pago
                  if (!metodosPagoStats.has(mp.metodoPago)) {
                    metodosPagoStats.set(mp.metodoPago, {
                      montoTotal: 0,
                      cantidadTransacciones: 0,
                      productosVendidos: new Set()
                    });
                  }

                  const stats = metodosPagoStats.get(mp.metodoPago)!;
                  stats.montoTotal += mp.monto;
                  stats.cantidadTransacciones += 1;
                  stats.productosVendidos.add(producto.codigoProducto);

                  // Acumular por producto y método de pago
                  const key = `${producto.codigoProducto}_${mp.metodoPago}`;
                  if (!productosPorMetodo.has(key)) {
                    productosPorMetodo.set(key, {
                      codigoProducto: producto.codigoProducto,
                      nombreProducto: producto.nombreProducto,
                      metodoPago: mp.metodoPago,
                      montoTotal: 0,
                      cantidadVentas: 0,
                      cantidadVendida: 0,
                      unidadMedida: producto.unidadMedida
                    });
                  }

                  const productStats = productosPorMetodo.get(key)!;
                  productStats.montoTotal += mp.monto;
                  productStats.cantidadVentas += 1;
                  productStats.cantidadVendida += ventaInd.cantidad;

                  montoTotalPeriodo += mp.monto;
                  totalTransacciones += 1;
                }
              }
            }
          } else if (producto.metodosPago) {
            // Procesar métodos de pago consolidados del producto
            for (const mp of producto.metodosPago) {
              // Filtros
              if (metodoPago && mp.metodoPago !== metodoPago) continue;
              if (codigoProducto && producto.codigoProducto !== codigoProducto) continue;

              // Acumular estadísticas por método de pago
              if (!metodosPagoStats.has(mp.metodoPago)) {
                metodosPagoStats.set(mp.metodoPago, {
                  montoTotal: 0,
                  cantidadTransacciones: 0,
                  productosVendidos: new Set()
                });
              }

              const stats = metodosPagoStats.get(mp.metodoPago)!;
              stats.montoTotal += mp.monto;
              stats.cantidadTransacciones += 1;
              stats.productosVendidos.add(producto.codigoProducto);

              // Acumular por producto y método de pago
              const key = `${producto.codigoProducto}_${mp.metodoPago}`;
              if (!productosPorMetodo.has(key)) {
                productosPorMetodo.set(key, {
                  codigoProducto: producto.codigoProducto,
                  nombreProducto: producto.nombreProducto,
                  metodoPago: mp.metodoPago,
                  montoTotal: 0,
                  cantidadVentas: 0,
                  cantidadVendida: 0,
                  unidadMedida: producto.unidadMedida
                });
              }

              const productStats = productosPorMetodo.get(key)!;
              productStats.montoTotal += mp.monto;
              productStats.cantidadVentas += 1;
              productStats.cantidadVendida += producto.cantidadVendida;

              montoTotalPeriodo += mp.monto;
              totalTransacciones += 1;
            }
          }
        }
      }
    }

    // Convertir a arrays y calcular porcentajes
    const resumenPorMetodoPago = Array.from(metodosPagoStats.entries()).map(([metodoPago, stats]) => ({
      metodoPago,
      montoTotal: Math.round(stats.montoTotal * 100) / 100,
      cantidadTransacciones: stats.cantidadTransacciones,
      porcentajeDelTotal: montoTotalPeriodo > 0 ? Math.round((stats.montoTotal / montoTotalPeriodo) * 100 * 100) / 100 : 0,
      montoPromedioPorTransaccion: stats.cantidadTransacciones > 0 ? Math.round((stats.montoTotal / stats.cantidadTransacciones) * 100) / 100 : 0,
      productosVendidos: Array.from(stats.productosVendidos) as string[],
      cantidadProductosUnicos: stats.productosVendidos.size
    })).sort((a, b) => b.montoTotal - a.montoTotal);

    const detallesPorProducto = Array.from(productosPorMetodo.values()).map(producto => ({
      codigoProducto: producto.codigoProducto,
      nombreProducto: producto.nombreProducto,
      metodoPago: producto.metodoPago,
      montoTotal: Math.round(producto.montoTotal * 100) / 100,
      cantidadVentas: producto.cantidadVentas,
      cantidadVendida: Math.round(producto.cantidadVendida * 100) / 100,
      unidadMedida: producto.unidadMedida
    })).sort((a, b) => b.montoTotal - a.montoTotal);

    return {
      fechaDesde,
      fechaHasta,
      montoTotalPeriodo: Math.round(montoTotalPeriodo * 100) / 100,
      totalTransacciones,
      totalCierres: cierres.length,
      resumenPorMetodoPago,
      detallesPorProducto,
      fechaGeneracion: new Date()
    };
  }

  /**
   * PROCESAR ENTRADA DE INVENTARIO (MÉTODO ANTERIOR - MANTENIDO POR COMPATIBILIDAD)
   * Registra ingresos de productos, combustibles y descargas de carrotanques
   */
  @Mutation(() => InventoryEntryResponse)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'employee')
  async processInventoryEntry(
    @Args('inventoryEntryInput') inventoryEntryInput: InventoryEntryInput,
    @CurrentUser() user: any,
  ): Promise<InventoryEntryResponse> {
    return this.inventoryService.processInventoryEntry(inventoryEntryInput);
  }

  /**
   * PROCESAR ENTRADA DE INVENTARIO (NUEVA ESTRUCTURA NORMALIZADA)
   * Registra procesos de entrada con movimientos separados
   */
  @Mutation(() => InventoryProcessResponse)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator')
  async processInventoryProcess(
    @Args('inventoryProcessInput') inventoryProcessInput: InventoryProcessInput,
    @CurrentUser() user: any,
  ): Promise<InventoryProcessResponse> {
    return this.productsService.processInventoryProcess(inventoryProcessInput, user);
  }

  /**
   * OBTENER PROCESO DE INVENTARIO POR ID
   */
  @Query(() => InventoryProcessResult, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'viewer')
  async getInventoryProcess(
    @Args('procesoId') procesoId: string,
  ): Promise<InventoryProcessResult | null> {
    return this.productsService.getInventoryProcess(procesoId);
  }

  /**
   * LISTAR PROCESOS DE INVENTARIO
   */
  @Query(() => [InventoryProcessResult])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'viewer')
  async listInventoryProcesses(
    @Args('puntoVentaId', { nullable: true }) puntoVentaId?: string,
    @Args('estado', { nullable: true }) estado?: string,
    @Args('tipoEntrada', { nullable: true }) tipoEntrada?: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: string,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: string,
  ): Promise<InventoryProcessResult[]> {
    return this.productsService.listInventoryProcesses({
      puntoVentaId,
      estado,
      tipoEntrada,
      fechaDesde,
      fechaHasta,
    });
  }

  // ===== NUEVAS FUNCIONALIDADES PARA VENTAS DE PRODUCTOS =====

  /**
   * REGISTRAR VENTA DE PRODUCTO
   */
  @Mutation(() => HistorialVentasProductos)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async registrarVentaProducto(
    @Args('input') input: RegistrarVentaProductoInput,
    @CurrentUser() user: any
  ): Promise<HistorialVentasProductos> {
    // Agregar información del usuario actual
    const inputWithUser = {
      ...input,
      usuarioId: user.id
    };
    
    return this.historialVentasService.registrarVentaProducto(inputWithUser);
  }

  @Mutation(() => HistorialVentasProductos)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateHistorialVentaProducto(
    @Args('id', { type: () => ID }) id: string,
    @Args('cantidadVendida', { type: () => Float, nullable: true }) cantidadVendida?: number,
    @Args('precioUnitario', { type: () => Float, nullable: true }) precioUnitario?: number,
    @Args('observaciones', { nullable: true }) observaciones?: string
  ): Promise<HistorialVentasProductos> {
    const input: UpdateHistorialVentaProductoInput = {
      id,
      ...(cantidadVendida !== undefined && { cantidadVendida }),
      ...(precioUnitario !== undefined && { precioUnitario }),
      ...(observaciones !== undefined && { observaciones })
    };
    return this.historialVentasService.updateHistorialVentaProducto(input);
  }

  @Mutation(() => MetodoPagoResumen, { name: 'updateCierreTurnoMetodoPago' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateCierreTurnoMetodoPago(
    @Args('id', { type: () => ID }) id: string,
    @Args('monto', { type: () => Float, nullable: true }) monto?: number,
    @Args('observaciones', { nullable: true }) observaciones?: string
  ): Promise<MetodoPagoResumen> {
    const input: UpdateCierreTurnoMetodoPagoInput = {
      id,
      ...(monto !== undefined && { monto }),
      ...(observaciones !== undefined && { observaciones })
    };
    return this.historialVentasService.updateCierreTurnoMetodoPago(input);
  }

  @Mutation(() => MovimientoEfectivo, { name: 'updateMovimientoEfectivo' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateMovimientoEfectivo(
    @Args('id', { type: () => ID }) id: string,
    @Args('monto', { type: () => Float, nullable: true }) monto?: number,
    @Args('concepto', { nullable: true }) concepto?: string,
    @Args('detalle', { nullable: true }) detalle?: string,
    @Args('observaciones', { nullable: true }) observaciones?: string
  ): Promise<MovimientoEfectivo> {
    const input: UpdateMovimientoEfectivoInput = {
      id,
      ...(monto !== undefined && { monto }),
      ...(concepto !== undefined && { concepto }),
      ...(detalle !== undefined && { detalle }),
      ...(observaciones !== undefined && { observaciones })
    };
    return this.historialVentasService.updateMovimientoEfectivo(input);
  }

  /**
   * OBTENER VENTAS DE PRODUCTOS CON FILTROS
   */
  @Query(() => [HistorialVentasProductos])
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerVentasProductos(
    @Args('filtros', { nullable: true }) filtros?: FiltrosVentasProductosInput
  ): Promise<HistorialVentasProductos[]> {
    return this.historialVentasService.obtenerVentasPaginadas(filtros);
  }

  /**
   * OBTENER VENTAS POR PRODUCTO
   */
  @Query(() => [HistorialVentasProductos])
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerVentasPorProducto(
    @Args('productoId', { type: () => ID }) productoId: string,
    @Args('filtros', { nullable: true }) filtros?: FiltrosVentasProductosInput
  ): Promise<HistorialVentasProductos[]> {
    return this.historialVentasService.obtenerVentasPorProducto(productoId, filtros);
  }

  /**
   * REPORTE CONSOLIDADO DE PRODUCTOS VENDIDOS
   */
  @Query(() => ResumenVentasProductos)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getAllProductsSalesConsolidatedReport(
    @Args('filtros') filtros: FiltrosReporteVentasInput,
    @CurrentUser() user: any,
  ): Promise<ResumenVentasProductos> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      select: { empresaId: true },
    });

    if (!usuario || !usuario.empresaId) {
      throw new UnauthorizedException('Usuario no tiene empresa asociada');
    }

    return this.historialVentasService.obtenerResumenVentasPorPeriodo(
      filtros,
      usuario.empresaId,
    );
  }

  /**
   * ESTADÍSTICAS GENERALES DE VENTAS
   */
  @Query(() => String, { name: 'getEstadisticasVentasGenerales' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getEstadisticasVentasGenerales(): Promise<string> {
    const estadisticas = await this.historialVentasService.obtenerEstadisticasGenerales();
    return JSON.stringify(estadisticas);
  }

  // ===== MÉTODOS DE PAGO =====

  /**
   * OBTENER TODOS LOS MÉTODOS DE PAGO
   */
  @Query(() => [MetodoPago])
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerMetodosPago(
    @Args('filtros', { nullable: true }) filtros?: FiltrosMetodosPagoInput
  ): Promise<MetodoPago[]> {
    return this.metodosPagoService.obtenerTodos(filtros);
  }

  /**
   * OBTENER MÉTODOS DE PAGO POR CATEGORÍA
   */
  @Query(() => [MetodoPago])
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerMetodosPagoPorCategoria(
    @Args('categoria') categoria: 'efectivo' | 'tarjeta' | 'digital'
  ): Promise<MetodoPago[]> {
    return this.metodosPagoService.obtenerPorCategoria(categoria);
  }

  /**
   * OBTENER MÉTODO DE PAGO POR CÓDIGO
   */
  @Query(() => MetodoPago, { nullable: true })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerMetodoPagoPorCodigo(
    @Args('codigo') codigo: string
  ): Promise<MetodoPago | null> {
    return this.metodosPagoService.obtenerPorCodigo(codigo);
  }

  /**
   * CREAR MÉTODO DE PAGO
   */
  @Mutation(() => MetodoPago)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async crearMetodoPago(
    @Args('input') input: CrearMetodoPagoInput
  ): Promise<MetodoPago> {
    return this.metodosPagoService.crearMetodoPago(input);
  }

  /**
   * ACTUALIZAR MÉTODO DE PAGO
   */
  @Mutation(() => MetodoPago)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async actualizarMetodoPago(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ActualizarMetodoPagoInput
  ): Promise<MetodoPago> {
    return this.metodosPagoService.actualizarMetodoPago(id, input);
  }

  /**
   * ELIMINAR MÉTODO DE PAGO
   */
  @Mutation(() => Boolean)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async eliminarMetodoPago(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    return this.metodosPagoService.eliminarMetodoPago(id);
  }

  // ===== HISTORIAL DE PRECIOS =====

  /**
   * OBTENER HISTORIAL DE PRECIOS DE UN PRODUCTO
   */
  @Query(() => HistorialPreciosResponse)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async obtenerHistorialPrecios(
    @Args('productoId', { type: () => ID }) productoId: string,
    @Args('page', { type: () => Int, defaultValue: 1 }) page: number = 1,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number = 10
  ): Promise<HistorialPreciosResponse> {
    const result = await this.productsService.obtenerHistorialPrecios(productoId, page, limit);
    return {
      historial: result.historial,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage
    };
  }

  // ===== MOVIMIENTOS DE EFECTIVO =====

  /**
   * OBTENER MOVIMIENTOS DE EFECTIVO CON FILTROS DE FECHA
   * Retorna lista de movimientos con totales de ingresos y egresos
   */
  @Query(() => MovimientosEfectivoResponse, { name: 'getMovimientosEfectivo' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getMovimientosEfectivo(
    @CurrentUser() user: any,
    @Args('filtros') filtros: FiltrosMovimientosEfectivoInput
  ): Promise<MovimientosEfectivoResponse> {
    // Obtener empresaId del usuario para validación de permisos
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      select: { empresaId: true },
    });

    const empresaId = usuario?.empresaId || undefined;

    return this.movimientosEfectivoService.obtenerMovimientosEfectivo(filtros, empresaId);
  }

  // ===== ACTUALIZACIÓN DINÁMICA DE LECTURAS DE MANGUERAS =====

  /**
   * OBTENER DETALLES DE UNA LECTURA DE MANGUERA
   * Query para obtener todos los datos necesarios para editar una lectura
   */
  @Query(() => LecturaMangueraDetails, { name: 'getLecturaMangueraDetails' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getLecturaMangueraDetails(
    @Args('lecturaId', { type: () => ID }) lecturaId: string
  ): Promise<LecturaMangueraDetails> {
    return this.lecturaMangueraUpdateService.getLecturaMangueraDetails(lecturaId);
  }

  /**
   * ACTUALIZAR LECTURA DE MANGUERA
   * Mutation para actualizar la cantidad vendida de una lectura con actualización en cascada
   */
  @Mutation(() => HistorialLectura, { name: 'updateHistorialLectura' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async updateHistorialLectura(
    @Args('id', { type: () => ID }) id: string,
    @Args('cantidadVendida', { type: () => Float }) cantidadVendida: number,
    @CurrentUser() user: any
  ): Promise<HistorialLectura> {
    return this.lecturaMangueraUpdateService.updateHistorialLectura(
      id,
      cantidadVendida,
      user.id
    );
  }
} 