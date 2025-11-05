import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { Carrotanque, CarrotanqueListResponse, CarrotanquesSummary } from './entities/carrotanque.entity';
import { CreateCarrotanqueInput, FilterCarrotanquesInput } from './dto/create-carrotanque.input';
import { UpdateCarrotanqueInput } from './dto/update-carrotanque.input';

@Injectable()
export class CarrotanquesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear un nuevo carrotanque (compartimiento)
   */
  async create(createCarrotanqueInput: CreateCarrotanqueInput): Promise<any> {
    // Verificar si la placa ya existe
    const existingCarrotanque = await this.prisma.carrotanque.findUnique({
      where: { placa: createCarrotanqueInput.placa },
    });

    if (existingCarrotanque) {
      throw new ConflictException('Ya existe un carrotanque con esta placa');
    }

    // Crear el carrotanque (realmente un compartimiento en el modelo actual)
    const carrotanque = await this.prisma.carrotanque.create({
      data: {
        nombre: createCarrotanqueInput.nombre,
        placa: createCarrotanqueInput.placa,
        capacidadTotal: 0, // Por defecto
        nivelActual: 0,
        nivelMinimo: 0,
        alturaActual: 0,
        unidadMedida: 'GALONES',
        conductor: createCarrotanqueInput.conductor,
        empresa: createCarrotanqueInput.empresa,
        activo: createCarrotanqueInput.activo ?? true,
        observaciones: createCarrotanqueInput.observaciones,
      },
    });

    return carrotanque;
  }

  /**
   * Obtener todos los carrotanques con filtros y paginación
   */
  async findAll(
    filters?: FilterCarrotanquesInput,
    page: number = 1,
    limit: number = 10
  ): Promise<CarrotanqueListResponse> {
    const skip = (page - 1) * limit;

    // Construir el objeto where basado en los filtros
    const where: any = {};

    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    }

    if (filters?.empresa) {
      where.empresa = {
        contains: filters.empresa,
        mode: 'insensitive',
      };
    }

    if (filters?.conductor) {
      where.conductor = {
        contains: filters.conductor,
        mode: 'insensitive',
      };
    }

    if (filters?.placa) {
      where.placa = {
        contains: filters.placa,
        mode: 'insensitive',
      };
    }

    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { placa: { contains: filters.search, mode: 'insensitive' } },
        { conductor: { contains: filters.search, mode: 'insensitive' } },
        { empresa: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consultas en paralelo
    const [carrotanques, total] = await Promise.all([
      this.prisma.carrotanque.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.carrotanque.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      carrotanques: carrotanques as any,
      total,
      totalPages,
      currentPage: page,
    };
  }

  /**
   * Obtener un carrotanque por ID
   */
  async findOne(id: string): Promise<any> {
    const carrotanque = await this.prisma.carrotanque.findUnique({
      where: { id },
    });

    if (!carrotanque) {
      throw new NotFoundException(`Carrotanque con ID ${id} no encontrado`);
    }

    return carrotanque;
  }

  /**
   * Obtener un carrotanque por placa
   */
  async findByPlaca(placa: string): Promise<any> {
    const carrotanque = await this.prisma.carrotanque.findUnique({
      where: { placa },
    });

    if (!carrotanque) {
      throw new NotFoundException(`Carrotanque con placa ${placa} no encontrado`);
    }

    return carrotanque;
  }

  /**
   * Actualizar un carrotanque
   */
  async update(updateCarrotanqueInput: UpdateCarrotanqueInput): Promise<any> {
    const { id, ...updateData } = updateCarrotanqueInput;

    // Verificar que el carrotanque existe
    const existingCarrotanque = await this.prisma.carrotanque.findUnique({
      where: { id },
    });

    if (!existingCarrotanque) {
      throw new NotFoundException(`Carrotanque con ID ${id} no encontrado`);
    }

    // Si se está actualizando la placa, verificar que no exista otra con la misma placa
    if (updateData.placa && updateData.placa !== existingCarrotanque.placa) {
      const duplicatePlaca = await this.prisma.carrotanque.findUnique({
        where: { placa: updateData.placa },
      });

      if (duplicatePlaca) {
        throw new ConflictException('Ya existe un carrotanque con esta placa');
      }
    }

    // Actualizar el carrotanque
    const updatedCarrotanque = await this.prisma.carrotanque.update({
      where: { id },
      data: updateData,
    });

    return updatedCarrotanque;
  }

  /**
   * Activar un carrotanque
   */
  async activate(id: string): Promise<any> {
    return this.update({ id, activo: true });
  }

  /**
   * Desactivar un carrotanque
   */
  async deactivate(id: string): Promise<any> {
    return this.update({ id, activo: false });
  }

  /**
   * Eliminar un carrotanque (soft delete - solo desactivar)
   */
  async remove(id: string): Promise<any> {
    return this.deactivate(id);
  }

  /**
   * Obtener resumen de carrotanques activos agrupados por vehículo
   */
  async getActiveCarrotanquesSummary(): Promise<CarrotanquesSummary> {
    const compartimientos = await this.prisma.carrotanque.findMany({
      where: { activo: true },
    });

    // Agrupar compartimientos por vehículo (usando los primeros caracteres de la placa)
    const vehiculosMap = new Map<string, any[]>();
    
    let idVehiculo = '';
    compartimientos.forEach(comp => {
      // Extraer la placa base del vehículo (ej: SSY683-C1 -> SSY683)
      const placaVehiculo = comp.placa;
       idVehiculo =comp.id;
      console.log("placaVehiculo", placaVehiculo);
      if (!vehiculosMap.has(placaVehiculo)) {
        vehiculosMap.set(placaVehiculo, []);
      }
      vehiculosMap.get(placaVehiculo)!.push(comp);
    });

    const vehiculos = Array.from(vehiculosMap.entries()).map(([placaVehiculo, compartimientos]) => {
      const capacidadTotal = compartimientos.reduce((acc, comp) => acc + Number(comp.capacidadTotal), 0);
      const nivelTotal = compartimientos.reduce((acc, comp) => acc + Number(comp.nivelActual), 0);
      const porcentajeOcupacion = capacidadTotal > 0 ? (nivelTotal / capacidadTotal) * 100 : 0;

      return {
        id: idVehiculo,
        nombre: `Carrotanque ${placaVehiculo}`,
        placa: placaVehiculo,
        capacidadTotal,
        nivelActual: nivelTotal,
        porcentajeOcupacion: Math.round(porcentajeOcupacion * 100) / 100,
        conductor: compartimientos[0]?.conductor,
        empresa: compartimientos[0]?.empresa,
        compartimientos: compartimientos.map(comp => ({
          id: comp.id,
          numero: comp.placa.split('-')[1] || '1', // Extraer el número del compartimiento
          nombre: comp.nombre,
          capacidadTotal: Number(comp.capacidadTotal),
          nivelActual: Number(comp.nivelActual),
          porcentajeOcupacion: Number(comp.capacidadTotal) > 0 
            ? Math.round((Number(comp.nivelActual) / Number(comp.capacidadTotal)) * 100 * 100) / 100 
            : 0,
          productoId: null, // Por ahora no tenemos relación con productos
        }))
      };
    });

    const totalCompartimientos = compartimientos.length;
    const capacidadTotalGeneral = compartimientos.reduce((acc, comp) => acc + Number(comp.capacidadTotal), 0);
    const nivelTotalGeneral = compartimientos.reduce((acc, comp) => acc + Number(comp.nivelActual), 0);
    const porcentajeOcupacionGeneral = capacidadTotalGeneral > 0 ? (nivelTotalGeneral / capacidadTotalGeneral) * 100 : 0;

    return {
      totalCarrotanques: vehiculos.length,
      totalCompartimientos,
      capacidadTotalLitros: capacidadTotalGeneral,
      nivelTotalLitros: nivelTotalGeneral,
      porcentajeOcupacionGeneral: Math.round(porcentajeOcupacionGeneral * 100) / 100,
      carrotanques: vehiculos,
    };
  }
} 