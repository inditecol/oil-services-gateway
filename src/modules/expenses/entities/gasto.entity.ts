import { ObjectType, Field, Float, ID } from '@nestjs/graphql';
import { CategoriaGasto } from './categoria-gasto.entity';

@ObjectType()
export class Gasto {
  @Field(() => ID)
  id: string;

  @Field()
  puntoVentaId: string;

  @Field()
  categoriaGastoId: string;

  @Field()
  concepto: string;

  @Field(() => Float)
  monto: number;

  @Field()
  fecha: Date;

  @Field()
  metodoPago: string;

  @Field({ nullable: true })
  numeroComprobante?: string;

  @Field({ nullable: true })
  proveedor?: string;

  @Field({ nullable: true })
  empleado?: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field({ nullable: true })
  comprobante?: string;

  @Field()
  aprobado: boolean;

  @Field({ nullable: true })
  aprobadoPor?: string;

  @Field({ nullable: true })
  fechaAprobacion?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relaciones
  @Field(() => CategoriaGasto, { nullable: true })
  categoria?: CategoriaGasto;
}

