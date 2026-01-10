import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';

export enum TipoModificacionTurno {
  INFORMACION_GENERAL = 'INFORMACION_GENERAL',
  LECTURA_MANGUERA = 'LECTURA_MANGUERA',
  PRODUCTO_VENDIDO = 'PRODUCTO_VENDIDO',
  METODO_PAGO = 'METODO_PAGO',
  MOVIMIENTO_EFECTIVO = 'MOVIMIENTO_EFECTIVO',
}

@Injectable()
export class AuditoriaTurnoService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registra un cambio en el historial de auditoría de un turno
   * @param turnoId ID del turno modificado
   * @param usuarioId ID del usuario que hizo el cambio
   * @param tipoModificacion Tipo de modificación
   * @param datosAnteriores Estado anterior (objeto)
   * @param datosNuevos Estado nuevo (objeto)
   * @param descripcion Descripción opcional del cambio
   * @param prismaTransaction Cliente Prisma opcional para usar en transacciones
   */
  async registrarCambio(
    turnoId: string,
    usuarioId: string,
    tipoModificacion: TipoModificacionTurno,
    datosAnteriores: any,
    datosNuevos: any,
    descripcion?: string,
    prismaTransaction?: any
  ): Promise<void> {
    const prisma = prismaTransaction || this.prisma;

    try {
      console.log(`[AUDITORIA] Registrando cambio - turnoId: ${turnoId}, usuarioId: ${usuarioId}, tipo: ${tipoModificacion}`);
      
      const registro = await prisma.historialCambioTurno.create({
        data: {
          turnoId,
          usuarioId,
          tipoModificacion: tipoModificacion as any,
          datosAnteriores: datosAnteriores as any,
          datosNuevos: datosNuevos as any,
          descripcion: descripcion || null,
        },
      });
      
      console.log(`[AUDITORIA] Registro creado exitosamente - ID: ${registro.id}`);
    } catch (error) {
      console.error('[AUDITORIA] Error al registrar cambio:', error);
      console.error('[AUDITORIA] Detalles del error:', {
        turnoId,
        usuarioId,
        tipoModificacion,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      // No lanzar error para no interrumpir el flujo principal
      // Solo loguear el error
    }
  }

  /**
   * Obtiene el listado paginado de cambios de un turno
   * @param turnoId ID del turno
   * @param page Página actual
   * @param limit Límite de registros por página
   */
  async obtenerLecturasCambioTurno(
    turnoId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    lecturas: any[];
    total: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      console.log(`[AUDITORIA] Obteniendo lecturas para turnoId: ${turnoId}, page: ${page}, limit: ${limit}`);
      
      const skip = (page - 1) * limit;

      // Contar total de registros
      const total = await this.prisma.historialCambioTurno.count({
        where: { turnoId },
      });

      console.log(`[AUDITORIA] Total de registros encontrados: ${total}`);

      // Obtener registros paginados
      const registros = await this.prisma.historialCambioTurno.findMany({
        where: { turnoId },
        skip,
        take: limit,
        orderBy: {
          fechaModificacion: 'desc',
        },
        select: {
          id: true,
          turnoId: true,
          usuarioId: true,
          fechaModificacion: true,
          tipoModificacion: true,
          descripcion: true,
          createdAt: true,
          // No incluir datosAnteriores y datosNuevos en el listado para optimizar
          usuario: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              username: true,
            },
          },
        },
      });

      console.log(`[AUDITORIA] Registros obtenidos: ${registros.length}`);

      const totalPages = Math.ceil(total / limit);

      const resultado = {
        lecturas: registros.map((registro) => ({
          ...registro,
          datosAnteriores: '', // Vacío en listado
          datosNuevos: '', // Vacío en listado
        })),
        total,
        totalPages,
        currentPage: page,
      };

      return resultado;
    } catch (error) {
      console.error('[AUDITORIA] Error al obtener lecturas:', error);
      throw error;
    }
  }

  /**
   * Obtiene el detalle completo de un cambio específico
   * @param lecturaId ID del registro de auditoría
   */
  async obtenerDetalleLecturaCambio(lecturaId: string): Promise<any> {
    const registro = await this.prisma.historialCambioTurno.findUnique({
      where: { id: lecturaId },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!registro) {
      throw new NotFoundException(`Registro de auditoría con ID ${lecturaId} no encontrado`);
    }

    return {
      id: registro.id,
      turnoId: registro.turnoId,
      usuarioId: registro.usuarioId,
      fechaModificacion: registro.fechaModificacion,
      tipoModificacion: registro.tipoModificacion,
      datosAnteriores: JSON.stringify(registro.datosAnteriores),
      datosNuevos: JSON.stringify(registro.datosNuevos),
      descripcion: registro.descripcion,
      createdAt: registro.createdAt,
      usuario: registro.usuario,
    };
  }
}
