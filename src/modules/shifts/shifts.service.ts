import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateShiftInput } from './dto/create-shift.input';
import { UpdateShiftInput } from './dto/update-shift.input';
import { UpdateTurnoInput } from './dto/update-turno-legacy.input';
import { Shift } from './entities/shift.entity';
import { DateUtilsService } from './services/date-utils.service';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateUtils: DateUtilsService
  ) {}

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
    const fechaInicio = new Date(createShiftInput.startDate);
    const fechaInicioSolo = this.dateUtils.extractDateOnly(fechaInicio);
    const horaInicio = createShiftInput.startTime;
    const horaFin = createShiftInput.endTime || null;

    const fechaInicioInicio = new Date(fechaInicio);
    fechaInicioInicio.setUTCHours(0, 0, 0, 0);
    const fechaInicioFin = new Date(fechaInicio);
    fechaInicioFin.setUTCHours(23, 59, 59, 999);
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
    const fechaInicio = new Date(startTimeISO);
    const fechaFin = new Date(finishTimeISO);
    const fechaInicioSolo = this.dateUtils.extractDateOnly(fechaInicio);
    const horaInicio = this.dateUtils.extractHourInHHmmFormat(startTimeISO);
    const horaFin = this.dateUtils.extractHourInHHmmFormat(finishTimeISO);
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

    const shift = await this.prisma.turno.create({
      data: {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        horaInicio: horaInicio,
        horaFin: horaFin,
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

      if (updateShiftInput.userId) {
        const user = await this.prisma.usuario.findUnique({
          where: { id: updateShiftInput.userId },
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        if (!user.activo) {
          throw new NotFoundException('User is not active');
        }
      }

      const updates: string[] = [];
      const escapedId = id.replace(/'/g, "''");

      if (updateShiftInput.startDate) {
        const dateMatch = updateShiftInput.startDate.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?/);
        if (!dateMatch) {
          throw new BadRequestException('Formato de startDate inválido. Se espera "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff"');
        }
        const escapedDate = updateShiftInput.startDate.replace(/'/g, "''");
        const hasMilliseconds = updateShiftInput.startDate.includes('.');
        const timestampFormat = hasMilliseconds ? 'YYYY-MM-DD HH24:MI:SS.FF3' : 'YYYY-MM-DD HH24:MI:SS';
        updates.push(`"fechaInicio" = to_timestamp('${escapedDate}', '${timestampFormat}')`);
      }

      if (updateShiftInput.endDate) {
        const dateMatch = updateShiftInput.endDate.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?/);
        if (!dateMatch) {
          throw new BadRequestException('Formato de endDate inválido. Se espera "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff"');
        }
        const escapedDate = updateShiftInput.endDate.replace(/'/g, "''");
        const hasMilliseconds = updateShiftInput.endDate.includes('.');
        const timestampFormat = hasMilliseconds ? 'YYYY-MM-DD HH24:MI:SS.FF3' : 'YYYY-MM-DD HH24:MI:SS';
        updates.push(`"fechaFin" = to_timestamp('${escapedDate}', '${timestampFormat}')`);
      }

      if (updateShiftInput.startTime !== undefined) {
        const escapedTime = updateShiftInput.startTime.replace(/'/g, "''");
        updates.push(`"horaInicio" = '${escapedTime}'`);
      }

      if (updateShiftInput.endTime !== undefined) {
        if (updateShiftInput.endTime) {
          const escapedTime = updateShiftInput.endTime.replace(/'/g, "''");
          updates.push(`"horaFin" = '${escapedTime}'`);
        } else {
          updates.push(`"horaFin" = NULL`);
        }
      }
      if (updateShiftInput.observations !== undefined) {
        const escapedObs = (updateShiftInput.observations || '').replace(/'/g, "''");
        updates.push(`"observaciones" = ${updateShiftInput.observations === null ? 'NULL' : `'${escapedObs}'`}`);
      }

      if (updateShiftInput.userId) {
        const escapedUserId = updateShiftInput.userId.replace(/'/g, "''");
        updates.push(`"usuarioId" = '${escapedUserId}'`);
      }

      if (updateShiftInput.active !== undefined) {
        updates.push(`"activo" = ${updateShiftInput.active}`);
      }

      if (updates.length > 0) {
        const setClause = updates.join(', ');
        const sqlQuery = `UPDATE turnos.turnos SET ${setClause} WHERE id = '${escapedId}'`;
        await this.prisma.$executeRawUnsafe(sqlQuery);
      }

      const shiftRaw = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT 
          t.*,
          to_char(t."fechaInicio", 'YYYY-MM-DD HH24:MI:SS.FF3') as "fechaInicioStr",
          to_char(t."fechaFin", 'YYYY-MM-DD HH24:MI:SS.FF3') as "fechaFinStr"
        FROM turnos.turnos t 
        WHERE t.id = '${escapedId}'`
      );

      if (!shiftRaw || shiftRaw.length === 0) {
        throw new NotFoundException('Shift not found after update');
      }

      const shiftData = shiftRaw[0];
      
      let usuario = null;
      if (shiftData.usuarioId) {
        const usuarios = await this.prisma.usuario.findMany({
          where: { id: shiftData.usuarioId },
        });
        usuario = usuarios.length > 0 ? usuarios[0] : null;
      }
      const shift = {
        ...shiftData,
        fechaInicio: shiftData.fechaInicioStr ? this.dateUtils.parseDateFromString(shiftData.fechaInicioStr) : shiftData.fechaInicio,
        fechaFin: shiftData.fechaFinStr ? this.dateUtils.parseDateFromString(shiftData.fechaFinStr) : (shiftData.fechaFin || null),
        usuario: usuario
      };

      return this.formatShift(shift);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new Error(`Error updating shift: ${error.message}`);
    }
  }

  async updateFromLegacyInput(id: string, updateTurnoInput: UpdateTurnoInput): Promise<Shift> {
    let startDate: string | undefined;
    if (updateTurnoInput.fechaInicio) {
      startDate = this.dateUtils.combineDateAndTime(updateTurnoInput.fechaInicio, updateTurnoInput.horaInicio);
    }

    let endDate: string | undefined;
    if (updateTurnoInput.fechaFin) {
      endDate = this.dateUtils.combineDateAndTime(updateTurnoInput.fechaFin, updateTurnoInput.horaFin);
    }

    return this.update(id, {
      startDate,
      endDate,
      observations: updateTurnoInput.observaciones,
      userId: updateTurnoInput.usuarioId,
      active: updateTurnoInput.activo,
    });
  }

  async remove(id: string): Promise<Shift> {
    try {
      const existingShift = await this.findById(id);
      if (!existingShift) {
        throw new NotFoundException('Shift not found');
      }


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
          fechaFin: null,
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