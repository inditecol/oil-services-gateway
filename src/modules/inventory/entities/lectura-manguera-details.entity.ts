import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class ProductoDetails {
  @Field(() => ID)
  id: string;

  @Field()
  codigo: string;

  @Field()
  nombre: string;

  @Field(() => Float)
  precioVenta: number;

  @Field()
  unidadMedida: string;
}

@ObjectType()
export class SurtidorDetails {
  @Field(() => ID)
  id: string;

  @Field()
  numero: string;

  @Field({ nullable: true })
  nombre?: string;
}

@ObjectType()
export class MangueraDetails {
  @Field(() => ID)
  id: string;

  @Field()
  numero: string;

  @Field(() => ProductoDetails)
  producto: ProductoDetails;

  @Field(() => SurtidorDetails)
  surtidor: SurtidorDetails;
}

@ObjectType()
export class LecturaMangueraDetails {
  @Field(() => ID)
  id: string;

  @Field(() => Float)
  lecturaAnterior: number;

  @Field(() => Float)
  lecturaActual: number;

  @Field(() => Float)
  cantidadVendida: number;

  @Field(() => Float)
  valorVenta: number;

  @Field(() => MangueraDetails)
  manguera: MangueraDetails;

  @Field(() => ID)
  cierreTurnoId: string;
}

