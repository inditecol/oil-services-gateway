import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class MetodoPago {
  @Field(() => ID)
  id: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field()
  activo: boolean;

  @Field()
  esEfectivo: boolean;

  @Field()
  esTarjeta: boolean;

  @Field()
  esDigital: boolean;

  @Field(() => Int)
  orden: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}