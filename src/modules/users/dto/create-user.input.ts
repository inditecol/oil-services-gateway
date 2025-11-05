import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString, IsArray } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  email: string;

  @Field()
  @IsNotEmpty({ message: 'El nombre de usuario es requerido' })
  @IsString({ message: 'El nombre de usuario debe ser una cadena' })
  username: string;

  @Field()
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @Field()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena' })
  nombre: string;

  @Field()
  @IsNotEmpty({ message: 'El apellido es requerido' })
  @IsString({ message: 'El apellido debe ser una cadena' })
  apellido: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena' })
  telefono?: string;

  @Field()
  @IsNotEmpty({ message: 'El tipo de documento es requerido' })
  @IsString({ message: 'El tipo de documento debe ser una cadena' })
  tipoDeDocumento: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'El número de identificación es requerido' })
  numeroDeIdentificacion: number;

  @Field()
  @IsNotEmpty({ message: 'El rol es requerido' })
  @IsString({ message: 'El rol debe ser una cadena' })
  rolId: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray({ message: 'Los puntos de venta deben ser un array' })
  @IsString({ each: true, message: 'Cada punto de venta debe ser una cadena' })
  puntosVentaIds?: string[];
} 