import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class CategoriaGasto {
  @Field(() => ID)
  id: string;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field()
  activo: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

