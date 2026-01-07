import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateTanqueInput, CreateTablaAforoInput } from './dto/create-tanque.input';
import { UpdateTanqueInput } from './dto/update-tanque.input';
import { Tanque, TanqueWithStatus, TanqueUpdateResponse } from './entities/tanque.entity';

@Injectable()
export class TanquesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo tanque
   */
  async create(createTanqueInput: CreateTanqueInput): Promise<Tanque> {
    // Verificar si el número ya existe en el punto de venta
    const existingTanque = await this.prisma.tanque.findFirst({
      where: { 
        nombre: createTanqueInput.nombre,
        puntoVentaId: createTanqueInput.puntoVentaId 
      },
    });

    if (existingTanque) {
      throw new ConflictException('Ya existe un tanque con este número en este punto de venta');
    }

    // Validar que el producto existe
    const producto = await this.prisma.producto.findUnique({
      where: { id: createTanqueInput.productoId }
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    // Validar que el punto de venta existe
    const puntoVenta = await this.prisma.puntoVenta.findUnique({
      where: { id: createTanqueInput.puntoVentaId }
    });

    if (!puntoVenta) {
      throw new NotFoundException('Punto de venta no encontrado');
    }

    // Crear el tanque
    const tanque = await this.prisma.tanque.create({
      data: {
        nombre: createTanqueInput.nombre,
        capacidadTotal: createTanqueInput.capacidadTotal,
        nivelActual: createTanqueInput.nivelActual ?? 0,
        nivelMinimo: createTanqueInput.nivelMinimo ?? 0,
        alturaActual: createTanqueInput.alturaActual ?? 0,
        diametro: createTanqueInput.diametro,
        alturaMaxima: createTanqueInput.alturaMaxima,
        tipoTanque: createTanqueInput.tipoTanque ?? 'CILINDRICO',
        // unidadMedida: createTanqueInput.unidadMedida ?? 'GALONES', // Temporarily commented - restart IDE
        activo: createTanqueInput.activo ?? true,
        productoId: createTanqueInput.productoId,
        puntoVentaId: createTanqueInput.puntoVentaId,
      },
      include: {
        producto: true,
        puntoVenta: true,
        tablaAforo: true,
      },
    });

    // Si se debe generar tabla de aforo automática
    if (createTanqueInput.generarTablaAforoAutomatica && createTanqueInput.diametro && createTanqueInput.alturaMaxima) {
      await this.generarTablaAforoAutomatica(tanque.id, createTanqueInput.diametro, createTanqueInput.alturaMaxima);
    }

    // Si se proporcionó tabla de aforo manual
    if (createTanqueInput.tablaAforo && createTanqueInput.tablaAforo.length > 0) {
      await this.crearTablaAforo(tanque.id, createTanqueInput.tablaAforo);
    }

    return this.findOne(tanque.id);
  }

  /**
   * Buscar todos los tanques con filtros
   */
  async findAll(puntoVentaId?: string, productoId?: string, activo?: boolean): Promise<Tanque[]> {
    const tanques = await this.prisma.tanque.findMany({
      where: {
        ...(puntoVentaId && { puntoVentaId }),
        ...(productoId && { productoId }),
        ...(activo !== undefined && { activo }),
      },
      include: {
        producto: true,
        puntoVenta: true,
        tablaAforo: {
          orderBy: { altura: 'asc' }
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return Promise.all(tanques.map(tanque => this.mapTanqueWithCalculations(tanque)));
  }

  /**
   * Buscar un tanque por ID
   */
  async findOne(id: string): Promise<Tanque> {
    const tanque = await this.prisma.tanque.findUnique({
      where: { id },
      include: {
        producto: true,
        puntoVenta: true,
        tablaAforo: {
          orderBy: { altura: 'asc' }
        },
      },
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    return await this.mapTanqueWithCalculations(tanque);
  }

  /**
   * Buscar tanques por punto de venta
   */
  async findByPuntoVenta(puntoVentaId: string): Promise<Tanque[]> {
    return this.findAll(puntoVentaId);
  }

  /**
   * Actualizar un tanque
   */
  async update(id: string, updateTanqueInput: UpdateTanqueInput): Promise<Tanque> {
    const existingTanque = await this.prisma.tanque.findUnique({
      where: { id }
    });

    if (!existingTanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Si se está cambiando el número, verificar que no exista otro con el mismo número en el punto de venta
    if (updateTanqueInput.nombre && updateTanqueInput.nombre !== existingTanque.nombre) {
      const duplicateTanque = await this.prisma.tanque.findFirst({
        where: { 
          nombre: updateTanqueInput.nombre,
          puntoVentaId: existingTanque.puntoVentaId,
          id: { not: id }
        },
      });

      if (duplicateTanque) {
        throw new ConflictException('Ya existe un tanque con este número en este punto de venta');
      }
    }

    const tanque = await this.prisma.tanque.update({
      where: { id },
      data: {
        ...(updateTanqueInput.numero && { numero: updateTanqueInput.numero }),
        ...(updateTanqueInput.capacidadTotal !== undefined && { capacidadTotal: updateTanqueInput.capacidadTotal }),
        ...(updateTanqueInput.nivelActual !== undefined && { nivelActual: updateTanqueInput.nivelActual }),
        ...(updateTanqueInput.nivelMinimo !== undefined && { nivelMinimo: updateTanqueInput.nivelMinimo }),
        ...(updateTanqueInput.diametro !== undefined && { diametro: updateTanqueInput.diametro }),
        ...(updateTanqueInput.alturaMaxima !== undefined && { alturaMaxima: updateTanqueInput.alturaMaxima }),
        ...(updateTanqueInput.tipoTanque && { tipoTanque: updateTanqueInput.tipoTanque }),
        ...(updateTanqueInput.unidadMedida && { unidadMedida: updateTanqueInput.unidadMedida }), // Temporarily commented - restart IDE
        ...(updateTanqueInput.activo !== undefined && { activo: updateTanqueInput.activo }),
        ...(updateTanqueInput.productoId && { productoId: updateTanqueInput.productoId }),
      },
      include: {
        producto: true,
        puntoVenta: true,
        tablaAforo: {
          orderBy: { altura: 'asc' }
        },
      },
    });

    return await this.mapTanqueWithCalculations(tanque);
  }

  /**
   * Eliminar un tanque
   */
  async remove(id: string): Promise<boolean> {
    const tanque = await this.prisma.tanque.findUnique({
      where: { id }
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    // Verificar que no haya entradas de inventario asociadas
    const entradasInventario = await this.prisma.entradaInventarioProcess.count({
      where: { tanqueId: id }
    });

    if (entradasInventario > 0) {
      throw new ConflictException('No se puede eliminar el tanque porque tiene entradas de inventario asociadas');
    }

    await this.prisma.tanque.delete({
      where: { id }
    });

    return true;
  }

  /**
   * Actualizar nivel del tanque
   */
  async updateLevel(id: string, nuevoNivel: number): Promise<Tanque> {
    const tanque = await this.prisma.tanque.findUnique({
      where: { id }
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    const capacidadTotal = parseFloat(tanque.capacidadTotal.toString());
    
    if (nuevoNivel > capacidadTotal) {
      throw new BadRequestException('El nivel excede la capacidad del tanque');
    }

    if (nuevoNivel < 0) {
      throw new BadRequestException('El nivel no puede ser negativo');
    }

    return this.update(id, { id, nivelActual: nuevoNivel });
  }

  /**
   * Actualizar nivel del tanque basado en altura del fluido (usando tabla de aforo)
   * Incluye validaciones y warnings
   */
  async updateLevelByHeight(id: string, alturaFluido: number): Promise<TanqueUpdateResponse> {
    const tanque = await this.prisma.tanque.findUnique({
      where: { id },
      include: {
        tablaAforo: true
      }
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    if (alturaFluido < 0) {
      throw new BadRequestException('La altura del fluido no puede ser negativa');
    }

    // Verificar que hay tabla de aforo
    if (!tanque.tablaAforo || tanque.tablaAforo.length === 0) {
      throw new BadRequestException('El tanque no tiene tabla de aforo configurada. No se puede convertir altura a volumen.');
    }

    const warnings: string[] = [];
    const messages: string[] = [];
    let status = 'NORMAL';

    // Verificar si es la misma altura
    // const alturaActualAnterior = parseFloat(tanque.alturaActual.toString()); // TODO: Uncomment when Prisma recognizes field
    // if (Math.abs(alturaFluido - alturaActualAnterior) < 0.1) { // Tolerancia de 0.1 cm
    //   warnings.push(`La altura ingresada (${alturaFluido}cm) es la misma que la altura actual (${alturaActualAnterior}cm)`);
    //   messages.push('No se detectaron cambios significativos en la altura del fluido');
    //   status = 'WARNING';
    // }

    // Convertir altura a volumen usando tabla de aforo
    // IMPORTANTE: getVolumeByHeight SIEMPRE retorna el volumen en LITROS (según tabla_aforo)
    const volumenEnLitros = await this.getVolumeByHeight(id, alturaFluido);

    // Convertir el volumen a la unidad del tanque si es necesario
    const LITROS_A_GALONES = 0.264172;
    const unidadTanque = tanque.unidadMedida || 'GALONES';
    const volumen = unidadTanque === 'GALONES' 
      ? Math.round(volumenEnLitros * LITROS_A_GALONES * 100) / 100 
      : Math.round(volumenEnLitros * 100) / 100;

    // Verificar que no exceda la capacidad
    const capacidadTotal = parseFloat(tanque.capacidadTotal.toString());
    if (volumen > capacidadTotal) {
      throw new BadRequestException(`El volumen calculado (${volumen}) excede la capacidad del tanque (${capacidadTotal})`);
    }

    // Verificar nivel mínimo
    const nivelMinimo = parseFloat(tanque.nivelMinimo.toString());
    const unidadDisplay = unidadTanque;
    
    if (volumen < nivelMinimo) {
      warnings.push(`¡ALERTA! El volumen calculado (${volumen} ${unidadDisplay}) está por debajo del nivel mínimo (${nivelMinimo} ${unidadDisplay})`);
      // TODO: Add alert to Sentry or other monitoring service or send email
      messages.push(`Tanque con nivel crítico. Se requiere abastecimiento urgente.`);
      status = 'CRITICAL';
    } else if (volumen < nivelMinimo * 1.2) { // Warning si está dentro del 20% del mínimo
      warnings.push(`Nivel bajo: El volumen (${volumen} ${unidadDisplay}) está cerca del nivel mínimo (${nivelMinimo} ${unidadDisplay})`);
      // TODO: Add alert to Sentry or other monitoring service or send email
      messages.push('Se recomienda programar abastecimiento pronto');
      status = status === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
    }

    // Actualizar tanto el nivel como la altura actual del tanque
    // Y sincronizar automáticamente el stockActual del producto asociado
    const tanqueActualizado = await this.prisma.$transaction(async (prisma) => {
      // 1. Actualizar el tanque con el volumen en su unidad de medida
      const tanqueUpdated = await prisma.tanque.update({
        where: { id },
        data: { 
          nivelActual: volumen,
          alturaActual: alturaFluido,
          updatedAt: new Date() 
        },
        include: {
          producto: true,
          puntoVenta: true,
          tablaAforo: {
            orderBy: { altura: 'asc' }
          },
        },
      });

      // 2. Sincronizar el stockActual del producto asociado
      // El stockActual debe tener exactamente el mismo valor que nivelActual del tanque
      if (tanqueUpdated.productoId) {
        await prisma.producto.update({
          where: { id: tanqueUpdated.productoId },
          data: {
            stockActual: volumen,
            updatedAt: new Date()
          }
        });
      }

      return tanqueUpdated;
    });

    const tanqueMapeado = await this.mapTanqueWithCalculations(tanqueActualizado);

    if (warnings.length === 0) {
      messages.push(`Nivel actualizado exitosamente: ${volumen} ${unidadDisplay} (${alturaFluido}cm)`);
      if (tanqueActualizado.productoId) {
        messages.push(`Stock del producto sincronizado automáticamente`);
      }
    }

    return {
      tanque: tanqueMapeado,
      success: true,
      warnings,
      messages,
      status
    };
  }

  /**
   * Obtener estado de todos los tanques con alertas
   */
  async getTankStatusByPuntoVenta(puntoVentaId: string): Promise<TanqueWithStatus[]> {
    const tanques = await this.findByPuntoVenta(puntoVentaId);
    const tanquesWithStatus = await Promise.all(
      tanques.map(async tanque => {
        const porcentajeLlenado = await this.calcularPorcentajeLlenado(tanque);
        const estado = this.determinarEstadoTanque(porcentajeLlenado);
        const requiereAbastecimiento = porcentajeLlenado <= 20; // Menos del 20%

        return {
          tanque,
          estado,
          porcentajeLlenado,
          requiereAbastecimiento,
        };
      })
    );
    return tanquesWithStatus;
  }

  /**
   * Calcular volumen basado en altura usando la fórmula: PI * (diametro/2)^2 * altura * 10
   */
  calculateVolumeByHeight(diametro: number, altura: number): number {
    if (!diametro || !altura) {
      throw new BadRequestException('Diámetro y altura son requeridos para el cálculo');
    }

    const radio = diametro / 2;
    const area = Math.PI * Math.pow(radio, 2);
    const volumen = area * altura * 10; // La fórmula incluye * 10

    return Math.round(volumen * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Generar tabla de aforo automática basada en diámetro y altura máxima
   */
  async generarTablaAforoAutomatica(tanqueId: string, diametro: number, alturaMaxima: number): Promise<void> {
    const incremento = 1; // Incremento de 1 cm
    const tablaAforo: CreateTablaAforoInput[] = [];

    // Generar entradas cada 1 cm hasta la altura máxima
    for (let altura = 0; altura <= alturaMaxima * 100; altura += incremento) { // Convertir metros a cm
      const volumen = this.calculateVolumeByHeight(diametro, altura / 100); // Convertir cm a metros para cálculo
      
      tablaAforo.push({
        altura: altura,
        volumen: volumen,
      });
    }

    await this.crearTablaAforo(tanqueId, tablaAforo);
  }

  /**
   * Crear registros de tabla de aforo
   */
  async crearTablaAforo(tanqueId: string, tablaAforo: CreateTablaAforoInput[]): Promise<void> {
    // Eliminar tabla de aforo existente
    await this.prisma.tablaAforo.deleteMany({
      where: { tanqueId }
    });

    // Crear nueva tabla de aforo
    const createData = tablaAforo.map(entrada => ({
      tanqueId,
      altura: entrada.altura,
      volumen: entrada.volumen,
    }));

    await this.prisma.tablaAforo.createMany({
      data: createData
    });
  }

  /**
   * Obtener volumen basado en altura usando tabla de aforo
   * Retorna el volumen en la unidad original de la tabla de aforo
   */
  async getVolumeByHeight(tanqueId: string, altura: number): Promise<number> {
    // Primero verificar que existe tabla de aforo y obtener los límites
    const tablaAforo = await this.prisma.tablaAforo.findMany({
      where: { tanqueId },
      orderBy: { altura: 'asc' }
    });

    if (!tablaAforo || tablaAforo.length === 0) {
      throw new BadRequestException('El tanque no tiene tabla de aforo configurada');
    }

    const alturaMinima = parseFloat(tablaAforo[0].altura.toString());
    const alturaMaxima = parseFloat(tablaAforo[tablaAforo.length - 1].altura.toString());

    // Validar que la altura esté dentro del rango de la tabla de aforo
    // Permitir altura 0 para tanques recién creados o vacíos
    if (altura < alturaMinima && altura !== 0) {
      throw new BadRequestException(
        `La altura ingresada (${altura}cm) es menor que la altura mínima de la tabla de aforo (${alturaMinima}cm)`
      );
    }

    if (altura > alturaMaxima) {
      throw new BadRequestException(
        `La altura ingresada (${altura}cm) excede la altura máxima de la tabla de aforo (${alturaMaxima}cm). ` +
        `Altura máxima permitida: ${alturaMaxima}cm`
      );
    }    
    // Buscar entrada exacta en tabla de aforo
    let entrada = await this.prisma.tablaAforo.findFirst({
      where: { 
        tanqueId,
        altura: altura
      }
    });

    if (entrada) {
      return parseFloat(entrada.volumen.toString());
    }

    // Si no hay entrada exacta, interpolar entre valores cercanos
    const entradaMenor = await this.prisma.tablaAforo.findFirst({
      where: { 
        tanqueId,
        altura: { lte: altura }
      },
      orderBy: { altura: 'desc' }
    });

    const entradaMayor = await this.prisma.tablaAforo.findFirst({
      where: { 
        tanqueId,
        altura: { gte: altura }
      },
      orderBy: { altura: 'asc' }
    });

    if (entradaMenor && entradaMayor && entradaMenor.id !== entradaMayor.id) {
      // Interpolación lineal
      const alturaMenor = parseFloat(entradaMenor.altura.toString());
      const alturaMayor = parseFloat(entradaMayor.altura.toString());
      const volumenMenor = parseFloat(entradaMenor.volumen.toString());
      const volumenMayor = parseFloat(entradaMayor.volumen.toString());

      const factor = (altura - alturaMenor) / (alturaMayor - alturaMenor);
      const volumen = volumenMenor + (factor * (volumenMayor - volumenMenor));
      
      return Math.round(volumen * 100) / 100;
    }

    if (entradaMenor) {
      return parseFloat(entradaMenor.volumen.toString());
    }

    if (entradaMayor) {
      return parseFloat(entradaMayor.volumen.toString());
    }

    throw new NotFoundException('No se pudo determinar el volumen para la altura especificada');
  }

  /**
   * Mapear tanque con cálculos adicionales
   */
  private async mapTanqueWithCalculations(tanque: any): Promise<Tanque> {
    const nivelPorcentaje = await this.calcularPorcentajeLlenado(tanque);
    
    return {
      ...tanque,
      nivelPorcentaje,
      volumenActualPorAltura: tanque.tablaAforo?.length > 0 ? 
        this.calcularVolumenPorTablaAforo(tanque, parseFloat(tanque.nivelActual.toString())) : 
        undefined,
      capacidadTotal: parseFloat(tanque.capacidadTotal.toString()),
      nivelActual: parseFloat(tanque.nivelActual.toString()),
      nivelMinimo: parseFloat(tanque.nivelMinimo.toString()),
      alturaActual: parseFloat(tanque.alturaActual.toString()),
      diametro: tanque.diametro ? parseFloat(tanque.diametro.toString()) : undefined,
      alturaMaxima: tanque.alturaMaxima ? parseFloat(tanque.alturaMaxima.toString()) : undefined,
      unidadMedida: tanque.unidadMedida,
      producto: tanque.producto ? this.formatProductoForGraphQL(tanque.producto) : undefined,
    };
  }

  /**
   * Formatear producto para GraphQL con campos calculados
   */
  private formatProductoForGraphQL(producto: any) {
    if (!producto) return undefined;

    const precioCompra = parseFloat(producto.precioCompra?.toString() || '0');
    const precioVenta = parseFloat(producto.precioVenta?.toString() || '0');
    
    // Calcular métricas de rentabilidad
    const utilidad = precioVenta - precioCompra;
    const margenUtilidad = precioVenta > 0 ? (utilidad / precioVenta) * 100 : 0;
    const porcentajeGanancia = precioCompra > 0 ? (utilidad / precioCompra) * 100 : 0;
    
    return {
      id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || null,
      unidadMedida: producto.unidadMedida,
      precioCompra: precioCompra,
      precioVenta: precioVenta,
      moneda: producto.moneda || 'COP',
      utilidad: Math.round(utilidad * 100) / 100,
      margenUtilidad: Math.round(margenUtilidad * 100) / 100,
      porcentajeGanancia: Math.round(porcentajeGanancia * 100) / 100,
      stockMinimo: producto.stockMinimo || 0,
      stockActual: producto.stockActual || 0,
      esCombustible: producto.esCombustible || false,
      activo: producto.activo !== undefined ? producto.activo : true,
      createdAt: producto.createdAt,
      updatedAt: producto.updatedAt,
      categoriaId: producto.categoriaId,
      categoria: producto.categoria || null,
    };
  }

  /**
   * Calcular porcentaje de llenado basado en alturaActual y tabla de aforo
   */
  private async calcularPorcentajeLlenado(tanque: any): Promise<number> {
    const capacidadTotal = parseFloat(tanque.capacidadTotal.toString());
    const alturaActual = parseFloat(tanque.alturaActual.toString());
    
    if (capacidadTotal === 0) return 0;
    
    try {
      // Calcular volumen real usando tabla de aforo
      const volumenActual = await this.getVolumeByHeight(tanque.id, alturaActual);
      return Math.round((volumenActual / capacidadTotal) * 100 * 100) / 100;
    } catch (error) {
      // Si no hay tabla de aforo o hay error, usar cálculo aproximado
      console.warn(`No se pudo calcular volumen por tabla de aforo para tanque ${tanque.id}:`, error.message);
      return Math.round((alturaActual / 200) * 100 * 100) / 100; // Aproximación basada en altura
    }
  }

  /**
   * Determinar estado del tanque basado en porcentaje
   */
  private determinarEstadoTanque(porcentajeLlenado: number): string {
    if (porcentajeLlenado >= 50) return 'NORMAL';
    if (porcentajeLlenado >= 20) return 'BAJO';
    if (porcentajeLlenado > 0) return 'CRITICO';
    return 'VACIO';
  }

  /**
   * Calcular volumen basado en tabla de aforo
   */
  private calcularVolumenPorTablaAforo(tanque: any, altura: number): number {
    if (!tanque.tablaAforo || tanque.tablaAforo.length === 0) {
      return 0;
    }

    // Buscar entrada exacta
    const entrada = tanque.tablaAforo.find((entry: any) => parseFloat(entry.altura.toString()) === altura);
    if (entrada) {
      return parseFloat(entrada.volumen.toString());
    }

    // Interpolación entre valores cercanos
    const entradas = tanque.tablaAforo
      .map((entry: any) => ({
        altura: parseFloat(entry.altura.toString()),
        volumen: parseFloat(entry.volumen.toString())
      }))
      .sort((a: any, b: any) => a.altura - b.altura);

    for (let i = 0; i < entradas.length - 1; i++) {
      if (altura >= entradas[i].altura && altura <= entradas[i + 1].altura) {
        const factor = (altura - entradas[i].altura) / (entradas[i + 1].altura - entradas[i].altura);
        return entradas[i].volumen + (factor * (entradas[i + 1].volumen - entradas[i].volumen));
      }
    }

    return 0;
  }

  /**
   * Importar tabla de aforo desde datos CSV
   */
  async importAforoFromCSV(tanqueId: string, csvData: string): Promise<void> {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    if (headers.length < 2 || !headers.includes('altura') || !headers.includes('volumen')) {
      throw new BadRequestException('El CSV debe tener columnas "altura" y "volumen"');
    }

    const alturaIndex = headers.indexOf('altura');
    const volumenIndex = headers.indexOf('volumen');
    
    const tablaAforo: CreateTablaAforoInput[] = [];

    // Procesar líneas de datos (saltar header)
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      
      if (values.length >= 2) {
        const altura = parseFloat(values[alturaIndex]);
        const volumen = parseFloat(values[volumenIndex]);
        
        if (!isNaN(altura) && !isNaN(volumen)) {
          tablaAforo.push({ altura, volumen });
        }
      }
    }

    if (tablaAforo.length === 0) {
      throw new BadRequestException('No se encontraron datos válidos en el CSV');
    }

    await this.crearTablaAforo(tanqueId, tablaAforo);
  }

  /**
   * Crear entradas masivas de tabla de aforo
   */
  async bulkCreateAforo(tanqueId: string, entradas: CreateTablaAforoInput[]): Promise<void> {
    if (entradas.length === 0) {
      throw new BadRequestException('Se requiere al menos una entrada');
    }

    // Validar que el tanque existe
    const tanque = await this.prisma.tanque.findUnique({
      where: { id: tanqueId }
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    await this.crearTablaAforo(tanqueId, entradas);
  }

  /**
   * Obtener tabla de aforo completa de un tanque
   */
  async getTablaAforo(tanqueId: string): Promise<any[]> {
    const tablaAforo = await this.prisma.tablaAforo.findMany({
      where: { tanqueId },
      orderBy: { altura: 'asc' }
    });

    return tablaAforo.map(entrada => ({
      ...entrada,
      altura: parseFloat(entrada.altura.toString()),
      volumen: parseFloat(entrada.volumen.toString())
    }));
  }

  /**
   * Eliminar tabla de aforo de un tanque
   */
  async eliminarTablaAforo(tanqueId: string): Promise<boolean> {
    const tanque = await this.prisma.tanque.findUnique({
      where: { id: tanqueId }
    });

    if (!tanque) {
      throw new NotFoundException('Tanque no encontrado');
    }

    await this.prisma.tablaAforo.deleteMany({
      where: { tanqueId }
    });

    return true;
  }

  /**
   * Generar tabla de aforo con parámetros personalizados
   */
  async generarTablaAforoConParametros(
    tanqueId: string, 
    diametro: number, 
    alturaMaxima: number, 
    incremento: number = 1
  ): Promise<void> {
    const tablaAforo: CreateTablaAforoInput[] = [];

    // Generar entradas con el incremento especificado
    for (let altura = 0; altura <= alturaMaxima * 100; altura += incremento) {
      const volumen = this.calculateVolumeByHeight(diametro, altura / 100);
      
      tablaAforo.push({
        altura: altura,
        volumen: volumen,
      });
    }

    await this.crearTablaAforo(tanqueId, tablaAforo);
  }

  /**
   * Exportar tabla de aforo a CSV
   */
  async exportAforoToCSV(tanqueId: string): Promise<string> {
    const tablaAforo = await this.getTablaAforo(tanqueId);
    
    if (tablaAforo.length === 0) {
      throw new NotFoundException('No hay tabla de aforo para este tanque');
    }

    let csv = 'altura,volumen\n';
    
    tablaAforo.forEach(entrada => {
      csv += `${entrada.altura},${entrada.volumen}\n`;
    });

    return csv;
  }

  /**
   * Validar tabla de aforo (buscar inconsistencias)
   */
  async validarTablaAforo(tanqueId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const tablaAforo = await this.getTablaAforo(tanqueId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (tablaAforo.length === 0) {
      errors.push('No hay tabla de aforo');
      return { isValid: false, errors, warnings };
    }

    // Verificar orden ascendente de alturas
    for (let i = 1; i < tablaAforo.length; i++) {
      if (tablaAforo[i].altura <= tablaAforo[i - 1].altura) {
        errors.push(`Altura en posición ${i} no es mayor que la anterior`);
      }
    }

    // Verificar que volúmenes sean crecientes
    for (let i = 1; i < tablaAforo.length; i++) {
      if (tablaAforo[i].volumen < tablaAforo[i - 1].volumen) {
        warnings.push(`Volumen en altura ${tablaAforo[i].altura}cm es menor que el anterior`);
      }
    }

    // Verificar que inicie en 0
    if (tablaAforo[0].altura !== 0) {
      warnings.push('La tabla no inicia en altura 0');
    }

    if (tablaAforo[0].volumen !== 0) {
      warnings.push('El volumen no inicia en 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
} 