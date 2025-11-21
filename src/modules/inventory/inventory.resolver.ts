import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { InventoryService } from './inventory.service';
import { InventoryEntryInput } from './dto/inventory-entry.input';
import { InventoryProcessInput } from './dto/inventory-process.input';
import { InventoryEntryResponse } from './entities/inventory-entry.entity';
import { InventoryProcessResponse, InventoryProcessResult } from './dto/inventory-process.response';

@Resolver()
@UseGuards(JwtAuthGuard)
export class InventoryResolver {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * PROCESAR ENTRADA DE INVENTARIO (MÉTODO PRINCIPAL)
   * Registra ingresos de productos, combustibles y descargas de carrotanques
   */
  @Mutation(() => InventoryEntryResponse)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'employee')
  async processInventoryEntry(
    @Args('inventoryEntryInput') inventoryEntryInput: InventoryEntryInput,
    @CurrentUser() user: any,
  ): Promise<InventoryEntryResponse> {
    return this.inventoryService.processInventoryEntry(inventoryEntryInput);
  }

  /**
   * PROCESAR ENTRADA DE INVENTARIO (NUEVA ESTRUCTURA NORMALIZADA)
   * Registra procesos de entrada con movimientos separados
   */
  @Mutation(() => InventoryProcessResponse)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'employee')
  async processInventoryProcess(
    @Args('inventoryProcessInput') inventoryProcessInput: InventoryProcessInput,
    @CurrentUser() user: any,
  ): Promise<InventoryProcessResponse> {
    return this.inventoryService.processInventoryProcess(inventoryProcessInput, user);
  }

  /**
   * OBTENER PROCESO DE INVENTARIO POR ID
   */
  @Query(() => InventoryProcessResult, { nullable: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'viewer')
  async getInventoryProcess(
    @Args('procesoId') procesoId: string,
  ): Promise<InventoryProcessResult | null> {
    return this.inventoryService.getInventoryProcess(procesoId);
  }

  /**
   * LISTAR PROCESOS DE INVENTARIO
   */
  @Query(() => [InventoryProcessResult])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager', 'operator', 'viewer')
  async listInventoryProcesses(
    @Args('puntoVentaId', { nullable: true }) puntoVentaId?: string,
    @Args('estado', { nullable: true }) estado?: string,
    @Args('tipoEntrada', { nullable: true }) tipoEntrada?: string,
    @Args('fechaDesde', { nullable: true }) fechaDesde?: string,
    @Args('fechaHasta', { nullable: true }) fechaHasta?: string,
  ): Promise<InventoryProcessResult[]> {
    return this.inventoryService.listInventoryProcesses({
      puntoVentaId,
      estado,
      tipoEntrada,
      fechaDesde,
      fechaHasta,
    });
  }

  /**
   * OBTENER RESUMEN GENERAL DEL INVENTARIO
   */
  @Query(() => String, { name: 'inventoryOverview' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async getInventoryOverview(): Promise<string> {
    const overview = await this.inventoryService.getInventoryOverview();
    return JSON.stringify(overview);
  }

  /**
   * OBTENER ESTADO DE TANQUES
   */
  @Query(() => String, { name: 'tankStatus' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'employee')
  async getTankStatus(): Promise<string> {
    const tanks = await this.inventoryService.getTankStatus();
    return JSON.stringify(tanks);
  }
} 