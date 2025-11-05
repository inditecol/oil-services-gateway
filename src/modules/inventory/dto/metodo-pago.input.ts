import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber, IsPositive } from 'class-validator';

@InputType()
export class CrearMetodoPagoInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  codigo: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @Field({ defaultValue: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean = true;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  esEfectivo?: boolean = false;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  esTarjeta?: boolean = false;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  esDigital?: boolean = false;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  orden?: number = 0;
}

@InputType()
export class ActualizarMetodoPagoInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  codigo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nombre?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esEfectivo?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esTarjeta?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esDigital?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  orden?: number;
}

@InputType()
export class FiltrosMetodosPagoInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  codigo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esEfectivo?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esTarjeta?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  esDigital?: boolean;
}
