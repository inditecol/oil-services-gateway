import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class Caja {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  puntoVentaId: string;

  @Field(() => Float)
  saldoActual: number;

  @Field(() => Float)
  saldoInicial: number;

  @Field({ nullable: true })
  fechaUltimoMovimiento?: Date;

  @Field()
  activa: boolean;

  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
