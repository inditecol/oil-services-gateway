import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

@InputType()
export class CreateConfiguracionEmpresaDto {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'El ID de la empresa es requerido' })
  empresaId: string;

  @Field({ defaultValue: false })
  @IsBoolean()
  seleccionPorProducto: boolean;
}

