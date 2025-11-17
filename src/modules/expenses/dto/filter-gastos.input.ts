import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';

@InputType()
export class FilterGastosInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  puntoVentaId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  categoriaGastoId?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  aprobado?: boolean;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  proveedor?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  empleado?: string;
}

