import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Gasto } from './entities/gasto.entity';
import { CategoriaGasto } from './entities/categoria-gasto.entity';
import { BalanceUtilidades, ResumenGastos } from './entities/balance-utilidades.entity';
import { CreateGastoInput } from './dto/create-gasto.input';
import { UpdateGastoInput } from './dto/update-gasto.input';
import { FilterGastosInput } from './dto/filter-gastos.input';
import { CreateCategoriaGastoInput } from './dto/create-categoria-gasto.input';

@Resolver()
@UseGuards(JwtAuthGuard)
export class ExpensesResolver {
  constructor(private expensesService: ExpensesService) {}

  // ==========================================
  // CATEGORÍAS DE GASTOS
  // ==========================================

  @Mutation(() => CategoriaGasto)
  createCategoriaGasto(@Args('data') data: CreateCategoriaGastoInput) {
    return this.expensesService.createCategoria(data);
  }

  @Query(() => [CategoriaGasto])
  getCategoriasGasto() {
    return this.expensesService.getCategorias();
  }

  @Query(() => CategoriaGasto)
  getCategoriaGasto(@Args('id') id: string) {
    return this.expensesService.getCategoriaById(id);
  }

  // ==========================================
  // GASTOS
  // ==========================================

  @Mutation(() => Gasto)
  createGasto(@Args('data') data: CreateGastoInput) {
    return this.expensesService.createGasto(data);
  }

  @Query(() => [Gasto])
  getGastos(
    @Args('filter', { nullable: true }) filter?: FilterGastosInput,
  ) {
    return this.expensesService.getGastos(filter || {});
  }

  @Query(() => Gasto)
  getGasto(@Args('id') id: string) {
    return this.expensesService.getGastoById(id);
  }

  @Mutation(() => Gasto)
  updateGasto(
    @Args('id') id: string,
    @Args('data') data: UpdateGastoInput,
  ) {
    return this.expensesService.updateGasto(id, data);
  }

  @Mutation(() => Gasto)
  deleteGasto(@Args('id') id: string) {
    return this.expensesService.deleteGasto(id);
  }

  @Mutation(() => Gasto)
  aprobarGasto(
    @Args('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.aprobarGasto(id, user.id);
  }

  // ==========================================
  // REPORTES Y BALANCE
  // ==========================================

  @Query(() => [ResumenGastos])
  getResumenGastosPorCategoria(
    @Args('puntoVentaId') puntoVentaId: string,
    @Args('fechaInicio') fechaInicio: string,
    @Args('fechaFin') fechaFin: string,
  ) {
    return this.expensesService.getResumenGastosPorCategoria(
      puntoVentaId,
      fechaInicio,
      fechaFin,
    );
  }

  @Query(() => BalanceUtilidades)
  getBalanceUtilidades(
    @Args('puntoVentaId') puntoVentaId: string,
    @Args('fechaInicio') fechaInicio: string,
    @Args('fechaFin') fechaFin: string,
  ) {
    return this.expensesService.getBalanceUtilidades(
      puntoVentaId,
      fechaInicio,
      fechaFin,
    );
  }
}

