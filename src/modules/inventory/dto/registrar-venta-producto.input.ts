import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsPositive, IsUUID } from 'class-validator';

@InputType()
export class RegistrarVentaProductoInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsUUID()
  productoId: string;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  cantidadVendida: number;

  @Field(() => Float)
  @IsNumber()
  @IsPositive()
  precioUnitario: number;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  unidadMedida: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  metodoPagoCodigo: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsUUID()
  usuarioId: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsUUID()
  turnoId: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsUUID()
  puntoVentaId: string;
}

@InputType()
export class FiltrosVentasProductosInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  productoId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  metodoPagoCodigo?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  turnoId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  puntoVentaId?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fechaInicio?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fechaFin?: Date;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  limit?: number = 10;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  offset?: number = 0;
}

@InputType()
export class FiltrosReporteVentasInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  productoId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsUUID()
  puntoVentaId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  codigoPuntoVenta?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fechaInicio?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  fechaFin?: Date;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  agrupacion?: 'dia' | 'mes' | 'año' | 'producto' | 'puntoVenta';
}

@InputType()
export class UpdateHistorialVentaProductoInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cantidadVendida?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  precioUnitario?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;
}