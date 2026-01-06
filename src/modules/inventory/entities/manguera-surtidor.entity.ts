import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { Producto } from './producto.entity';
import { Surtidor } from './surtidor.entity';

@ObjectType()
export class MangueraSurtidor {
  @Field(() => ID)
  id: string;

  @Field()
  numero: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Float)
  lecturaAnterior: number;

  @Field(() => Float)
  lecturaActual: number;

  @Field()
  activo: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  surtidorId: string;

  @Field(() => Surtidor, { nullable: true })
  surtidor?: Surtidor;

  @Field(() => ID)
  productoId: string;

  @Field(() => Producto)
  producto: Producto;
} 