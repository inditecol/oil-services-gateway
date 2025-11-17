import { InputType, Field, Float } from '@nestjs/graphql';
import { IsOptional, IsNumber, IsString, IsDateString, IsBoolean } from 'class-validator';

@InputType()
export class UpdateGastoInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  concepto?: string;

  @Field(() => Float, { nullable: true })
  @IsNumber()
  @IsOptional()
  monto?: number;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  fecha?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  metodoPago?: string;

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

  @Field({ nullable: true })
  @IsBoolean()
  @IsOptional()
  aprobado?: boolean;
}

