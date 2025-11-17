import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class ResumenGastos {
  @Field()
  categoria: string;

  @Field(() => Float)
  total: number;

  @Field()
  cantidad: number;
}

@ObjectType()
export class BalanceUtilidades {
  @Field(() => Float)
  ventasTotales: number;

  @Field(() => Float)
  costoMercancia: number;

  @Field(() => Float)
  utilidadBruta: number;

  @Field(() => Float)
  gastosOperacionales: number;

  @Field(() => Float)
  gastosNomina: number;

  @Field(() => Float)
  gastosProveedores: number;

  @Field(() => Float)
  otrosGastos: number;

  @Field(() => Float)
  totalGastos: number;

  @Field(() => Float)
  utilidadNeta: number;

  @Field(() => Float)
  margenUtilidad: number;

  @Field(() => [ResumenGastos])
  detalleGastos: ResumenGastos[];
}

