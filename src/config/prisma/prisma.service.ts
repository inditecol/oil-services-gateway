import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly logger: Logger) {
    super({
      log: ['query', 'info', 'warn', 'error'],
      transactionOptions: {
        timeout: 60000 * 10, // 60 segundos para debugging (default es 5000ms)
        maxWait: 10000, // Máximo tiempo de espera para obtener una conexión
        isolationLevel: 'ReadCommitted', // Nivel de aislamiento
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Base de datos conectada correctamente', 'PrismaService');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('❌ Desconectado de la base de datos', 'PrismaService');
  }

  // Método para limpiar la base de datos (útil para testing)
  async cleanDatabase() {
    const models = Reflect.ownKeys(this).filter(key => key[0] !== '_');

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (typeof model === 'object' && model !== null && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }

  // Método para obtener estadísticas de la base de datos
  async getDatabaseStats() {
    const [
      usuariosCount,
      productosCount,
      ventasCount,
      clientesCount,
    ] = await Promise.all([
      this.usuario.count(),
      this.producto.count(),
      this.venta.count(),
      this.cliente.count(),
    ]);

    return {
      usuarios: usuariosCount,
      productos: productosCount,
      ventas: ventasCount,
      clientes: clientesCount,
    };
  }
} 