import { ObjectType, Field, Float, Int, ID } from '@nestjs/graphql';
import { Producto } from './producto.entity';

@ObjectType()
export class ConsolidadoProductosVendidos {
  @Field(() => ID)
  productoId: string;

  @Field(() => Producto)
  producto: Producto;

  @Field(() => Float)
  cantidadTotalVendida: number;

  @Field(() => Float)
  valorTotalVentas: number;

  @Field(() => Float)
  precioPromedio: number;

  @Field(() => Int)
  numeroVentas: number;

  @Field(() => Float)
  rentabilidad: number; // Margen de ganancia
}

@ObjectType()
export class ResumenVentasProductos {
  @Field(() => Float)
  totalVentas: number;

  @Field(() => Float)
  totalCantidad: number;

  @Field(() => Int)
  totalTransacciones: number;

  @Field(() => Float)
  promedioPorVenta: number;

  @Field(() => [ConsolidadoProductosVendidos])
  productosVendidos: ConsolidadoProductosVendidos[];
}
