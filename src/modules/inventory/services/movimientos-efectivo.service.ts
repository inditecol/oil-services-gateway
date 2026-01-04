import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { FiltrosMovimientosEfectivoInput } from '../dto/shift-closure.input';
import { MovimientoEfectivo, MovimientosEfectivoResponse } from '../entities/shift-closure.entity';

@Injectable()
export class MovimientosEfectivoService {
  constructor(private prisma: PrismaService) {}

  async obtenerMovimientosEfectivo(
    filtros: FiltrosMovimientosEfectivoInput,
    empresaId?: string
  ): Promise<MovimientosEfectivoResponse> {
    console.log('[MOVIMIENTOS_EFECTIVO] ========== INICIO obtenerMovimientosEfectivo ==========');
    console.log('[MOVIMIENTOS_EFECTIVO] Filtros recibidos:', JSON.stringify(filtros, null, 2));
    console.log('[MOVIMIENTOS_EFECTIVO] fechaDesde (raw):', filtros.fechaDesde, 'tipo:', typeof filtros.fechaDesde);
    console.log('[MOVIMIENTOS_EFECTIVO] fechaHasta (raw):', filtros.fechaHasta, 'tipo:', typeof filtros.fechaHasta);
    
    // Construir condiciones para la consulta SQL
    const conditions: string[] = [];
    
    // Filtrar por fechaInicio y fechaFin del TURNO (no por fecha del movimiento ni fechaCierre)
    // El frontend envía fecha inicio (ej: 01/09/2025 12:00 AM = 00:00:00) y fecha fin (ej: 01/09/2025 11:59 PM = 23:59:59)
    // Se deben mostrar todos los movimientos de turnos que se solapen con ese rango
    // Un turno se solapa si: fechaInicio <= fechaHasta AND (fechaFin IS NULL OR fechaFin >= fechaDesde)
    // Y también por hora: horaInicio < horaHasta AND (horaFin IS NULL OR horaFin > horaDesde)
    
    // Función auxiliar para extraer hora en formato HH:mm
    const extraerHoraHHmm = (dateInput: Date | string): string => {
      const date = new Date(dateInput);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    };
    
    if (filtros.fechaDesde && filtros.fechaHasta) {
      const fechaDesdeDate = new Date(filtros.fechaDesde);
      const fechaHastaDate = new Date(filtros.fechaHasta);
      const fechaDesdeISO = fechaDesdeDate.toISOString();
      const fechaHastaISO = fechaHastaDate.toISOString();
      
      // Extraer horas del rango
      const horaDesde = extraerHoraHHmm(filtros.fechaDesde);
      const horaHasta = extraerHoraHHmm(filtros.fechaHasta);
      
      console.log('[MOVIMIENTOS_EFECTIVO] Fechas procesadas:');
      console.log('[MOVIMIENTOS_EFECTIVO]   - fechaDesdeDate:', fechaDesdeDate);
      console.log('[MOVIMIENTOS_EFECTIVO]   - fechaDesdeISO:', fechaDesdeISO);
      console.log('[MOVIMIENTOS_EFECTIVO]   - fechaHastaDate:', fechaHastaDate);
      console.log('[MOVIMIENTOS_EFECTIVO]   - fechaHastaISO:', fechaHastaISO);
      console.log('[MOVIMIENTOS_EFECTIVO]   - horaDesde:', horaDesde);
      console.log('[MOVIMIENTOS_EFECTIVO]   - horaHasta:', horaHasta);
      
      // Un turno se solapa con el rango si:
      // - El turno inicia antes o igual al final del rango (t."fechaInicio" <= fechaHasta)
      // - Y el turno termina después o igual al inicio del rango (t."fechaFin" >= fechaDesde o es NULL)
      conditions.push(`t."fechaInicio" <= '${fechaHastaISO}'::timestamp`);
      conditions.push(`(t."fechaFin" IS NULL OR t."fechaFin" >= '${fechaDesdeISO}'::timestamp)`);
      
      // Filtrar por hora (horaInicio y horaFin del turno)
      // Lógica de solapamiento: horaInicio < horaHasta AND (horaFin IS NULL OR horaFin > horaDesde)
      if (horaDesde && horaHasta) {
        if (horaDesde === horaHasta) {
          // Rango de un solo punto: incluir turnos que contengan ese punto
          conditions.push(`(
            t."horaInicio" <= '${horaHasta}' 
            AND (t."horaFin" IS NULL OR t."horaFin" >= '${horaDesde}')
          )`);
          console.log('[MOVIMIENTOS_EFECTIVO] Filtrando por rango de fechas Y HORAS del turno (rango de un punto: ' + horaDesde + ')');
        } else {
          // Rango normal: usar solapamiento estricto (excluir límites)
          // IMPORTANTE: Si horaFin es NULL, el turno está activo y termina al final del día
          // Para que se solape, debe cumplir: horaInicio < horaHasta
          // Y si tiene horaFin, debe cumplir: horaFin > horaDesde
          conditions.push(`(
            t."horaInicio" < '${horaHasta}' 
            AND (
              t."horaFin" IS NULL 
              OR t."horaFin" > '${horaDesde}'
            )
          )`);
          console.log('[MOVIMIENTOS_EFECTIVO] Filtrando por rango de fechas Y HORAS del turno (solapamiento estricto)');
          console.log('[MOVIMIENTOS_EFECTIVO]   - Condición: horaInicio < ' + horaHasta + ' AND (horaFin IS NULL OR horaFin > ' + horaDesde + ')');
        }
        console.log('[MOVIMIENTOS_EFECTIVO]   - horaDesde: ' + horaDesde + ', horaHasta: ' + horaHasta);
      }
    } else {
      // Si solo hay una fecha, aplicar filtros individuales
      if (filtros.fechaDesde) {
        const fechaDesdeDate = new Date(filtros.fechaDesde);
        const fechaDesdeISO = fechaDesdeDate.toISOString();
        const horaDesde = extraerHoraHHmm(filtros.fechaDesde);
        // El turno debe terminar después o igual a fechaDesde (o no tener fechaFin)
        conditions.push(`(t."fechaFin" IS NULL OR t."fechaFin" >= '${fechaDesdeISO}'::timestamp)`);
        if (horaDesde) {
          conditions.push(`(t."horaFin" IS NULL OR t."horaFin" >= '${horaDesde}')`);
        }
      }
      
      if (filtros.fechaHasta) {
        const fechaHastaDate = new Date(filtros.fechaHasta);
        const fechaHastaISO = fechaHastaDate.toISOString();
        const horaHasta = extraerHoraHHmm(filtros.fechaHasta);
        // El turno debe iniciar antes o igual a fechaHasta
        conditions.push(`t."fechaInicio" <= '${fechaHastaISO}'::timestamp`);
        if (horaHasta) {
          conditions.push(`t."horaInicio" <= '${horaHasta}'`);
        }
      }
    }

    // Filtrar por punto de venta
    if (filtros.puntoVentaId) {
      conditions.push(`t."puntoVentaId" = '${filtros.puntoVentaId.replace(/'/g, "''")}'`);
    }

    // Filtrar por empresa
    if (empresaId) {
      conditions.push(`EXISTS (SELECT 1 FROM configuracion.puntos_venta pv WHERE pv.id = t."puntoVentaId" AND pv."empresaId" = '${empresaId.replace(/'/g, "''")}')`);
    }

    // Filtrar por tipo
    if (filtros.tipo) {
      conditions.push(`m.tipo = '${filtros.tipo.replace(/'/g, "''")}'`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Construir query SQL
    const querySQL = `
      SELECT m.id
      FROM turnos.movimientos_efectivo m
      INNER JOIN turnos.cierres_turno c ON m."cierreTurnoId" = c.id
      INNER JOIN turnos.turnos t ON c."turnoId" = t.id
      ${whereClause}
    `;

    console.log('[MOVIMIENTOS_EFECTIVO] Query SQL generada:');
    console.log(querySQL.trim());
    console.log('[MOVIMIENTOS_EFECTIVO] Condiciones aplicadas:', conditions);

    let movimientoIds: string[] = [];

    try {
      // QUERY DE DIAGNÓSTICO: Verificar qué turnos existen
      const diagnosticoQuery = `
        SELECT 
          t.id AS turno_id,
          t."fechaInicio",
          t."fechaFin",
          t."horaInicio",
          t."horaFin",
          t."puntoVentaId",
          COUNT(c.id) AS cantidad_cierres,
          COUNT(m.id) AS cantidad_movimientos
        FROM turnos.turnos t
        LEFT JOIN turnos.cierres_turno c ON c."turnoId" = t.id
        LEFT JOIN turnos.movimientos_efectivo m ON m."cierreTurnoId" = c.id
        ${filtros.puntoVentaId ? `WHERE t."puntoVentaId" = '${filtros.puntoVentaId.replace(/'/g, "''")}'` : ''}
        GROUP BY t.id, t."fechaInicio", t."fechaFin", t."horaInicio", t."horaFin", t."puntoVentaId"
        ORDER BY t."fechaInicio" DESC
        LIMIT 10
      `;
      
      const turnosDiagnostico: any[] = await this.prisma.$queryRawUnsafe(diagnosticoQuery);
      console.log('[MOVIMIENTOS_EFECTIVO] ========== DIAGNÓSTICO DE TURNOS ==========');
      console.log('[MOVIMIENTOS_EFECTIVO] Turnos encontrados para el punto de venta:', turnosDiagnostico.length);
      if (turnosDiagnostico.length > 0) {
        turnosDiagnostico.forEach((t, idx) => {
          console.log(`[MOVIMIENTOS_EFECTIVO] Turno ${idx + 1}:`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - ID: ${t.turno_id}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - fechaInicio: ${t.fechaInicio}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - fechaFin: ${t.fechaFin || 'NULL'}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - horaInicio: ${t.horaInicio}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - horaFin: ${t.horaFin || 'NULL'}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - cantidad_cierres: ${t.cantidad_cierres}`);
          console.log(`[MOVIMIENTOS_EFECTIVO]   - cantidad_movimientos: ${t.cantidad_movimientos}`);
          
          // Verificar si se solapa con el rango
          if (filtros.fechaDesde && filtros.fechaHasta) {
            const fechaInicioTurno = new Date(t.fechaInicio);
            const fechaFinTurno = t.fechaFin ? new Date(t.fechaFin) : null;
            const fechaDesde = new Date(filtros.fechaDesde);
            const fechaHasta = new Date(filtros.fechaHasta);
            const seSolapa = fechaInicioTurno <= fechaHasta && 
                             (fechaFinTurno === null || fechaFinTurno >= fechaDesde);
            console.log(`[MOVIMIENTOS_EFECTIVO]   - ¿Se solapa con el rango? ${seSolapa ? 'SÍ' : 'NO'}`);
            if (!seSolapa) {
              console.log(`[MOVIMIENTOS_EFECTIVO]     Razón: fechaInicio (${fechaInicioTurno.toISOString()}) <= fechaHasta (${fechaHasta.toISOString()}) = ${fechaInicioTurno <= fechaHasta}`);
              console.log(`[MOVIMIENTOS_EFECTIVO]     Razón: fechaFin (${fechaFinTurno?.toISOString() || 'NULL'}) >= fechaDesde (${fechaDesde.toISOString()}) = ${fechaFinTurno === null || fechaFinTurno >= fechaDesde}`);
            }
          }
        });
      } else {
        console.log('[MOVIMIENTOS_EFECTIVO] ⚠️ No se encontraron turnos para este punto de venta');
      }
      console.log('[MOVIMIENTOS_EFECTIVO] ==========================================');
      
      const movimientosIdsRaw: any[] = await this.prisma.$queryRawUnsafe(querySQL.trim());
      movimientoIds = movimientosIdsRaw.map((m: any) => m.id);
      console.log('[MOVIMIENTOS_EFECTIVO] IDs de movimientos encontrados:', movimientoIds.length);
      if (movimientoIds.length > 0) {
        console.log('[MOVIMIENTOS_EFECTIVO] Primeros 5 IDs:', movimientoIds.slice(0, 5));
      } else {
        console.log('[MOVIMIENTOS_EFECTIVO] ⚠️ No se encontraron movimientos con el filtro aplicado');
      }
    } catch (error) {
      console.error('[MOVIMIENTOS_EFECTIVO] Error ejecutando query SQL:', error);
      throw error;
    }

    // Si no hay movimientos, retornar respuesta vacía con totales en 0
    if (movimientoIds.length === 0) {
      return {
        totalIngresos: 0,
        totalEgresos: 0,
        movimientos: [],
      };
    }

    // Obtener movimientos con relaciones usando los IDs encontrados
    const movimientos = await this.prisma.movimientoEfectivo.findMany({
      where: {
        id: { in: movimientoIds },
      },
      include: {
        cierreTurno: {
          include: {
            usuario: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha: 'asc',
      },
    });

    // Calcular totales y mapear a la respuesta
    let totalIngresos = 0;
    let totalEgresos = 0;

    const movimientosResponse: MovimientoEfectivo[] = movimientos.map((movimiento) => {
      // Obtener nombre completo del usuario
      const nombreResponsable = movimiento.cierreTurno.usuario
        ? `${movimiento.cierreTurno.usuario.nombre} ${movimiento.cierreTurno.usuario.apellido}`.trim()
        : 'Usuario no disponible';

      const monto = Number(movimiento.monto);

      // Acumular totales
      if (movimiento.tipo === 'INGRESO') {
        totalIngresos += monto;
      } else if (movimiento.tipo === 'EGRESO') {

        totalEgresos += monto;
      }

      return {
        id: movimiento.id,
        tipo: movimiento.tipo,
        monto,
        concepto: movimiento.concepto,
        detalle: movimiento.detalle || null,
        observaciones: movimiento.observaciones || null,
        fecha: movimiento.fecha,
        nombreResponsable,
      };
    });

    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalEgresos: Math.round(totalEgresos * 100) / 100,
      movimientos: movimientosResponse,
    };
  }
}
