import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

@InputType()
export class UpdateConfiguracionEmpresaDto {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'El ID de la empresa es requerido' })
  empresaId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  seleccionPorProducto?: boolean;
}

