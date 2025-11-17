import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

// Módulos de la aplicación
import { PrismaModule } from './config/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompanyModule } from './modules/company/company.module';
import { PointOfSaleModule } from './modules/point-of-sale/point-of-sale.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ExpensesModule } from './modules/expenses/expenses.module';

@Module({
  imports: [
    // Configuración global
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // GraphQL Configuration
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: process.env.NODE_ENV === 'development',
      introspection: true,
      context: ({ req }) => ({ req }),
    }),

    // Database
    PrismaModule,

    // Módulos de funcionalidad
    AuthModule,
    UsersModule,
    CompanyModule,
    PointOfSaleModule,
    InventoryModule,
    SalesModule,
    ClientsModule,
    ShiftsModule,
    ReportsModule,
    ExpensesModule,
  ],
})
export class AppModule {} 