import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

@InputType()
export class CreateGastoInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  puntoVentaId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  categoriaGastoId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  concepto: string;

  @Field(() => Float)
  @IsNumber()
  @IsNotEmpty()
  monto: number;

  @Field()
  @IsDateString()
  @IsNotEmpty()
  fecha: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  metodoPago: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  numeroComprobante?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  proveedor?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  empleado?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  comprobante?: string;
}

