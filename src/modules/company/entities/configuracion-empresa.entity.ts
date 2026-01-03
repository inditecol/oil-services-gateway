import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class ConfiguracionEmpresa {
  @Field(() => ID)
  id: string;

  @Field()
  empresaId: string;

  @Field()
  seleccionPorProducto: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class ConfiguracionEmpresaPayload {
  @Field()
  seleccionPorProducto: boolean;
}

