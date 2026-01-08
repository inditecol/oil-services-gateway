import { Logger } from 'nestjs-pino';

/**
 * Intercepta las llamadas a console.log, console.warn y console.error
 * y las redirige a Pino Logger
 */
export function setupConsoleInterceptor(logger: Logger) {
  // Guardar las funciones originales
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Interceptar console.log -> Logger log (que internamente usa info en Pino)
  console.log = (...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
    logger.log(message);
  };

  // Interceptar console.info -> Logger log (que internamente usa info en Pino)
  console.info = (...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
    logger.log(message);
  };

  // Interceptar console.warn -> Logger warn
  console.warn = (...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
    logger.warn(message);
  };

  // Interceptar console.error -> Logger error
  console.error = (...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
    
    // Si el último argumento es un Error, incluir el stack trace
    const lastArg = args[args.length - 1];
    if (lastArg instanceof Error) {
      logger.error(message, lastArg.stack);
    } else {
      logger.error(message);
    }
  };

  // Interceptar console.debug -> Logger debug
  console.debug = (...args: any[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
    logger.debug(message);
  };

  // Retornar función para restaurar los métodos originales si es necesario
  return {
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
      console.debug = originalDebug;
    },
  };
}

