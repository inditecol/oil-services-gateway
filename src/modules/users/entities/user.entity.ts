import { ObjectType, Field, ID, HideField } from '@nestjs/graphql';
import { Rol } from './rol.entity';
import { PointOfSale } from '../../point-of-sale/entities/point-of-sale.entity';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @HideField()
  password: string;

  @Field()
  nombre: string;

  @Field()
  apellido: string;

  @Field({ nullable: true })
  telefono?: string;

  @Field({ nullable: true })
  tipoDeDocumento?: string;

  @Field(() => String, { nullable: true })
  numeroDeIdentificacion?: string;

  @Field()
  activo: boolean;

  @Field()
  emailVerified: boolean;

  @Field({ nullable: true })
  ultimoLogin?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relaciones
  @Field()
  rolId: string;

  @Field(() => Rol)
  rol: Rol;

  @Field(() => [PointOfSale])
  puntosVenta: PointOfSale[];
} 