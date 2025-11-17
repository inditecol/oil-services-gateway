import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Categoria } from './categoria.entity';
import { PointOfSale } from '../../point-of-sale/entities/point-of-sale.entity';

@ObjectType()
export class Producto {
  @Field(() => ID)
  id: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field()
  unidadMedida: string;

  @Field(() => Float)
  precioCompra: number;

  @Field(() => Float)
  precioVenta: number;

  @Field()
  moneda: string; // Código ISO de la moneda (COP, USD, EUR, etc.)

  // Campos calculados
  @Field(() => Float, { nullable: true })
  utilidad?: number; // precioVenta - precioCompra

  @Field(() => Float, { nullable: true })
  margenUtilidad?: number; // ((precioVenta - precioCompra) / precioVenta) * 100

  @Field(() => Float, { nullable: true })
  porcentajeGanancia?: number; // ((precioVenta - precioCompra) / precioCompra) * 100

  @Field(() => Int)
  stockMinimo: number;

  @Field(() => Int)
  stockActual: number;

  @Field(() => String, { nullable: true })
  tipoProducto?: string;

  @Field(() => Int, { nullable: true })
  codigoPlu?: number;

  @Field({ nullable: true })
  puntoVentaId?: string;

  @Field(() => PointOfSale, { nullable: true })
  puntoVenta?: PointOfSale;

  @Field()
  esCombustible: boolean;

  @Field()
  activo: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relaciones
  @Field()
  categoriaId: string;

  @Field(() => Categoria, { nullable: true })
  categoria?: Categoria;
}

@ObjectType()
export class ProductListResponse {
  @Field(() => [Producto])
  products: Producto[];

  @Field()
  total: number;

  @Field()
  page: number;

  @Field()
  limit: number;

  @Field()
  totalPages: number;
} 