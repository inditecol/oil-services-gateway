import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateShiftInput } from './dto/create-shift.input';
import { UpdateShiftInput } from './dto/update-shift.input';
import { Shift } from './entities/shift.entity';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extrae la hora en formato HH:mm de un string ISO
   * @param isoString - String ISO (ej: "2025-09-01T06:00:00.000Z")
   * @returns String en formato HH:mm (ej: "06:00")
   */
  private extraerHoraEnFormatoHHmm(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Extrae solo la fecha (YYYY-MM-DD) de un string ISO o Date
   * @param dateInput - String ISO o Date
   * @returns String en formato YYYY-MM-DD
   */
  private extraerSoloFecha(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toISOString().split('T')[0];
  }

  // Helper method to format Shift
  private formatShift(shift: any): Shift {
    return {
      id: shift.id,
      startDate: new Date(shift.fechaInicio),
      endDate: shift.fechaFin ? new Date(shift.fechaFin) : null,
      startTime: shift.horaInicio,
      endTime: shift.horaFin,
      observations: shift.observaciones,
      active: shift.activo,
      createdAt: shift.createdAt,
      updatedAt: shift.updatedAt,
      userId: shift.usuarioId,
      user: shift.usuario,
      puntoVentaId: shift.puntoVentaId,
      puntoVenta: shift.puntoVenta,
    } as Shift;
  }

  async create(createShiftInput: CreateShiftInput): Promise<Shift> {
    // Extraer fecha y horas
    const fechaInicio = new Date(createShiftInput.startDate);
    const fechaInicioSolo = this.extraerSoloFecha(fechaInicio);
    const horaInicio = createShiftInput.startTime; // Ya debe estar en formato HH:mm
    const horaFin = createShiftInput.endTime || null;

    // Normalizar fechaInicio para comparar solo la fecha (sin hora)
    const fechaInicioInicio = new Date(fechaInicio);
    fechaInicioInicio.setUTCHours(0, 0, 0, 0);
    const fechaInicioFin = new Date(fechaInicio);
    fechaInicioFin.setUTCHours(23, 59, 59, 999);

    // Validar que no exista un turno con los mismos datos únicos
    // Criterio de unicidad: fechaInicio (solo fecha) + puntoVentaId + horaInicio + horaFin
    const turnoDuplicado = await this.prisma.turno.findFirst({
      where: {
        fechaInicio: {
          gte: fechaInicioInicio,
          lte: fechaInicioFin,
        },
        puntoVentaId: createShiftInput.puntoVentaId,
        horaInicio: horaInicio,
        horaFin: horaFin,
      },
    });

    if (turnoDuplicado) {
      throw new ConflictException(
        `Ya existe un turno para esta fecha (${fechaInicioSolo}), punto de venta y horas (${horaInicio} - ${horaFin || 'N/A'}). Turno ID: ${turnoDuplicado.id}`
      );
    }

    const shift = await this.prisma.turno.create({
      data: {
        fechaInicio: fechaInicio,
        fechaFin: createShiftInput.endDate ? new Date(createShiftInput.endDate) : null,
        horaInicio: horaInicio,
        horaFin: horaFin,
        observaciones: createShiftInput.observations,
        activo: createShiftInput.active ?? true,
        puntoVenta: {
          connect: { id: createShiftInput.puntoVentaId }
        },
        ...(createShiftInput.userId && {
          usuario: {
            connect: { id: createShiftInput.userId }
          }
        }),
      },
      include: {
        puntoVenta: true,
        usuario: {
          include: {
            rol: true,
          }
        },
      },
    });

    return this.formatShift(shift);
  }

  /**
   * Crea un turno desde timestamps ISO (usado por processShiftClosure)
   * @param startTimeISO - Timestamp ISO de inicio (ej: "2025-09-01T06:00:00.000Z")
   * @param finishTimeISO - Timestamp ISO de fin (ej: "2025-09-01T14:00:00.000Z")
   * @param puntoVentaId - ID del punto de venta
   * @param usuarioId - ID del usuario
   * @param observaciones - Observaciones opcionales
   * @returns Shift creado
   */
  async createFromTimestamps(
    startTimeISO: string,
    finishTimeISO: string,
    puntoVentaId: string,
    usuarioId: string,
    observaciones?: string
  ): Promise<Shift> {
    // Extraer fecha y horas de los timestamps
    const fechaInicio = new Date(startTimeISO);
    const fechaFin = new Date(finishTimeISO);
    const fechaInicioSolo = this.extraerSoloFecha(fechaInicio);
    const horaInicio = this.extraerHoraEnFormatoHHmm(startTimeISO);
    const horaFin = this.extraerHoraEnFormatoHHmm(finishTimeISO);

    // Validar que no exista un turno con los mismos datos únicos
    const turnoDuplicado = await this.prisma.turno.findFirst({
      where: {
        fechaInicio: fechaInicio,
        puntoVentaId: puntoVentaId,
        horaInicio: horaInicio,
        horaFin: horaFin,
      },
    });

    if (turnoDuplicado) {
      throw new ConflictException(
        `Ya existe un turno para esta fecha (${fechaInicioSolo}), punto de venta y horas (${horaInicio} - ${horaFin}). Turno ID: ${turnoDuplicado.id}`
      );
    }

    // Crear NUEVO turno (nunca actualizar existente)
    const shift = await this.prisma.turno.create({
      data: {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        horaInicio: horaInicio, // Formato "HH:mm" (ej: "06:00", "14:00")
        horaFin: horaFin, // Formato "HH:mm" (ej: "14:00", "22:00")
        puntoVentaId: puntoVentaId,
        usuarioId: usuarioId,
        observaciones: observaciones || `Turno automático para cierre de ${puntoVentaId}`,
        activo: true,
      },
      include: {
        puntoVenta: true,
        usuario: {
          include: {
            rol: true,
          }
        },
      },
    });

    return this.formatShift(shift);
  }

  async findAll(filters?: {
    userId?: string;
    puntoVentaId?: string;
    startDate?: Date;
    endDate?: Date;
    active?: boolean;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters?.userId) {
        where.usuarioId = filters.userId;
      }

      if (filters?.puntoVentaId) {
        where.puntoVentaId = filters.puntoVentaId;
      }

      if (filters?.startDate || filters?.endDate) {
        where.fechaInicio = {};
        if (filters.startDate) {
          where.fechaInicio.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.fechaInicio.lte = filters.endDate;
        }
      }

      if (filters?.active !== undefined) {
        where.activo = filters.active;
      }

      const [shifts, total] = await Promise.all([
        this.prisma.turno.findMany({
          where,
          include: {
            usuario: true,
            puntoVenta: true,
          },
          orderBy: { fechaInicio: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.turno.count({ where }),
      ]);

      return {
        shifts: shifts.map(shift => this.formatShift(shift)),
        total,
        page,
        limit,
      };
    } catch (error) {
      throw new Error(`Error querying shifts: ${error.message}`);
    }
  }

  async findById(id: string): Promise<Shift | null> {
    try {
      const shift = await this.prisma.turno.findUnique({
        where: { id },
        include: {
          usuario: true,
        },
      });

      return shift ? this.formatShift(shift) : null;
    } catch (error) {
      throw new Error(`Error querying shift: ${error.message}`);
    }
  }

  async update(id: string, updateShiftInput: UpdateShiftInput): Promise<Shift> {
    try {
      const existingShift = await this.findById(id);
      if (!existingShift) {
        throw new NotFoundException('Shift not found');
      }

      // If changing the user, verify that it exists
      if (updateShiftInput.userId) {
        const user = await this.prisma.usuario.findUnique({
          where: { id: updateShiftInput.userId },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }
      }

      const updateData: any = {};

      if (updateShiftInput.startDate) {
        updateData.fechaInicio = new Date(updateShiftInput.startDate);
      }

      if (updateShiftInput.endDate) {
        updateData.fechaFin = new Date(updateShiftInput.endDate);
      }

      if (updateShiftInput.startTime) {
        updateData.horaInicio = updateShiftInput.startTime;
      }

      if (updateShiftInput.endTime) {
        updateData.horaFin = updateShiftInput.endTime;
      }

      if (updateShiftInput.observations !== undefined) {
        updateData.observaciones = updateShiftInput.observations;
      }

      if (updateShiftInput.userId) {
        updateData.usuarioId = updateShiftInput.userId;
      }

      if (updateShiftInput.active !== undefined) {
        updateData.activo = updateShiftInput.active;
      }

      const shift = await this.prisma.turno.update({
        where: { id },
        data: updateData,
        include: {
          usuario: true,
        },
      });

      return this.formatShift(shift);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Error updating shift: ${error.message}`);
    }
  }

  async remove(id: string): Promise<Shift> {
    try {
      const existingShift = await this.findById(id);
      if (!existingShift) {
        throw new NotFoundException('Shift not found');
      }

      // Verify if there are associated shift closures
      /* 
      const closuresCount = await this.prisma.cierreTurno.count({
        where: { turnoId: id },
      });

      if (closuresCount > 0) {
        throw new ConflictException('Cannot delete shift because it has associated closures');
      }
      */

      const shift = await this.prisma.turno.delete({
        where: { id },
        include: {
          usuario: true,
        },
      });

      return this.formatShift(shift);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Error deleting shift: ${error.message}`);
    }
  }

  async getActiveShifts() {
    try {
      const activeShifts = await this.prisma.turno.findMany({
        where: {
          activo: true,
          fechaFin: null, // Shifts without end date are considered active
        },
        include: {
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              username: true,
            },
          },
        },
        orderBy: { fechaInicio: 'desc' },
      });

      return {
        activeShifts: activeShifts.length,
        shifts: activeShifts.map(shift => this.formatShift(shift)),
      };
    } catch (error) {
      throw new Error(`Error querying active shifts: ${error.message}`);
    }
  }

  async closeShift(id: string): Promise<Shift> {
    try {
      const shift = await this.update(id, {
        endDate: new Date().toISOString(),
        active: false,
      });

      return shift;
    } catch (error) {
      throw new Error(`Error closing shift: ${error.message}`);
    }
  }

  async getShiftsByUser(userId: string) {
    try {
      const shifts = await this.prisma.turno.findMany({
        where: { usuarioId: userId },
        include: {
          usuario: true,
        },
        orderBy: { fechaInicio: 'desc' },
      });

      return shifts.map(shift => this.formatShift(shift));
    } catch (error) {
      throw new Error(`Error querying user shifts: ${error.message}`);
    }
  }
} 