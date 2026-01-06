import { Injectable } from '@nestjs/common';

@Injectable()
export class DateUtilsService {
  /**
   * Extrae la hora en formato HH:mm de un string ISO
   * @param isoString - String ISO (ej: "2025-09-01T06:00:00.000Z")
   * @returns String en formato HH:mm (ej: "06:00")
   */
  extractHourInHHmmFormat(isoString: string): string {
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
  extractDateOnly(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toISOString().split('T')[0];
  }

  /**
   * Parsea un string de fecha en formato "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff" a Date sin conversiones de zona horaria
   * @param dateString - String en formato "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff"
   * @returns Date con la hora exacta como hora local (incluyendo milisegundos si están presentes)
   */
  parseDateFromString(dateString: string): Date {
    const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?/);
    if (!match) {
      return new Date(dateString);
    }
    
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    const seconds = parseInt(match[6], 10);
    const milliseconds = match[7] ? parseInt(match[7].substring(1).padEnd(3, '0'), 10) : 0;
    
    return new Date(year, month, day, hours, minutes, seconds, milliseconds);
  }

  /**
   * Combina una fecha ISO con una hora en formato HH:mm para crear un string "YYYY-MM-DD HH:mm:00"
   * @param fechaISO - String ISO de fecha (ej: "2025-12-03T00:00:00.000Z")
   * @param hora - String en formato HH:mm (ej: "06:00")
   * @returns String en formato "YYYY-MM-DD HH:mm:00"
   */
  combineDateAndTime(fechaISO: string, hora?: string): string {
    const fechaOnly = fechaISO.split('T')[0];
    const horaFinal = hora || '00:00';
    return `${fechaOnly} ${horaFinal}:00`;
  }
}

