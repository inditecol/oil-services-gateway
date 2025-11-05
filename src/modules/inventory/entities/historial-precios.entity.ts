import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class HistorialPrecios {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productoId: string;

  @Field(() => Float)
  precioAnterior: number;

  @Field(() => Float)
  precioNuevo: number;

  @Field(() => Float)
  diferencia: number;

  @Field(() => Float)
  porcentajeCambio: number;

  @Field({ nullable: true })
  motivo?: string;

  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  fechaCambio: Date;

  @Field(() => ID)
  usuarioId: string;

  @Field()
  createdAt: Date;

  // Relaciones
  @Field(() => User, { nullable: true })
  usuario?: User;
}

@ObjectType()
export class HistorialPreciosResponse {
  @Field(() => [HistorialPrecios])
  historial: HistorialPrecios[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int)
  currentPage: number;
}
