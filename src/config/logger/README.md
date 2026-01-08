# Sistema de Logging con Pino

Este módulo implementa un sistema de logging global usando Pino, que intercepta y reemplaza todas las llamadas a `console.log`, `console.warn` y `console.error` en toda la aplicación.

## Características

- ✅ Logger global configurado con Pino
- ✅ Intercepta automáticamente `console.log`, `console.warn`, `console.error`, `console.info` y `console.debug`
- ✅ Logs estructurados en formato JSON (producción) o formato legible (desarrollo)
- ✅ Configuración por entorno (desarrollo/producción)
- ✅ Niveles de log configurables: `debug`, `info`, `warn`, `error`, `fatal`
- ✅ Integración automática con NestJS

## Configuración

### Variables de Entorno

```env
# Nivel de logging (debug, info, warn, error, fatal)
LOG_LEVEL=info

# Entorno (development, production)
NODE_ENV=development
```

### Niveles de Log

- `debug`: Información detallada para debugging
- `info`: Información general de la aplicación
- `warn`: Advertencias que no detienen la ejecución
- `error`: Errores que requieren atención
- `fatal`: Errores críticos que pueden detener la aplicación

## Uso

### Uso Automático (Recomendado)

Simplemente usa `console.log`, `console.warn`, `console.error` como siempre. El sistema los intercepta automáticamente y los redirige a Pino:

```typescript
console.log('Mensaje informativo');
console.warn('Advertencia');
console.error('Error', error);
```

### Uso Directo del Logger (Opcional)

Si necesitas más control, puedes inyectar el `Logger` de NestJS:

```typescript
import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Injectable()
export class MyService {
  constructor(private readonly logger: Logger) {}

  someMethod() {
    this.logger.log('Mensaje informativo', 'MyService');
    this.logger.warn('Advertencia', 'MyService');
    this.logger.error('Error', error.stack, 'MyService');
    this.logger.debug('Debug info', 'MyService');
    this.logger.fatal('Error fatal', 'MyService');
  }
}
```

### LoggerService (Wrapper)

También puedes usar el `LoggerService` que implementa la interfaz estándar de NestJS:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '../config/logger/logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: LoggerService) {}

  someMethod() {
    this.logger.log('Mensaje', 'MyService');
    this.logger.warn('Advertencia', 'MyService');
    this.logger.error('Error', 'stack trace', 'MyService');
  }
}
```

## Formato de Logs

### Desarrollo
En desarrollo, los logs se muestran en formato legible con colores:
```
[2024-01-07 10:30:45] INFO: Mensaje informativo
[2024-01-07 10:30:46] WARN: Advertencia
[2024-01-07 10:30:47] ERROR: Error message
```

### Producción
En producción, los logs se generan en formato JSON estructurado:
```json
{"level":30,"time":1704625845000,"msg":"Mensaje informativo"}
{"level":40,"time":1704625846000,"msg":"Advertencia"}
{"level":50,"time":1704625847000,"msg":"Error message","err":{"type":"Error","message":"..."}}
```

## Configuración Avanzada

La configuración se encuentra en `src/config/logger/logger.module.ts`. Puedes personalizar:

- Nivel de logging por entorno
- Formato de salida
- Serialización de requests/responses
- Filtrado de rutas (ej: `/health`, `/graphql`)

## Notas

- Los logs de Prisma también se redirigen automáticamente a Pino
- Las rutas `/health` y `/graphql` están excluidas del auto-logging de HTTP para reducir ruido
- Los errores HTTP (4xx, 5xx) se registran automáticamente con el nivel apropiado

