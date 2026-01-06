import { InputType, Field, Float, ID } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

@InputType()
export class UpdateMovimientoEfectivoInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'El ID del movimiento de efectivo es requerido' })
  id: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' })
  monto?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  concepto?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  detalle?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

