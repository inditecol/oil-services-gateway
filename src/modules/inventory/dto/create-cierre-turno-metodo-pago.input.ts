import { InputType, Field, Float, ID } from '@nestjs/graphql';
import { IsString, IsNumber, IsOptional, Min, IsNotEmpty } from 'class-validator';

@InputType()
export class CreateCierreTurnoMetodoPagoInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'El ID del cierre de turno es requerido' })
  cierreTurnoId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty({ message: 'El ID del método de pago es requerido' })
  metodoPagoId: string;

  @Field(() => Float)
  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto debe ser mayor o igual a 0' })
  monto: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

