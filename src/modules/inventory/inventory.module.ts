import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryResolver } from './inventory.resolver';
import { ProductsService } from './products.service';
import { ProductsResolver } from './products.resolver';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { SurtidoresService } from './surtidores.service';
import { SurtidoresResolver } from './surtidores.resolver';
import { TanquesService } from './tanques.service';
import { TanquesResolver } from './tanques.resolver';
import { CarrotanquesService } from './carrotanques.service';
import { CarrotanquesResolver } from './carrotanques.resolver';

// Nuevos servicios para el sistema de ventas de productos
import { MetodosPagoService } from './services/metodos-pago.service';
import { HistorialVentasService } from './services/historial-ventas.service';
import { ProcessShiftResolver } from './process-shift.resolver';
import { ProcessShiftService } from './services/process-shift.service';

@Module({
  providers: [
    InventoryService,
    InventoryResolver,
    ProductsService,
    ProductsResolver,
    CategoriesService,
    CategoriesResolver,
    SurtidoresService,
    SurtidoresResolver,
    TanquesService,
    TanquesResolver,
    CarrotanquesService,
    CarrotanquesResolver,
    // Nuevos servicios
    MetodosPagoService,
    HistorialVentasService,
    ProcessShiftService,
    ProcessShiftResolver,
  ],
  exports: [
    InventoryService, 
    ProductsService, 
    CategoriesService, 
    SurtidoresService, 
    TanquesService, 
    CarrotanquesService,
    // Exportar nuevos servicios
    MetodosPagoService,
    HistorialVentasService,
  ],
})
export class InventoryModule {} 