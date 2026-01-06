import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { TanquesService } from './tanques.service';
import { randomUUID } from 'crypto';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { Producto } from './entities/producto.entity';
import { InventoryEntryInput } from './dto/inventory-entry.input';
import {
  InventoryEntryResponse,
  TankHeightEntryResult,
  ProductEntryResult,
  CarrotanqueEntryResult,
  ResumenFinancieroIngreso,
  ResumenInventarioIngreso
} from './entities/inventory-entry.entity';
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

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tanquesService: TanquesService
  ) {}

  // Helper method to convert Prisma product to GraphQL entity
  private formatProduct(product: any): Producto {
    const precioCompra = parseFloat(product.precioCompra?.toString() || '0');
    const precioVenta = parseFloat(product.precioVenta?.toString() || '0');

    // Calcular métricas de rentabilidad
    const utilidad = precioVenta - precioCompra;
    const margenUtilidad = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;
    const porcentajeGanancia = precioCompra > 0 ? (utilidad / precioCompra) * 100 : 0;

    return {
      ...product,
      precioCompra: precioCompra,
      precioVenta: precioVenta,
      utilidad: utilidad,
      margenUtilidad: Math.round(margenUtilidad * 100) / 100, // Redondear a 2 decimales
      porcentajeGanancia: Math.round(porcentajeGanancia * 100) / 100, // Redondear a 2 decimales
    } as Producto;
  }

  // Helper method to convert array of Prisma products to GraphQL entities
  private formatProducts(products: any[]): Producto[] {
    return products.map(product => this.formatProduct(product));
  }

  async create(createProductInput: CreateProductInput): Promise<Producto> {
    // Verificar si el código ya existe
    const existingProduct = await this.prisma.producto.findUnique({
      where: { codigo: createProductInput.codigo },
    });

    if (existingProduct) {
      throw new ConflictException('El código del producto ya existe');
    }

    const producto = await this.prisma.producto.create({
      data: {
        codigo: createProductInput.codigo,
        nombre: createProductInput.nombre,
        descripcion: createProductInput.descripcion,
        unidadMedida: createProductInput.unidadMedida,
        precioCompra: createProductInput.precioCompra,
        precioVenta: createProductInput.precioVenta,
        moneda: createProductInput.moneda || 'COP',
        stockMinimo: createProductInput.stockMinimo || 0,
        stockActual: createProductInput.stockActual || 0,
        esCombustible: createProductInput.esCombustible || false,
        tipoProducto: createProductInput.tipoProducto,
        codigoPlu: createProductInput.codigoPlu,
        categoriaId: createProductInput.categoriaId,
        puntoVentaId: createProductInput.puntoVentaId,
      },
      include: { categoria: true, puntoVenta: true },
    });

    return this.formatProduct(producto);
  }

  async findAll(filters?: {
    page?: number;
    limit?: number;
    searchTerm?: string;
    categoriaId?: string;
    activo?: boolean;
    esCombustible?: boolean;
    puntoVentaId?: string;
  }): Promise<{ products: Producto[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filtros opcionales - solo agregar si tienen valores válidos
    if (filters?.searchTerm && filters.searchTerm.trim() !== '') {
      where.OR = [
        { nombre: { contains: filters.searchTerm, mode: 'insensitive' } },
        { codigo: { contains: filters.searchTerm } },
        { descripcion: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    if (filters?.categoriaId && filters.categoriaId.trim() !== '') {
      where.categoriaId = filters.categoriaId;
    }

    if (filters?.activo !== undefined && filters?.activo !== null) {
      where.activo = filters.activo;
    }

    if (filters?.esCombustible !== undefined && filters?.esCombustible !== null) {
      where.esCombustible = filters.esCombustible;
    }

    if (filters?.puntoVentaId && filters.puntoVentaId.trim() !== '') {
      where.puntoVentaId = filters.puntoVentaId;
    }

    const [productos, total] = await Promise.all([
      this.prisma.producto.findMany({
        where,
        include: { categoria: true, puntoVenta: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.producto.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      products: this.formatProducts(productos),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(id: string): Promise<Producto | null> {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: { categoria: true, puntoVenta: true },
    });

    return producto ? this.formatProduct(producto) : null;
  }

  async findByCode(codigo: string): Promise<Producto | null> {
    const producto = await this.prisma.producto.findUnique({
      where: { codigo },
      include: { categoria: true, puntoVenta: true },
    });

    return producto ? this.formatProduct(producto) : null;
  }

  async findByCategory(categoriaId: string): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: { categoriaId },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async findByPointOfSale(puntoVentaId: string): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: { puntoVentaId },
      include: { categoria: true, puntoVenta: true },
      orderBy: { nombre: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async findActive(): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async findLowStock(): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: {
        stockActual: {
          lte: { stockMinimo: true } as any,
        },
      },
      include: { categoria: true },
      orderBy: { stockActual: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async findFuel(): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: { esCombustible: true },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async searchProducts(searchTerm: string): Promise<Producto[]> {
    const productos = await this.prisma.producto.findMany({
      where: {
        OR: [
          { nombre: { contains: searchTerm, mode: 'insensitive' } },
          { codigo: { contains: searchTerm } },
          { descripcion: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    return this.formatProducts(productos);
  }

  async update(id: string, updateProductInput: UpdateProductInput, usuarioId?: string, isEmployee?: boolean): Promise<Producto> {
    const existingProduct = await this.findById(id);

    if (!existingProduct) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Si es empleado, validar que solo se actualice precioVenta y que el producto sea combustible
    if (isEmployee) {
      if (!existingProduct.esCombustible) {
        throw new ForbiddenException('Los empleados solo pueden actualizar el precio de productos combustibles');
      }

      // Asegurar que solo se actualice precioVenta (y motivoCambioPrecio si viene)
      const allowedFields = ['precioVenta', 'motivoCambioPrecio'];
      const filteredData: any = {};
      
      if (updateProductInput.precioVenta !== undefined) {
        filteredData.precioVenta = updateProductInput.precioVenta;
      }
      
      if (updateProductInput.motivoCambioPrecio !== undefined) {
        filteredData.motivoCambioPrecio = updateProductInput.motivoCambioPrecio;
      }

      // Verificar si el precio de venta está cambiando
      const precioAnterior = parseFloat(existingProduct.precioVenta.toString());
      const precioNuevo = filteredData.precioVenta ? parseFloat(filteredData.precioVenta.toString()) : precioAnterior;
      const precioCambio = precioAnterior !== precioNuevo;

      const producto = await this.prisma.producto.update({
        where: { id },
        data: { precioVenta: filteredData.precioVenta },
        include: { categoria: true },
      });

      // Registrar cambio de precio si aplica
      if (precioCambio && usuarioId) {
        await this.registrarCambioPrecio(id, precioAnterior, precioNuevo, usuarioId, filteredData.motivoCambioPrecio);
      }

      return this.formatProduct(producto);
    }

    // Para admin y manager, comportamiento normal
    // Si se está actualizando el código, verificar que no exista
    if (updateProductInput.codigo && updateProductInput.codigo !== existingProduct.codigo) {
      const codeExists = await this.prisma.producto.findUnique({
        where: { codigo: updateProductInput.codigo },
      });

      if (codeExists) {
        throw new ConflictException('El código del producto ya existe');
      }
    }

    // Validar precioVenta > precioCompra si se está actualizando precioVenta
    // Usar precioCompra del input si viene, sino usar el de la BD
    if (updateProductInput.precioVenta !== undefined) {
      const precioCompraParaValidar = updateProductInput.precioCompra !== undefined
        ? parseFloat(updateProductInput.precioCompra.toString())
        : parseFloat(existingProduct.precioCompra.toString());
      
      const precioVentaNuevo = parseFloat(updateProductInput.precioVenta.toString());
      
      if (precioVentaNuevo <= precioCompraParaValidar) {
        throw new ForbiddenException('El precio de venta debe ser mayor al precio de compra');
      }
    }

    // Verificar si el precio de venta está cambiando
    const precioAnterior = parseFloat(existingProduct.precioVenta.toString());
    const precioNuevo = updateProductInput.precioVenta ? parseFloat(updateProductInput.precioVenta.toString()) : precioAnterior;
    const precioCambio = precioAnterior !== precioNuevo;

    const producto = await this.prisma.producto.update({
      where: { id },
      data: updateProductInput,
      include: { categoria: true },
    });

    // Registrar cambio de precio si aplica
    if (precioCambio && usuarioId) {
      await this.registrarCambioPrecio(id, precioAnterior, precioNuevo, usuarioId, updateProductInput.motivoCambioPrecio);
    }

    return this.formatProduct(producto);
  }

  validateEmployeeUpdatePermissions(
    existingProduct: Producto,
    updateProductInput: UpdateProductInput
  ): { isValid: boolean; filteredInput?: UpdateProductInput; error?: string } {
    if (!existingProduct.esCombustible) {
      return {
        isValid: false,
        error: 'Los empleados solo pueden actualizar el precio de productos combustibles'
      };
    }

    const defaultValues = {
      moneda: 'COP',
      stockMinimo: 0,
      stockActual: 0,
      esCombustible: false,
      activo: true,
    };

    const inputEntries = Object.entries(updateProductInput).filter(([key, value]) => {
      if (defaultValues[key] !== undefined && value === defaultValues[key]) {
        return false;
      }
      if (existingProduct[key] !== undefined && 
          JSON.stringify(value) === JSON.stringify(existingProduct[key])) {
        return false;
      }
      return value !== undefined && 
             value !== null && 
             value !== '' &&
             typeof value !== 'function' &&
             !(typeof value === 'object' && value.constructor === Object && Object.keys(value).length === 0);
    });

    const inputKeys = inputEntries.map(([key]) => key);
    const allowedFields = ['precioVenta', 'motivoCambioPrecio'];
    const invalidFields = inputKeys.filter(key => !allowedFields.includes(key));

    if (invalidFields.length > 0) {
      return {
        isValid: false,
        error: `Los empleados solo pueden actualizar el precio de venta. Campos no permitidos detectados: ${invalidFields.join(', ')}`
      };
    }

    if (!updateProductInput.precioVenta) {
      return {
        isValid: false,
        error: 'El precio de venta es requerido'
      };
    }

    const precioCompraActual = parseFloat(existingProduct.precioCompra.toString());
    const precioVentaNuevo = parseFloat(updateProductInput.precioVenta.toString());
    
    if (precioVentaNuevo <= precioCompraActual) {
      return {
        isValid: false,
        error: 'El precio de venta debe ser mayor al precio de compra'
      };
    }

    const filteredInput: UpdateProductInput = {
      precioVenta: updateProductInput.precioVenta,
      ...(updateProductInput.motivoCambioPrecio && { motivoCambioPrecio: updateProductInput.motivoCambioPrecio }),
    };

    return {
      isValid: true,
      filteredInput
    };
  }

  convertGalonesToLitros(cantidad: number): number {
    const GALONES_TO_LITROS = 3.78541;
    return cantidad * GALONES_TO_LITROS;
  }

  validateAndConvertUnit(cantidad: number, unidadMedida: string): { cantidadEnLitros: number; error?: string } {
    const unidadLower = unidadMedida.toLowerCase();
    
    if (unidadLower === 'galones') {
      return {
        cantidadEnLitros: this.convertGalonesToLitros(cantidad)
      };
    } else if (unidadLower === 'litros') {
      return {
        cantidadEnLitros: cantidad
      };
    } else {
      return {
        cantidadEnLitros: 0,
        error: `Unidad no soportada: ${unidadMedida}. Use 'litros' o 'galones'`
      };
    }
  }

  async updateStock(id: string, cantidad: number, tipo: 'entrada' | 'salida'): Promise<Producto> {
    const product = await this.findById(id);

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const newStock = tipo === 'entrada'
      ? product.stockActual + cantidad
      : product.stockActual - cantidad;

    if (newStock < 0) {
      throw new ConflictException('Stock insuficiente');
    }

    const producto = await this.prisma.producto.update({
      where: { id },
      data: { stockActual: newStock },
      include: { categoria: true },
    });

    return this.formatProduct(producto);
  }

  async remove(id: string): Promise<Producto> {
    const existingProduct = await this.findById(id);

    if (!existingProduct) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Verificar si tiene ventas asociadas
    const salesCount = await this.prisma.detalleVenta.count({
      where: { productoId: id },
    });

    if (salesCount > 0) {
      throw new ConflictException('No se puede eliminar el producto porque tiene ventas asociadas');
    }

    const producto = await this.prisma.producto.delete({
      where: { id },
      include: { categoria: true },
    });

    return this.formatProduct(producto);
  }

  async toggleProductStatus(id: string): Promise<Producto> {
    const product = await this.findById(id);

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const updatedProduct = await this.prisma.producto.update({
      where: { id },
      data: { activo: !product.activo },
      include: { categoria: true },
    });

    return this.formatProduct(updatedProduct);
  }

  async getProductStats() {
    const totalProducts = await this.prisma.producto.count();
    const activeProducts = await this.prisma.producto.count({
      where: { activo: true },
    });
    const lowStockProducts = await this.prisma.producto.count({
      where: {
        AND: [
          { activo: true },
          {
            stockActual: {
              lte: { stockMinimo: true } as any,
            },
          },
        ],
      },
    });

    const inventoryValue = await this.prisma.producto.aggregate({
      where: { activo: true },
      _sum: {
        stockActual: true,
      },
    });

    return {
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      lowStockProducts,
      inventoryValue: inventoryValue._sum.stockActual || 0,
    };
  }

  async updateTankLevel(productoId: string, cantidad: number, tipo: 'entrada' | 'salida'): Promise<boolean> {
    try {
      // Buscar el tanque asociado al producto
      const tanque = await this.prisma.tanque.findFirst({
        where: {
          productoId: productoId,
          activo: true
        },
      });

      if (!tanque) {
        throw new NotFoundException('No se encontró tanque activo para este producto');
      }

      // Calcular nuevo nivel
      const nivelActualDecimal = parseFloat(tanque.nivelActual.toString());
      const nuevoNivel = tipo === 'entrada'
        ? nivelActualDecimal + cantidad
        : nivelActualDecimal - cantidad;

      // Verificar que no exceda la capacidad
      const capacidadTotal = parseFloat(tanque.capacidadTotal.toString());
      if (nuevoNivel > capacidadTotal) {
        throw new ConflictException('El nivel excede la capacidad del tanque');
      }

      // Verificar que no sea negativo
      if (nuevoNivel < 0) {
        throw new ConflictException('Nivel de tanque insuficiente');
      }

      // Actualizar el tanque
      await this.prisma.tanque.update({
        where: { id: tanque.id },
        data: {
          nivelActual: nuevoNivel,
          updatedAt: new Date()
        },
      });

      return true;
    } catch (error) {
      // Re-lanzar la excepción para que pueda ser manejada en el resolver
      throw error;
    }
  }

  async updateTankLevelForPointOfSale(productoId: string, puntoVentaId: string, cantidad: number, tipo: 'entrada' | 'salida'): Promise<boolean> {
    try {
      // Buscar el tanque específico del punto de venta para este producto
      const tanque = await this.prisma.tanque.findFirst({
        where: {
          productoId: productoId,
          puntoVentaId: puntoVentaId,
          activo: true
        },
        include: {
          producto: true,
          puntoVenta: true
        }
      });

      if (!tanque) {
        console.log(`[TANQUE] No se encontró tanque para producto ${productoId} en punto de venta ${puntoVentaId}`);
        throw new NotFoundException(`No se encontró tanque activo para este producto en el punto de venta especificado`);
      }

      console.log(`[TANQUE] Tanque encontrado: ${tanque.nombre} - Producto: ${tanque.producto.codigo} - Punto de Venta: ${tanque.puntoVenta.codigo}`);

      // Calcular nuevo nivel
      const nivelActualDecimal = parseFloat(tanque.nivelActual.toString());
      const nuevoNivel = tipo === 'entrada'
        ? nivelActualDecimal + cantidad
        : nivelActualDecimal - cantidad;

      console.log(`[TANQUE] Nivel actual: ${nivelActualDecimal}L, Cantidad: ${cantidad}L (${tipo}), Nuevo nivel: ${nuevoNivel}L`);

      // Verificar que no exceda la capacidad
      const capacidadTotal = parseFloat(tanque.capacidadTotal.toString());
      if (nuevoNivel > capacidadTotal) {
        throw new ConflictException(`El nivel ${nuevoNivel}L excede la capacidad del tanque ${capacidadTotal}L`);
      }

      // Verificar que no sea negativo
      if (nuevoNivel < 0) {
        throw new ConflictException(`Nivel de tanque insuficiente: se requiere ${cantidad}L pero solo hay ${nivelActualDecimal}L`);
      }

      // Actualizar el tanque
      const tanqueActualizado = await this.prisma.tanque.update({
        where: { id: tanque.id },
        data: {
          nivelActual: nuevoNivel,
          updatedAt: new Date()
        },
      });

      console.log(`[TANQUE] Tanque ${tanque.nombre} actualizado exitosamente: ${nivelActualDecimal}L -> ${nuevoNivel}L`);

      return true;
    } catch (error) {
      console.error(`[TANQUE] Error actualizando tanque:`, error);
      // Re-lanzar la excepción para que pueda ser manejada en el resolver
      throw error;
    }
  }

  async getTankStatus() {
    const tanks = await this.prisma.producto.findMany({
      where: { esCombustible: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        stockActual: true,
        stockMinimo: true
      }
    });

    return tanks.map(tank => ({
      ...tank,
      nivelTanque: tank.stockActual,
      alertaBajo: tank.stockActual <= tank.stockMinimo,
      estado: tank.stockActual <= tank.stockMinimo ? 'BAJO' : 'NORMAL'
    }));
  }

  /**
   * Análisis de rentabilidad de productos
   */
  async getProductRentabilityAnalysis(): Promise<any> {
    const productos = await this.prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: true },
      orderBy: { nombre: 'asc' },
    });

    const productosConRentabilidad = productos.map(producto => {
      const precioCompra = parseFloat(producto.precioCompra?.toString() || '0');
      const precioVenta = parseFloat(producto.precioVenta?.toString() || '0');
      const utilidad = precioVenta - precioCompra;
      const margenUtilidad = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;
      const porcentajeGanancia = precioCompra > 0 ? (utilidad / precioCompra) * 100 : 0;

      // Clasificación de rentabilidad
      let clasificacionRentabilidad = 'BAJA';
      if (margenUtilidad >= 30) clasificacionRentabilidad = 'ALTA';
      else if (margenUtilidad >= 15) clasificacionRentabilidad = 'MEDIA';

      // Recomendaciones automáticas
      let recomendacion = '';
      if (margenUtilidad < 10) {
        recomendacion = 'Considere aumentar el precio de venta o reducir costos de compra';
      } else if (margenUtilidad > 50) {
        recomendacion = 'Excelente margen - monitorear competencia';
      } else {
        recomendacion = 'Margen saludable - mantener seguimiento';
      }

      return {
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        precioCompra,
        precioVenta,
        moneda: producto.moneda,
        utilidad: Math.round(utilidad * 100) / 100,
        margenUtilidad: Math.round(margenUtilidad * 100) / 100,
        porcentajeGanancia: Math.round(porcentajeGanancia * 100) / 100,
        ventasEstimadas: producto.stockActual * 0.3, // Estimación simple
        utilidadProyectada: Math.round((utilidad * producto.stockActual * 0.3) * 100) / 100,
        clasificacionRentabilidad,
        recomendacion,
      };
    });

    return productosConRentabilidad;
  }

  /**
   * Resumen de rentabilidad general
   */
  async getRentabilitySummary(): Promise<any> {
    const productos = await this.getProductRentabilityAnalysis();

    if (productos.length === 0) {
      return {
        productos: [],
        utilidadTotalProyectada: 0,
        margenPromedioGeneral: 0,
        productoMasRentable: 'N/A',
        productoMenosRentable: 'N/A',
        totalProductos: 0,
      };
    }

    const utilidadTotalProyectada = productos.reduce((sum, p) => sum + p.utilidadProyectada, 0);
    const margenPromedio = productos.reduce((sum, p) => sum + p.margenUtilidad, 0) / productos.length;

    const productoMasRentable = productos.reduce((max, p) =>
      p.margenUtilidad > max.margenUtilidad ? p : max
    );

    const productoMenosRentable = productos.reduce((min, p) =>
      p.margenUtilidad < min.margenUtilidad ? p : min
    );

    return {
      productos,
      utilidadTotalProyectada: Math.round(utilidadTotalProyectada * 100) / 100,
      margenPromedioGeneral: Math.round(margenPromedio * 100) / 100,
      productoMasRentable: `${productoMasRentable.codigo} - ${productoMasRentable.nombre} (${productoMasRentable.margenUtilidad}%)`,
      productoMenosRentable: `${productoMenosRentable.codigo} - ${productoMenosRentable.nombre} (${productoMenosRentable.margenUtilidad}%)`,
      totalProductos: productos.length,
    };
  }

  /**
   * Sugerir precios optimizados
   */
  async suggestOptimalPricing(productoId: string, margenObjetivo: number = 25): Promise<any> {
    const producto = await this.findById(productoId);

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    const precioCompra = producto.precioCompra;
    const precioVentaActual = producto.precioVenta;

    // Calcular precio óptimo basado en margen objetivo
    const precioVentaOptimo = precioCompra / (1 - (margenObjetivo / 100));

    // Calcular diferentes escenarios
    const escenarios = [
      {
        nombre: 'Conservador (15% margen)',
        precioVenta: precioCompra / (1 - 0.15),
        margen: 15,
      },
      {
        nombre: 'Objetivo (25% margen)',
        precioVenta: precioVentaOptimo,
        margen: margenObjetivo,
      },
      {
        nombre: 'Agresivo (35% margen)',
        precioVenta: precioCompra / (1 - 0.35),
        margen: 35,
      },
    ];

    return {
      productoActual: {
        codigo: producto.codigo,
        nombre: producto.nombre,
        precioCompra,
        precioVentaActual,
        margenActual: producto.margenUtilidad,
      },
      escenarios: escenarios.map(e => ({
        ...e,
        precioVenta: Math.round(e.precioVenta * 100) / 100,
        utilidadPorUnidad: Math.round((e.precioVenta - precioCompra) * 100) / 100,
        diferenciaPrecioActual: Math.round((e.precioVenta - precioVentaActual) * 100) / 100,
      })),
      recomendacion: margenObjetivo <= producto.margenUtilidad
        ? 'El margen actual ya cumple o supera el objetivo'
        : `Considere ajustar el precio de venta a $${Math.round(precioVentaOptimo * 100) / 100} ${producto.moneda}`,
    };
  }

  async validateTurnoExists(turnoId: string): Promise<boolean> {
    try {
      const turno = await this.prisma.turno.findUnique({
        where: { id: turnoId }
      });
      return !!turno;
    } catch (error) {
      console.error('Error validating turno:', error);
      return false;
    }
  }

  async saveShiftClosure(cierreData: {
    turnoId: string;
    usuarioId: string;
    totalVentasLitros: number;
    totalVentasGalones: number;
    valorTotalGeneral: number;
    productosActualizados: number;
    tanquesActualizados: number;
    estado: string;
    errores?: string[];
    advertencias?: string[];
    resumenSurtidores: any[];
    observacionesGenerales?: string;
  }) {
    try {
      const cierreTurno = await this.prisma.cierreTurno.create({
        data: {
          turnoId: cierreData.turnoId,
          usuarioId: cierreData.usuarioId,
          totalVentasLitros: cierreData.totalVentasLitros,
          totalVentasGalones: cierreData.totalVentasGalones,
          valorTotalGeneral: cierreData.valorTotalGeneral,
          productosActualizados: cierreData.productosActualizados,
          tanquesActualizados: cierreData.tanquesActualizados,
          estado: cierreData.estado,
          errores: cierreData.errores || [],
          advertencias: cierreData.advertencias || [],
          resumenSurtidores: cierreData.resumenSurtidores,
          observacionesGenerales: cierreData.observacionesGenerales
        },
        include: {
          turno: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              username: true
            }
          }
        }
      });

      return cierreTurno;
    } catch (error) {
      throw new Error(`Error guardando cierre de turno: ${error.message}`);
    }
  }

  async getShiftClosures(filters?: {
    turnoId?: string;
    fechaDesde?: Date;
    fechaHasta?: Date;
    estado?: string;
    usuarioId?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters?.turnoId) {
        where.turnoId = filters.turnoId;
      }

      if (filters?.fechaDesde || filters?.fechaHasta) {
        where.fechaCierre = {};
        if (filters.fechaDesde) {
          where.fechaCierre.gte = filters.fechaDesde;
        }
        if (filters.fechaHasta) {
          where.fechaCierre.lte = filters.fechaHasta;
        }
      }

      if (filters?.estado) {
        where.estado = filters.estado;
      }

      if (filters?.usuarioId) {
        where.usuarioId = filters.usuarioId;
      }

      const [cierres, total] = await Promise.all([
        this.prisma.cierreTurno.findMany({
          where,
          include: {
            turno: true,
            usuario: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                username: true
              }
            }
          },
          orderBy: { fechaCierre: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.cierreTurno.count({ where })
      ]);

      return {
        cierres: cierres.map(cierre => ({
          ...cierre,
          totalVentasLitros: parseFloat(cierre.totalVentasLitros.toString()),
          totalVentasGalones: parseFloat(cierre.totalVentasGalones.toString()),
          valorTotalGeneral: parseFloat(cierre.valorTotalGeneral.toString()),
          resumenSurtidores: typeof cierre.resumenSurtidores === 'string'
            ? JSON.parse(cierre.resumenSurtidores)
            : cierre.resumenSurtidores
        })),
        total,
        page,
        limit
      };
    } catch (error) {
      throw new Error(`Error consultando cierres de turno: ${error.message}`);
    }
  }

  async getShiftClosureById(id: string) {
    try {
      const cierre = await this.prisma.cierreTurno.findUnique({
        where: { id },
        include: {
          turno: true,
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              username: true
            }
          }
        }
      });

      if (!cierre) {
        throw new NotFoundException('Cierre de turno no encontrado');
      }

      return {
        ...cierre,
        totalVentasLitros: parseFloat(cierre.totalVentasLitros.toString()),
        totalVentasGalones: parseFloat(cierre.totalVentasGalones.toString()),
        valorTotalGeneral: parseFloat(cierre.valorTotalGeneral.toString()),
        resumenSurtidores: typeof cierre.resumenSurtidores === 'string'
          ? JSON.parse(cierre.resumenSurtidores)
          : cierre.resumenSurtidores
      };
    } catch (error) {
      throw new Error(`Error consultando cierre de turno: ${error.message}`);
    }
  }

  async getShiftClosureDataByTurnoId(turnoId: string) {
    try {
      const turno = await this.prisma.turno.findUnique({
        where: { id: turnoId },
        include: {
          puntoVenta: {
            include: {
              caja: true
            }
          },
          usuario: true,
          cierres: {
            include: {
              metodosPago: {
                include: {
                  metodoPagoRel: true
                }
              },
              movimientosEfectivo: true,
              usuario: true
            },
            orderBy: {
              fechaCierre: 'desc'
            },
            take: 1
          }
        }
      });

      if (!turno) {
        throw new NotFoundException(`Turno con ID ${turnoId} no encontrado`);
      }

      // Obtener seleccionPorProducto desde configuracion_empresa
      let seleccionPorProducto = false;
      if (turno.puntoVenta?.empresaId) {
        const configuracionEmpresa = await this.prisma.configuracionEmpresa.findUnique({
          where: { empresaId: turno.puntoVenta.empresaId },
          select: { seleccionPorProducto: true }
        });
        seleccionPorProducto = configuracionEmpresa?.seleccionPorProducto ?? false;
      }

      // Usar seleccionPorProducto como el valor de active (en lugar de turno.activo)
      const activoValue: boolean = seleccionPorProducto;

      const cierreTurno = turno.cierres && turno.cierres.length > 0 
        ? turno.cierres[0] 
        : null;

      if (!cierreTurno) {
        throw new NotFoundException(`No se encontró cierre de turno para el turno ${turnoId}`);
      }

      const historialLecturas = await this.prisma.historialLectura.findMany({
        where: {
          turnoId: cierreTurno.id
        },
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
        },
        orderBy: {
          fechaLectura: 'desc'
        }
      });

      const historialVentasProductos = await this.prisma.historialVentasProductos.findMany({
        where: {
          turnoId: turnoId
        },
        include: {
          producto: true,
          metodoPago: true,
          cliente: true,
          usuario: true,
          puntoVenta: true
        },
        orderBy: {
          fechaVenta: 'desc'
        }
      });

      const cierreFormateado = {
        ...cierreTurno,
        totalVentasLitros: parseFloat(cierreTurno.totalVentasLitros.toString()),
        totalVentasGalones: parseFloat(cierreTurno.totalVentasGalones.toString()),
        valorTotalGeneral: parseFloat(cierreTurno.valorTotalGeneral.toString()),
        resumenSurtidores: typeof cierreTurno.resumenSurtidores === 'string'
          ? JSON.parse(cierreTurno.resumenSurtidores)
          : cierreTurno.resumenSurtidores
      };

      const metodosPagoFormateados = cierreTurno.metodosPago?.map(pago => ({
        id: pago.id,
        metodoPago: pago.metodoPago,
        monto: parseFloat(pago.monto.toString()),
        porcentaje: parseFloat(pago.porcentaje.toString()),
        observaciones: pago.observaciones,
        cierreTurnoId: pago.cierreTurnoId
      })) || [];

      const movimientosEfectivoFormateados = cierreTurno.movimientosEfectivo?.map(mov => ({
        ...mov,
        monto: parseFloat(mov.monto.toString()),
        fecha: mov.fecha
      })) || [];

      const historialLecturasFormateado = historialLecturas.map(lectura => ({
        ...lectura,
        lecturaAnterior: parseFloat(lectura.lecturaAnterior.toString()),
        lecturaActual: parseFloat(lectura.lecturaActual.toString()),
        cantidadVendida: parseFloat(lectura.cantidadVendida.toString()),
        valorVenta: parseFloat(lectura.valorVenta.toString()),
        cierreTurnoId: lectura.turnoId || cierreTurno.id, // turnoId contiene el cierreTurnoId
        manguera: lectura.manguera ? {
          ...lectura.manguera,
          lecturaAnterior: parseFloat(lectura.manguera.lecturaAnterior.toString()),
          lecturaActual: parseFloat(lectura.manguera.lecturaActual.toString()),
          producto: lectura.manguera.producto ? {
            ...lectura.manguera.producto,
            precioCompra: lectura.manguera.producto.precioCompra ? parseFloat(lectura.manguera.producto.precioCompra.toString()) : 0,
            precioVenta: lectura.manguera.producto.precioVenta ? parseFloat(lectura.manguera.producto.precioVenta.toString()) : 0,
            stockMinimo: lectura.manguera.producto.stockMinimo ? parseFloat(lectura.manguera.producto.stockMinimo.toString()) : 0,
            stockActual: lectura.manguera.producto.stockActual ? parseFloat(lectura.manguera.producto.stockActual.toString()) : 0
          } : null,
          surtidor: lectura.manguera.surtidor ? {
            id: lectura.manguera.surtidor.id,
            numero: lectura.manguera.surtidor.numero,
            nombre: lectura.manguera.surtidor.nombre,
            descripcion: lectura.manguera.surtidor.descripcion,
            ubicacion: lectura.manguera.surtidor.ubicacion,
            cantidadMangueras: lectura.manguera.surtidor.cantidadMangueras,
            activo: lectura.manguera.surtidor.activo,
            fechaInstalacion: lectura.manguera.surtidor.fechaInstalacion,
            fechaMantenimiento: lectura.manguera.surtidor.fechaMantenimiento,
            observaciones: lectura.manguera.surtidor.observaciones,
            createdAt: lectura.manguera.surtidor.createdAt,
            updatedAt: lectura.manguera.surtidor.updatedAt,
            mangueras: [],
            puntoVenta: lectura.manguera.surtidor.puntoVenta || null
          } as any : null
        } : null
      }));

      const historialVentasFormateado = historialVentasProductos.map(venta => ({
        ...venta,
        cantidadVendida: parseFloat(venta.cantidadVendida.toString()),
        precioUnitario: parseFloat(venta.precioUnitario.toString()),
        valorTotal: parseFloat(venta.valorTotal.toString())
      }));

      // ================================
      // CÁLCULO DE CAJA POR TURNO
      // ================================
      // Regla de negocio esperada por frontend:
      // - Turno 1:
      //   cajaAnterior = saldoInicial (de configuracion.cajas)
      //   cajaActual   = cajaAnterior + ingresos turno 1 − egresos turno 1
      // - Turno 2:
      //   cajaAnterior = cajaActual turno 1
      //   cajaActual   = cajaAnterior + ingresos turno 2 − egresos turno 2
      // - Turno N:
      //   cajaAnterior = cajaActual turno N-1, y así sucesivamente.
      //
      // Para cumplir esto sin cambiar el modelo de datos,
      // calculamos una caja "virtual" por turno encadenando todos
      // los cierres del mismo punto de venta en orden cronológico.

      // 1) Tomar el saldoInicial global configurado para la caja del punto de venta
      const saldoInicialGlobal =
        turno.puntoVenta?.caja?.saldoInicial !== undefined
          ? parseFloat(turno.puntoVenta.caja.saldoInicial.toString())
          : 0;

      // 2) Obtener todos los cierres del mismo punto de venta, con sus movimientos,
      //    ordenados cronológicamente por fechaCierre (ascendente)
      const cierresMismoPuntoVenta = await this.prisma.cierreTurno.findMany({
        where: {
          turno: {
            puntoVentaId: turno.puntoVentaId,
          },
        },
        include: {
          movimientosEfectivo: true,
        },
        orderBy: {
          fechaCierre: 'asc',
        },
      });

      let saldoEncadenado = saldoInicialGlobal;
      let cajaAnteriorTurnoActual = saldoInicialGlobal;
      let cajaActualTurnoActual = saldoInicialGlobal;

      for (const cierre of cierresMismoPuntoVenta) {
        const ingresosCierre = cierre.movimientosEfectivo
          .filter(m => m.tipo === 'INGRESO')
          .reduce((sum, m) => sum + Number(m.monto), 0);

        const egresosCierre = cierre.movimientosEfectivo
          .filter(m => m.tipo === 'EGRESO')
          .reduce((sum, m) => sum + Number(m.monto), 0);

        const cajaAnteriorCierre = saldoEncadenado;
        const cajaActualCierre = cajaAnteriorCierre + ingresosCierre - egresosCierre;

        // Actualizar acumulado para el siguiente cierre
        saldoEncadenado = cajaActualCierre;

        // Si este es el cierre del turno solicitado, guardamos sus valores
        if (cierre.id === cierreTurno.id) {
          cajaAnteriorTurnoActual = cajaAnteriorCierre;
          cajaActualTurnoActual = cajaActualCierre;
          break;
        }
      }

      const cajaFormateada = {
        id: turno.puntoVenta?.caja?.id || `virtual-${turno.id}`,
        puntoVentaId: turno.puntoVentaId,
        saldoInicial: cajaAnteriorTurnoActual,
        saldoActual: cajaActualTurnoActual,
        fechaUltimoMovimiento: turno.puntoVenta?.caja?.fechaUltimoMovimiento || cierreTurno.fechaCierre,
        activa: turno.puntoVenta?.caja?.activa ?? true,
        observaciones: turno.puntoVenta?.caja?.observaciones || `Caja encadenada para turno ${turno.id}`,
        createdAt: turno.puntoVenta?.caja?.createdAt || cierreTurno.fechaCierre,
        updatedAt: turno.puntoVenta?.caja?.updatedAt || cierreTurno.fechaCierre,
      };

      const turnoResponse = {
        id: turno.id,
        startDate: turno.fechaInicio,
        endDate: turno.fechaFin,
        startTime: turno.horaInicio,
        endTime: turno.horaFin,
        observations: turno.observaciones,
        active: activoValue,
        createdAt: turno.createdAt,
        updatedAt: turno.updatedAt,
        userId: turno.usuarioId,
        user: turno.usuario,
        puntoVentaId: turno.puntoVentaId,
        puntoVenta: turno.puntoVenta
      };

      return {
        turno: turnoResponse,
        cierreTurno: cierreFormateado,
        metodosPago: metodosPagoFormateados,
        historialLecturas: historialLecturasFormateado,
        historialVentasProductos: historialVentasFormateado,
        movimientosEfectivo: movimientosEfectivoFormateados,
        caja: cajaFormateada,
        puntoVenta: turno.puntoVenta ? {
          ...turno.puntoVenta,
          caja: cajaFormateada
        } : null,
        usuario: turno.usuario ? {
          id: turno.usuario.id,
          nombre: turno.usuario.nombre,
          apellido: turno.usuario.apellido,
          username: turno.usuario.username,
          email: turno.usuario.email
        } : null
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Error consultando datos del turno: ${error.message}`);
    }
  }

  /**
   * Dar de baja productos vencidos
   */
  async writeOffExpiredProducts(writeOffInput: any): Promise<any> {
    const resultados = [];
    const errores = [];
    const advertencias = [];
    let productosExitosos = 0;
    let productosConError = 0;
    let valorTotalPerdida = 0;

    for (const item of writeOffInput.productos) {
      try {
        // Buscar el producto
        const producto = await this.prisma.producto.findUnique({
          where: { codigo: item.codigoProducto },
          include: { categoria: true }
        });
        console.log('[writeOffExpiredProducts] producto', JSON.stringify(producto, null, 2));
        if (!producto) {
          errores.push(`Producto no encontrado: ${item.codigoProducto}`);
          resultados.push({
            codigoProducto: item.codigoProducto,
            nombreProducto: 'PRODUCTO NO ENCONTRADO',
            cantidadEliminada: 0,
            unidadMedida: item.unidadMedida,
            stockAnterior: 0,
            stockActual: 0,
            valorPerdida: 0,
            motivoBaja: item.motivoBaja || 'VENCIMIENTO',
            lote: item.lote,
            fechaVencimiento: item.fechaVencimiento,
            observaciones: item.observaciones,
            procesadoExitosamente: false,
            error: 'Producto no encontrado'
          });
          productosConError++;
          continue;
        }

        // Verificar que hay suficiente stock
        if (producto.stockActual < item.cantidad) {
          const error = `Stock insuficiente. Disponible: ${producto.stockActual}, Solicitado: ${item.cantidad}`;
          errores.push(`${item.codigoProducto}: ${error}`);
          resultados.push({
            codigoProducto: item.codigoProducto,
            nombreProducto: producto.nombre,
            cantidadEliminada: 0,
            unidadMedida: item.unidadMedida,
            stockAnterior: producto.stockActual,
            stockActual: producto.stockActual,
            valorPerdida: 0,
            motivoBaja: item.motivoBaja || 'VENCIMIENTO',
            lote: item.lote,
            fechaVencimiento: item.fechaVencimiento,
            observaciones: item.observaciones,
            procesadoExitosamente: false,
            error
          });
          productosConError++;
          continue;
        }

        // Calcular el valor de la pérdida
        const valorPerdida = Number(producto.precioCompra) * item.cantidad;

        // Actualizar el stock
        const nuevoStock = producto.stockActual - item.cantidad;
        const productoActualizado = await this.prisma.producto.update({
          where: { id: producto.id },
          data: { stockActual: nuevoStock }
        });

        // Crear observaciones detalladas
        const motivoBaja = item.motivoBaja || 'VENCIMIENTO';
        let observacionesCompletas = `BAJA POR ${motivoBaja}`;
        if (item.lote) observacionesCompletas += ` - Lote: ${item.lote}`;
        if (item.fechaVencimiento) observacionesCompletas += ` - Fecha vencimiento: ${item.fechaVencimiento}`;
        if (item.observaciones) observacionesCompletas += ` - ${item.observaciones}`;
        if (writeOffInput.responsable) observacionesCompletas += ` - Responsable: ${writeOffInput.responsable}`;

        // Crear entrada de inventario para dar de baja
        const entradaBaja = await this.prisma.entradaInventario.create({
          data: {
            puntoVentaId: 'system-writeoff', // ID del sistema para bajas
            tipoEntrada: 'baja_vencidos',
            codigoProceso: `BAJA-${new Date().toISOString().slice(0, 10)}-${item.codigoProducto}`,
            responsable: writeOffInput.responsable || 'Sistema',
            estado: 'COMPLETADO_EXITOSAMENTE',
            costoTotalProceso: -valorPerdida,
            observacionesGenerales: `Baja por vencimiento: ${item.codigoProducto}`
          }
        });

        // Registrar el proceso específico de baja
        await this.prisma.entradaInventarioProcess.create({
          data: {
            entradaInventarioId: entradaBaja.id,
            cantidad: -item.cantidad, // Cantidad negativa para indicar salida
            unidadMedida: producto.unidadMedida,
            tipoMovimiento: 'salida',
            precioUnitario: Number(producto.precioCompra),
            costoTotal: -valorPerdida, // Valor negativo para indicar pérdida
            estadoMovimiento: 'COMPLETADO',
            codigoProducto: item.codigoProducto,
            lote: item.lote,
            fechaVencimiento: item.fechaVencimiento ? new Date(item.fechaVencimiento) : null,
            observaciones: observacionesCompletas,
            fechaMovimiento: new Date(),
            productoId: producto.id
          }
        });

        resultados.push({
          codigoProducto: item.codigoProducto,
          nombreProducto: producto.nombre,
          cantidadEliminada: item.cantidad,
          unidadMedida: item.unidadMedida,
          stockAnterior: producto.stockActual,
          stockActual: nuevoStock,
          valorPerdida,
          motivoBaja,
          lote: item.lote,
          fechaVencimiento: item.fechaVencimiento,
          observaciones: item.observaciones,
          procesadoExitosamente: true,
          error: null
        });

        productosExitosos++;
        valorTotalPerdida += valorPerdida;

        // Advertencia si el stock queda muy bajo
        if (nuevoStock <= producto.stockMinimo && nuevoStock > 0) {
          advertencias.push(`${item.codigoProducto}: Stock bajo después de la baja (${nuevoStock} <= ${producto.stockMinimo})`);
        } else if (nuevoStock === 0) {
          advertencias.push(`${item.codigoProducto}: Producto agotado después de la baja`);
        }

      } catch (error) {
        errores.push(`Error procesando ${item.codigoProducto}: ${error.message}`);
        resultados.push({
          codigoProducto: item.codigoProducto,
          nombreProducto: 'ERROR',
          cantidadEliminada: 0,
          unidadMedida: item.unidadMedida,
          stockAnterior: 0,
          stockActual: 0,
          valorPerdida: 0,
          motivoBaja: item.motivoBaja || 'VENCIMIENTO',
          lote: item.lote,
          fechaVencimiento: item.fechaVencimiento,
          observaciones: item.observaciones,
          procesadoExitosamente: false,
          error: error.message
        });
        productosConError++;
      }
    }

    return {
      totalProductosProcesados: writeOffInput.productos.length,
      productosExitosos,
      productosConError,
      valorTotalPerdida,
      fechaProceso: new Date(),
      responsable: writeOffInput.responsable,
      observacionesGenerales: writeOffInput.observacionesGenerales,
      resultados,
      errores,
      advertencias
    };
  }

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

        // 2. PROCESAR INGRESOS DE PRODUCTOS
        if (entryInput.ingresosProductos && entryInput.ingresosProductos.length > 0) {
          for (const ingresoInput of entryInput.ingresosProductos) {
            try {
              // Buscar el producto
              const producto = await prisma.producto.findUnique({
                where: { codigo: ingresoInput.codigoProducto },
                include: { categoria: true }
              });

              if (!producto) {
                errores.push(`Producto ${ingresoInput.codigoProducto} no encontrado`);
                continue;
              }

              // Validar que cantidad * precio = costo total
              const costoEsperado = ingresoInput.cantidadIngresada * ingresoInput.precioCompra;
              if (Math.abs(costoEsperado - ingresoInput.costoTotal) > 0.01) {
                advertencias.push(`${ingresoInput.codigoProducto}: Costo total no coincide (esperado: ${costoEsperado}, recibido: ${ingresoInput.costoTotal})`);
              }

              const stockAnterior = producto.stockActual;
              const stockNuevo = stockAnterior + ingresoInput.cantidadIngresada;

              // Actualizar stock del producto
              await prisma.producto.update({
                where: { id: producto.id },
                data: {
                  stockActual: stockNuevo,
                  precioCompra: ingresoInput.precioCompra // Actualizar precio de compra
                }
              });

              // Registrar entrada de inventario con trazabilidad completa
              await prisma.entradaInventarioProcess.create({
                data: {
                  entradaInventarioId: entradaInventario.id, // Referencia al código de entrada
                  productoId: producto.id,
                  codigoProducto: ingresoInput.codigoProducto,
                  cantidad: ingresoInput.cantidadIngresada,
                  unidadMedida: ingresoInput.unidadMedida,
                  tipoMovimiento: 'entrada',
                  estadoMovimiento: 'COMPLETADO',
                  precioUnitario: ingresoInput.precioCompra,
                  costoTotal: ingresoInput.costoTotal,

                  // Información del producto específico
                  lote: ingresoInput.lote,
                  fechaVencimiento: ingresoInput.fechaVencimiento ? new Date(ingresoInput.fechaVencimiento) : null,

                  // No aplican para productos no combustibles
                  alturaFluidoAnterior: null,
                  alturaFluidoNueva: null,
                  volumenCalculado: null,
                  tanqueId: null,
                  carrotanqueId: null,

                  // Trazabilidad completa
                  observaciones: `Producto: ${producto.nombre} | Código: ${ingresoInput.codigoProducto} | Cantidad: ${ingresoInput.cantidadIngresada} ${ingresoInput.unidadMedida} | Precio: $${ingresoInput.precioCompra} | Lote: ${ingresoInput.lote || 'N/A'} | Proveedor: ${ingresoInput.proveedor || 'N/A'} | ${ingresoInput.observaciones || ''}`,
                  fechaMovimiento: new Date()
                }
              });

              resumenProductos.push({
                codigoProducto: producto.codigo,
                nombreProducto: producto.nombre,
                unidadMedida: ingresoInput.unidadMedida,
                cantidadIngresada: ingresoInput.cantidadIngresada,
                stockAnterior,
                stockNuevo,
                precioCompra: ingresoInput.precioCompra,
                costoTotal: ingresoInput.costoTotal,
                procesadoExitosamente: true,
                lote: ingresoInput.lote,
                fechaVencimiento: ingresoInput.fechaVencimiento,
                proveedor: ingresoInput.proveedor,
                numeroFactura: ingresoInput.numeroFactura,
                observaciones: ingresoInput.observaciones
              });

              costoTotalProductos += ingresoInput.costoTotal;
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
                where: { id: descargaInput.carrotanqueId },
                include: { tablaAforo: true }
              });

              if (!carrotanque) {
                errores.push(`Carrotanque ${descargaInput.carrotanqueId} no encontrado`);
                continue;
              }

              // Buscar el producto
              const producto = await prisma.producto.findUnique({
                where: { codigo: descargaInput.codigoProducto }
              });

              if (!producto) {
                errores.push(`Producto ${descargaInput.codigoProducto} no encontrado para carrotanque ${carrotanque.placa}`);
                continue;
              }

              // Validar que cantidad * precio = costo total
              const costoEsperado = descargaInput.cantidadDescargada * descargaInput.precioCompra;
              if (Math.abs(costoEsperado - descargaInput.costoTotal) > 0.01) {
                advertencias.push(`Carrotanque ${carrotanque.placa}: Costo total no coincide (esperado: ${costoEsperado}, recibido: ${descargaInput.costoTotal})`);
              }

              const nivelAnterior = carrotanque.nivelActual;
              const nivelNuevo = Math.max(0, Number(nivelAnterior) - descargaInput.cantidadDescargada);

              // Actualizar nivel del carrotanque
              await prisma.carrotanque.update({
                where: { id: carrotanque.id },
                data: {
                  nivelActual: nivelNuevo,
                  alturaActual: nivelNuevo
                }
              });

              // Actualizar stock del producto
              await prisma.producto.update({
                where: { id: producto.id },
                data: {
                  stockActual: {
                    increment: descargaInput.cantidadDescargada
                  },
                  // Actualizar precio de compra
                  precioCompra: descargaInput.precioCompra
                }
              });

              // Registrar entrada de inventario para el producto descargado con trazabilidad completa
              await prisma.entradaInventarioProcess.create({
                data: {
                  entradaInventarioId: entradaInventario.id, // Referencia al código de entrada
                  productoId: producto.id,
                  codigoProducto: descargaInput.codigoProducto,
                  cantidad: descargaInput.cantidadDescargada,
                  unidadMedida: descargaInput.unidadMedida,
                  tipoMovimiento: 'entrada',
                  estadoMovimiento: 'COMPLETADO',
                  precioUnitario: descargaInput.precioCompra,
                  costoTotal: descargaInput.costoTotal,

                  // Información específica del carrotanque
                  carrotanqueId: carrotanque.id,

                  // Información del producto (si aplica)
                  lote: null, // Normalmente los carrotanques no manejan lotes específicos
                  fechaVencimiento: null, // Normalmente combustibles no tienen vencimiento

                  // No aplican para carrotanques
                  alturaFluidoAnterior: null,
                  alturaFluidoNueva: null,
                  volumenCalculado: null,
                  tanqueId: null,

                  // Trazabilidad completa
                  observaciones: `Carrotanque: ${carrotanque.placa} | Producto: ${descargaInput.codigoProducto} | Cantidad: ${descargaInput.cantidadDescargada} ${descargaInput.unidadMedida} | Precio: $${descargaInput.precioCompra} | Nivel: ${Number(nivelAnterior)}→${nivelNuevo} | Remisión: ${descargaInput.numeroRemision || 'N/A'} | ${descargaInput.observaciones || ''}`,
                  fechaMovimiento: new Date()
                }
              });

              resumenCarrotanques.push({
                carrotanqueId: carrotanque.id,
                placa: carrotanque.placa,
                codigoProducto: producto.codigo,
                nombreProducto: producto.nombre,
                cantidadDescargada: descargaInput.cantidadDescargada,
                unidadMedida: descargaInput.unidadMedida,
                precioCompra: descargaInput.precioCompra,
                costoTotal: descargaInput.costoTotal,
                nivelAnterior: Number(nivelAnterior),
                nivelNuevo,
                procesadoExitosamente: true,
                numeroRemision: descargaInput.numeroRemision,
                observaciones: descargaInput.observaciones
              });

              costoTotalCarrotanques += descargaInput.costoTotal;
              cantidadCarrotanquesDescargados++;

              // Sumar al volumen total si es combustible
              if (descargaInput.unidadMedida === 'litros') {
                volumenTotalLitros += descargaInput.cantidadDescargada;
                volumenTotalGalones += descargaInput.cantidadDescargada / 3.78541;
              } else if (descargaInput.unidadMedida === 'galones') {
                volumenTotalGalones += descargaInput.cantidadDescargada;
                volumenTotalLitros += descargaInput.cantidadDescargada * 3.78541;
              }

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

        const costoTotalGeneral = costoTotalTanques + costoTotalProductos + costoTotalCarrotanques;
        const totalMovimientos = cantidadTanquesActualizados + cantidadProductosIngresados + cantidadCarrotanquesDescargados;
        const estadoFinal = errores.length > 0 ? (totalMovimientos > 0 ? 'COMPLETADO_CON_ERRORES' : 'ERROR') : 'COMPLETADO_EXITOSAMENTE';

        // Actualizar entrada de inventario con estadísticas finales
        await prisma.entradaInventario.update({
          where: { id: entradaInventario.id },
          data: {
            estado: estadoFinal,
            costoTotalProceso: costoTotalGeneral,
            totalMovimientos,
            movimientosExitosos: totalMovimientos - (errores.length > 0 ? 1 : 0),
            movimientosConError: errores.length > 0 ? 1 : 0,
            fechaFin: finishTime
          }
        });

        return {
          resumenTanques: resumenTanques.length > 0 ? resumenTanques : null,
          resumenProductos: resumenProductos.length > 0 ? resumenProductos : null,
          resumenCarrotanques: resumenCarrotanques.length > 0 ? resumenCarrotanques : null,
          resumenFinanciero: {
            costoTotalTanques,
            costoTotalProductos,
            costoTotalCarrotanques,
            costoTotalGeneral,
            cantidadTanquesActualizados,
            cantidadProductosIngresados,
            cantidadCarrotanquesDescargados,
            observaciones: `Procesado: ${cantidadTanquesActualizados} tanques, ${cantidadProductosIngresados} productos, ${cantidadCarrotanquesDescargados} carrotanques`
          },
          resumenInventario: {
            volumenTotalIngresadoLitros: volumenTotalLitros,
            volumenTotalIngresadoGalones: volumenTotalGalones,
            productosNocombustiblesIngresados: cantidadProductosIngresados,
            valorInventarioIncrementado: costoTotalGeneral,
            observaciones: `Incremento total en inventario: ${volumenTotalLitros.toFixed(2)} L, ${volumenTotalGalones.toFixed(2)} Gal`
          },
          fechaProceso: new Date(),
          entradaId: entradaInventario.id,
          responsable: entryInput.responsable || 'Sistema',
          estado: errores.length > 0 ? 'COMPLETADO_CON_ERRORES' : 'COMPLETADO_EXITOSAMENTE',
          errores: errores.length > 0 ? errores : null,
          advertencias: advertencias.length > 0 ? advertencias : null,
          observacionesGenerales: entryInput.observacionesGenerales
        };

      } catch (error) {
        // En caso de error crítico, la transacción automáticamente hace ROLLBACK
        // No necesitamos actualizar estados porque los registros se deshacen automáticamente
        console.error('Error en transacción de inventario:', error);
        throw new ConflictException(`Error procesando entrada de inventario: ${error.message}`);
      }
    }); // Fin de la transacción
  }

  /**
   * NUEVA ESTRUCTURA NORMALIZADA
   * Procesa una entrada de inventario usando la estructura separada de proceso y movimientos
   */
  async processInventoryProcess(
    processInput: InventoryProcessInput,
    user: any
  ): Promise<InventoryProcessResponse> {

    try {
      // Validar que el punto de venta existe
      const puntoVenta = await this.prisma.puntoVenta.findUnique({
        where: { id: processInput.puntoVentaId }
      });

      if (!puntoVenta) {
        return {
          success: false,
          message: `Punto de venta con ID ${processInput.puntoVentaId} no encontrado`,
          errores: [`Punto de venta con ID ${processInput.puntoVentaId} no encontrado`]
        };
      }

      // Generar código único del proceso
      const codigoProceso = await this.generateProcessCode(processInput.puntoVentaId);

      // Crear el proceso principal
      const proceso = await this.prisma.entradaInventario.create({
        data: {
          puntoVentaId: processInput.puntoVentaId,
          tipoEntrada: processInput.tipoEntrada,
          codigoProceso,
          responsable: processInput.responsable || user?.nombre || 'Sistema',
          observacionesGenerales: processInput.observacionesGenerales,
          costoTotalProceso: processInput.costoTotalProceso || 0,
          fechaFin: processInput.fechaFin ? new Date(processInput.fechaFin) : null,
          estado: 'PROCESANDO'
        }
      });

      return {
        success: true,
        message: `Proceso ${codigoProceso} creado exitosamente`,
        proceso: {
          id: proceso.id,
          puntoVentaId: proceso.puntoVentaId,
          tipoEntrada: proceso.tipoEntrada,
          codigoProceso: proceso.codigoProceso,
          responsable: proceso.responsable,
          estado: proceso.estado,
          fechaInicio: proceso.fechaInicio.toISOString(),
          fechaFin: proceso.fechaFin?.toISOString(),
          costoTotalProceso: parseFloat(proceso.costoTotalProceso?.toString() || '0'),

          observacionesGenerales: proceso.observacionesGenerales,
          totalMovimientos: proceso.totalMovimientos,
          movimientosExitosos: proceso.movimientosExitosos,
          movimientosConError: proceso.movimientosConError,
          movimientos: []
        }
      };

    } catch (error) {
      return {
        success: false,
        message: `Error crítico procesando inventario: ${error.message}`,
        errores: [`Error crítico: ${error.message}`]
      };
    }
  }

  /**
   * Obtiene un proceso de inventario por ID
   */
  async getInventoryProcess(procesoId: string): Promise<InventoryProcessResult | null> {
    const proceso = await this.prisma.entradaInventario.findUnique({
      where: { id: procesoId },
      include: {
        puntoVenta: true,
        procesos: {
          include: {
            producto: true,
            tanque: true,
            carrotanque: true
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!proceso) {
      return null;
    }

    return this.formatProcessResult(proceso);
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

    const where: any = {};

    if (filters.puntoVentaId) {
      where.puntoVentaId = filters.puntoVentaId;
    }

    if (filters.estado) {
      where.estado = filters.estado;
    }

    if (filters.tipoEntrada) {
      where.tipoEntrada = filters.tipoEntrada;
    }

    if (filters.fechaDesde || filters.fechaHasta) {
      where.fechaInicio = {};
      if (filters.fechaDesde) {
        where.fechaInicio.gte = new Date(filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        where.fechaInicio.lte = new Date(filters.fechaHasta);
      }
    }

    const procesos = await this.prisma.entradaInventario.findMany({
      where,
      include: {
        puntoVenta: true,
        procesos: {
          include: {
            producto: true,
            tanque: true,
            carrotanque: true
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return procesos.map(proceso => this.formatProcessResult(proceso));
  }

  // MÉTODOS PRIVADOS AUXILIARES

  /**
   * Genera un código único para el proceso
   */
  private async generateProcessCode(puntoVentaId: string): Promise<string> {
    return this.generateProcessCodeInTransaction(puntoVentaId, this.prisma);
  }

  /**
   * Genera un código único para el proceso usando UUID
   */
  private async generateProcessCodeInTransaction(puntoVentaId: string, prisma: any): Promise<string> {
    // Generar UUID único
    const uuid = randomUUID();

    // Formato: INV-YYYYMMDD-UUID
    return `INV-${uuid}`;
  }

  /**
   * Formatea un proceso para la respuesta
   */
  private formatProcessResult(proceso: any): InventoryProcessResult {
    return {
      id: proceso.id,
      puntoVentaId: proceso.puntoVentaId,
      tipoEntrada: proceso.tipoEntrada,
      codigoProceso: proceso.codigoProceso,
      responsable: proceso.responsable,
      estado: proceso.estado,
      fechaInicio: proceso.fechaInicio.toISOString(),
      fechaFin: proceso.fechaFin?.toISOString(),
      costoTotalProceso: parseFloat(proceso.costoTotalProceso?.toString() || '0'),
      observacionesGenerales: proceso.observacionesGenerales,
      totalMovimientos: proceso.totalMovimientos,
      movimientosExitosos: proceso.movimientosExitosos,
      movimientosConError: proceso.movimientosConError,
      movimientos: proceso.procesos?.map((m: any) => this.formatMovementResult(m)) || []
    };
  }

  /**
   * Formatea un movimiento para la respuesta
   */
  private formatMovementResult(movimiento: any): InventoryMovementResult {
    return {
      id: movimiento.id,
      procesoId: movimiento.entradaInventarioId,
      cantidad: parseFloat(movimiento.cantidad?.toString() || '0'),
      unidadMedida: movimiento.unidadMedida,
      tipoMovimiento: movimiento.tipoMovimiento,
      precioUnitario: parseFloat(movimiento.precioUnitario?.toString() || '0'),
      costoTotal: parseFloat(movimiento.costoTotal?.toString() || '0'),
      codigoProducto: movimiento.codigoProducto,
      lote: movimiento.lote,
      fechaVencimiento: movimiento.fechaVencimiento?.toISOString(),
      alturaFluidoAnterior: parseFloat(movimiento.alturaFluidoAnterior?.toString() || '0'),
      alturaFluidoNueva: parseFloat(movimiento.alturaFluidoNueva?.toString() || '0'),
      volumenCalculado: parseFloat(movimiento.volumenCalculado?.toString() || '0'),
      estadoMovimiento: movimiento.estadoMovimiento,
      observaciones: movimiento.observaciones,
      mensajeError: movimiento.mensajeError,
      fechaMovimiento: movimiento.fechaMovimiento.toISOString(),
      productoId: movimiento.productoId,
      tanqueId: movimiento.tanqueId,
      carrotanqueId: movimiento.carrotanqueId
    };
  }

  /**
   * Registrar cambio de precio en el historial
   */
  private async registrarCambioPrecio(
    productoId: string,
    precioAnterior: number,
    precioNuevo: number,
    usuarioId: string,
    motivo?: string
  ): Promise<void> {
    const diferencia = precioNuevo - precioAnterior;
    const porcentajeCambio = precioAnterior > 0 ? (diferencia / precioAnterior) * 100 : 0;

    await this.prisma.historialPrecios.create({
      data: {
        productoId,
        precioAnterior,
        precioNuevo,
        diferencia,
        porcentajeCambio,
        motivo,
        usuarioId,
        fechaCambio: new Date()
      }
    });
  }

  /**
   * Obtener historial de precios de un producto
   */
  async obtenerHistorialPrecios(
    productoId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ historial: any[]; total: number; totalPages: number; currentPage: number }> {
    const skip = (page - 1) * limit;

    const [historial, total] = await Promise.all([
      this.prisma.historialPrecios.findMany({
        where: { productoId },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true
            }
          }
        },
        orderBy: { fechaCambio: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.historialPrecios.count({
        where: { productoId }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      historial: historial.map(h => ({
        ...h,
        precioAnterior: parseFloat(h.precioAnterior.toString()),
        precioNuevo: parseFloat(h.precioNuevo.toString()),
        diferencia: parseFloat(h.diferencia.toString()),
        porcentajeCambio: parseFloat(h.porcentajeCambio.toString())
      })),
      total,
      totalPages,
      currentPage: page
    };
  }

  /**
   * Obtener el saldo actual de la caja de un punto de venta
   */
  async getCajaSaldo(puntoVentaId: string) {
    let caja = await this.prisma.caja.findUnique({
      where: { puntoVentaId }
    });

    if (!caja) {
      // Crear la caja si no existe
      caja = await this.prisma.caja.create({
        data: {
          puntoVentaId,
          saldoActual: 0,
          saldoInicial: 0,
          activa: true
        }
      });
    }

    return {
      id: caja.id,
      puntoVentaId: caja.puntoVentaId,
      saldoActual: parseFloat(caja.saldoActual.toString()),
      saldoInicial: parseFloat(caja.saldoInicial.toString()),
      fechaUltimoMovimiento: caja.fechaUltimoMovimiento,
      activa: caja.activa,
      observaciones: caja.observaciones,
      createdAt: caja.createdAt,
      updatedAt: caja.updatedAt
    };
  }

} 